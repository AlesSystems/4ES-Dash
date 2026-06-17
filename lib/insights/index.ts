/**
 * Barrel export for the Insights compute library (Phase 4).
 *
 * All modules are pure client-safe compute functions — no server imports,
 * no I/O, no process.env. Safe to bundle to the client.
 */

export * from './year-in-review';
export * from './genres';
export * from './cost-per-hour';
export * from './idle';
