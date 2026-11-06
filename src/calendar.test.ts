import { expect, it } from "vitest";
import { calendarDateInZone } from "./calendar";
import { weekDays } from "./model";
it("uses the sheet calendar day when UTC and Taipei are on different dates", () => {
  const now = new Date("2026-11-06T18:30:00Z");
  expect(calendarDateInZone(now, "Asia/Taipei")).toBe("2026-11-07");
  expect(calendarDateInZone(now, "UTC")).toBe("2026-11-06");
});
it("keeps Sunday in its correct training week across a device/sheet timezone boundary", () => {
  const day = calendarDateInZone(
    new Date("2026-11-08T17:00:00Z"),
    "Asia/Taipei",
  );
  expect(day).toBe("2026-11-09");
  expect(weekDays(new Date(day + "T12:00:00"))[0]).toBe("2026-11-09");
});
