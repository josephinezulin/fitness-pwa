import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  ALL_TABS,
  HEADERS,
  WORKOUT_TYPE_KEYS,
  validateGrids,
  type Cell,
  type Grids,
} from "./sheet-schema";
import { VIDEO_CATEGORIES } from "./videos";

function templateHarness() {
  class Sheet {
    name = "Sheet1";
    rows = 1000;
    cols = 26;
    values = new Map<string, Cell>();
    formats = new Map<number, string>();
    filter: number[] | null = null;
    setName(name: string) {
      this.name = name;
      return this;
    }
    getName() {
      return this.name;
    }
    getMaxRows() {
      return this.rows;
    }
    getMaxColumns() {
      return this.cols;
    }
    insertRowsAfter(_start: number, count: number) {
      this.rows += count;
    }
    deleteRows(_start: number, count: number) {
      this.rows -= count;
    }
    insertColumnsAfter(_start: number, count: number) {
      this.cols += count;
    }
    deleteColumns(_start: number, count: number) {
      this.cols -= count;
    }
    setFrozenRows() {}
    setRowHeight() {}
    setColumnWidths() {}
    getLastRow() {
      return Math.max(
        0,
        ...[...this.values.keys()].map((k) => Number(k.split(":")[0])),
      );
    }
    getRange(row: number, col: number, height = 1, width = 1) {
      if (
        row < 1 ||
        col < 1 ||
        row + height - 1 > this.rows ||
        col + width - 1 > this.cols
      )
        throw Error("Range exceeds grid");
      const sheet = this;
      const range = {
        setValues(data: Cell[][]) {
          if (data.length !== height || data.some((r) => r.length !== width))
            throw Error("Range shape mismatch");
          data.forEach((r, y) =>
            r.forEach((value, x) =>
              sheet.values.set(`${row + y}:${col + x}`, value),
            ),
          );
          return range;
        },
        getValues() {
          return Array.from({ length: height }, (_, y) =>
            Array.from(
              { length: width },
              (_, x) => sheet.values.get(`${row + y}:${col + x}`) ?? "",
            ),
          );
        },
        setNumberFormat(format: string) {
          sheet.formats.set(col, format);
          return range;
        },
        createFilter() {
          sheet.filter = [row, col, height, width];
          return range;
        },
        setFontFamily() {
          return range;
        },
        setFontSize() {
          return range;
        },
        applyRowBanding() {
          return range;
        },
        setBackground() {
          return range;
        },
        setFontColor() {
          return range;
        },
        setFontWeight() {
          return range;
        },
        setHorizontalAlignment() {
          return range;
        },
        setDataValidation(rule: { checkbox?: boolean }) {
          // Observed Google behavior: checkbox validation materializes FALSE in blank cells.
          if (rule.checkbox)
            for (let y = row; y < row + height; y++)
              for (let x = col; x < col + width; x++) {
                if (!sheet.values.has(`${y}:${x}`))
                  sheet.values.set(`${y}:${x}`, false);
              }
          return range;
        },
        setNote() {
          return range;
        },
      };
      return range;
    }
  }
  const sheets = [new Sheet()];
  const metadata: string[][] = [];
  const ss = {
    getUrl: () => "https://docs.google.com/spreadsheets/d/mock-only",
    setSpreadsheetLocale() {},
    setSpreadsheetTimeZone() {},
    addDeveloperMetadata(...args: string[]) {
      metadata.push(args);
    },
    getSheets: () => sheets,
    insertSheet(name: string) {
      const sheet = new Sheet();
      sheet.name = name;
      sheets.push(sheet);
      return sheet;
    },
    getSheetByName: (name: string) => sheets.find((s) => s.name === name),
  };
  const lists: string[][] = [];
  function validation() {
    let checkbox = false;
    const rule = {
      requireCheckbox: () => {
        checkbox = true;
        return rule;
      },
      setAllowInvalid: () => rule,
      requireValueInList: (list: string[]) => {
        lists.push(list);
        return rule;
      },
      requireFormulaSatisfied: () => rule,
      setHelpText: () => rule,
      build: () => ({ checkbox }),
    };
    return rule;
  }
  const context = {
    SpreadsheetApp: {
      create: () => ss,
      DeveloperMetadataVisibility: { DOCUMENT: "DOCUMENT" },
      BandingTheme: { LIGHT_GREEN: "LIGHT_GREEN" },
      newDataValidation: validation,
      flush() {},
    },
    Logger: { log() {} },
  };
  const code = readFileSync(
    new URL("../apps-script/CreateFitnessTemplate.gs", import.meta.url),
    "utf8",
  );
  const result = runInNewContext(code + "\ncreateFitnessTemplate();", context, {
    timeout: 3000,
  });
  return {
    sheets,
    metadata,
    result,
    lists,
    validation,
    newSheet: (name: string) => {
      const sheet = new Sheet();
      sheet.name = name;
      return sheet;
    },
  };
}
describe("Apps Script template builder (mock, not a Google runtime test)", () => {
  it("creates exactly the PWA schema and default plans within grid bounds", () => {
    const { sheets, metadata, result } = templateHarness();
    expect(result).toContain("/mock-only");
    expect(sheets.map((s) => s.name)).toEqual(ALL_TABS);
    expect(metadata).toEqual([["fitnessSchemaVersion", "1", "DOCUMENT"]]);
    const grids = {} as Grids;
    for (const sheet of sheets) {
      const name = sheet.name as keyof Grids;
      expect(sheet.rows).toBe(1000);
      expect(sheet.cols).toBe(HEADERS[name].length);
      expect(sheet.filter).toEqual([1, 1, 1000, sheet.cols]);
      grids[name] = sheet
        .getRange(1, 1, Math.max(1, sheet.getLastRow()), sheet.cols)
        .getValues();
      expect(grids[name][0]).toEqual(HEADERS[name]);
    }
    const report = validateGrids(grids);
    expect(report.errors).toEqual([]);
    expect(report.counts).toEqual({
      HealthMetrics: 0,
      DailySteps: 0,
      WorkoutLogs: 0,
      WorkoutPlans: 3,
      SyncLogs: 0,
      TreadmillSegments: 0,
      Videos: 0,
    });
  });
  it("offers every PWA workout type in the sheet dropdowns", () => {
    const { lists } = templateHarness();
    expect(lists.filter((l) => l.includes("home"))).toEqual([
      WORKOUT_TYPE_KEYS,
      WORKOUT_TYPE_KEYS,
    ]);
  });
  it("preserves decimal display, text timestamps and true boolean plans without placeholder rows", () => {
    const { sheets } = templateHarness();
    expect(sheets[0].formats.get(7)).toBe("0.0#");
    expect(sheets[0].formats.get(3)).toBe("@");
    expect(sheets[2].cols).toBe(11);
    expect(sheets[2].formats.get(11)).toBe("@");
    expect(sheets[3].getRange(2, 8, 3, 1).getValues()).toEqual([
      [true],
      [true],
      [true],
    ]);
    expect(sheets[3].getLastRow()).toBe(4);
  });
});

