import React from 'react'
import { Zap, Gauge, Disc } from 'lucide-react'

function StatsFooter({ topSpeed, avgThrottle, avgBrake, theme }) {
  const primary = theme?.primary || '#00A19B'
  const card = theme?.card || '#12131a'
  const border = theme?.border || '#1e2028'

  const stats = [
    { label: 'Top Speed', value: topSpeed, unit: 'km/h', icon: Gauge, color: primary },
    { label: 'Avg Throttle', value: avgThrottle, unit: '%', icon: Zap, color: primary },
    { label: 'Avg Brake', value: avgBrake, unit: '%', icon: Disc, color: '#e74c3c' },
  ]

  return (
    <div className="mt-3 grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-2 py-2 px-3 rounded-xl border transition-all duration-200 hover:border-white/10" style={{ backgroundColor: card, borderColor: border }}>
          <stat.icon className="w-4 h-4 opacity-70" style={{ color: stat.color }} />
          <div>
            <p className="text-[9px] uppercase tracking-wider text-[#8a8a9a]">{stat.label}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-mono font-bold text-white">{stat.value}</span>
              <span className="text-[10px] text-[#8a8a9a]">{stat.unit}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default StatsFooter
