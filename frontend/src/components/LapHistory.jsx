import React from 'react'
import { RotateCcw } from 'lucide-react'

function LapHistory({ laps, theme }) {
  const primary = theme?.primary || '#00A19B'
  const card = theme?.card || '#12131a'
  const border = theme?.border || '#1e2028'
  const bg = theme?.bg || '#0a0a0f'

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-xl border p-3" style={{ backgroundColor: card, borderColor: border }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white">Lap History</h3>
        <RotateCcw className="w-3.5 h-3.5 text-[#8a8a9a] hover:text-white cursor-pointer transition-colors" />
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto min-h-0">
        {laps.map((lap, index) => (
          <div
            key={lap.lap}
            className="p-2.5 rounded-lg border transition-all duration-200"
            style={{
              borderColor: index === 0 ? `${primary}40` : border,
              backgroundColor: index === 0 ? `${primary}08` : `${bg}80`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] uppercase text-[#8a8a9a] tracking-wider">Lap {lap.lap}</p>
                <p className="text-base font-mono font-bold text-white">{lap.time}</p>
              </div>
              {lap.delta !== null && (
                <span className={`text-[10px] font-mono font-medium`} style={{ color: lap.delta < 0 ? primary : '#e74c3c' }}>
                  {lap.delta < 0 ? '' : '+'}{lap.delta}s
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LapHistory
