import { describe, expect, it } from "vitest";
import { LOCAL_KEY, readLocal, snapshotKey, storeSnapshot } from "./workspace";
import { empty } from "./model";
const identity = {
  subject: "A",
  spreadsheetId: "sheet-1",
  title: "私人副本",
  timezone: "Asia/Taipei",
  checkedAt: "2026-11-06T00:00:00Z",
};
describe("account and file storage isolation", () => {
  it("partitions every account and file, including separator-like IDs", () => {
    expect(snapshotKey(identity)).not.toBe(
      snapshotKey({ ...identity, subject: "B" }),
    );
    expect(snapshotKey(identity)).not.toBe(
      snapshotKey({ ...identity, spreadsheetId: "sheet-2" }),
    );
    expect(snapshotKey({ subject: "A:B", spreadsheetId: "C" })).not.toBe(
      snapshotKey({ subject: "A", spreadsheetId: "B:C" }),
    );
  });
  it("serializes only explicit snapshot fields and never overwrites legacy data", () => {
    const values = new Map([[LOCAL_KEY, JSON.stringify(empty)]]);
    const storage = {
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    storeSnapshot(
      storage,
      { ...identity, accessToken: "must-not-be-stored" } as typeof identity,
      empty,
    );
    expect(values.get(LOCAL_KEY)).toBe(JSON.stringify(empty));
    expect(values.get(snapshotKey(identity))).not.toContain(
      "must-not-be-stored",
    );
    expect(values.size).toBe(2);
    const withExtra = {
      version: 1,
      workouts: [
        {
          id: "w",
          date: "2026-11-06",
          type: "home",
          minutes: 30,
          calories: 100,
          note: "",
          accessToken: "must-not-be-stored",
        },
      ],
      metrics: [],
    };
    storeSnapshot(storage, identity, withExtra as typeof empty);
    expect(values.get(snapshotKey(identity))).not.toContain(
      "must-not-be-stored",
    );
  });
  it("preserves corrupted original storage without silently replacing it", () => {
    const raw = "{invalid";
    const storage = { getItem: () => raw };
    expect(readLocal(storage).error).toContain("尚未覆蓋");
    expect(storage.getItem()).toBe(raw);
  });
});
