import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Activity, Shield, Cpu, BarChart3, AlertCircle } from 'lucide-react'

function LoginPage() {
  const { user, loginWithSteam, loginWithSteamMock } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // If already logged in, redirect to home
  useEffect(() => {
    if (user) {
      navigate('/home')
    }
  }, [user, navigate])

  // Check for error from Steam callback
  const error = searchParams.get('error')

  return (
    <div className="h-screen w-screen bg-[#0a0a0f] flex items-center justify-center overflow-hidden relative">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#04BFAD]/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#04BFAD]/3 rounded-full blur-[100px]"></div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#04BFAD]/10 border border-[#04BFAD]/30 rounded-2xl mb-4">
            <Activity className="w-8 h-8 text-[#04BFAD]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">F1 Focus Telemetry</h1>
          <p className="text-sm text-[#8a8a9a] mt-2">Cognitive Monitoring System for F1 Drivers</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs text-red-300">
              {error === 'auth_failed' && 'Steam authentication was cancelled or failed.'}
              {error === 'validation_failed' && 'Could not verify Steam login. Please try again.'}
              {error === 'no_steam_id' && 'Could not retrieve your Steam ID.'}
              {error === 'profile_fetch_failed' && 'Could not fetch your Steam profile.'}
              {!['auth_failed', 'validation_failed', 'no_steam_id', 'profile_fetch_failed'].includes(error) && 'An error occurred. Please try again.'}
            </p>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-[#12131a] border border-[#1e2028] rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white text-center mb-2">Welcome</h2>
          <p className="text-xs text-[#8a8a9a] text-center mb-6">
            Sign in with your Steam account to access the cognitive monitoring dashboard
          </p>

          {/* Steam Login Button (Real) */}
          <button
            onClick={loginWithSteam}
            className="w-full flex items-center justify-center gap-3 bg-[#171a21] hover:bg-[#1b2838] border border-[#2a475e] rounded-xl px-6 py-3.5 transition-all duration-200 hover:border-[#66c0f4] group"
          >
            {/* Steam Logo */}
            <svg className="w-6 h-6" viewBox="0 0 256 259" xmlns="http://www.w3.org/2000/svg">
              <path d="M128.715 0C60.195 0 4.29 52.212.399 118.736l69.477 28.7a36.37 36.37 0 0 1 20.58-6.352c.682 0 1.356.02 2.023.06l30.794-44.609v-.626c0-26.9 21.887-48.786 48.794-48.786 26.9 0 48.793 21.893 48.793 48.808 0 26.9-21.893 48.794-48.793 48.794h-1.133l-43.89 31.318c0 .539.026 1.085.026 1.617 0 20.167-16.39 36.55-36.564 36.55-17.856 0-32.756-12.823-35.96-29.77L4.006 158.07C18.596 214.326 68.975 255.5 128.715 255.5c71.094 0 128.715-57.614 128.715-128.715C257.43 55.786 199.809 0 128.715 0" fill="#66c0f4" className="group-hover:fill-[#a4d7f5] transition-all"/>
            </svg>
            <span className="text-[#c7d5e0] font-medium group-hover:text-white transition-colors">
              Sign in with Steam
            </span>
          </button>

          {/* Dev Mode Login */}
          <button
            onClick={() => { loginWithSteamMock() }}
            className="w-full mt-3 flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 border border-[#1e2028] rounded-xl px-6 py-2.5 transition-all duration-200 hover:border-[#565F64]"
          >
            <Cpu className="w-4 h-4 text-[#565F64]" />
            <span className="text-[#565F64] text-xs font-medium">
              Dev Mode (Skip Login)
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#1e2028]"></div>
            <span className="text-[10px] text-[#565F64] uppercase tracking-wider">Why Steam?</span>
            <div className="flex-1 h-px bg-[#1e2028]"></div>
          </div>

          {/* Info Points */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs text-[#8a8a9a]">
              <Shield className="w-4 h-4 text-[#04BFAD] shrink-0" />
              <span>Secure authentication via Steam OpenID</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#8a8a9a]">
              <Cpu className="w-4 h-4 text-[#04BFAD] shrink-0" />
              <span>Links your F1 25 game data automatically</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#8a8a9a]">
              <BarChart3 className="w-4 h-4 text-[#04BFAD] shrink-0" />
              <span>Track cognitive performance across sessions</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-[#565F64] mt-6">
          Pemantauan Kognitif Pemandu F1 • UKM FTSM 2025
        </p>
      </div>
    </div>
  )
}

export default LoginPage
