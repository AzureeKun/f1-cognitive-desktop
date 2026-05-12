import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Activity
} from 'lucide-react'

// Mock session records (will be replaced with database data)
const MOCK_SESSIONS = [
  {
    id: 1,
    date: '2026-05-10',
    time: '14:32',
    track: 'Monaco',
    mode: 'Time Trial',
    laps: 14,
    duration: '18:45',
    avgFocus: 92,
    minFocus: 78,
    topSpeed: 298,
    avgLapTime: '1:10.342',
    bestLap: '1:10.112',
    trend: 'up',
  },
  {
    id: 2,
    date: '2026-05-08',
    time: '20:15',
    track: 'Silverstone',
    mode: 'Grand Prix',
    laps: 52,
    duration: '1:28:12',
    avgFocus: 87,
    minFocus: 65,
    topSpeed: 342,
    avgLapTime: '1:27.891',
    bestLap: '1:26.445',
    trend: 'down',
  },
  {
    id: 3,
    date: '2026-05-06',
    time: '16:00',
    track: 'Spa-Francorchamps',
    mode: 'Time Trial',
    laps: 8,
    duration: '14:22',
    avgFocus: 95,
    minFocus: 88,
    topSpeed: 338,
    avgLapTime: '1:44.221',
    bestLap: '1:43.887',
    trend: 'up',
  },
  {
    id: 4,
    date: '2026-05-04',
    time: '21:30',
    track: 'Monza',
    mode: 'Grand Prix',
    laps: 53,
    duration: '1:15:33',
    avgFocus: 81,
    minFocus: 58,
    topSpeed: 356,
    avgLapTime: '1:21.556',
    bestLap: '1:20.112',
    trend: 'down',
  },
  {
    id: 5,
    date: '2026-05-02',
    time: '19:00',
    track: 'Suzuka',
    mode: 'Time Trial',
    laps: 10,
    duration: '13:50',
    avgFocus: 90,
    minFocus: 82,
    topSpeed: 318,
    avgLapTime: '1:29.445',
    bestLap: '1:28.990',
    trend: 'up',
  },
]

function RecordsPage() {
  const { theme } = useApp()
  const navigate = useNavigate()

  const getFocusColor = (score) => {
    if (score >= 90) return theme.primary
    if (score >= 80) return '#f5a623'
    return '#e74c3c'
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/home')}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#8a8a9a]" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white">Session Records</h1>
            <p className="text-[10px] text-[#8a8a9a]">Your driving history & cognitive analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#8a8a9a]">
          <Activity className="w-3.5 h-3.5" style={{ color: theme.primary }} />
          <span>{MOCK_SESSIONS.length} sessions recorded</span>
        </div>
      </header>

      {/* Table Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Sessions', value: MOCK_SESSIONS.length },
              { label: 'Avg Focus', value: `${Math.round(MOCK_SESSIONS.reduce((a, s) => a + s.avgFocus, 0) / MOCK_SESSIONS.length)}%` },
              { label: 'Total Laps', value: MOCK_SESSIONS.reduce((a, s) => a + s.laps, 0) },
              { label: 'Best Focus', value: `${Math.max(...MOCK_SESSIONS.map(s => s.avgFocus))}%` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border px-4 py-3" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                <p className="text-[9px] uppercase tracking-wider text-[#8a8a9a]">{stat.label}</p>
                <p className="text-lg font-mono font-bold text-white mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Sessions Table */}
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b text-[9px] uppercase tracking-wider text-[#565F64] font-medium" style={{ borderColor: theme.border }}>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Track</div>
              <div className="col-span-1">Mode</div>
              <div className="col-span-1">Laps</div>
              <div className="col-span-1">Duration</div>
              <div className="col-span-1">Avg Focus</div>
              <div className="col-span-1">Min Focus</div>
              <div className="col-span-1">Top Speed</div>
              <div className="col-span-1">Best Lap</div>
              <div className="col-span-1">Trend</div>
            </div>

            {/* Table Rows */}
            {MOCK_SESSIONS.map((session, index) => (
              <div 
                key={session.id}
                className="grid grid-cols-12 gap-2 px-4 py-3 border-b items-center hover:bg-white/[0.02] transition-colors cursor-pointer"
                style={{ borderColor: theme.border }}
              >
                {/* Date */}
                <div className="col-span-2 flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-[#565F64]" />
                  <div>
                    <p className="text-xs text-white font-medium">{session.date}</p>
                    <p className="text-[9px] text-[#565F64]">{session.time}</p>
                  </div>
                </div>

                {/* Track */}
                <div className="col-span-2 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" style={{ color: theme.primary }} />
                  <span className="text-xs text-white">{session.track}</span>
                </div>

                {/* Mode */}
                <div className="col-span-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full border text-[#8a8a9a]" style={{ borderColor: theme.border }}>
                    {session.mode}
                  </span>
                </div>

                {/* Laps */}
                <div className="col-span-1">
                  <span className="text-xs font-mono text-white">{session.laps}</span>
                </div>

                {/* Duration */}
                <div className="col-span-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#565F64]" />
                  <span className="text-[11px] font-mono text-[#C8CCCE]">{session.duration}</span>
                </div>

                {/* Avg Focus */}
                <div className="col-span-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getFocusColor(session.avgFocus) }}></div>
                    <span className="text-xs font-mono font-bold" style={{ color: getFocusColor(session.avgFocus) }}>
                      {session.avgFocus}%
                    </span>
                  </div>
                </div>

                {/* Min Focus */}
                <div className="col-span-1">
                  <span className="text-xs font-mono" style={{ color: getFocusColor(session.minFocus) }}>
                    {session.minFocus}%
                  </span>
                </div>

                {/* Top Speed */}
                <div className="col-span-1">
                  <span className="text-xs font-mono text-white">{session.topSpeed} <span className="text-[9px] text-[#565F64]">km/h</span></span>
                </div>

                {/* Best Lap */}
                <div className="col-span-1">
                  <span className="text-xs font-mono" style={{ color: theme.primary }}>{session.bestLap}</span>
                </div>

                {/* Trend */}
                <div className="col-span-1">
                  {session.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4" style={{ color: theme.primary }} />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[#e74c3c]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecordsPage
