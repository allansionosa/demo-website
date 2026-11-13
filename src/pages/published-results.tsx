import { Download, ExternalLink, FileHeart, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { portalApi } from '../api';
import { Modal } from '../components/modal';
import { Alert, EmptyState, PageError, PageLoading, PageTitle, ResultsTable } from '../components/shared';
import { dateTime, errorMessage } from '../format';
import { useLoad } from '../hooks/use-load';
import type { DiagnosticResult, PatientProfile } from '../types';

export function PublishedResultsPage({ token, onOpen }: { token: string; onOpen: (result: DiagnosticResult) => void }) {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const invalidDates = Boolean(from && to && from > to);
  const state = useLoad(useCallback(() => invalidDates
    ? Promise.resolve({ items: [], totalCount: 0, page: 1, pageSize: 50 })
    : portalApi.getResultPage(token, { search, department, from, to, sort, page }),
  [token, search, department, from, to, sort, page, invalidDates]));
  const total = state.data?.totalCount ?? 0;
  const change = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  const reset = () => { setSearch(''); setDepartment(''); setFrom(''); setTo(''); setSort('newest'); setPage(1); };
  return <div className="page-stack published-results-page">
    <PageTitle eyebrow="Clinical records" title="Diagnostic results" copy="Your reports validated and released by the hospital." />
    <div className="toolbar"><label className="search-box"><Search size={18} aria-hidden="true" /><span className="sr-only">Search diagnostic results</span><input value={search} maxLength={150} onChange={(event) => change(setSearch, event.target.value)} placeholder="Search examination or report number" /></label><span className="record-count" role="status">{state.loading ? 'Loading reports…' : `${total} result${total === 1 ? '' : 's'}`}</span></div>
    <div className="filter-grid results-filters">
      <label className="field">Department<select aria-label="Department" value={department} onChange={(event) => change(setDepartment, event.target.value)}><option value="">All departments</option>{[['LAB', 'Laboratory'], ['XRA', 'X-ray'], ['CTS', 'CT Scan'], ['MRI', 'MRI'], ['ULT', 'Ultrasound'], ['MAM', 'Mammography'], ['HST', 'Cardiology']].map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <label className="field">Released from<input type="date" value={from} onChange={(event) => change(setFrom, event.target.value)} /></label>
      <label className="field">Released to<input type="date" value={to} min={from || undefined} onChange={(event) => change(setTo, event.target.value)} /></label>
      <label className="field">Sort by<select aria-label="Sort by" value={sort} onChange={(event) => change(setSort, event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      <button className="button button-secondary filter-reset" onClick={reset}>Clear filters</button>
    </div>
    {invalidDates && <Alert tone="error">Choose a to date on or after the from date.</Alert>}
    <section className="card table-card" aria-busy={state.loading}>
      {state.loading ? <PageLoading compact /> : state.error ? <PageError message={state.error} retry={state.reload} compact />
        : state.data?.items.length ? <ResultsTable results={state.data.items} onOpen={onOpen} />
          : <EmptyState icon={FileHeart} title={search || department || from || to ? 'No matching results' : 'No released results yet'}
            copy={search || department || from || to ? 'Try a different search or clear the filters to see your released reports.' : 'Reports appear after the hospital validates and releases them.'}
            action={search || department || from || to ? <button className="button button-secondary" onClick={reset}>Clear filters</button> : undefined} />}
    </section>
    <div className="toolbar"><span className="muted">Page {page} of {Math.max(1, Math.ceil(total / 50))}</span><div className="report-actions"><button className="button button-secondary" disabled={state.loading || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="button button-secondary" disabled={state.loading || page * 50 >= total} onClick={() => setPage(page + 1)}>Next</button></div></div>
  </div>;
}

export function PublishedPdfModal({ token, patient, result, resultId, onClose }: {
  token: string; patient: PatientProfile; result: DiagnosticResult; resultId: number; onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'preview' | 'open' | 'download' | null>('preview');
  const resource = useRef<{ controller: AbortController; url: string } | null>(null);
  const load = useCallback(async (action: 'preview' | 'open' | 'download') => {
    const current = resource.current;
    if (!current) return;
    setBusy(action); setError('');
    try {
      const blob = await portalApi.getResultPdf(token, resultId, current.controller.signal);
      if (current.controller.signal.aborted || resource.current !== current) return;
      if (current.url) URL.revokeObjectURL(current.url);
      current.url = URL.createObjectURL(blob); setUrl(current.url);
      if (action !== 'preview') {
        const link = document.createElement('a'); link.href = current.url;
        if (action === 'download') link.download = `Result-${resultId}.pdf`;
        else { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
        document.body.appendChild(link); link.click(); link.remove();
      }
    } catch (caught) {
      if (!current.controller.signal.aborted && resource.current === current) {
        if (current.url) URL.revokeObjectURL(current.url);
        current.url = ''; setUrl(''); setError(errorMessage(caught));
      }
    } finally { if (!current.controller.signal.aborted && resource.current === current) setBusy(null); }
  }, [token, resultId]);
  useEffect(() => {
    const current = { controller: new AbortController(), url: '' };
    resource.current = current;
    void load('preview');
    return () => { current.controller.abort(); if (current.url) URL.revokeObjectURL(current.url); resource.current = null; };
  }, [load]);
  return <Modal title={result.description} onClose={onClose} wide className="report-modal">
    <div className="report-actions"><button className="button button-secondary" disabled={busy !== null || !url} onClick={() => void load('open')}><ExternalLink size={17} />{busy === 'open' ? 'Opening…' : 'Open / Print PDF'}</button><button className="button button-secondary" disabled={busy !== null || !url} onClick={() => void load('download')}><Download size={17} />{busy === 'download' ? 'Downloading…' : 'Download PDF'}</button></div>
    <div className="report-meta"><span><strong>Patient</strong>{patient.fullName}</span><span><strong>Released</strong>{dateTime(result.validatedDate)}</span><span><strong>Report no.</strong>{result.examinationNo || '—'}</span></div>
    {error ? <div role="alert"><PageError message={error} retry={() => void load('preview')} compact /></div> : busy === 'preview' ? <PageLoading compact /> : url ? <iframe title="Released report PDF" className="released-pdf-frame" src={url} /> : null}
  </Modal>;
}
