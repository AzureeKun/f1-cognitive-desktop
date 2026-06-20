import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { io } from 'socket.io-client'
import Header from '../components/Header'
import CognitiveScore from '../components/CognitiveScore'
import SpeedTelemetry from '../components/SpeedTelemetry'
import SteeringAngle from '../components/SteeringAngle'
import LapHistory from '../components/LapHistory'
import PedalInput from '../components/PedalInput'
import TelemetryTrace from '../components/TelemetryTrace'
import StatsFooter from '../components/StatsFooter'

const API_URL = import.meta.env.VITE_API_URL || API_URL

function DashboardPage() {
  const { user, theme } = useApp()
  const navigate = useNavigate()

  const [isConnected, setIsConnected] = useState(false)
  const [isLiveOn, setIsLiveOn] = useState(false)
  const [isOverlayOn, setIsOverlayOn] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [currentData, setCurrentData] = useState({
    speed: 0, steeringAngle: 0, throttle: 0, brake: 0, lapTime: 0, lapDistance: 0,
  })
  const [speedHistory, setSpeedHistory] = useState([])
  const [steeringHistory, setSteeringHistory] = useState([])
  const [throttleHistory, setThrottleHistory] = useState([])
  const [brakeHistory, setBrakeHistory] = useState([])
  const [distanceLabels, setDistanceLabels] = useState([])
  const [focusScore, setFocusScore] = useState(0)
  const [focusStatus, setFocusStatus] = useState('Waiting...')
  const [confidence, setConfidence] = useState(0)
  const [topSpeed, setTopSpeed] = useState(0)
  const [lapHistory, setLapHistory] = useState([])

  const prevLapTimeRef = useRef(0)
  const lapCountRef = useRef(0)
  const lastLapRecordedRef = useRef(0)
  const socketRef = useRef(null)

  // Toggle UDP telemetry listener + session lifecycle
  const handleToggleLive = async () => {
    try {
      if (isLiveOn) {
        // END session
        if (sessionId) {
          await fetch(`${API_URL}/api/sessions/${sessionId}/end`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ totalLaps: lapCountRef.current }),
          })
          setSessionId(null)
        }
        // Signal forwarder to STOP capturing UDP
        if (socketRef.current) {
          socketRef.current.emit('toggle_telemetry', { status: 'STOP' })
          socketRef.current.emit('control_overlay', { action: 'STOP' })
        }
        setIsLiveOn(false)
      } else {
        // START session
        const sessionRes = await fetch(`${API_URL}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            steamId: user?.steamId || '76561198884240051',
            displayName: user?.displayName || 'Driver',
            trackName: 'Live Session',
            gameMode: 'Time Trial',
          }),
        })
        const sessionData = await sessionRes.json()
        if (sessionData.sessionId) {
          setSessionId(sessionData.sessionId)
          setIsLiveOn(true)
          lapCountRef.current = 0
          setLapHistory([])
          setTopSpeed(0)
          // Signal forwarder to START capturing UDP
          if (socketRef.current) {
            socketRef.current.emit('toggle_telemetry', { status: 'START', sessionId: sessionData.sessionId })
            socketRef.current.emit('control_overlay', { action: 'START' })
          }
        }
      }
    } catch (err) {
      console.error('Failed to toggle live:', err)
    }
  }

  // End session + close overlay on unmount (page leave)
  useEffect(() => {
    return () => {
      if (sessionId) {
        fetch(`${API_URL}/api/sessions/${sessionId}/end`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ totalLaps: lapCountRef.current }),
        }).catch(() => {})
        fetch(`${API_URL}/api/udp/stop`, { method: 'POST' }).catch(() => {})
      }
      // Close overlay popup when leaving dashboard
      if (window._overlayPopup && !window._overlayPopup.closed) {
        window._overlayPopup.close()
      }
      window._overlayPopup = null
    }
  }, [sessionId])

  // Open/close overlay as a minimal popup window
  const handleOpenOverlay = () => {
    if (isOverlayOn) {
      if (window._overlayPopup && !window._overlayPopup.closed) {
        window._overlayPopup.close()
      }
      window._overlayPopup = null
      setIsOverlayOn(false)
    } else {
      // Open minimal popup — positioned bottom-right of screen
      const w = 440, h = 270
      const left = window.screen.width - w - 20
      const top = window.screen.height - h - 80
      const overlayUrl = `${API_URL}/overlay`
      const popup = window.open(
        overlayUrl,
        'F1FocusOverlay',
        `popup,width=${w},height=${h},left=${left},top=${top},toolbar=no,location=no,menubar=no,scrollbars=no,status=no`
      )
      if (popup) {
        window._overlayPopup = popup
        setIsOverlayOn(true)
        const checkClosed = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkClosed)
            setIsOverlayOn(false)
            window._overlayPopup = null
          }
        }, 1000)
      }
    }
  }

  const formatLapTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00.000'
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(3)
    return `${mins}:${secs.padStart(6, '0')}`
  }

  // Connect WebSocket on mount
  useEffect(() => {
    const socket = io(API_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      console.log('[WS] Connected to backend')
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected')
      setIsConnected(false)
    })

    // Instant UDP status feedback
    socket.on('udp_status', (data) => {
      if (data.status === 'connected') {
        setIsLiveOn(true)
      } else if (data.status === 'disconnected' || data.status === 'error') {
        setIsLiveOn(false)
      }
    })

    // Lap completion event  Edirectly populates Lap History
    socket.on('live_lap_completed', (data) => {
      const lapNumber = data.lapNumber || 0
      const lapTimeRaw = data.lapTimeRaw || 0
      const lapTimeFormatted = data.lapTime || ''
      const avgFocus = data.avgFocusScore || 0

      if (lapNumber > 0 && lapTimeRaw > 0) {
        lapCountRef.current = lapNumber
        setLapHistory(prev => {
          const bestTime = prev.length > 0 ? Math.min(...prev.map(l => l.rawTime)) : lapTimeRaw
          const delta = prev.length > 0 ? lapTimeRaw - bestTime : 0
          return [...prev, {
            lap: lapNumber,
            time: lapTimeFormatted,
            rawTime: lapTimeRaw,
            delta: delta !== 0 ? (delta > 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3)) : null,
            focus: avgFocus,
          }]
        })
      }
    })

    // Listen for live telemetry broadcasts from backend
    socket.on('live_telemetry', (point) => {
      const speed = point.speed || 0
      const steeringAngle = point.steeringAngle || 0
      const throttle = point.throttle || 0
      const brake = point.brake || 0
      const lapTime = point.lapTime || 0
      const lapDistance = point.lapDistance || 0
      const focus = point.focusScore || 0

      setCurrentData({ speed, steeringAngle, throttle, brake, lapTime, lapDistance })
      setSpeedHistory(prev => [...prev.slice(-49), speed])
      setSteeringHistory(prev => [...prev.slice(-49), steeringAngle])
      setThrottleHistory(prev => [...prev.slice(-49), throttle * 100])
      setBrakeHistory(prev => [...prev.slice(-49), brake * 100])
      setDistanceLabels(prev => [...prev.slice(-49), Math.round(lapDistance).toString()])
      setTopSpeed(prev => Math.max(prev, Math.round(speed)))

      // Focus
      setFocusScore(Math.round(focus))
      setConfidence(point.confidence || 0)
      if (focus >= 80) setFocusStatus('OPTIMAL FOCUS')
      else if (focus >= 50) setFocusStatus('MODERATE FOCUS')
      else setFocusStatus('DISTRACTED')

      // (Lap detection now handled by 'live_lap_completed' event above)
      prevLapTimeRef.current = lapTime
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [])

  return (
    <div className="h-screen w-screen p-3 flex flex-col overflow-hidden" style={{ backgroundColor: theme.bg }}>
      <Header
        trackName="LIVE SESSION"
        sessionType={isLiveOn ? 'Receiving Telemetry' : 'Ready  EClick LIVE ON to start'}
        isConnected={isLiveOn}
        currentLapTime={formatLapTime(currentData.lapTime)}
        focusScore={focusScore || 0}
        driverName={user?.displayName || 'Driver'}
        avatar={user?.avatar}
        theme={theme}
        onBack={() => navigate('/home')}
        isLiveOn={isLiveOn}
        onToggleLive={handleToggleLive}
        onOpenOverlay={handleOpenOverlay}
        isOverlayOn={isOverlayOn}
      />

      <div className="flex-1 grid grid-cols-12 gap-3 mt-3 min-h-0">
        <div className="col-span-2 min-h-0">
          <LapHistory laps={lapHistory.length > 0 ? lapHistory : [
            { lap: '--', time: 'Waiting for data...', delta: null }
          ]} theme={theme} />
        </div>

        <div className="col-span-10 flex flex-col gap-3 min-h-0">
          <div className="grid grid-cols-3 gap-3 flex-[4] min-h-0">
            <CognitiveScore score={focusScore} status={focusStatus} confidence={confidence} theme={theme} />
            <SpeedTelemetry currentSpeed={Math.round(currentData.speed)} speedHistory={speedHistory.length > 0 ? speedHistory : [0]} theme={theme} />
            <SteeringAngle currentAngle={parseFloat(currentData.steeringAngle.toFixed(1))} steeringHistory={steeringHistory.length > 0 ? steeringHistory : [0]} theme={theme} />
          </div>
          <div className="flex-[5] min-h-0">
            <TelemetryTrace throttle={Math.round(currentData.throttle * 100)} brake={Math.round(currentData.brake * 100)} bufferSize={180} theme={theme} />
          </div>
        </div>
      </div>

      <StatsFooter topSpeed={topSpeed} maxG={0} avgThrottle={Math.round(currentData.throttle * 100)} avgBrake={Math.round(currentData.brake * 100)} theme={theme} />
    </div>
  )
}

export default DashboardPage