describe("targeted placeholder repair", () => {
  it("removes FALSE-only placeholders and preserves real inactive plans and partial data", () => {
    const header = [...HEADERS.WorkoutPlans];
    const rows: Cell[][] = [
      [
        "plan-1",
        1,
        "home",
        "停用課表",
        20,
        30,
        "",
        false,
        "2026-11-06T00:00:00Z",
      ],
      ["", "", "", "", "", "", "", false, ""],
      ["", "", "", "", "", "", "", false, ""],
      ["", "", "", "尚未填完的課表", "", "", "", false, ""],
      ["", "", "", "", "", "", "", false, ""],
    ];
    let validationsCleared = false;
    const sheet = {
      getMaxColumns: () => 9,
      getMaxRows: () => rows.length + 1,
      getRange: (row: number) => ({
        getValues: () => (row === 1 ? [header] : rows),
      }),
      getLastRow: () =>
        Math.max(
          1,
          ...rows.map((row, i) => (row.some((v) => v !== "") ? i + 2 : 1)),
        ),
      getRangeList: (ranges: string[]) => ({
        clearDataValidations() {
          validationsCleared = true;
        },
        clearContent() {
          expect(validationsCleared).toBe(true);
          for (const range of ranges) {
            const match = /^H(\d+):H(\d+)$/.exec(range)!;
            for (let row = +match[1]; row <= +match[2]; row++)
              rows[row - 2][7] = "";
          }
        },
      }),
    };
    const context = {
      SpreadsheetApp: {
        openByUrl: () => ({
          getSheetByName: () => sheet,
          getDeveloperMetadata: () => [],
        }),
        flush() {},
      },
      Logger: { log() {} },
    };
    const code = readFileSync(
      new URL("../apps-script/RepairTemplatePlaceholders.gs", import.meta.url),
      "utf8",
    ).replace(
      "const url = '貼上你的試算表網址';",
      "const url = 'https://docs.google.com/spreadsheets/d/mock-only/edit';",
    );
    runInNewContext(code + "\nrepairFitnessTemplatePlaceholders();", context, {
      timeout: 3000,
    });
    expect(rows[0][7]).toBe(false);
    expect(rows[1][7]).toBe("");
    expect(rows[2][7]).toBe("");
    expect(rows[3][7]).toBe(false);
    expect(rows[4][7]).toBe("");
  });
});

