import { HEADERS, ALL_TABS, type Grids } from "./sheet-schema";
import type { SheetSource, SheetInspection } from "./sheets";
import { projectCloudData } from "./cloud-data";
export const TEST_TIME = "2026-11-06T12:00:00.000Z";
export const TEST_ZONE = "Asia/Taipei";
export function testSource(): SheetSource {
  const grids = Object.fromEntries(
    ALL_TABS.map((tab) => [tab, [[...HEADERS[tab]]]]),
  ) as Grids;
  for (const [day, type, min, max] of [
    [1, "home", 20, 30],
    [3, "walk", 30, 60],
    [6, "home", 20, 30],
  ])
    grids.WorkoutPlans.push([
      `p-${day}`,
      day,
      type,
      "預設課表",
      min,
      max,
      "",
      true,
      TEST_TIME,
    ]);
  return {
    grids,
    sheets: Object.fromEntries(
      ALL_TABS.map((tab, sheetId) => [tab, { sheetId, rowCount: 1000 }]),
    ),
  };
}
export function testInspection(
  source = testSource(),
  id = "sheet-private-1",
): SheetInspection {
  return {
    id,
    title: "虛構測試資料",
    timezone: TEST_ZONE,
    checkedAt: TEST_TIME,
    report: { ok: true, errors: [], counts: {} },
    source,
    data: projectCloudData(source.grids, TEST_ZONE),
  };
}
