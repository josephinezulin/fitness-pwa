// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HealthChart } from "./pages/HealthChart";
import { WeeklyActivity } from "./WeeklyActivity";
import type { Workout } from "./model";

// Only layout is supplied: actual Recharts SVG, null handling, Tooltip and keyboard logic run.
beforeEach(() => {
  const box = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    width: 600,
    height: 225,
    right: 600,
    bottom: 225,
    toJSON: () => ({}),
  };
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(box);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(600);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, contentRect: box } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const props = () => ({
  metrics: [
    { id: "zero", date: "2026-11-01", steps: 0 },
    { id: "later", date: "2026-11-03", steps: 1200 },
    { id: "last", date: "2026-11-04", steps: 1400 },
  ],
  viewToday: "2026-11-07",
  range: 7,
  setRange: vi.fn(),
  metric: "steps" as const,
  setMetric: vi.fn(),
  cloud: false,
  onAdd: vi.fn(),
});
describe("real trend charts and readable alternatives", () => {
  it("keeps an isolated measurement visible and separates SVG gradients between chart instances", async () => {
    render(
      <>
        <HealthChart
          {...props()}
          metric="weight"
          metrics={[{ id: "one", date: "2026-11-07", weight: 60 }]}
        />
        <HealthChart
          {...props()}
          metric="weight"
          metrics={[{ id: "two", date: "2026-11-07", weight: 61 }]}
        />
      </>,
    );
    const charts = await screen.findAllByRole("application", {
      name: "體重近7天趨勢圖",
    });
    expect(charts).toHaveLength(2);
    const gradientIds = charts.map((chart) => {
      expect(chart.querySelectorAll(".recharts-area-dot")).toHaveLength(1);
      return chart.querySelector('[id$="-fill"]')?.id;
    });
    expect(gradientIds.every(Boolean)).toBe(true);
    expect(new Set(gradientIds).size).toBe(2);
  });
  it("draws calendar gaps and individual observations, with the same zero/missing values in the table", async () => {
    const { container } = render(<HealthChart {...props()} />);
    await screen.findByRole("application", { name: "步數近7天趨勢圖" });
    const curve = container.querySelector(".recharts-area-curve");
    expect(curve?.getAttribute("d")?.match(/M/g)).toHaveLength(2);
    expect(container.querySelectorAll(".recharts-area-dot")).toHaveLength(3);
    expect(screen.getByText(/近 7 天有 3 天步數紀錄/).textContent).toContain(
      "1,400 步（2026-11-04）",
    );
    fireEvent.click(screen.getByText("查看每日數值"));
    const table = screen.getByRole("table", {
      name: "近 7 天步數每日摘要（截至 2026-11-07）",
    });
    expect(within(table).getAllByRole("row")).toHaveLength(8);
    expect(
      within(table).getByRole("row", { name: "2026-11-01 0" }),
    ).toBeTruthy();
    expect(
      within(table).getByRole("row", { name: "2026-11-02 未記錄" }),
    ).toBeTruthy();
    expect(
      within(table).getByRole("row", { name: "2026-11-03 1,200" }),
    ).toBeTruthy();
    expect(
      within(table)
        .getByRole("rowheader", { name: "2026-11-03" })
        .getAttribute("scope"),
    ).toBe("row");
  });
  it("moves the actual tooltip across a missing day using left/right arrows", async () => {
    render(<HealthChart {...props()} />);
    const chart = await screen.findByRole("application", {
      name: "步數近7天趨勢圖",
    });
    expect(chart.getAttribute("tabindex")).toBe("0");
    expect(chart.getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.focus(chart);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("0 步"),
    );
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("2026-11-02"),
    );
    expect(screen.getByRole("status").textContent).toContain("未記錄");
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(screen.getByRole("status").textContent).toContain("1,200 步");
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByRole("status").textContent).toContain("2026-11-02");
  });
  it("announces filter selection, retains an empty-period table and respects cloud health read-only access", () => {
    const input = props();
    render(<HealthChart {...input} metric="fat" cloud />);
    expect(
      screen
        .getByRole("button", { name: "體脂率" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "體重" }));
    expect(input.setMetric).toHaveBeenCalledWith("weight");
    fireEvent.change(screen.getByRole("combobox", { name: "趨勢時間範圍" }), {
      target: { value: "30" },
    });
    expect(input.setRange).toHaveBeenCalledWith(30);
    expect(screen.queryByRole("application")).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "新增健康數據",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByText("查看每日數值"));
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("未記錄")).toHaveLength(7);
    expect(within(table).queryByText("0")).toBeNull();
  });
  it("keeps weekly no-log/no-treadmill states distinct from flat incline in tables and keyboard tooltips", async () => {
    const w: Workout = {
      id: "home",
      date: "2026-12-21",
      type: "home",
      minutes: 30,
      calories: 0,
      note: "",
    };
    const t: Workout = {
      ...w,
      id: "flat",
      date: "2026-12-28",
      type: "walk",
      minutes: 10,
      segments: [{ minutes: 10, speed: 6, incline: 0 }],
    };
    render(<WeeklyActivity workouts={[w, t]} reference="2027-01-01" />);
    await screen.findByRole("application", { name: "最近8週運動分鐘趨勢圖" });
    fireEvent.click(screen.getByText("查看每週數值"));
    expect(
      within(screen.getByRole("table")).getByRole("row", {
        name: "2026-11-09 未記錄運動",
      }),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("table")).getByRole("row", {
        name: "2026-12-21 30",
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "跑步機距離" }));
    expect(
      screen
        .getByRole("button", { name: "跑步機距離" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(screen.getByRole("table")).getByRole("row", {
        name: "2026-12-21 無跑步機分段",
      }),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("table")).getByRole("row", {
        name: "2026-12-28 1",
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "平均坡度" }));
    expect(
      within(screen.getByRole("table")).getByRole("row", {
        name: "2026-12-28 0",
      }),
    ).toBeTruthy();
    const chart = await screen.findByRole("application", {
      name: "最近8週平均坡度趨勢圖",
    });
    fireEvent.focus(chart);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("未記錄運動"),
    );
    for (let i = 0; i < 7; i++) fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(screen.getByRole("status").textContent).toContain("2026-12-28");
    expect(screen.getByRole("status").textContent).toContain("0 %");
  });
});
