import { WeeklyGoal } from "../WeeklyActivity";
import type { Metric, Workout, WorkoutPlan } from "../model";
import type { Video } from "../videos";
import {
  MiniStats,
  TodaySuggestion,
  WeekChecklist,
  WeightCard,
} from "./HomeCards";

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
  hidden,
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
  hidden: string[];
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
      <WeeklyGoal
        minutes={weekMinutes}
        goal={weeklyGoal}
        onChange={onGoalChange}
        onDraftChange={onGoalDraftChange}
      >
        <WeekChecklist {...checks} />
        <TodaySuggestion
          {...checks}
          seen={seen}
          hidden={hidden}
          onVideoDone={onVideoDone}
        />
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
