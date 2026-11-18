using Microsoft.Extensions.Configuration;
using System.Globalization;
using System.Reflection;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using H = hims_web_api.Services.OnlineResults;
using P = api.Services.OnlineResults;

if (args.Contains("--verify-live-render"))
{
    var apiRoot = @"C:\Users\Trainee\ncbsi\hims_web_api";
    var environment = new EnvironmentStub { EnvironmentName="Development", ContentRootPath=apiRoot, WebRootPath=Path.Combine(apiRoot,"wwwroot") };
    var configuration = new Microsoft.Extensions.Configuration.ConfigurationBuilder().AddJsonFile(Path.Combine(apiRoot,"appsettings.json")).Build();
    var context = new hims_web_api.Data.MainContext(environment,configuration);
    var renderer = new H.OnlineResultRenderer(context,environment);
    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(90));
    using var connection = context.CreateConnection();
    foreach (var source in new[] { "Laboratory","Radiology","EchocardiographicStudy" })
    {
        var candidate = await Dapper.SqlMapper.QueryFirstOrDefaultAsync<H.ResultCandidate>(connection,
            "SELECT TOP (1) * FROM HIMS_ONLINE.dbo.vw_ResultCandidates WHERE SourceTable=@Source ORDER BY ExaminationId",new { Source=source });
        if (candidate == null) throw new InvalidOperationException("No eligible source exists for read-only render verification.");
        var pdf = await renderer.RenderAsync(candidate,timeout.Token);
        if (pdf.Length<5 || !pdf.AsSpan(0,5).SequenceEqual("%PDF-"u8)) throw new InvalidDataException("Invalid PDF.");
        Console.WriteLine("PASS Read-only "+source+" RDL render; PDF bytes="+pdf.Length);
        Array.Clear(pdf);
    }
    return;
}

