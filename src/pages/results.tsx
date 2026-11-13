import { Activity, Download, FileHeart, FileText, Printer, Search } from 'lucide-react';
import { useCallback, useState } from 'react';
import { portalApi } from '../api';
import { isDemoSession } from '../demo';
import { PublishedResultsPage, PublishedPdfModal } from './published-results';
import { Modal } from '../components/modal';
import { Alert, EmptyState, PageError, PageLoading, PageTitle, ResultsTable } from '../components/shared';
import { dateTime, shortDate } from '../format';
import { useLoad } from '../hooks/use-load';
import { downloadFile, recordDate, resultKey, resultTimestamp } from '../record-tools';
import { reportModel } from '../report-model';
import type { DiagnosticResult, PatientProfile, ResultDetails } from '../types';

function LegacyResultsPage({ token, patient }: { token: string; patient: PatientProfile }) {
  const state = useLoad(useCallback(() => portalApi.getResults(token), [token]));
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState<DiagnosticResult | null>(null);
  if (state.loading) return <PageLoading />;
  if (state.error || !state.data) return <PageError message={state.error} retry={state.reload} />;
  const departments = [...new Map(state.data.map((result) => [result.departmentCode, result.department])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const invalidDates = Boolean(from && to && from > to);
  const filtered = state.data.filter((result) => {
    const date = recordDate(resultTimestamp(result));
    return `${result.description} ${result.department} ${result.examinationNo || ''}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (department === 'all' || result.departmentCode === department) && (!from || date >= from) && (!to || date <= to);
  }).sort((a, b) => sort === 'oldest'
    ? resultTimestamp(a).localeCompare(resultTimestamp(b))
    : resultTimestamp(b).localeCompare(resultTimestamp(a)));
  const reset = () => { setQuery(''); setDepartment('all'); setFrom(''); setTo(''); setSort('newest'); };
  return <div className="page-stack">
    <PageTitle eyebrow="Clinical records" title="Diagnostic results" copy="Your reports validated and released by the hospital." />
    <div className="toolbar"><label className="search-box"><Search size={18} aria-hidden="true" /><span className="sr-only">Search diagnostic results</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search examination or report number" /></label><span className="record-count" role="status">{invalidDates ? 0 : filtered.length} result{filtered.length === 1 ? '' : 's'}</span></div>
    <div className="filter-grid results-filters">
      <label className="field">Department<select aria-label="Department" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="all">All departments</option>{departments.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <label className="field">Released from<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="field">Released to<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
      <label className="field">Sort by<select aria-label="Sort by" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      <button className="button button-secondary filter-reset" onClick={reset}>Clear filters</button>
    </div>
    {invalidDates && <Alert tone="error">Choose a to date on or after the from date.</Alert>}
    <section className="card table-card">{!invalidDates && filtered.length ? <ResultsTable results={filtered} onOpen={setSelected} /> : <EmptyState icon={FileHeart}
      title={state.data.length ? 'No matching results' : 'No released results yet'}
      copy={state.data.length ? 'Try a different search or clear the filters to see your released reports.' : 'Reports appear after the hospital validates and releases them.'}
      action={state.data.length ? <button className="button button-secondary" onClick={reset}>Clear filters</button> : undefined} />}</section>
    {selected && <ResultModal key={resultKey(selected)} token={token} patient={patient} result={selected} onClose={() => setSelected(null)} />}
  </div>;
}

function LegacyResultModal({ token, patient, result, onClose }: {
  token: string; patient: PatientProfile; result: DiagnosticResult; onClose: () => void;
}) {
  const state = useLoad(useCallback(() => portalApi.getResultDetails(token, result.departmentCode, result.examinationId), [token, result.departmentCode, result.examinationId]));
  const [notice, setNotice] = useState('');
  const model = state.data ? reportModel(state.data) : null;
  const hasContent = Boolean(model && (model.meta.length || model.narratives.length || model.readings.length));
  function downloadReport() {
    if (!model || !hasContent) return;
    const lines = ['Patient portal — released report copy', result.description, `Patient: ${patient.fullName}`, `Report no.: ${result.examinationNo || 'Not recorded'}`, `Department: ${result.department}`, `Released: ${dateTime(result.validatedDate)}`, '',
      ...model.meta.map((field) => `${field.label}: ${field.value}`), '',
      ...model.narratives.map((field) => `${field.label}\n${field.value}\n`),
      ...model.readings.flatMap((reading) => [reading.title, ...reading.fields.map((field) => `${field.label}: ${field.value}`), '']),
      'Discuss these findings with your doctor. This portal does not provide medical interpretation.',
      'This is a portal copy of the released report, not a signed original.'];
    downloadFile(lines.join('\n'), 'released-report.txt', 'text/plain;charset=utf-8');
    setNotice('Report copy downloaded. Keep it private on shared devices.');
  }
  return <Modal title={result.description} onClose={onClose} wide className="report-modal">
    <div className="report-actions no-print"><button className="button button-secondary" disabled={!hasContent} onClick={() => window.print()}><Printer size={17} /> Print / Save PDF</button><button className="button button-secondary" disabled={!hasContent} onClick={downloadReport}><Download size={17} /> Download text copy</button></div>
    {notice && <div className="no-print"><Alert tone="success">{notice}</Alert></div>}
    <article className="printable-report">
      <div className="report-heading"><span className="eyebrow">Released diagnostic report</span><h2>{result.description}</h2><p>Patient: <strong>{patient.fullName}</strong></p></div>
      <div className="report-meta"><span><strong>Report no.</strong>{result.examinationNo || '—'}</span><span><strong>Released</strong>{dateTime(result.validatedDate)}</span><span><strong>Department</strong>{result.department}</span><span><strong>Performed</strong>{shortDate(result.examinationDate)}</span></div>
      {state.loading ? <PageLoading compact /> : state.error || !state.data ? <PageError message={state.error} retry={state.reload} compact /> : <ResultDocument result={state.data} />}
      <p className="report-copy-note">This is a portal copy of the released report, not a signed original.</p>
      <Alert tone="info"><Activity size={18} /> Discuss these findings with your doctor. This portal does not provide medical interpretation.</Alert>
    </article>
  </Modal>;
}

function ResultDocument({ result }: { result: ResultDetails }) {
  const model = reportModel(result);
  if (!model.meta.length && !model.narratives.length && !model.readings.length) return <EmptyState icon={FileText} title="Report details are unavailable" copy="Please contact the diagnostic department for a copy." />;
  return <div className="result-document">
    {model.meta.length > 0 && <dl className="result-summary">{model.meta.map((field, index) => <div key={`${field.label}-${index}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>}
    {model.narratives.map((field, index) => <section className="report-narrative" key={`${field.label}-${index}`}><h3>{field.label}</h3><p>{field.value}</p></section>)}
    {model.readings.map((reading, index) => <section className={model.laboratory ? 'laboratory-reading' : 'report-narrative'} key={index}>
      <h3>{reading.title}</h3>
      <dl className="report-reading-fields">{reading.fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value || 'Not recorded'}</dd></div>)}</dl>
    </section>)}
  </div>;
}

export function ResultsPage(props: { token: string; patient: PatientProfile }) {
  const [selected, setSelected] = useState<DiagnosticResult | null>(null);
  return isDemoSession(props.token) ? <LegacyResultsPage {...props} /> : <>
    <PublishedResultsPage token={props.token} onOpen={setSelected} />
    {selected && <ResultModal key={resultKey(selected)} {...props} result={selected} onClose={() => setSelected(null)} />}
  </>;
}
export function ResultModal(props: { token: string; patient: PatientProfile; result: DiagnosticResult; onClose: () => void }) {
  return props.result.onlineResultId ? <PublishedPdfModal {...props} resultId={props.result.onlineResultId} /> : <LegacyResultModal {...props} />;
}
