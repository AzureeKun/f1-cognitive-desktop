import React from "react";
import { Flag, Signal, Network } from "lucide-react";
import imgDriver from "figma:asset/1ecb12199697dd16c82152392c0b02a04bd85271.png";

export function Header() {
  return (
    <header className="w-full bg-[#111111]/90 backdrop-blur-md border-b border-[#272b30] z-10 sticky top-0">
      <div className="flex flex-col lg:flex-row items-center justify-between px-6 py-4 gap-4 lg:gap-0 lg:h-20">
        <div className="flex items-center gap-6 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#1a1a1a] border border-[#272b30] rounded-xl flex items-center justify-center shrink-0">
              <Flag className="text-white w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-white font-bold text-xl lg:text-2xl tracking-[1.2px] uppercase font-['Rajdhani',sans-serif]">
                Monaco Grand Prix
              </h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#00a19c]" />
                  <span className="text-[#c6c6c6] text-xs lg:text-sm font-medium font-['Rajdhani',sans-serif]">
                    On Track
                  </span>
                </div>
                <div className="w-1 h-1 rounded-full bg-[#272b30]" />
                <span className="text-[#c6c6c6] text-xs lg:text-sm font-medium font-['Rajdhani',sans-serif]">
                  Q3 Session
                </span>
              </div>
            </div>
          </div>
          <div className="flex lg:hidden flex-col items-end">
            <span className="text-[#888] text-[10px] font-semibold tracking-[1.2px] uppercase font-['Rajdhani',sans-serif] pb-1">
              Lap Time
            </span>
            <span className="text-[#00a19c] text-xl font-mono leading-none">
              1:10.245
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 lg:gap-8 w-full lg:w-auto justify-between lg:justify-end overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          <div className="hidden lg:flex flex-col items-end shrink-0">
            <span className="text-[#888] text-xs font-semibold tracking-[1.2px] uppercase font-['Rajdhani',sans-serif] pb-1">
              Lap Time
            </span>
            <span className="text-[#00a19c] text-3xl font-mono leading-none">
              1:10.245
            </span>
          </div>
          
          <div className="hidden lg:block w-px h-10 bg-[#272b30] shrink-0" />
          
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex flex-col items-center">
              <Signal className="text-[#00a19c] w-4 h-4 mb-1" />
              <span className="text-[#c6c6c6] text-xs font-mono">98%</span>
            </div>
            <div className="flex flex-col items-center">
              <Network className="text-[#00a19c] w-4 h-4 mb-1" />
              <span className="text-[#c6c6c6] text-xs font-mono">12ms</span>
            </div>
          </div>

          <div className="hidden lg:block w-px h-10 bg-[#272b30] shrink-0" />
          
          <div className="flex items-center gap-3 bg-[#1a1a1a] border border-[#272b30] rounded-full pl-2 pr-4 py-1.5 shrink-0">
            <div className="w-8 h-8 rounded-full border border-[#272b30] overflow-hidden shrink-0">
              <img src={imgDriver} alt="Driver" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-white text-sm font-bold font-['Rajdhani',sans-serif] leading-tight whitespace-nowrap">
                L. HAMILTON
              </span>
              <span className="text-[#888] text-[10px] uppercase tracking-wider font-['Rajdhani',sans-serif] leading-tight">
                Car 44
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
