/**
 * Whole years elapsed since an ISO-8601 timestamp (e.g. Steam account creation),
 * or null when the input is null/unparseable. Used for the "N years in" headlines.
 */
export function accountAgeYears(iso: string | null): number | null {
  if (iso === null) return null;
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return null;
  const years = Math.floor((Date.now() - created) / (365.25 * 24 * 60 * 60 * 1000));
  return years >= 0 ? years : null;
}