var tests = new List<(string Name, Func<Task> Run)>();
void Test(string name, Func<Task> test) => tests.Add((name,test));
H.ResultCandidate Candidate(int id = 1) => new() { SourceTable="Laboratory",ExaminationId=id,PatientId=7,PatientNo="SYN-7",PatientName="Synthetic patient",Description="Synthetic examination",DoctorCode="1",ValidatedDate=new(2026,11,13),Revision=SHA256.HashData(BitConverter.GetBytes(id)) };
H.OnlineResultPublisher Worker(Repo repo, Renderer renderer, Files files) => new(repo,renderer,files,Options.Create(new H.OnlineResultsOptions { Enabled=true }),NullLogger<H.OnlineResultPublisher>.Instance);
Test("Publisher backfills eligible reports once without duplicates",async()=>{
 var c=Candidate();var repo=new Repo([c]);var renderer=new Renderer();var files=new Files();var worker=Worker(repo,renderer,files);
 Check(await worker.RunOnceAsync(default)==1,"Initial backfill");Check(await worker.RunOnceAsync(default)==0,"Already published");Check(renderer.Calls==1&&files.Saved.Count==1,"Single PDF");
});
Test("Publisher recreates a missing saved PDF through the same backfill path",async()=>{
 var c=Candidate();var repo=new Repo([c]);repo.Published.Add(c.ExaminationId);repo.ToCheck.Add(new(c.ExaminationId,Guid.NewGuid().ToString("N")+".pdf"));var files=new Files();
 Check(await Worker(repo,new Renderer(),files).RunOnceAsync(default)==1&&repo.Forgotten==1&&files.Saved.Count==1,"Missing publication recovered");
});
Test("Publisher rejects withdrawal before rendering",async()=>{
 var repo=new Repo([Candidate()]) { Current= _=>null };var renderer=new Renderer();var files=new Files();Check(await Worker(repo,renderer,files).RunOnceAsync(default)==0,"No publication");Check(renderer.Calls==0&&files.Saved.Count==0,"No PDF");
});
Test("Publisher rejects source changes during rendering",async()=>{
 var c=Candidate();var repo=new Repo([c]);var renderer=new Renderer { OnRender=_=>{repo.Current=_=>Candidate(2);return "%PDF-synthetic"u8.ToArray();} };var files=new Files();
 Check(await Worker(repo,renderer,files).RunOnceAsync(default)==0&&files.Saved.Count==0,"Changed result cannot be published");
});
Test("Publisher isolates render failures and retries failed reports",async()=>{
 var repo=new Repo([Candidate(),Candidate(2)]);var renderer=new Renderer { OnRender=c=>c.ExaminationId==1?throw new InvalidDataException():"%PDF-synthetic"u8.ToArray() };var files=new Files();var worker=Worker(repo,renderer,files);
 Check(await worker.RunOnceAsync(default)==1,"Other results continue");renderer.OnRender=null;Check(await worker.RunOnceAsync(default)==1,"Failed result retries");
});
Test("Publisher never advertises failed storage or invalid PDF bytes",async()=>{
 foreach(var invalid in new[]{true,false}) {var repo=new Repo([Candidate()]);var renderer=new Renderer { OnRender=_=>invalid?"not-pdf"u8.ToArray():"%PDF-synthetic"u8.ToArray() };var files=new Files { FailSave=!invalid };Check(await Worker(repo,renderer,files).RunOnceAsync(default)==0&&repo.Published.Count==0,"No metadata for invalid/missing file");}
});
Test("Publisher preserves files after an ambiguous committed acknowledgement",async()=>{
 var repo=new Repo([Candidate()]){ThrowAfterCommit=true};var files=new Files();Check(await Worker(repo,new Renderer(),files).RunOnceAsync(default)==0,"Failure is not reported as success");Check(repo.Published.Count==1&&files.Saved.Count==1,"Possibly committed PDF remains readable");
});
Test("Publisher removes only definitely unpublished files",async()=>{
 var repo=new Repo([Candidate()]){AcceptPublication=false};var files=new Files();Check(await Worker(repo,new Renderer(),files).RunOnceAsync(default)==0&&files.Saved.Count==0,"Rejected file removed");
});
Test("Publisher requires the configured private directory and honors cancellation",async()=>{
 var repo=new Repo([Candidate()]);await Throws<DirectoryNotFoundException>(()=>Worker(repo,new Renderer(),new Files{IsReady=false}).RunOnceAsync(default));Check(repo.PendingCalls==0,"No work against missing share");
 using var cancel=new CancellationTokenSource();cancel.Cancel();await Throws<OperationCanceledException>(()=>Worker(repo,new Renderer(),new Files()).RunOnceAsync(cancel.Token));
});
Test("Portal filters enforce bounded pages dates and literal search",()=>{
 var q=new P.PublishedResultQuery { Search="%_[~",Page=2 }.Validate();Check(q.Search=="%~%~_~[~~%"&&q.Offset==50,"Literal search and bounded offset");
 foreach(var q2 in new[]{new P.PublishedResultQuery{Page=0},new P.PublishedResultQuery{Department="INVALID"},new P.PublishedResultQuery{Sort="invalid"},new P.PublishedResultQuery{From="2026-11-14",To="2026-11-13"},new P.PublishedResultQuery{From="invalid"},new P.PublishedResultQuery{Search=new string('x',151)}}) ThrowsSync<ArgumentException>(()=>q2.Validate());return Task.CompletedTask;
});
Test("Portal query binding defaults omitted and blank filters", async () =>
{
    foreach (var queryString in new[] { "", "?search=%20&department=&from=&to=&sort=&page=" })
    {
        var (query, isValid) = await BindPublishedQueryAsync(queryString);
        Check(isValid && query != null, "Optional filters bind without MVC validation errors");
        var filters = query!.Validate();
        Check(filters is { Search: null, Department: "", From: null, Before: null, OldestFirst: false, Page: 1 },
            "Default filters use the first page and newest-first order");
    }
});
Test("Portal query binding rejects a malformed page", async () =>
{
    var (_, isValid) = await BindPublishedQueryAsync("?page=first");
    Check(!isValid, "MVC reports a nonnumeric page as invalid");
});
P.OnlineResultReader Reader(Catalog catalog, PortalFiles files) => new(catalog,files,Options.Create(new P.OnlineResultsOptions{Enabled=true}));
Test("Portal PDF denies other patients unknown results and withdrawn copies",async()=>{
 var catalog=new Catalog();var files=new PortalFiles();var reader=Reader(catalog,files);Check(await reader.OpenAsync(99,1,default)==null&&files.Opens==0,"Other patient denied");Check(await reader.OpenAsync(7,99,default)==null,"Unknown result denied");catalog.Withdrawn=true;Check(await reader.OpenAsync(7,1,default)==null&&files.Opens==0,"Withdrawn denied");
});
Test("Portal PDF rechecks authorization after opening and disposes withdrawn streams",async()=>{
 var catalog=new Catalog();var files=new PortalFiles { OnOpen=()=>catalog.Withdrawn=true };Check(await Reader(catalog,files).OpenAsync(7,1,default)==null,"Withdrawal while opening denied");Check(files.Stream is{Disposed:true},"Stream disposed");
});
Test("Portal PDF rejects unsafe filenames and surfaces missing files",async()=>{
 var catalog=new Catalog { Filename="../private.pdf" };var files=new PortalFiles();await Throws<InvalidDataException>(()=>Reader(catalog,files).OpenAsync(7,1,default));Check(files.Opens==0,"Traversal never reaches filesystem");catalog.Filename=Guid.NewGuid().ToString("N")+".pdf";files.Missing=true;await Throws<FileNotFoundException>(()=>Reader(catalog,files).OpenAsync(7,1,default));
});
Test("Portal PDF uses the authenticated patient and returns a private response",async()=>{
 var catalog=new Catalog();var files=new PortalFiles();var controller=Controller(Reader(catalog,files),new(1,7,"SYN-7","synthetic@example.invalid",false));var response=await controller.PublishedResultPdf(1,default);Check(response is FileStreamResult {ContentType:"application/pdf"},"PDF response");Check(catalog.LastPatient==7,"Session patient enforced");Check(controller.Response.Headers.CacheControl.ToString()=="no-store, private","No cache");((FileStreamResult)response).FileStream.Dispose();
});
Test("Portal endpoints require sign in and changed temporary passwords",async()=>{
 var reader=Reader(new Catalog(),new PortalFiles());var controller=Controller(reader,null);Check(await controller.PublishedResultPdf(1,default) is UnauthorizedObjectResult,"No sign-in");controller=Controller(reader,new(1,7,"SYN-7","synthetic@example.invalid",true));Check(await controller.PublishedResultPdf(1,default) is ObjectResult {StatusCode:403},"Temporary-password account denied");Check(await controller.PublishedResults(new(),default) is ObjectResult{StatusCode:403},"List also denied");
});
Test("Temporary-password sessions can change their password", async () =>
{
    var account = new api.Models.PatientPortalAccountContext(1, 7, "SYN-7", "synthetic@example.invalid", true);
    var controller = ControllerWithPortal(Reader(new Catalog(), new PortalFiles()), account, out var portal);
    var response = await controller.ChangePassword(new api.Models.PatientPortalPasswordRequest
    {
        CurrentPassword = "synthetic-current",
        NewPassword = "synthetic-replacement"
    });

    Check(response is OkObjectResult, "An authenticated temporary-password session can change its password");
    Check(portal.PasswordChange == (account, "synthetic-current", "synthetic-replacement", "synthetic-only"),
        "The password change uses the authenticated account and current session");
});
Test("Portal list passes patient identity and filters and returns recoverable storage errors",async()=>{
 var catalog=new Catalog();var files=new PortalFiles{Missing=true};var controller=Controller(Reader(catalog,files),new(1,7,"SYN-7","synthetic@example.invalid",false));Check(await controller.PublishedResults(new(){Page=3,Department="LAB"},default) is OkObjectResult,"List response");Check(catalog.LastPatient==7&&catalog.LastQuery?.Offset==100&&catalog.LastQuery.Department=="LAB","Scoped paged filters");Check(await controller.PublishedResultPdf(1,default) is ObjectResult{StatusCode:503},"Missing file retryable");
});
Test("Private PDF storage is atomic rejects traversal and never overwrites",async()=>{
 var temp=Path.Combine(Path.GetTempPath(),"online-result-tests-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(temp);
 try {var env=new EnvironmentStub{WebRootPath=Path.Combine(temp,"wwwroot")};var storage=new H.OnlineResultFiles(Options.Create(new H.OnlineResultsOptions{StoragePath=Path.Combine(temp,"private")}),env);Check(!storage.IsReady,"No auto-creation of missing share");Directory.CreateDirectory(Path.Combine(temp,"private"));var file=Guid.NewGuid().ToString("N")+".pdf";await storage.SaveAsync(file,"%PDF-synthetic"u8.ToArray(),default);Check(File.ReadAllText(Path.Combine(temp,"private",file))=="%PDF-synthetic","Complete PDF");await Throws<IOException>(()=>storage.SaveAsync(file,"%PDF-changed"u8.ToArray(),default));await Throws<ArgumentException>(()=>storage.SaveAsync("../outside.pdf",[],default));Check(Directory.GetFiles(Path.Combine(temp,"private")).Length==1,"No staging leftovers");ThrowsSync<InvalidOperationException>(()=>new H.OnlineResultFiles(Options.Create(new H.OnlineResultsOptions{StoragePath=env.WebRootPath}),env));}
 finally {if(Path.GetFullPath(temp).StartsWith(Path.GetFullPath(Path.GetTempPath()),StringComparison.OrdinalIgnoreCase)&&Path.GetFileName(temp).StartsWith("online-result-tests-",StringComparison.Ordinal))Directory.Delete(temp,true);}
});
foreach(var test in tests){await test.Run();Console.WriteLine("PASS "+test.Name);}Console.WriteLine($"Passed {tests.Count} tests; no live database connections or account writes.");
static void Check(bool value,string message){if(!value)throw new Exception(message);}
static async Task Throws<T>(Func<Task> action)where T:Exception{try{await action();}catch(T){return;}throw new Exception("Expected "+typeof(T).Name);}
static void ThrowsSync<T>(Action action)where T:Exception{try{action();}catch(T){return;}throw new Exception("Expected "+typeof(T).Name);}
static async Task<(P.PublishedResultQuery? Query, bool IsValid)> BindPublishedQueryAsync(string queryString)
{
    var registrations = new ServiceCollection();
    registrations.AddLogging();
    registrations.AddControllers();
    await using var services = registrations.BuildServiceProvider();

    var http = new DefaultHttpContext { RequestServices = services };
    http.Request.QueryString = new QueryString(queryString);
    var action = new ActionContext(http, new RouteData(), new ActionDescriptor());
    var metadata = services.GetRequiredService<IModelMetadataProvider>().GetMetadataForType(typeof(P.PublishedResultQuery));
    var info = new BindingInfo { BindingSource = BindingSource.Query };
    var values = new QueryStringValueProvider(BindingSource.Query, http.Request.Query, CultureInfo.InvariantCulture);
    var binder = services.GetRequiredService<IModelBinderFactory>().CreateBinder(new ModelBinderFactoryContext
    {
        Metadata = metadata,
        BindingInfo = info
    });
    var binding = DefaultModelBindingContext.CreateBindingContext(action, values, metadata, info, "");
    await binder.BindModelAsync(binding);
    services.GetRequiredService<IObjectModelValidator>().Validate(action, binding.ValidationState, binding.ModelName, binding.Result.Model);
    return (binding.Result.Model as P.PublishedResultQuery, action.ModelState.IsValid);
}

static api.Controllers.PatientPortalController Controller(P.OnlineResultReader reader, api.Models.PatientPortalAccountContext? account)
    => ControllerWithPortal(reader, account, out _);

static api.Controllers.PatientPortalController ControllerWithPortal(P.OnlineResultReader reader, api.Models.PatientPortalAccountContext? account, out PortalProxy portal)
{
    var proxy = DispatchProxy.Create<api.Services.IPatientPortalService, PortalProxy>();
    portal = (PortalProxy)(object)proxy;
    portal.Account = account;
    var controller = new api.Controllers.PatientPortalController(proxy, reader, NullLogger<api.Controllers.PatientPortalController>.Instance)
    {
        ControllerContext = new() { HttpContext = new DefaultHttpContext() }
    };
    controller.Request.Headers.Authorization = "Bearer synthetic-only";
    return controller;
}

public class PortalProxy : DispatchProxy
{
    public api.Models.PatientPortalAccountContext? Account;
    public (api.Models.PatientPortalAccountContext Account, string Current, string New, string Token)? PasswordChange { get; private set; }

    protected override object? Invoke(MethodInfo? method, object?[]? args)
    {
        if (method?.Name == nameof(api.Services.IPatientPortalService.AuthenticateAsync))
            return Task.FromResult(Account);
        if (method?.Name == nameof(api.Services.IPatientPortalService.ChangePasswordAsync)
            && args is [api.Models.PatientPortalAccountContext account, string current, string replacement, string token])
        {
            PasswordChange = (account, current, replacement, token);
            return Task.FromResult(new api.Models.PatientPortalOperationResult(true, "Password updated."));
        }
        throw new NotSupportedException();
    }
}
sealed class Repo(List<H.ResultCandidate> candidates):H.IOnlineResultRepository{
 public readonly HashSet<int> Published=[];public Func<H.ResultCandidate,H.ResultCandidate?>? Current;public bool ThrowAfterCommit;public bool AcceptPublication=true;public int PendingCalls;
 public Task<IReadOnlyList<H.ResultCandidate>> PendingAsync(int size,CancellationToken ct){PendingCalls++;return Task.FromResult<IReadOnlyList<H.ResultCandidate>>(candidates.Where(c=>!Published.Contains(c.ExaminationId)).ToList());}
 public Task<H.ResultCandidate?> CurrentAsync(H.ResultCandidate c,CancellationToken ct)=>Task.FromResult(Current==null?c:Current(c));
 public Task<bool> PublishAsync(H.ResultCandidate c,string filename,CancellationToken ct){if(!AcceptPublication)return Task.FromResult(false);Published.Add(c.ExaminationId);if(ThrowAfterCommit)throw new IOException();return Task.FromResult(true);}
 public Task ReconcileAsync(CancellationToken ct)=>Task.CompletedTask;
 public List<H.PublicationFile> ToCheck=[]; public int Forgotten;
 public Task<IReadOnlyList<H.PublicationFile>> FileBatchAsync(CancellationToken ct)=>Task.FromResult<IReadOnlyList<H.PublicationFile>>(ToCheck);
 public Task ForgetMissingAsync(H.PublicationFile f,CancellationToken ct){Forgotten++;Published.Remove(f.Id);return Task.CompletedTask;}
}
sealed class Renderer:H.IOnlineResultRenderer{public int Calls;public Func<H.ResultCandidate,byte[]>? OnRender;public Task<byte[]> RenderAsync(H.ResultCandidate c,CancellationToken ct){Calls++;return Task.FromResult(OnRender?.Invoke(c)??"%PDF-synthetic"u8.ToArray());}}
sealed class Files:H.IOnlineResultFiles{public bool IsReady{get;set;}=true;public bool FailSave;public HashSet<string> Saved=[];public bool Exists(string f)=>Saved.Contains(f);public Task SaveAsync(string f,byte[] b,CancellationToken ct){if(FailSave)throw new IOException();Saved.Add(f);return Task.CompletedTask;}public void DeleteUnpublished(string f)=>Saved.Remove(f);}
sealed class Catalog:P.IOnlineResultCatalog{public string Filename=Guid.NewGuid().ToString("N")+".pdf";public bool Withdrawn;public int LastPatient;public P.ValidatedResultQuery? LastQuery;public Task<P.PublishedFile?> FindAsync(int patientId,int id,CancellationToken ct){LastPatient=patientId;return Task.FromResult<P.PublishedFile?>(patientId==7&&id==1&&!Withdrawn?new(){Id=id,Filename=Filename}:null);}public Task<P.PublishedResultPage> PageAsync(int patientId,P.ValidatedResultQuery query,CancellationToken ct){LastPatient=patientId;LastQuery=query;return Task.FromResult(new P.PublishedResultPage([],0,query.Page));}}
sealed class TrackedStream:MemoryStream{public bool Disposed;protected override void Dispose(bool disposing){Disposed=true;base.Dispose(disposing);}}
sealed class PortalFiles:P.IOnlineResultFiles{public int Opens;public bool Missing;public Action? OnOpen;public TrackedStream? Stream;public Stream Open(string f){Opens++;if(Missing)throw new FileNotFoundException();OnOpen?.Invoke();return Stream=new();}}
sealed class EnvironmentStub:IWebHostEnvironment{public string ApplicationName{get;set;}="Synthetic";public string EnvironmentName{get;set;}="Testing";public string ContentRootPath{get;set;}=Path.GetTempPath();public IFileProvider ContentRootFileProvider{get;set;}=new NullFileProvider();public string WebRootPath{get;set;}="";public IFileProvider WebRootFileProvider{get;set;}=new NullFileProvider();}
