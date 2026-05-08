import React from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { generateSpeedData, generateSteeringData, generatePedalData } from "../utils/mockData";

import { CognitiveScore } from "./CognitiveScore";

interface TelemetryChartsProps {
  focusStatus: "Focused" | "Distracted";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111]/90 border border-[#272b30] p-2 rounded text-xs font-mono backdrop-blur">
        <p className="text-[#888] mb-1">Dist: {label}m</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {entry.value.toFixed(1)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function TelemetryCharts({ focusStatus }: TelemetryChartsProps) {
  const speedData = React.useMemo(() => generateSpeedData(), []);
  const steeringData = React.useMemo(() => generateSteeringData(), []);
  const pedalData = React.useMemo(() => generatePedalData(), []);

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Top Row: Cognitive Score, Speed, Steering */}
      <div className="flex flex-col lg:flex-row gap-4 lg:h-64 shrink-0">
        <div className="w-full lg:w-1/3 flex">
          <div className="flex-1 min-h-[256px]">
            <CognitiveScore status={focusStatus} score={focusStatus === "Focused" ? 92 : 45} />
          </div>
        </div>
        
        {/* Speed Telemetry */}
        <div className="w-full lg:w-1/3 bg-[#1a1a1a] border border-[#272b30] rounded-2xl p-4 flex flex-col min-h-[256px]">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-[#c6c6c6] text-sm font-bold uppercase tracking-[1.4px] font-['Rajdhani',sans-serif]">
              Speed Telemetry
            </h2>
            <div className="flex items-baseline gap-1">
              <span className="text-white text-xl font-mono leading-none">285</span>
              <span className="text-[#888] text-[10px] font-mono">km/h</span>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={speedData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fff" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#272b30" vertical={false} />
                <XAxis dataKey="distance" hide />
                <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false} tickCount={6} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="speed" 
                  name="Speed"
                  stroke="#fff" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#speedGrad)" 
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Steering Angle */}
        <div className="w-full lg:w-1/3 bg-[#1a1a1a] border border-[#272b30] rounded-2xl p-4 flex flex-col min-h-[256px]">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-[#c6c6c6] text-sm font-bold uppercase tracking-[1.4px] font-['Rajdhani',sans-serif]">
              Steering Angle
            </h2>
            <div className="flex items-baseline gap-1">
              <span className="text-white text-xl font-mono leading-none">-12.4</span>
              <span className="text-[#888] text-[10px] font-mono">°</span>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={steeringData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#272b30" vertical={false} />
                <XAxis dataKey="distance" hide />
                <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false} domain={[-60, 60]} ticks={[-40, -20, 0, 20, 40]} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="angle" 
                  name="Angle"
                  stroke="#888" 
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row: Combined Pedal Input */}
      <div className="flex-1 bg-[#1a1a1a] border border-[#272b30] rounded-2xl p-5 flex flex-col min-h-[300px]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-[#c6c6c6] text-sm font-bold uppercase tracking-[1.4px] font-['Rajdhani',sans-serif]">
              Combined Pedal Input
            </h2>
            <span className="text-[#888] text-[10px] uppercase tracking-wider font-['Rajdhani',sans-serif]">
              Throttle vs Brake pressure over distance
            </span>
          </div>
          <div className="flex gap-4 border border-[#272b30] bg-[#111] px-3 py-1.5 rounded-full">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00a19c]" />
              <span className="text-[#c6c6c6] text-xs font-mono">Throttle</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#E53935]" />
              <span className="text-[#c6c6c6] text-xs font-mono">Brake</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 w-full min-h-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pedalData} margin={{ top: 5, right: 0, left: -20, bottom: 20 }}>
              <defs>
                <linearGradient id="throttleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00a19c" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#00a19c" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="brakeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E53935" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#E53935" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#272b30" vertical={true} horizontal={true} />
              <XAxis 
                dataKey="distance" 
                stroke="#888" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                tickCount={10}
                dy={10}
                label={{ value: 'Distance (m)', position: 'insideBottom', offset: -10, fill: '#888', fontSize: 10 }}
              />
              <YAxis 
                stroke="#888" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                domain={[0, 100]} 
                ticks={[0, 20, 40, 60, 80, 100]}
                label={{ value: 'Input %', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="throttle" 
                name="Throttle"
                stroke="#00a19c" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#throttleGrad)" 
                isAnimationActive={false}
              />
              <Area 
                type="monotone" 
                dataKey="brake" 
                name="Brake"
                stroke="#E53935" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#brakeGrad)" 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
