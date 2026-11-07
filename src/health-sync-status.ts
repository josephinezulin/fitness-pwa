import { populated, type Grids } from "./sheet-schema";

export type HealthSyncEntry = {
  receivedAt: string;
  status: "committed" | "failed" | "partial";
  acceptedCount: number;
  rejectedCount: number;
};
export type HealthSyncSummary = {
  latest: HealthSyncEntry | null;
  lastSuccess: HealthSyncEntry | null;
};
/** Source has passed the private-file/schema gate. Select metadata only, never IDs or error text. */
export function summarizeHealthSync(grids: Grids): HealthSyncSummary {
  let latest: HealthSyncEntry | null = null,
    lastSuccess: HealthSyncEntry | null = null;
  const newer = (a: HealthSyncEntry, b: HealthSyncEntry | null) =>
    !b || Date.parse(a.receivedAt) > Date.parse(b.receivedAt);
  const concern = { committed: 0, failed: 1, partial: 2 };
  for (const row of grids.SyncLogs.slice(1)) {
    if (!populated(row)) continue;
    const entry: HealthSyncEntry = {
      receivedAt: String(row[2]),
      status: row[5] as HealthSyncEntry["status"],
      acceptedCount: Number(row[6]),
      rejectedCount: Number(row[7]),
    };
    if (
      newer(entry, latest) ||
      (latest &&
        Date.parse(entry.receivedAt) === Date.parse(latest.receivedAt) &&
        concern[entry.status] > concern[latest.status])
    )
      latest = entry;
    if (entry.status === "committed" && newer(entry, lastSuccess))
      lastSuccess = entry;
  }
  return { latest, lastSuccess };
}
