import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectSpreadsheet } from "./sheets";
import {
  HEADERS,
  OPTIONAL_TABS,
  TAB_NAMES,
  type TabName,
} from "./sheet-schema";
const session = {
  accessToken: "test-token-not-real",
  expiresAt: Date.now() + 3600000,
  subject: "account-A",
  email: "test@example.com",
};
const metadata = {
  spreadsheetId: "test_spreadsheet_id",
  properties: { title: "測試副本", timeZone: "Asia/Taipei" },
  developerMetadata: [
    {
      metadataKey: "fitnessSchemaVersion",
      metadataValue: "1",
      location: { spreadsheet: true },
    },
  ],
  sheets: TAB_NAMES.map((title, sheetId) => ({
    properties: {
      title,
      sheetId,
      gridProperties: { rowCount: 1000, columnCount: HEADERS[title].length },
    },
  })),
};
const privateFile = {
  mimeType: "application/vnd.google-apps.spreadsheet",
  ownedByMe: true,
  shared: false,
  capabilities: { canEdit: true },
};
const json = (body: unknown, status = 200) => {
  const input = body as { valueRanges?: { values: unknown[][] }[] };
  if (input.valueRanges) {
    const tabs = [...TAB_NAMES, ...OPTIONAL_TABS];
    body = {
      sheets: input.valueRanges.map((range, i) => ({
        properties: { title: tabs[i] },
        data: [
          {
            rowData: range.values.map((row) => ({
              values: row.map((value) => ({
                userEnteredValue:
                  typeof value === "number"
                    ? { numberValue: value }
                    : typeof value === "boolean"
                      ? { boolValue: value }
                      : typeof value === "string" &&
                          value.startsWith("=IMPORTXML")
                        ? { formulaValue: value }
                        : { stringValue: value },
              })),
            })),
          },
        ],
      })),
    };
  }
  return new Response(JSON.stringify(body), { status });
};
afterEach(() => vi.unstubAllGlobals());
function browserTimers() {
  vi.stubGlobal("window", { setTimeout, clearTimeout });
}
describe("read-only Google Sheets gate", () => {
  it("rejects expired sessions before making any request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      inspectSpreadsheet(
        "test_spreadsheet_id",
        { ...session, expiresAt: 0 },
        new AbortController().signal,
      ),
    ).rejects.toThrow("過期");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects public templates before reading health cells", async () => {
    browserTimers();
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ ...privateFile, shared: true }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      inspectSpreadsheet(
        "test_spreadsheet_id",
        session,
        new AbortController().signal,
      ),
    ).rejects.toThrow("私人");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects somebody else’s file even if it is editable", async () => {
    browserTimers();
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ ...privateFile, ownedByMe: false }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      inspectSpreadsheet(
        "test_spreadsheet_id",
        session,
        new AbortController().signal,
      ),
    ).rejects.toThrow("你擁有");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("requires a version marker before reading cells", async () => {
    browserTimers();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(privateFile))
      .mockResolvedValueOnce(json({ ...metadata, developerMetadata: [] }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      inspectSpreadsheet(
        "test_spreadsheet_id",
        session,
        new AbortController().signal,
      ),
    ).rejects.toThrow("版本");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("accepts a private compatible copy and reports counts without uploading data", async () => {
    browserTimers();
    const ranges = TAB_NAMES.map((tab) => ({
      values: [[...HEADERS[tab]]] as unknown[][],
    }));
    for (const [day, type, min, max] of [
      [1, "home", 20, 30],
      [3, "walk", 30, 60],
      [6, "home", 20, 30],
    ]) {
      ranges[3].values.push([
        `plan-${day}`,
        day,
        type,
        "預設課表",
        min,
        max,
        "",
        true,
        "2026-11-06T00:00:00Z",
      ]);
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(privateFile))
      .mockResolvedValueOnce(json(metadata))
      .mockResolvedValueOnce(json({ valueRanges: ranges }));
    vi.stubGlobal("fetch", fetcher);
    const result = await inspectSpreadsheet(
      "test_spreadsheet_id",
      session,
      new AbortController().signal,
    );
    expect(result.report.ok).toBe(true);
    expect(result.report.counts.WorkoutPlans).toBe(3);
    expect(result.report.counts.HealthMetrics).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result).not.toHaveProperty("accessToken");
    for (const [, options] of fetcher.mock.calls)
      expect(options.method).toBe("GET");
  });
  it("makes only GET requests, sends auth in headers, and rejects formulas", async () => {
    browserTimers();
    const ranges = TAB_NAMES.map((tab) => ({
      values: [[...HEADERS[tab]]] as unknown[][],
    }));
    ranges[3].values.push([
      "p",
      1,
      "home",
      '=IMPORTXML("https://example.com", "//a")',
      20,
      30,
      "",
      true,
      "2026-11-06T00:00:00Z",
    ]);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(privateFile))
      .mockResolvedValueOnce(json(metadata))
      .mockResolvedValueOnce(json({ valueRanges: ranges }));
    vi.stubGlobal("fetch", fetcher);
    const result = await inspectSpreadsheet(
      "test_spreadsheet_id",
      session,
      new AbortController().signal,
    );
    expect(result.report.ok).toBe(false);
    expect(result.report.errors.some((e) => e.includes("公式"))).toBe(true);
    for (const [url, options] of fetcher.mock.calls) {
      expect(String(url)).not.toContain(session.accessToken);
      expect(options.method).toBe("GET");
      expect(options.credentials).toBe("omit");
      expect(options.cache).toBe("no-store");
      expect(options.headers.Authorization).toBe(
        `Bearer ${session.accessToken}`,
      );
    }
  });
  it("reads optional TreadmillSegments and Videos tabs and projects them", async () => {
    browserTimers();
    const tabs: TabName[] = [...TAB_NAMES, ...OPTIONAL_TABS];
    const ranges = tabs.map((tab) => ({
      values: [[...HEADERS[tab]]] as unknown[][],
    }));
    for (const [day, type, min, max] of [
      [1, "home", 20, 30],
      [3, "walk", 30, 60],
      [6, "home", 20, 30],
    ])
      ranges[3].values.push([
        `plan-${day}`,
        day,
        type,
        "預設課表",
        min,
        max,
        "",
        true,
        "2026-11-06T00:00:00Z",
      ]);
    ranges[2].values.push([
      "w1",
      "2026-11-05",
      "Asia/Taipei",
      "run",
      30,
      0,
      "",
      "pwa",
      1,
      "2026-11-05T00:00:00Z",
      "",
    ]);
    ranges[5].values.push(["s1", "w1", 1, 30, 8, 1, "", ""]);
    ranges[6].values.push([
      "v1",
      "https://youtu.be/v7AYKMP6rOE",
      "新手瑜伽",
      "瑜伽",
      20,
      "",
      "",
    ]);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(privateFile))
      .mockResolvedValueOnce(
        json({
          ...metadata,
          sheets: tabs.map((title, sheetId) => ({
            properties: {
              title,
              sheetId,
              gridProperties: {
                rowCount: 1000,
                columnCount: HEADERS[title].length,
              },
            },
          })),
        }),
      )
      .mockResolvedValueOnce(json({ valueRanges: ranges }));
    vi.stubGlobal("fetch", fetcher);
    const result = await inspectSpreadsheet(
      "test_spreadsheet_id",
      session,
      new AbortController().signal,
    );
    expect(result.report.errors).toEqual([]);
    expect(String(fetcher.mock.calls[2][0])).toContain("TreadmillSegments");
    expect(result.data!.workouts[0].segments).toEqual([
      { minutes: 30, speed: 8, incline: 1 },
    ]);
    expect(result.data!.videos![0].youtubeId).toBe("v7AYKMP6rOE");
  });
  it("rejects unknown extra tabs before reading cells", async () => {
    browserTimers();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(privateFile))
      .mockResolvedValueOnce(
        json({
          ...metadata,
          sheets: [
            ...metadata.sheets,
            {
              properties: {
                title: "Notes",
                gridProperties: { rowCount: 10, columnCount: 2 },
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      inspectSpreadsheet(
        "test_spreadsheet_id",
        session,
        new AbortController().signal,
      ),
    ).rejects.toThrow("選用");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not continue when permission is revoked", async () => {
    browserTimers();
    const fetcher = vi.fn().mockResolvedValue(json({}, 401));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      inspectSpreadsheet(
        "test_spreadsheet_id",
        session,
        new AbortController().signal,
      ),
    ).rejects.toThrow("授權失效");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("ignores a request canceled before it starts", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(
      inspectSpreadsheet("test_spreadsheet_id", session, controller.signal),
    ).rejects.toThrow("Aborted");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it("reads leading equals text safely and trims formatted empty rows while keeping interior row numbers", async () => {
  browserTimers();
  const { testSource } = await import("./test-fixtures");
  const source = testSource();
  source.grids.WorkoutLogs.push(
    [],
    [
      "w1",
      "2026-11-06",
      "Asia/Taipei",
      "home",
      30,
      0,
      '=IMPORTXML("literal", "text")',
      "pwa",
      1,
      "2026-11-06T12:00:00Z",
      "",
    ],
    [],
    [],
  );
  const tabs = [...TAB_NAMES, ...OPTIONAL_TABS];
  const cells = {
    sheets: tabs
      .map((title) => ({
        properties: { title },
        data: [
          {
            rowData: source.grids[title]!.map((row) => ({
              values: row.map((value) => ({
                userEnteredValue:
                  typeof value === "number"
                    ? { numberValue: value }
                    : typeof value === "boolean"
                      ? { boolValue: value }
                      : { stringValue: value },
              })),
            })),
          },
        ],
      }))
      .reverse(),
  };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(json(privateFile))
      .mockResolvedValueOnce(
        json({
          ...metadata,
          sheets: tabs.map((title, sheetId) => ({
            properties: {
              title,
              sheetId,
              gridProperties: {
                rowCount: 1000,
                columnCount: HEADERS[title].length,
              },
            },
          })),
        }),
      )
      .mockResolvedValueOnce(json(cells)),
  );
  const result = await inspectSpreadsheet(
    "test_spreadsheet_id",
    session,
    new AbortController().signal,
  );
  expect(result.report.errors).toEqual([]);
  expect(result.data!.workouts[0].note).toBe('=IMPORTXML("literal", "text")');
  expect(result.source!.grids.WorkoutLogs).toHaveLength(3);
  expect(result.source!.grids.WorkoutLogs[1]).toEqual([]);
  expect(result.source!.grids.WorkoutLogs[2][0]).toBe("w1");
});
