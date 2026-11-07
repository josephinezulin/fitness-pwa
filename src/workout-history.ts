import { WORKOUT_TYPES, type Workout, type WorkoutType } from "./model";

export type WorkoutFilters = {
  query: string;
  type: WorkoutType | "all";
  from: string;
  to: string;
};
export const emptyWorkoutFilters: WorkoutFilters = {
  query: "",
  type: "all",
  from: "",
  to: "",
};
const normalize = (text: string) =>
  text.normalize("NFKC").toLocaleLowerCase("zh-TW");
const validDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = new Date(`${date}T00:00:00Z`);
  return (
    Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === date
  );
};

/** Filter calendar date keys without converting them to device-local instants. */
export function workoutHistory(workouts: Workout[], filters: WorkoutFilters) {
  const error =
    (filters.from && !validDate(filters.from)) ||
    (filters.to && !validDate(filters.to))
      ? "請輸入有效的開始與結束日期。"
      : filters.from && filters.to && filters.from > filters.to
        ? "開始日期不能晚於結束日期，請調整日期範圍。"
        : "";
  const words = normalize(filters.query).trim().split(/\s+/).filter(Boolean);
  const rows = error
    ? []
    : workouts
        .filter((workout) => {
          if (filters.type !== "all" && workout.type !== filters.type)
            return false;
          if (filters.from && workout.date < filters.from) return false;
          if (filters.to && workout.date > filters.to) return false;
          if (!words.length) return true;
          const text = normalize(
            `${workout.date} ${WORKOUT_TYPES[workout.type].label} ${workout.note} ${workout.segments?.length ? "跑步機" : ""}`,
          );
          return words.every((word) => text.includes(word));
        })
        .sort((a, b) => b.date.localeCompare(a.date));
  return {
    rows,
    error,
    minutes:
      Math.round(rows.reduce((total, row) => total + row.minutes, 0) * 10) / 10,
    calories:
      Math.round(rows.reduce((total, row) => total + row.calories, 0) * 10) /
      10,
  };
}
