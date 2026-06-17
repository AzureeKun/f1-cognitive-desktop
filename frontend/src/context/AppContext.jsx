import React, { createContext, useContext, useState, useEffect } from 'react'
import { getTeamTheme, DEFAULT_THEME } from '../utils/themes'

const AppContext = createContext()

// Backend API URL (uses Vite env variable for production)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export function AppProvider({ children }) {
  // Auth state - loads from localStorage on startup (auto-login)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('f1_user')
    return saved ? JSON.parse(saved) : null
  })

  const [loading, setLoading] = useState(true)

  // Theme state
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem('f1_theme') || DEFAULT_THEME
  })

  const theme = getTeamTheme(themeId)

  // On first load: check URL params for Steam login callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    
    if (params.get('login_success') === 'true') {
      // Coming back from Steam login
      const userData = {
        steamId: params.get('steam_id'),
        displayName: params.get('display_name'),
        avatar: params.get('avatar'),
        profileUrl: params.get('profile_url'),
      }
      if (userData.steamId) {
        setUser(userData)
        // Clean URL params
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
    
    setLoading(false)
  }, [])

  // Persist user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('f1_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('f1_user')
    }
  }, [user])

  // Apply theme CSS variables
  useEffect(() => {
    localStorage.setItem('f1_theme', themeId)
    document.documentElement.style.setProperty('--color-primary', theme.primary)
    document.documentElement.style.setProperty('--color-secondary', theme.secondary)
    document.documentElement.style.setProperty('--color-accent', theme.accent)
    document.documentElement.style.setProperty('--color-bg', theme.bg)
    document.documentElement.style.setProperty('--color-card', theme.card)
    document.documentElement.style.setProperty('--color-border', theme.border)

    // Sync to backend for overlay
    fetch(`${API_URL}/api/theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: theme.id,
        name: theme.name,
        primary: theme.primary,
        secondary: theme.secondary,
        accent: theme.accent,
        bg: theme.bg,
        card: theme.card,
        border: theme.border,
      }),
    }).catch(() => {})
  }, [themeId, theme])

  /**
   * Redirects user to Steam OpenID login via backend.
   */
  const loginWithSteam = () => {
    window.location.href = `${API_URL}/api/auth/steam`
  }

  /**
   * Dev mode: simulate login without Steam.
   */
  const loginWithSteamMock = () => {
    setUser({
      steamId: '76561198884240051',
      displayName: 'RacerPro44',
      avatar: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg',
      profileUrl: 'https://steamcommunity.com/id/racerpro44',
    })
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('f1_user')
    fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
  }

  const changeTheme = (newThemeId) => {
    setThemeId(newThemeId)
    // Sync theme to backend (for Electron overlay)
    const newTheme = getTeamTheme(newThemeId)
    fetch(`${API_URL}/api/theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newTheme.id,
        name: newTheme.name,
        primary: newTheme.primary,
        secondary: newTheme.secondary,
        accent: newTheme.accent,
        bg: newTheme.bg,
        card: newTheme.card,
        border: newTheme.border,
      }),
    }).catch(() => {})
  }

  return (
    <AppContext.Provider value={{
      user,
      loading,
      theme,
      themeId,
      loginWithSteam,
      loginWithSteamMock,
      logout,
      changeTheme,
      apiUrl: API_URL,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
