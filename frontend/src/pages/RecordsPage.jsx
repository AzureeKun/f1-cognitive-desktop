import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getSessions, getUserStats } from '../utils/api'
import { ArrowLeft, Calendar, Clock, Activity, Loader2, TrendingUp, Flag, Timer, Zap } from 'lucide-react'

function RecordsPage() {
  const { user, theme } = useApp()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
        setError('Failed to load records.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  const getFocusColor = (score) => {
    if (score >= 80) return '#22c55e'
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

  const formatLapTime = (seconds) => {
    if (!seconds || seconds <= 0) return '--'
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(3)
    return `${mins}:${secs.padStart(6, '0')}`
  }

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const primary = theme?.primary || '#04BFAD'
  const completedSessions = sessions.filter(s => !s.isActive)

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/home')} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-4 h-4 text-[#8a8a9a]" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white">Session Records</h1>
            <p className="text-[10px] text-[#8a8a9a]">Cognitive performance archive</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#8a8a9a]">
          <Activity className="w-3.5 h-3.5" style={{ color: primary }} />
          <span>{completedSessions.length} completed sessions</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: primary }} />
              <span className="ml-2 text-sm text-[#8a8a9a]">Loading...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-center">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Sessions', value: stats?.totalSessions || completedSessions.length, icon: Activity },
                  { label: 'Avg Focus', value: stats?.averageFocus > 0 ? `${stats.averageFocus}%` : '--', icon: TrendingUp },
                  { label: 'Total Laps', value: stats?.totalLaps || 0, icon: Flag },
                  { label: 'Best Focus', value: stats?.bestFocus > 0 ? `${stats.bestFocus}%` : '--', icon: Zap },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-xl border px-4 py-3" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-3 h-3" style={{ color: primary }} />
                      <p className="text-[9px] uppercase tracking-wider text-[#8a8a9a]">{label}</p>
                    </div>
                    <p className="text-xl font-mono font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>

              {/* Sessions List */}
              {completedSessions.length === 0 ? (
                <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: primary }} />
                  <p className="text-sm text-[#8a8a9a]">No completed sessions yet.</p>
                  <p className="text-xs text-[#565F64] mt-1">Toggle 'Live On' and complete at least one lap.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedSessions.map((session) => {
                    const focus = session.focusResult?.averageFocusPct || 0
                    const laps = session.totalLaps || 0
                    const level = session.focusResult?.focusLevel || 'N/A'
                    const fastest = session.fastestLap
                    const duration = session.durationSeconds

                    return (
                      <div key={session.id} className="rounded-xl border p-5 transition-colors hover:border-opacity-60"
                        style={{ backgroundColor: theme.card, borderColor: theme.border }}>
                        
                        <div className="flex items-center justify-between">
                          {/* Left: Focus indicator + Date */}
                          <div className="flex items-center gap-4">
                            {/* Focus ring mini */}
                            <div className="w-14 h-14 rounded-full flex items-center justify-center relative"
                              style={{ border: `3px solid ${getFocusColor(focus)}`, backgroundColor: `${getFocusColor(focus)}10` }}>
                              <span className="text-sm font-mono font-bold" style={{ color: getFocusColor(focus) }}>
                                {focus > 0 ? Math.round(focus) : '--'}
                              </span>
                            </div>
                            
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm text-white font-semibold">{formatDate(session.startTime)}</span>
                                <span className="text-[10px] text-[#565F64]">{formatTime(session.startTime)}</span>
                              </div>
                              <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: getFocusColor(focus) }}>
                                {level}
                              </p>
                              <p className="text-[10px] text-[#565F64] mt-0.5">{session.trackName} • {session.gameMode}</p>
                            </div>
                          </div>

                          {/* Right: Metrics */}
                          <div className="flex items-center gap-6">
                            {/* Laps */}
                            <div className="text-center">
                              <div className="flex items-center gap-1 justify-center mb-0.5">
                                <Flag className="w-3 h-3 text-[#8a8a9a]" />
                                <span className="text-[9px] uppercase text-[#8a8a9a]">Laps</span>
                              </div>
                              <span className="text-lg font-mono font-bold text-white">{laps}</span>
                            </div>

                            {/* Fastest Lap */}
                            <div className="text-center">
                              <div className="flex items-center gap-1 justify-center mb-0.5">
                                <Timer className="w-3 h-3 text-[#8a8a9a]" />
                                <span className="text-[9px] uppercase text-[#8a8a9a]">Fastest</span>
                              </div>
                              <span className="text-sm font-mono font-bold text-white">{formatLapTime(fastest)}</span>
                            </div>

                            {/* Duration */}
                            <div className="text-center">
                              <div className="flex items-center gap-1 justify-center mb-0.5">
                                <Clock className="w-3 h-3 text-[#8a8a9a]" />
                                <span className="text-[9px] uppercase text-[#8a8a9a]">Duration</span>
                              </div>
                              <span className="text-sm font-mono text-white">{formatDuration(duration)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
