import React from "react";
import { Brain } from "lucide-react";

interface CognitiveScoreProps {
  status?: "Focused" | "Distracted";
  score?: number;
}

export function CognitiveScore({ status = "Focused", score = 92 }: CognitiveScoreProps) {
  const isFocused = status === "Focused";
  const colorHex = isFocused ? "#00A19C" : "#E53935";
  const bgClass = isFocused 
    ? "bg-gradient-to-br from-[#00A19C]/10 to-transparent" 
    : "bg-gradient-to-br from-[#E53935]/10 to-transparent";

  // SVG Circular progress math
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={`relative h-full w-full bg-[#1a1a1a] border border-[#272b30] rounded-2xl p-5 flex flex-col justify-between overflow-hidden ${bgClass}`}>
      {/* Background radial glow */}
      <div 
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: colorHex }}
      />
      
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h2 className="text-[#c6c6c6] text-sm font-bold uppercase tracking-[1.4px] font-['Rajdhani',sans-serif]">
            Cognitive Score
          </h2>
          <span className="text-[#888] text-[10px] uppercase tracking-wider font-['Rajdhani',sans-serif]">
            Real-time Biometrics
          </span>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#111] border border-white/10 flex items-center justify-center">
          <Brain className="w-4 h-4" style={{ color: colorHex }} />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 py-4 relative z-10">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="#272B30"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke={colorHex}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <div className="flex items-baseline">
              <span className="text-white text-4xl font-mono">{score}</span>
              <span className="text-[#888] text-lg font-mono">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center relative z-10">
        <div 
          className="px-4 py-1 rounded-full border border-current bg-black/40"
          style={{ color: colorHex }}
        >
          <span className="text-xs font-bold uppercase tracking-widest font-['Rajdhani',sans-serif]">
            {isFocused ? "Optimal Focus" : "Distracted"}
          </span>
        </div>
      </div>
    </div>
  );
}
