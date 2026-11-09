import { WeeklyGoal } from "../WeeklyActivity";
import type { Metric, Workout, WorkoutPlan, SheetVideo } from "../model";
import type { Video } from "../videos";
import { MiniStats, TodayCard, WeekChecklist, WeightCard } from "./HomeCards";

export function OverviewPage({
  metrics,
  workouts,
  plans,
  days,
  viewToday,
  weekMinutes,
  weeklyGoal,
  canEdit,
  canAddMetric,
  seen,
  cloud,
  sheetVideos,
  onGoalChange,
  onGoalDraftChange,
  onCheck,
  onUncheck,
  onVideoDone,
  onOpenTrends,
  onAddMetric,
}: {
  metrics: Metric[];
  workouts: Workout[];
  plans: WorkoutPlan[];
  days: string[];
  viewToday: string;
  weekMinutes: number;
  weeklyGoal: number;
  canEdit: boolean;
  canAddMetric: boolean;
  seen: Record<string, number>;
  cloud: boolean;
  sheetVideos?: SheetVideo[];
  onGoalChange: (goal: number) => boolean;
  onGoalDraftChange?: (open: boolean) => void;
  onCheck: (plan: WorkoutPlan, date: string) => void;
  onUncheck: (plan: WorkoutPlan, date: string) => void;
  onVideoDone: (video: Video) => void;
  onOpenTrends: () => void;
  onAddMetric: () => void;
}) {
  const checks = {
    plans,
    workouts,
    viewToday,
    days,
    canEdit,
    onCheck,
    onUncheck,
  };
  return (
    <div className="home">
      <TodayCard
        {...checks}
        seen={seen}
        cloud={cloud}
        sheetVideos={sheetVideos}
        onVideoDone={onVideoDone}
      />
      <WeeklyGoal
        minutes={weekMinutes}
        goal={weeklyGoal}
        onChange={onGoalChange}
        onDraftChange={onGoalDraftChange}
      >
        <WeekChecklist {...checks} />
      </WeeklyGoal>
      <WeightCard
        metrics={metrics}
        viewToday={viewToday}
        onOpen={onOpenTrends}
        onAdd={onAddMetric}
        canAdd={canAddMetric}
      />
      <MiniStats metrics={metrics} viewToday={viewToday} />
    </div>
  );
}
