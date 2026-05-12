import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { F1_TEAMS } from '../utils/themes'
import { 
  Gamepad2, 
  BarChart3, 
  Activity, 
  LogOut, 
  Palette, 
  Check,
  MonitorPlay,
  History
} from 'lucide-react'

function HomePage() {
  const { user, theme, themeId, changeTheme, logout } = useApp()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${theme.primary}15`, border: `1px solid ${theme.primary}40` }}>
            <Activity className="w-4 h-4" style={{ color: theme.primary }} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">F1 Focus Telemetry</h1>
            <p className="text-[10px] text-[#8a8a9a]">Cognitive Monitoring Dashboard</p>
          </div>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img 
              src={user?.avatar} 
              alt={user?.displayName}
              className="w-8 h-8 rounded-full border-2 object-cover"
              style={{ borderColor: theme.primary }}
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
            <div className="w-8 h-8 rounded-full border-2 items-center justify-center text-xs font-bold text-white hidden" style={{ borderColor: theme.primary, backgroundColor: `${theme.primary}30` }}>
              {user?.displayName?.charAt(0)?.toUpperCase()}
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-white">{user?.displayName}</p>
              <p className="text-[9px] text-[#8a8a9a]">Steam Connected</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4 text-[#8a8a9a] hover:text-white" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Welcome back, {user?.displayName}</h2>
            <p className="text-sm text-[#8a8a9a] mt-1">Ready to monitor your cognitive performance?</p>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Start Session Card */}
            <button
              onClick={() => navigate('/dashboard')}
              className="group p-6 rounded-2xl border text-left transition-all duration-300 hover:scale-[1.02]"
              style={{ 
                backgroundColor: theme.card, 
                borderColor: theme.border,
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = theme.primary}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = theme.border}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${theme.primary}15` }}>
                    <MonitorPlay className="w-6 h-6" style={{ color: theme.primary }} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Live Dashboard</h3>
                  <p className="text-xs text-[#8a8a9a] leading-relaxed">
                    Start real-time cognitive monitoring while playing F1 25. 
                    View your focus level, telemetry data, and AI predictions live.
                  </p>
                </div>
                <Gamepad2 className="w-5 h-5 text-[#565F64] group-hover:text-white transition-colors" />
              </div>
            </button>

            {/* Records Card */}
            <button
              onClick={() => navigate('/records')}
              className="group p-6 rounded-2xl border text-left transition-all duration-300 hover:scale-[1.02]"
              style={{ 
                backgroundColor: theme.card, 
                borderColor: theme.border,
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = theme.primary}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = theme.border}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${theme.primary}15` }}>
                    <History className="w-6 h-6" style={{ color: theme.primary }} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Session Records</h3>
                  <p className="text-xs text-[#8a8a9a] leading-relaxed">
                    View all your past driving sessions, focus analysis results, 
                    and performance trends over time.
                  </p>
                </div>
                <BarChart3 className="w-5 h-5 text-[#565F64] group-hover:text-white transition-colors" />
              </div>
            </button>
          </div>

          {/* Theme Selector */}
          <div className="rounded-2xl border p-6" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4" style={{ color: theme.primary }} />
              <h3 className="text-sm font-bold text-white">Dashboard Theme</h3>
              <span className="text-[10px] text-[#8a8a9a] ml-2">Choose your favorite F1 team</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {F1_TEAMS.map((team) => (
                <button
                  key={team.id}
                  onClick={() => changeTheme(team.id)}
                  className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                    themeId === team.id ? 'ring-1' : 'hover:border-white/20'
                  }`}
                  style={{
                    backgroundColor: themeId === team.id ? `${team.primary}10` : 'rgba(255,255,255,0.02)',
                    borderColor: themeId === team.id ? team.primary : theme.border,
                    ringColor: team.primary,
                  }}
                >
                  {/* Color swatch */}
                  <div className="flex gap-0.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.primary }}></div>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.secondary }}></div>
                  </div>
                  <span className="text-[11px] font-medium text-white truncate">{team.name}</span>
                  {themeId === team.id && (
                    <Check className="w-3 h-3 absolute top-1 right-1" style={{ color: team.primary }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
