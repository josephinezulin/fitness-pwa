import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { HEADERS } from "./sheet-schema";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const token = "a".repeat(64);
const now = new Date().toISOString();
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const request = () => ({
  version: 1,
  requestId: "test-request-000001",
  deviceId: "phone-test",
  token,
  rangeStart: new Date(Date.now() - 7 * 86400000).toISOString(),
  rangeEnd: now,
  metrics: [
    {
      sampleKey: "sample-1",
      measuredAt: now,
      metricType: "weight",
      value: 68.5,
      unit: "kg",
      source: "health",
    },
  ],
  dailySteps: [
    { date: day, totalSteps: 5000, computedAt: now, source: "iPhone" },
  ],
});
function harness(
  options: {
    shared?: boolean;
    disabled?: boolean;
    failStepsOnce?: boolean;
    busy?: boolean;
  } = {},
) {
  let fileReads = 0,
    writes = 0,
    releases = 0,
    uuid = 0,
    failSteps = !!options.failStepsOnce;
  const properties = new Map<string, string>([
    ["HEALTH_INGEST_ENABLED", options.disabled ? "false" : "true"],
    ["HEALTH_DEVICE_ID", "phone-test"],
    ["HEALTH_DEVICE_TOKEN_SHA256", hash(token)],
    ["HEALTH_SPREADSHEET_ID", "test-sheet-only"],
  ]);
  const sheets = Object.fromEntries(
    Object.entries(HEADERS).map(([name, headers]) => {
      const rows: unknown[][] = [[...headers]];
      let maxRows = 1000;
      const sheet = {
        rows,
        getMaxColumns: () => headers.length,
        getMaxRows: () => maxRows,
        getLastRow: () => rows.length,
        insertRowsAfter: (_start: number, count: number) => {
          maxRows += count;
        },
        getRange: (
          row: number,
          col: number,
          height: number,
          width: number,
        ) => ({
          getValues: () =>
            Array.from({ length: height }, (_, y) =>
              Array.from(
                { length: width },
                (_, x) => rows[row + y - 1]?.[col + x - 1] ?? "",
              ),
            ),
          getFormulas: () =>
            Array.from({ length: height }, (_, y) =>
              Array.from({ length: width }, (_, x) => {
                const v = rows[row + y - 1]?.[col + x - 1];
                return typeof v === "string" && v.startsWith("=") ? v : "";
              }),
            ),
          setValues: (values: unknown[][]) => {
            if (row + height - 1 > maxRows || col + width - 1 > headers.length)
              throw Error("Grid exceeded");
            if (name === "DailySteps" && failSteps) {
              failSteps = false;
              throw Error("Simulated step write failure");
            }
            writes++;
            values.forEach((cells, y) => {
              rows[row + y - 1] ||= [];
              cells.forEach((v, x) => {
                rows[row + y - 1][col + x - 1] = v;
              });
            });
          },
        }),
      };
      return [name, sheet];
    }),
  );
  const logged: string[] = [];
  const context: Record<string, any> = {
    Utilities: {
      DigestAlgorithm: { SHA_256: "SHA_256" },
      Charset: { UTF_8: "UTF_8" },
      computeDigest: (_kind: string, value: string) => [
        ...Buffer.from(hash(value), "hex"),
      ],
      newBlob: (value: string) => ({ getBytes: () => [...Buffer.from(value)] }),
      getUuid: () =>
        `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`,
      formatDate: (date: Date, zone: string) => {
        const parts = new Intl.DateTimeFormat("en", {
          timeZone: zone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(date);
        const get = (type: string) => parts.find((p) => p.type === type)!.value;
        return `${get("year")}-${get("month")}-${get("day")}`;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties.get(key) ?? null,
        setProperty: (key: string, value: string) => properties.set(key, value),
        deleteProperty: (key: string) => properties.delete(key),
        setProperties: (values: Record<string, string>) =>
          Object.entries(values).forEach(([k, v]) => properties.set(k, v)),
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => !options.busy,
        releaseLock: () => {
          releases++;
        },
      }),
    },
    DriveApp: {
      Access: { PRIVATE: "PRIVATE" },
      getFileById: () => {
        fileReads++;
        return {
          getOwner: () => ({ getEmail: () => "owner@example.com" }),
          getSharingAccess: () => (options.shared ? "ANYONE" : "PRIVATE"),
          getEditors: () => [],
          getViewers: () => [],
        };
      },
    },
    Session: {
      getEffectiveUser: () => ({ getEmail: () => "owner@example.com" }),
    },
    SpreadsheetApp: {
      flush() {},
      openById: () => ({
        getSheets: () => Object.values(sheets),
        getSheetByName: (name: string) => sheets[name],
        getSpreadsheetTimeZone: () => "Asia/Taipei",
        getDeveloperMetadata: () => [
          {
            getKey: () => "fitnessSchemaVersion",
            getValue: () => "1",
            getVisibility: () => "DOCUMENT",
            getLocation: () => ({ getLocationType: () => "SPREADSHEET" }),
          },
        ],
      }),
    },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput: (text: string) => ({
        setMimeType: () => JSON.parse(text),
      }),
    },
    Logger: { log: (message: string) => logged.push(message) },
  };
  runInNewContext(
    readFileSync(
      new URL("../apps-script/HealthIngest.gs", import.meta.url),
      "utf8",
    ),
    context,
    { timeout: 3000 },
  );
  return {
    context,
    properties,
    sheets,
    logged,
    post: (body: unknown) =>
      context.doPost({ postData: { contents: JSON.stringify(body) } }),
    counts: () => ({ fileReads, writes, releases }),
  };
}
describe("authenticated Shortcuts ingestion (Google services mocked)", () => {
  it("uses exactly the same five-table contract as the PWA", () => {
    expect(harness().context.HEALTH_HEADERS).toEqual(HEADERS);
  });
  it("is disabled by default and refuses GET without exposing health data", () => {
    const h = harness({ disabled: true });
    expect(h.post(request())).toEqual({ ok: false, error: "SERVICE_DISABLED" });
    expect(h.context.doGet()).toEqual({
      ok: false,
      error: "METHOD_NOT_ALLOWED",
    });
    expect(h.counts().fileReads).toBe(0);
  });
  it("authenticates before any Drive or Sheets access", () => {
    const h = harness();
    expect(h.post({ ...request(), token: "wrong" })).toEqual({
      ok: false,
      error: "AUTH_FAILED",
    });
    expect(h.counts()).toMatchObject({ fileReads: 0, writes: 0 });
    expect(h.post({ ...request(), deviceId: "other-phone" }).error).toBe(
      "AUTH_FAILED",
    );
  });
  it("refuses shared sheets and returns no payload or token in errors", () => {
    const h = harness({ shared: true });
    const result = h.post(request());
    expect(result).toEqual({ ok: false, error: "PRIVATE_OWNER_REQUIRED" });
    expect(h.counts().writes).toBe(0);
    expect(JSON.stringify(result)).not.toContain(token);
  });
  it("stores one measurement and one daily total, preserving kg and snapshot time", () => {
    const h = harness();
    const result = h.post(request());
    expect(result).toMatchObject({
      ok: true,
      acceptedCount: 2,
      writtenCount: 2,
    });
    expect(h.sheets.HealthMetrics.rows[1][6]).toBe(68.5);
    expect(h.sheets.DailySteps.rows[1][3]).toBe(5000);
    expect(h.sheets.DailySteps.rows[1][7]).toBe(now);
    expect(h.sheets.SyncLogs.rows[1][5]).toBe("committed");
  });
  it("replays the same request without writes and dedupes seven-day rescans under a new request ID", () => {
    const h = harness();
    const body = request();
    expect(h.post(body).ok).toBe(true);
    const before = h.counts().writes;
    expect(h.post(body)).toMatchObject({ ok: true, replayed: true });
    expect(h.counts().writes).toBe(before);
    expect(h.post({ ...body, requestId: "test-request-000002" })).toMatchObject(
      { ok: true, writtenCount: 0 },
    );
    expect(h.sheets.HealthMetrics.rows).toHaveLength(2);
    expect(h.sheets.DailySteps.rows).toHaveLength(2);
  });
  it("rejects reused request IDs with altered values, invalid units and formula-like source text", () => {
    const h = harness();
    const body = request();
    h.post(body);
    expect(
      h.post({
        ...body,
        dailySteps: [{ ...body.dailySteps[0], totalSteps: 999 }],
      }).error,
    ).toBe("REQUEST_ID_REUSED");
    expect(
      h.post({ ...body, metrics: [{ ...body.metrics[0], unit: "lb" }] }).error,
    ).toBe("INVALID_METRIC");
    expect(
      h.post({
        ...body,
        metrics: [
          {
            ...body.metrics[0],
            source: '=IMPORTXML("https://example.com","//a")',
          },
        ],
      }).error,
    ).toBe("INVALID_METRIC");
  });
  it("recovers from failure between metrics and steps without duplicate health rows", () => {
    const h = harness({ failStepsOnce: true });
    const body = request();
    expect(h.post(body)).toEqual({ ok: false, error: "SYNC_FAILED" });
    expect(h.sheets.SyncLogs.rows[1][5]).toBe("partial");
    expect(h.sheets.HealthMetrics.rows).toHaveLength(2);
    expect(h.post(body)).toMatchObject({ ok: true, acceptedCount: 2 });
    expect(h.sheets.HealthMetrics.rows).toHaveLength(2);
    expect(h.sheets.DailySteps.rows).toHaveLength(2);
    expect(h.sheets.SyncLogs.rows[1][5]).toBe("committed");
  });
  it("updates 5000 to 6200 and does not add an older snapshot after a delayed delivery", () => {
    const h = harness();
    const body = request();
    h.post(body);
    const newer = new Date(Date.parse(now) + 1000).toISOString();
    expect(
      h.post({
        ...body,
        requestId: "test-request-000002",
        metrics: [],
        dailySteps: [
          { ...body.dailySteps[0], totalSteps: 6200, computedAt: newer },
        ],
      }).ok,
    ).toBe(true);
    expect(
      h.post({ ...body, requestId: "test-request-000003", metrics: [] }),
    ).toMatchObject({ ok: true, staleSteps: 1 });
    expect(h.sheets.DailySteps.rows[1][3]).toBe(6200);
    expect(h.sheets.DailySteps.rows[1][6]).toBe(2);
  });
  it("keeps two measurements on the same day and preserves a tombstone on rescan", () => {
    const h = harness();
    const body = request();
    body.metrics.push({
      ...body.metrics[0],
      sampleKey: "sample-2",
      value: 68.3,
    });
    expect(h.post(body).ok).toBe(true);
    expect(h.sheets.HealthMetrics.rows).toHaveLength(3);
    h.sheets.HealthMetrics.rows[1][11] = now;
    expect(h.post({ ...body, requestId: "test-request-000002" }).ok).toBe(true);
    expect(h.sheets.HealthMetrics.rows[1][11]).toBe(now);
    expect(h.sheets.HealthMetrics.rows).toHaveLength(3);
  });
  it("rejects malformed requests and same sample key with changed content before writes", () => {
    const h = harness();
    const body = request();
    expect(h.post({ ...body, requestId: "short" }).error).toBe(
      "INVALID_REQUEST",
    );
    expect(h.post({ ...body, unexpected: true }).error).toBe("INVALID_FIELDS");
    expect(h.post({ ...body, rangeStart: "2026-02-30T00:00:00Z" }).error).toBe(
      "INVALID_TIME",
    );
    expect(h.counts().writes).toBe(0);
    h.post(body);
    const before = h.counts().writes;
    expect(
      h.post({
        ...body,
        requestId: "test-request-000002",
        metrics: [{ ...body.metrics[0], value: 99 }],
      }).error,
    ).toBe("SAMPLE_CONFLICT");
    expect(h.counts().writes).toBe(before);
  });
  it("does not release an unacquired lock and avoids writes when busy", () => {
    const h = harness({ busy: true });
    expect(h.post(request()).error).toBe("BUSY_RETRY");
    expect(h.counts()).toMatchObject({ writes: 0, releases: 0 });
  });
  it("never prints generated device credentials and keeps new service disabled", () => {
    const h = harness();
    h.properties.delete("HEALTH_DEVICE_TOKEN_SHA256");
    h.context.initializeHealthIngest();
    const generated = h.properties.get("HEALTH_DEVICE_TOKEN_ONCE")!;
    expect(generated).toHaveLength(64);
    expect(h.properties.get("HEALTH_INGEST_ENABLED")).toBe("false");
    expect(h.logged.join("")).not.toContain(generated);
    expect(h.properties.get("HEALTH_DEVICE_TOKEN_SHA256")).toBe(
      hash(generated),
    );
  });
});
