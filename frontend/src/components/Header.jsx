import React from 'react'
import { Signal, Activity, User, ArrowLeft, Monitor } from 'lucide-react'

function Header({ trackName, sessionType, isConnected, currentLapTime, focusScore, driverName, avatar, theme, onBack, isLiveOn, onToggleLive, onOpenOverlay, isOverlayOn }) {
  const primary = theme?.primary || '#00A19B'
  const card = theme?.card || '#12131a'
  const border = theme?.border || '#1e2028'

  return (
    <header className="flex items-center justify-between rounded-xl px-5 py-2 border" style={{ backgroundColor: card, borderColor: border }}>
      {/* Left - Track Info + Controls */}
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
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isConnected ? primary : '#e74c3c', animation: isConnected ? 'pulse 2s infinite' : 'none' }}></span>
            <span>{isConnected ? 'On Track' : 'Disconnected'}</span>
            <span className="text-[#1e2028]">•</span>
            <span>{sessionType}</span>
          </div>
        </div>

        {/* Live Telemetry Toggle */}
        <button
          onClick={onToggleLive}
          className="ml-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200"
          style={{
            backgroundColor: isLiveOn ? `${primary}20` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isLiveOn ? primary : '#2a2b35'}`,
            color: isLiveOn ? primary : '#8a8a9a',
          }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isLiveOn ? primary : '#565F64' }}></span>
          {isLiveOn ? 'LIVE ON' : 'LIVE OFF'}
        </button>

        {/* Open Overlay Button */}
        <button
          onClick={onOpenOverlay}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200"
          style={{
            backgroundColor: isOverlayOn ? `${primary}20` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isOverlayOn ? primary : '#2a2b35'}`,
            color: isOverlayOn ? primary : '#8a8a9a',
          }}
        >
          <Monitor className="w-3 h-3" />
          {isOverlayOn ? 'Overlay On' : 'Overlay'}
        </button>
      </div>

      {/* Center - Lap Time */}
      <div className="text-center">
        <p className="text-[9px] uppercase tracking-widest text-[#8a8a9a]">Lap Time</p>
        <p className="text-2xl font-mono font-bold tracking-tight" style={{ color: primary }}>{currentLapTime}</p>
      </div>

      {/* Right - Focus Score & Driver */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1 text-[10px]">
          <Signal className="w-3.5 h-3.5" style={{ color: primary }} />
          <span className="text-[#8a8a9a]">Focus: {focusScore}%</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs font-semibold text-white">{driverName}</p>
          </div>
          {avatar ? (
            <img src={avatar} alt={driverName} className="w-8 h-8 rounded-full object-cover" style={{ border: `2px solid ${primary}40` }} />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primary}20`, border: `1px solid ${primary}40` }}>
              <User className="w-3.5 h-3.5" style={{ color: primary }} />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
