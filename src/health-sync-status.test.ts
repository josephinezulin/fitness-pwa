import { describe, expect, it } from "vitest";
import { summarizeHealthSync } from "./health-sync-status";
import { testSource } from "./test-fixtures";

const row = (received: string, status: string, count = 3) => [
  "fixture-request",
  "fixture-device",
  received,
  "2026-11-01T00:00:00Z",
  "2026-11-07T00:00:00Z",
  status,
  count,
  0,
  "",
];
describe("health ingestion metadata", () => {
  it("distinguishes empty history without inventing a completed sync", () => {
    const source = testSource();
    source.grids.SyncLogs.push([], ["", ""]);
    expect(summarizeHealthSync(source.grids)).toEqual({
      latest: null,
      lastSuccess: null,
    });
  });
  it("finds latest request and success by timestamp independently of sheet order", () => {
    const source = testSource();
    source.grids.SyncLogs.push(
      row("2026-11-07T09:00:00.001Z", "failed"),
      row("2026-11-07T08:00:00Z", "committed"),
      row("2026-11-07T09:00:00Z", "committed", 5),
    );
    const result = summarizeHealthSync(source.grids);
    expect(result.latest).toMatchObject({
      receivedAt: "2026-11-07T09:00:00.001Z",
      status: "failed",
    });
    expect(result.lastSuccess).toMatchObject({
      receivedAt: "2026-11-07T09:00:00Z",
      acceptedCount: 5,
    });
  });
  it("does not let a same-time success hide an incomplete request", () => {
    const source = testSource(),
      stamp = "2026-11-07T09:00:00Z";
    source.grids.SyncLogs.push(
      row(stamp, "partial"),
      row(stamp, "committed"),
      row(stamp, "failed"),
    );
    expect(summarizeHealthSync(source.grids).latest?.status).toBe("partial");
    expect(summarizeHealthSync(source.grids).lastSuccess?.status).toBe(
      "committed",
    );
  });
  it("selects only safe metadata, without IDs, device data or error payload text", () => {
    const source = testSource(),
      input = row("2026-11-07T09:00:00Z", "partial");
    input[0] = "private-request-marker";
    input[1] = "private-device-marker";
    input[8] = "private-error-marker";
    source.grids.SyncLogs.push(input);
    const original = structuredClone(source.grids);
    const result = summarizeHealthSync(source.grids);
    expect(JSON.stringify(result)).not.toContain("private-");
    expect(Object.keys(result.latest!)).toEqual([
      "receivedAt",
      "status",
      "acceptedCount",
      "rejectedCount",
    ]);
    expect(source.grids).toEqual(original);
  });
});
