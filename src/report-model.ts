import type { ResultDetails } from './types';

export type ReportField = { label: string; value: string };
export type ReportReading = {
  title: string;
  fields: ReportField[];
};

export function plainValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '';
  const raw = String(value);
  if (!/[<&]/.test(raw)) return raw;
  // Parse as an inert document, preserve paragraph/line boundaries, and never
  // insert report HTML into the active document.
  const document = new DOMParser().parseFromString(raw, 'text/html');
  document.querySelectorAll('script, style').forEach((node) => node.remove());
  document.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
  document.querySelectorAll('p, div, li, tr').forEach((node) => node.append('\n'));
  return document.body.textContent?.trim() || '';
}

export function firstValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const entry = Object.entries(record).find(([name]) => name.toLowerCase() === key.toLowerCase());
    const value = plainValue(entry?.[1]);
    if (value.trim()) return value;
  }
  return '';
}

const commonFields = [
  ['Name', 'Patient'], ['CaseNo', 'Case no.'], ['Sex', 'Sex'], ['Age', 'Age'],
  ['DateOfBirth', 'Date of birth'], ['ExaminationNo', 'Report no.'],
  ['ChargeSlipNo', 'Charge slip no.'], ['DatePerform', 'Performed'],
  ['ReqPhysician', 'Requesting physician'], ['Pathologist', 'Pathologist'],
  ['MedTech', 'Medical technologist'], ['MedTech1', 'Medical technologist'],
  ['Radiologist', 'Radiologist'], ['Doctor', 'Doctor'], ['ExamTitle', 'Examination'],
] as const;

const narrativeFields = [
  ['ClinicalHistory', 'Clinical history'], ['Clinical', 'Clinical information'],
  ['Findings', 'Findings'], ['Impression', 'Impression'],
  ['Interpretation', 'Interpretation'], ['Remarks', 'Remarks'], ['Miscellaneous', 'Additional notes'],
] as const;

function fields(record: Record<string, unknown>, mapping: ReadonlyArray<readonly [string, string]>) {
  return mapping.flatMap(([key, label]) => {
    const value = firstValue(record, key);
    return value ? [{ label, value }] : [];
  });
}

export function reportModel(result: ResultDetails) {
  const laboratory = result.departmentCode.toUpperCase() === 'LAB';
  const meta = fields(result.header, commonFields);
  const narratives = fields(result.header, narrativeFields);
  const readings: ReportReading[] = [];
  if (laboratory) {
    for (const row of result.details) {
      const printRow = Object.entries(row).find(([key]) => key.toLowerCase() === 'printrow')?.[1];
      if (printRow === false || printRow === 0 || printRow === '0' || String(printRow).toLowerCase() === 'false') continue;
      const values = fields(row, [
        ['Result', 'Result'], ['Value', 'Value'], ['Unit', 'Unit'], ['Reference', 'Reference range'],
        ['SIResult', 'SI result'], ['SIUnit', 'SI unit'], ['SIReference', 'SI reference range'],
        ['Findings', 'Findings'], ['Impression', 'Impression'],
      ]);
      const title = firstValue(row, 'Test', 'Description', 'ExaminationReportTitle', 'ExaminationTemplate');
      if (title || values.length) readings.push({ title: title || 'Laboratory reading', fields: values });
    }
  } else {
    // Radiology can return multiple report rows; retain each narrative in order.
    for (const row of result.details) {
      const values = fields(row, narrativeFields);
      if (values.length) readings.push({ title: firstValue(row, 'ExamTitle', 'Description') || 'Report continuation', fields: values });
    }
  }
  return { laboratory, meta, narratives, readings };
}
