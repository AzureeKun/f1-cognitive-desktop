import React from 'react'
import { Brain } from 'lucide-react'

function CognitiveScore({ score, status, confidence, theme }) {
  const primary = theme?.primary || '#00A19B'
  const card = theme?.card || '#12131a'
  const border = theme?.border || '#1e2028'

  const getColor = () => {
    if (score >= 90) return primary
    if (score >= 80) return '#f5a623'
    return '#e74c3c'
  }

  const ringColor = getColor()
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-xl border p-3" style={{ backgroundColor: card, borderColor: border }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white">Cognitive Score</h3>
          <p className="text-[9px] text-[#8a8a9a]">Real-Time Biometrics</p>
        </div>
        <Brain className="w-4 h-4" style={{ color: primary }} />
      </div>

      {/* Circular Progress */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="relative">
          <svg width="130" height="130" className="transform -rotate-90">
            <circle cx="65" cy="65" r={radius} stroke="#1e2028" strokeWidth="7" fill="none" />
            <circle
              cx="65" cy="65" r={radius}
              stroke={ringColor}
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
              style={{ filter: `drop-shadow(0 0 6px ${ringColor})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-mono font-bold" style={{ color: ringColor }}>{score}</span>
            <span className="text-sm" style={{ color: ringColor }}>%</span>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex justify-center mt-1">
        <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border" style={{ color: ringColor, borderColor: `${ringColor}40`, backgroundColor: `${ringColor}10` }}>
          {status}
        </span>
      </div>
    </div>
  )
}

export default CognitiveScore
