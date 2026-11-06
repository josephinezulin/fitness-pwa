import { afterEach, describe, expect, it, vi } from "vitest";
import {
  planSheetWrite,
  remoteWorkouts,
  remoteVideos,
  typedCell,
  writeCloudOperation,
  SyncConflictError,
  type CloudOperation,
} from "./sheets-write";
import {
  testSource,
  testInspection,
  TEST_TIME,
  TEST_ZONE,
} from "./test-fixtures";
import type { SheetSource } from "./sheets";
import type { TabName } from "./sheet-schema";
const mock = vi.hoisted(() => ({ inspect: vi.fn() }));
vi.mock("./sheets", async (original) => ({
  ...(await original<typeof import("./sheets")>()),
  inspectSpreadsheet: mock.inspect,
}));
const workout = {
  id: "w1",
  date: "2026-11-06",
  type: "walk" as const,
  minutes: 30.5,
  calories: 90,
  note: "坡度分段",
  segments: [
    { minutes: 10.5, speed: 5, incline: 3 },
    { minutes: 20, speed: 6, incline: 8 },
  ],
};
const operation = (): Extract<CloudOperation, { kind: "workout" }> => ({
  kind: "workout",
  id: workout.id,
  operationId: "test-operation-1",
  timezone: TEST_ZONE,
  base: null,
  value: structuredClone(workout),
});
function apply(
  source: SheetSource,
  requests: ReturnType<typeof planSheetWrite>,
) {
  const result = structuredClone(source);
  for (const request of requests) {
    if (request.updateCells) {
      const { range, rows } = request.updateCells as any;
      const tab = Object.entries(result.sheets).find(
        ([, v]) => v.sheetId === range.sheetId,
      )![0] as TabName;
      for (let i = 0; i < rows.length; i++)
        result.grids[tab]![range.startRowIndex + i] = rows[i].values.map(
          (c: any) =>
            c.userEnteredValue.stringValue ??
            c.userEnteredValue.numberValue ??
            c.userEnteredValue.boolValue,
        );
    }
    if (request.appendDimension) {
      const { sheetId, length } = request.appendDimension as any;
      Object.values(result.sheets).find(
        (x) => x.sheetId === sheetId,
      )!.rowCount += length;
    }
  }
  return result;
}
const plan = (source: SheetSource, op: CloudOperation = operation()) =>
  planSheetWrite(source, op, TEST_ZONE, TEST_TIME);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("atomic workout and video writes", () => {
  it("rounds the raw segment sum, and rejects a changed sheet timezone", () => {
    const op = operation();
    op.value = {
      ...workout,
      segments: [
        { minutes: 10.49, speed: 5, incline: 3 },
        { minutes: 20, speed: 6, incline: 8 },
      ],
    };
    expect(
      apply(testSource(), plan(testSource(), op)).grids.WorkoutLogs[1][4],
    ).toBe(30);
    expect(() => plan(testSource(), { ...op, timezone: "UTC" })).toThrow(
      "時區已變更",
    );
  });
  it("deletes a manually entered video whose optional trailing cells were absent", () => {
    const source = testSource();
    source.grids.Videos!.push(["v", "v7AYKMP6rOE", "手動影片", "瑜伽"]);
    const op: CloudOperation = {
      kind: "video",
      id: "v",
      timezone: TEST_ZONE,
      operationId: "delete-video-1",
      base: remoteVideos(source)[0],
      value: null,
    };
    const result = apply(source, plan(source, op));
    expect(result.grids.Videos![1]).toHaveLength(7);
    expect(result.grids.Videos![1][6]).toBe(TEST_TIME);
  });
  it("writes the parent and precise segments together without touching health tables", () => {
    const source = testSource(),
      before = structuredClone(source);
    const requests = plan(source),
      result = apply(source, requests);
    expect(source).toEqual(before);
    expect(result.grids.WorkoutLogs[1][4]).toBe(31);
    expect(result.grids.TreadmillSegments![1][3]).toBe(10.5);
    expect(remoteWorkouts(result)[0].minutes).toBe(30.5);
    expect(requests).toHaveLength(3);
    expect(JSON.stringify(requests)).not.toContain("deleteDimension");
    expect(result.grids.HealthMetrics).toEqual(before.grids.HealthMetrics);
  });
  it("tombstones old segments and replaces them in the same batch", () => {
    const source = apply(testSource(), plan(testSource()));
    const edit: CloudOperation = {
      ...operation(),
      operationId: "test-edit-operation-2",
      base: remoteWorkouts(source)[0],
      value: {
        ...workout,
        segments: workout.segments.map((s) => ({ ...s, incline: 9 })),
      },
    };
    const result = apply(source, plan(source, edit));
    expect(result.grids.TreadmillSegments).toHaveLength(5);
    expect(
      result.grids
        .TreadmillSegments!.slice(1, 3)
        .every((row) => row[7] === TEST_TIME),
    ).toBe(true);
    expect(remoteWorkouts(result)[0].segments?.map((s) => s.incline)).toEqual([
      9, 9,
    ]);
    expect(remoteWorkouts(result)[0].revision).toBe(2);
  });
  it("deletes with parent and child tombstones, and acknowledges a repeated deletion", () => {
    const source = apply(testSource(), plan(testSource()));
    const deletion: CloudOperation = {
      ...operation(),
      base: remoteWorkouts(source)[0],
      value: null,
    };
    const result = apply(source, plan(source, deletion));
    expect(result.grids.WorkoutLogs[1][10]).toBe(TEST_TIME);
    expect(result.grids.TreadmillSegments![1][7]).toBe(TEST_TIME);
    expect(plan(result, deletion)).toEqual([]);
  });
  it("does not duplicate a previously committed creation after a lost response", () => {
    const op = operation(),
      result = apply(testSource(), plan(testSource(), op));
    expect(plan(result, op)).toEqual([]);
  });
  it("detects manual segment edits with unchanged revisions", () => {
    const source = apply(testSource(), plan(testSource()));
    const op: CloudOperation = {
      ...operation(),
      base: remoteWorkouts(source)[0],
      value: { ...workout, note: "local" },
    };
    source.grids.TreadmillSegments![1][4] = 12;
    expect(() => plan(source, op)).toThrow(SyncConflictError);
  });
  it.each([
    '=IMPORTXML("https://example.com","//a")',
    "+SUM(1,2)",
    "-1+2",
    "@SUM(1,2)",
    "'=原本有引號",
  ])("keeps %s literal without altering user text", (note) => {
    const op: CloudOperation = { ...operation(), value: { ...workout, note } };
    const result = apply(testSource(), plan(testSource(), op));
    expect(result.grids.WorkoutLogs[1][6]).toBe(note);
    expect(typedCell(note)).toEqual({
      userEnteredValue: { stringValue: note },
    });
    expect(JSON.stringify(plan(testSource(), op))).not.toContain(
      "formulaValue",
    );
  });
  it("preserves native validation and formatting when expanding the grid", () => {
    const source = testSource();
    source.sheets.WorkoutLogs!.rowCount = 1;
    // Real templates have at least the header and one formatted data row.
    source.sheets.TreadmillSegments!.rowCount = 2;
    const requests = plan(source);
    expect(requests.some((r) => !!r.appendDimension)).toBe(true);
    expect(
      requests
        .filter((r) => !!r.copyPaste)
        .map((r) => (r.copyPaste as any).pasteType),
    ).toEqual(["PASTE_FORMAT", "PASTE_DATA_VALIDATION"]);
  });
  it("rejects missing optional tabs and invalid records without mutating the source", () => {
    const source = testSource();
    delete source.sheets.TreadmillSegments;
    delete source.grids.TreadmillSegments;
    expect(() => plan(source)).toThrow("升級");
    expect(source.grids.WorkoutLogs).toHaveLength(1);
    expect(() =>
      plan(testSource(), {
        ...operation(),
        value: { ...workout, calories: -1 },
      }),
    ).toThrow();
  });
  it("adds, edits, deletes and safely retries a video", () => {
    const video = {
      id: "v1",
      youtubeId: "v7AYKMP6rOE",
      title: "=影片原文",
      category: "瑜伽",
      minutes: 20,
    };
    const op: CloudOperation = {
      kind: "video",
      id: "v1",
      operationId: "test-video-1",
      timezone: TEST_ZONE,
      base: null,
      value: video,
    };
    let source = apply(testSource(), plan(testSource(), op));
    expect(plan(source, op)).toEqual([]);
    const edit: CloudOperation = {
      ...op,
      base: remoteVideos(source)[0],
      value: { ...video, title: "改名" },
    };
    source = apply(source, plan(source, edit));
    expect(remoteVideos(source)[0].title).toBe("改名");
    const deletion: CloudOperation = {
      ...op,
      base: remoteVideos(source)[0],
      value: null,
    };
    source = apply(source, plan(source, deletion));
    expect(remoteVideos(source)[0].deletedAt).toBe(TEST_TIME);
    expect(plan(source, deletion)).toEqual([]);
  });
});
describe("authorized network writes", () => {
  const session = {
    subject: "A",
    email: "test@example.com",
    accessToken: "memory-only",
    expiresAt: Date.now() + 3600000,
  };
  it("refuses an account mismatch before reading or writing", async () => {
    await expect(
      writeCloudOperation(
        "sheet-private-1",
        "B",
        operation(),
        session,
        new AbortController().signal,
      ),
    ).rejects.toThrow("帳號不同");
    expect(mock.inspect).not.toHaveBeenCalled();
  });
  it("checks privacy and revisions, posts once, then reads back before confirming", async () => {
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const source = testSource(),
      op = operation();
    mock.inspect
      .mockResolvedValueOnce(testInspection(source))
      .mockResolvedValueOnce(testInspection(apply(source, plan(source, op))));
    const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    await writeCloudOperation(
      "sheet-private-1",
      "A",
      op,
      session,
      new AbortController().signal,
    );
    expect(mock.inspect).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toMatch(/:batchUpdate$/);
    expect(String(url)).not.toContain("memory-only");
    expect(options.headers.Authorization).toBe("Bearer memory-only");
    expect(options.credentials).toBe("omit");
    expect(JSON.parse(options.body).requests).toHaveLength(3);
  });
  it("safely retries after a committed POST lost its response", async () => {
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const source = testSource(),
      op = operation();
    mock.inspect.mockResolvedValueOnce(testInspection(source));
    const fetcher = vi
      .fn()
      .mockRejectedValue(new TypeError("network disconnected"));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      writeCloudOperation(
        "sheet-private-1",
        "A",
        op,
        session,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    mock.inspect.mockResolvedValueOnce(
      testInspection(apply(source, plan(source, op))),
    );
    await writeCloudOperation(
      "sheet-private-1",
      "A",
      op,
      session,
      new AbortController().signal,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
