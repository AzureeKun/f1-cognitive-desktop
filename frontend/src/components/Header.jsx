import React from 'react'
import { Signal, Activity, User, ArrowLeft } from 'lucide-react'

function Header({ trackName, sessionType, isConnected, currentLapTime, accuracy, latency, driverName, carNumber, theme, onBack }) {
  const primary = theme?.primary || '#00A19B'
  const card = theme?.card || '#12131a'
  const border = theme?.border || '#1e2028'

  return (
    <header className="flex items-center justify-between rounded-xl px-5 py-2 border" style={{ backgroundColor: card, borderColor: border }}>
      {/* Left - Track Info */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-4 h-4 text-[#8a8a9a]" />
          </button>
        )}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primary}15`, border: `1px solid ${primary}40` }}>
          <Activity className="w-4 h-4" style={{ color: primary }} />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide">{trackName}</h1>
          <div className="flex items-center gap-2 text-[10px] text-[#8a8a9a]">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: isConnected ? primary : '#e74c3c' }}></span>
            <span>{isConnected ? 'On Track' : 'Disconnected'}</span>
            <span className="text-[#1e2028]">•</span>
            <span>{sessionType}</span>
          </div>
        </div>
      </div>

      {/* Center - Lap Time */}
      <div className="text-center">
        <p className="text-[9px] uppercase tracking-widest text-[#8a8a9a]">Lap Time</p>
        <p className="text-2xl font-mono font-bold tracking-tight" style={{ color: primary }}>{currentLapTime}</p>
      </div>

      {/* Right - System Stats & Driver */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <Signal className="w-3.5 h-3.5" style={{ color: primary }} />
            <span className="text-[#8a8a9a]">{accuracy}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" style={{ color: primary }} />
            <span className="text-[#8a8a9a]">{latency}ms</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs font-semibold text-white">{driverName}</p>
            <p className="text-[9px] text-[#8a8a9a]">CAR {carNumber}</p>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primary}20`, border: `1px solid ${primary}40` }}>
            <User className="w-3.5 h-3.5" style={{ color: primary }} />
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
