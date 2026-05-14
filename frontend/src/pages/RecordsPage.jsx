import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getSessions, getUserStats } from '../utils/api'
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Loader2
} from 'lucide-react'

function RecordsPage() {
  const { user, theme } = useApp()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch sessions and stats from Firebase via backend
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.steamId) return

      try {
        setLoading(true)
        const [sessionsRes, statsRes] = await Promise.all([
          getSessions(user.steamId),
          getUserStats(user.steamId),
        ])

        setSessions(sessionsRes.sessions || [])
        setStats(statsRes.stats || null)
      } catch (err) {
        console.error('Failed to fetch records:', err)
        setError('Failed to load session records. Make sure the backend is running.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const getFocusColor = (score) => {
    if (score >= 80) return theme.primary
    if (score >= 50) return '#f5a623'
    return '#e74c3c'
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '--'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return '--'
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
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
          <span>{sessions.length} sessions recorded</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto">

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.primary }} />
              <span className="ml-2 text-sm text-[#8a8a9a]">Loading records...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-center">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Content when loaded */}
          {!loading && !error && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Total Sessions', value: stats?.totalSessions || sessions.length },
                  { label: 'Avg Focus', value: stats?.averageFocus ? `${stats.averageFocus}%` : '--' },
                  { label: 'Total Laps', value: stats?.totalLaps || 0 },
                  { label: 'Best Focus', value: stats?.bestFocus ? `${stats.bestFocus}%` : '--' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border px-4 py-3" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                    <p className="text-[9px] uppercase tracking-wider text-[#8a8a9a]">{stat.label}</p>
                    <p className="text-lg font-mono font-bold text-white mt-0.5">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Sessions List */}
              {sessions.length === 0 ? (
                <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: theme.primary }} />
                  <p className="text-sm text-[#8a8a9a]">No sessions recorded yet.</p>
                  <p className="text-xs text-[#565F64] mt-1">Start a live session from the Home page to begin recording.</p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b text-[9px] uppercase tracking-wider text-[#565F64] font-medium" style={{ borderColor: theme.border }}>
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2">Track</div>
                    <div className="col-span-2">Mode</div>
                    <div className="col-span-1">Laps</div>
                    <div className="col-span-2">Focus Level</div>
                    <div className="col-span-1">Score</div>
                    <div className="col-span-2">Status</div>
                  </div>

                  {/* Table Rows */}
                  {sessions.map((session) => (
                    <div 
                      key={session.id}
                      className="grid grid-cols-12 gap-2 px-4 py-3 border-b items-center hover:bg-white/[0.02] transition-colors cursor-pointer"
                      style={{ borderColor: theme.border }}
                      onClick={() => navigate(`/dashboard`)}
                    >
                      {/* Date */}
                      <div className="col-span-2 flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-[#565F64]" />
                        <div>
                          <p className="text-xs text-white font-medium">{formatDate(session.startTime)}</p>
                          <p className="text-[9px] text-[#565F64]">{formatTime(session.startTime)}</p>
                        </div>
                      </div>

                      {/* Track */}
                      <div className="col-span-2 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" style={{ color: theme.primary }} />
                        <span className="text-xs text-white">{session.trackName || 'Unknown'}</span>
                      </div>

                      {/* Mode */}
                      <div className="col-span-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full border text-[#8a8a9a]" style={{ borderColor: theme.border }}>
                          {session.gameMode || 'Unknown'}
                        </span>
                      </div>

                      {/* Laps */}
                      <div className="col-span-1">
                        <span className="text-xs font-mono text-white">{session.totalLaps || 0}</span>
                      </div>

                      {/* Focus Level */}
                      <div className="col-span-2">
                        {session.focusResult ? (
                          <span className="text-xs font-medium" style={{ color: getFocusColor(session.focusResult.averageFocusPct) }}>
                            {session.focusResult.focusLevel}
                          </span>
                        ) : (
                          <span className="text-xs text-[#565F64]">Not analyzed</span>
                        )}
                      </div>

                      {/* Score */}
                      <div className="col-span-1">
                        {session.focusResult ? (
                          <span className="text-xs font-mono font-bold" style={{ color: getFocusColor(session.focusResult.averageFocusPct) }}>
                            {Math.round(session.focusResult.averageFocusPct)}%
                          </span>
                        ) : (
                          <span className="text-xs text-[#565F64]">--</span>
                        )}
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${session.isActive ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-[#1e2028] text-[#8a8a9a] border border-[#2a2a35]'}`}>
                          {session.isActive ? '● Live' : 'Completed'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default RecordsPage
