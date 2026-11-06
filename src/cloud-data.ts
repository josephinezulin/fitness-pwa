import { validate, type Data, type Metric, type Workout } from "./model";
import {
  activeSegments,
  populated,
  segmentOf,
  type Grids,
} from "./sheet-schema";
import { parseYouTubeId } from "./videos";

/** Project raw rows to the daily summaries used by the UI. Never mutates source rows. */
export function projectCloudData(grids: Grids, timezone: string): Data {
  const metrics = new Map<string, Metric>();
  const latest = new Map<string, string>();
  const heart = new Map<string, number[]>();
  const daily = (date: string) => {
    if (!metrics.has(date))
      metrics.set(date, { id: `cloud-day-${date}`, date });
    return metrics.get(date)!;
  };
  for (const row of grids.HealthMetrics.slice(1)) {
    if (!row[0] || row[11]) continue;
    if (row[4] !== timezone)
      throw Error(
        "目前每份資料副本只支援一個統計時區，健康資料的 timezone 必須與試算表一致。",
      );
    const date = String(row[3]),
      type = String(row[5]),
      timestamp = String(row[2]);
    if (type === "heartRate") {
      const values = heart.get(date) || [];
      values.push(Number(row[6]));
      heart.set(date, values);
    } else {
      const field = type === "weight" ? "weight" : "fat";
      const key = `${date}:${type}`;
      // Use time then sample ID as a stable tie-breaker; row order cannot change the result.
      const order = `${String(Date.parse(timestamp)).padStart(16, "0")}:${row[0]}`;
      if (!latest.has(key) || order > latest.get(key)!) {
        daily(date)[field] = Number(row[6]);
        latest.set(key, order);
      }
    }
  }
  for (const [date, values] of heart)
    daily(date).heart = Math.round(
      values.reduce((sum, n) => sum + n, 0) / values.length,
    );
  for (const row of grids.DailySteps.slice(1)) {
    if (!row[0]) continue;
    if (row[2] !== timezone)
      throw Error("步數 timezone 必須與試算表一致，避免將不同時區的一天混算。");
    daily(String(row[1])).steps = Number(row[3]);
  }
  const segments = activeSegments(grids);
  const workouts: Workout[] = [];
  for (const row of grids.WorkoutLogs.slice(1)) {
    if (!row[0] || row[10]) continue;
    if (row[2] !== timezone)
      throw Error("運動紀錄 timezone 必須與試算表一致。");
    const workout: Workout = {
      id: String(row[0]),
      date: String(row[1]),
      type: row[3] as Workout["type"],
      minutes: Number(row[4]),
      calories: Number(row[5]),
      note: String(row[6] || ""),
    };
    const parts = segments.get(workout.id)?.map(segmentOf);
    if (parts?.length) {
      // The sheet stores whole minutes; segments keep the precise total.
      workout.segments = parts;
      workout.minutes =
        Math.round(parts.reduce((sum, s) => sum + s.minutes, 0) * 10) / 10;
    }
    workouts.push(workout);
  }
  const videos = grids.Videos
    ? grids.Videos.slice(1)
        .filter((row) => populated(row) && !row[6])
        .map((row) => ({
          id: String(row[0]),
          youtubeId: parseYouTubeId(String(row[1]))!,
          title: String(row[2]).trim(),
          category: String(row[3]),
          ...(typeof row[4] === "number" ? { minutes: row[4] } : {}),
        }))
    : undefined;
  return validate({
    version: 1,
    ...(videos ? { videos } : {}),
    workouts,
    metrics: [...metrics.values()].sort((a, b) => a.date.localeCompare(b.date)),
  });
}