describe("upgrade script for existing copies (mock, not a Google runtime test)", () => {
  function upgradeHarness(extraTab?: string) {
    const h = templateHarness();
    const sheets = h.sheets.slice(0, 5);
    sheets[2]
      .getRange(2, 1, 1, 11)
      .setValues([
        [
          "w1",
          "2026-11-05",
          "Asia/Taipei",
          "walk",
          30,
          0,
          "舊資料",
          "pwa",
          1,
          "2026-11-05T00:00:00Z",
          "",
        ],
      ]);
    if (extraTab) sheets.push(h.newSheet(extraTab));
    const ss = {
      getDeveloperMetadata: () => [
        { getKey: () => "fitnessSchemaVersion", getValue: () => "1" },
      ],
      getSheets: () => sheets,
      getSheetByName: (name: string) => sheets.find((s) => s.name === name),
      insertSheet(name: string) {
        const sheet = h.newSheet(name);
        sheets.push(sheet);
        return sheet;
      },
    };
    const code = readFileSync(
      new URL("../apps-script/UpgradeFitnessTemplate.gs", import.meta.url),
      "utf8",
    ).replace(
      "const url = '貼上你的試算表網址';",
      "const url = 'https://docs.google.com/spreadsheets/d/mock-only/edit';",
    );
    const lists: string[][] = [];
    const run = () =>
      runInNewContext(
        code + "\nupgradeFitnessTemplate();",
        {
          SpreadsheetApp: {
            openByUrl: () => ss,
            newDataValidation: () => {
              const rule = h.validation();
              const original = rule.requireValueInList;
              rule.requireValueInList = (list: string[]) => {
                lists.push(list);
                return original(list);
              };
              return rule;
            },
            BandingTheme: { LIGHT_GREEN: "LIGHT_GREEN" },
            flush() {},
          },
          Logger: { log() {} },
        },
        { timeout: 3000 },
      ) as string[];
    return { sheets, run, lists };
  }
  it("adds the optional tabs, widens type dropdowns and keeps existing rows", () => {
    const { sheets, run, lists } = upgradeHarness();
    run();
    expect(sheets.map((s) => s.name)).toEqual(ALL_TABS);
    expect(lists.filter((l) => l.includes("home"))).toEqual([
      WORKOUT_TYPE_KEYS,
      WORKOUT_TYPE_KEYS,
    ]);
    expect(lists).toContainEqual([...VIDEO_CATEGORIES]);
    const grids = {} as Grids;
    for (const sheet of sheets) {
      const name = sheet.name as keyof Grids;
      expect(sheet.cols).toBe(HEADERS[name].length);
      grids[name] = sheet
        .getRange(1, 1, Math.max(1, sheet.getLastRow()), sheet.cols)
        .getValues();
    }
    expect(grids.WorkoutLogs[1][6]).toBe("舊資料");
    expect(validateGrids(grids).errors).toEqual([]);
  });
  it("is safe to run twice", () => {
    const { sheets, run } = upgradeHarness();
    run();
    expect(run()).toContain("Videos 已存在，未修改");
    expect(sheets).toHaveLength(7);
  });
  it("stops before changing anything when an unknown tab exists", () => {
    const { sheets, run } = upgradeHarness("Notes");
    expect(run).toThrow("未定義的工作表");
    expect(sheets).toHaveLength(6);
  });
});
