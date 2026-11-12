// Populate only with clinic-approved public information. Match the API branch
// name exactly; instructions use the actual booked item ID, not guessed names.
export type ClinicInformation = {
  address: string;
  directionsUrl?: string;
  preparationByItemId: Record<number, string>;
};

export const clinicInformation: Record<string, ClinicInformation> = {};

export function safeDirectionsUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
