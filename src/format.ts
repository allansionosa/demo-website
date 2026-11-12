export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

export function strongPassword(value: string) {
  return (
    value.length >= 10 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}
export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'PT'
  );
}
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'Patient';
}
export function money(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value || 0);
}
export function dateValue(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function shortDate(value?: string | null) {
  const date = dateValue(value);
  return date
    ? new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date)
    : '—';
}
export function longDate(value?: string | null) {
  const date = dateValue(value);
  return date
    ? new Intl.DateTimeFormat('en-PH', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(date)
    : 'Not recorded';
}
export function dateTime(value?: string | null) {
  const date = dateValue(value);
  return date
    ? new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date)
    : '—';
}
export function day(value: string) {
  return dateValue(value)?.getDate() || '—';
}
export function month(value: string) {
  const date = dateValue(value);
  return date
    ? new Intl.DateTimeFormat('en-PH', { month: 'short' })
        .format(date)
        .toUpperCase()
    : '—';
}
export function year(value: string) {
  return dateValue(value)?.getFullYear() || '—';
}
