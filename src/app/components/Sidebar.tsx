import React from "react";
import { History, ChevronUp, ChevronDown } from "lucide-react";

export function Sidebar() {
  const lapData = [
    { lap: 14, time: "1:10.245", diff: "- 0.12s", better: true },
    { lap: 13, time: "1:10.367", diff: "+ 0.05s", better: false },
    { lap: 12, time: "1:10.312", diff: "- 0.4s", better: true },
    { lap: 11, time: "1:10.712", diff: "", better: null },
  ];

  return (
    <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
      {/* Lap History Card */}
      <div className="flex-1 bg-[#1a1a1a] border border-[#272b30] rounded-2xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#c6c6c6] text-sm font-bold uppercase tracking-[1.4px] font-['Rajdhani',sans-serif]">
            Lap History
          </h2>
          <History className="w-4 h-4 text-[#888]" />
        </div>
        
        <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1">
          {lapData.map((lap, i) => (
            <div 
              key={lap.lap} 
              className={`flex items-center justify-between p-3 rounded-xl border ${
                i === 0 ? "bg-[#111] border-[#00a19c]/30 shadow-[inset_0_0_20px_rgba(0,161,156,0.05)]" : "bg-[#111] border-[#272b30]"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-[#888] text-xs font-mono mb-1">LAP {lap.lap}</span>
                <span className={`text-base font-mono ${i === 0 ? "text-[#00a19c]" : "text-white"}`}>
                  {lap.time}
                </span>
              </div>
              {lap.better !== null && (
                <div className="flex items-center gap-1">
                  {lap.better ? (
                    <ChevronDown className="w-3 h-3 text-[#2ea043]" />
                  ) : (
                    <ChevronUp className="w-3 h-3 text-[#80142b]" />
                  )}
                  <span className={`text-xs font-mono ${lap.better ? "text-[#2ea043]" : "text-[#80142b]"}`}>
                    {lap.diff.replace(/[-+]\s/, '')}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-[#1a1a1a] border border-[#272b30] rounded-2xl p-4 h-24 flex">
        <div className="flex-1 flex flex-col justify-center border-r border-[#272b30]/50 pr-4">
          <span className="text-[#888] text-[10px] uppercase tracking-wider font-['Rajdhani',sans-serif] mb-1">
            Top Speed
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-white text-xl font-mono">312</span>
            <span className="text-[#888] text-xs font-mono">km/h</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center pl-4">
          <span className="text-[#888] text-[10px] uppercase tracking-wider font-['Rajdhani',sans-serif] mb-1">
            Max G
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-white text-xl font-mono">4.8</span>
            <span className="text-[#888] text-xs font-mono">G</span>
          </div>
        </div>
      </div>
    </div>
  );
}
