/** Background jobs, invoked by `/api/cron/*` route handlers. See docs/BACKEND.md. */

export {
  runSnapshot,
  runSnapshotForUser,
  utcDayKey,
  clampPlaytime,
  ACHIEVEMENT_SNAPSHOT_LIMIT,
} from './snapshot';
export type { SnapshotResult, SnapshotBatchResult } from './snapshot';
