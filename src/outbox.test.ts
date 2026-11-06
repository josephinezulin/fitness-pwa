import { describe, expect, it } from "vitest";
import {
  cleanOperation,
  outboxKey,
  overlayOutbox,
  readOutbox,
  storeOutbox,
  type PendingOperation,
} from "./outbox";
const identity = { subject: "A", spreadsheetId: "sheet-private-1" };
const op = (): Extract<PendingOperation, { kind: "workout" }> => ({
  kind: "workout",
  id: "w1",
  operationId: "operation-1234",
  timezone: "Asia/Taipei",
  base: null,
  state: "pending",
  value: {
    id: "w1",
    type: "home",
    date: "2026-11-06",
    minutes: 20,
    calories: 0,
    note: "離線紀錄",
  },
});
function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
}
describe("durable account-scoped outbox", () => {
  it("separates accounts and sheets, including ambiguous separators", () => {
    const s = storage();
    storeOutbox(s, identity, [op()]);
    expect(readOutbox(s, identity)).toHaveLength(1);
    expect(readOutbox(s, { ...identity, subject: "B" })).toEqual([]);
    expect(
      readOutbox(s, { ...identity, spreadsheetId: "sheet-private-2" }),
    ).toEqual([]);
    expect(outboxKey({ subject: "A:B", spreadsheetId: "C" })).not.toBe(
      outboxKey({ subject: "A", spreadsheetId: "B:C" }),
    );
  });
  it("never serializes arbitrary token fields, including nested values", () => {
    const s = storage(),
      input = op();
    storeOutbox(s, { ...identity, accessToken: "secret" } as typeof identity, [
      {
        ...input,
        accessToken: "secret",
        value: { ...input.value, accessToken: "secret" },
      } as unknown as PendingOperation,
    ]);
    expect([...s.values.values()].join("")).not.toContain("secret");
    expect([...s.values.values()].join("")).not.toContain("accessToken");
  });
  it("keeps malformed or wrong-account storage untouched", () => {
    const s = storage();
    s.values.set(outboxKey(identity), "{broken");
    expect(() => readOutbox(s, identity)).toThrow("原始內容已保留");
    expect(s.getItem(outboxKey(identity))).toBe("{broken");
    storeOutbox(s, identity, [op()]);
    const raw = s.getItem(outboxKey(identity))!;
    s.values.set(outboxKey({ ...identity, subject: "B" }), raw);
    expect(() => readOutbox(s, { ...identity, subject: "B" })).toThrow();
  });
  it("projects local edits and deletions over a fresh remote snapshot", () => {
    const data = {
      version: 1 as const,
      metrics: [{ id: "m1", date: "2026-11-06", weight: 68.5 }],
      workouts: [op().value!],
    };
    const removed = overlayOutbox(data, [{ ...op(), value: null }]);
    expect(removed.workouts).toEqual([]);
    expect(removed.metrics).toEqual(data.metrics);
    expect(
      overlayOutbox({ ...data, workouts: [] }, [op()]).workouts[0].note,
    ).toBe("離線紀錄");
  });
  it("persists uncertainty and rejects mismatched record IDs", () => {
    const s = storage();
    storeOutbox(s, identity, [{ ...op(), state: "uncertain" }]);
    expect(readOutbox(s, identity)[0].state).toBe("uncertain");
    expect(() => cleanOperation({ ...op(), id: "wrong" })).toThrow("識別碼");
  });
});
