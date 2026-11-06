import type { ReactNode } from "react";
import { Play, ChevronRight } from "lucide-react";
import type { VideoCategory } from "../videos";
export function WeeklyPage({
  schedule,
  onVideo,
}: {
  schedule: ReactNode;
  onVideo: (category: VideoCategory) => void;
}) {
  return (
    <div className="two-column">
      {schedule}
      <section className="card">
        <span className="eyebrow">在家，也能好好動</span>
        <h2>居家訓練小指南</h2>
        <p className="guide">
          建議先暖身 5
          分鐘，再依能力進行深蹲、靠牆伏地挺身、臀橋與鳥狗式，最後緩和伸展。從舒服的強度開始，疼痛或不適時停止。
        </p>
        {(
          [
            ["居家徒手", "居家徒手訓練影片"],
            ["快走／跑步機", "上坡快走／跑步機影片"],
            ["暖身", "運動前暖身"],
            ["伸展放鬆", "運動後伸展"],
          ] as const
        ).map(([category, label]) => (
          <button
            key={category}
            className="video-link"
            onClick={() => onVideo(category)}
          >
            <Play size={20} />
            {label}
            <ChevronRight size={16} />
          </button>
        ))}
        <p className="tiny muted">
          影片在 App 內直接播放，需網路連線。課表可依自己的生活步調調整。
        </p>
      </section>
    </div>
  );
}
