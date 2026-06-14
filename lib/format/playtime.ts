/**
 * Format a playtime duration (Steam gives integer minutes) as hours.
 * Whole hours drop the decimal; otherwise one decimal place.
 *   minutesToHours(0)    -> '0'
 *   minutesToHours(60)   -> '1'
 *   minutesToHours(90)   -> '1.5'
 *   minutesToHours(23410)-> '390.2'
 */
export function minutesToHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/** Same as {@link minutesToHours} with an ` h` suffix for display. */
export function formatHours(minutes: number): string {
  return `${minutesToHours(minutes)} h`;
}
