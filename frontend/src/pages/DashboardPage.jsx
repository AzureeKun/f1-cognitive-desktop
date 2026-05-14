import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import CognitiveScore from '../components/CognitiveScore'
import SpeedTelemetry from '../components/SpeedTelemetry'
import SteeringAngle from '../components/SteeringAngle'
import LapHistory from '../components/LapHistory'
import PedalInput from '../components/PedalInput'
import StatsFooter from '../components/StatsFooter'
import { startSession, endSession, submitTelemetry, predictFocusSingle } from '../utils/api'

function DashboardPage() {
  const { user, theme } = useApp()
  const navigate = useNavigate()

  // Session state
  const [sessionId, setSessionId] = useState(null)
  const [isConnected, setIsConnected] = useState(false)

  // Real-time telemetry state
  const [currentData, setCurrentData] = useState({
    speed: 0,
    steeringAngle: 0,
    throttle: 0,
    brake: 0,
    lapTime: 0,
    lapDistance: 0,
  })

  // History arrays for charts (last 30 data points)
  const [speedHistory, setSpeedHistory] = useState([])
  const [steeringHistory, setSteeringHistory] = useState([])
  const [throttleHistory, setThrottleHistory] = useState([])
  const [brakeHistory, setBrakeHistory] = useState([])
  const [distanceLabels, setDistanceLabels] = useState([])

  // Focus state from AI model
  const [focusScore, setFocusScore] = useState(0)
  const [focusStatus, setFocusStatus] = useState('Waiting...')
  const [confidence, setConfidence] = useState(0)

  // Stats
  const [topSpeed, setTopSpeed] = useState(0)
  const [lapHistory, setLapHistory] = useState([])
  const [latency, setLatency] = useState(0)

  // Buffer for batch telemetry upload
  const telemetryBuffer = useRef([])
  const wsRef = useRef(null)

  // Start session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const result = await startSession(
          user?.steamId,
          user?.displayName,
          'Live Session',
          'Time Trial'
        )
        if (result.sessionId) {
          setSessionId(result.sessionId)
          setIsConnected(true)
          console.log('[Dashboard] Session started:', result.sessionId)
        }
      } catch (err) {
        console.error('[Dashboard] Failed to start session:', err)
      }
    }
    initSession()

    // Cleanup: end session on unmount
    return () => {
      if (sessionId) {
        endSession(sessionId, lapHistory.length, 0).catch(() => {})
      }
    }
  }, [])

  // Connect to backend WebSocket or poll for telemetry data
  useEffect(() => {
    if (!sessionId) return

    // Poll the backend every 500ms for new telemetry
    // In production, this would be a WebSocket connection to the UDP listener
    const pollInterval = setInterval(async () => {
      try {
        // Fetch latest telemetry from backend (the telemetry collector pushes data there)
        const res = await fetch(`http://localhost:5000/api/sessions/${sessionId}/telemetry?limit=1`)
        const data = await res.json()
        
        if (data.data && data.data.length > 0) {
          const latest = data.data[data.data.length - 1]
          handleNewTelemetry(latest)
        }
      } catch (err) {
        // Backend not sending data yet - that's okay
      }
    }, 500)

    return () => clearInterval(pollInterval)
  }, [sessionId])

  // Flush telemetry buffer to Firebase every 5 seconds
  useEffect(() => {
    if (!sessionId) return

    const flushInterval = setInterval(async () => {
      if (telemetryBuffer.current.length > 0) {
        const batch = [...telemetryBuffer.current]
        telemetryBuffer.current = []
        try {
          await submitTelemetry(sessionId, batch)
        } catch (err) {
          console.error('[Dashboard] Failed to flush telemetry:', err)
        }
      }
    }, 5000)

    return () => clearInterval(flushInterval)
  }, [sessionId])

  // Handle incoming telemetry data point
  const handleNewTelemetry = async (point) => {
    const newData = {
      speed: point.speed || 0,
      steeringAngle: point.steeringAngle || 0,
      throttle: point.throttle || 0,
      brake: point.brake || 0,
      lapTime: point.lapTime || 0,
      lapDistance: point.lapDistance || 0,
    }

    setCurrentData(newData)

    // Update history arrays (keep last 50 points)
    setSpeedHistory(prev => [...prev.slice(-49), newData.speed])
    setSteeringHistory(prev => [...prev.slice(-49), newData.steeringAngle])
    setThrottleHistory(prev => [...prev.slice(-49), newData.throttle * 100])
    setBrakeHistory(prev => [...prev.slice(-49), newData.brake * 100])
    setDistanceLabels(prev => [...prev.slice(-49), Math.round(newData.lapDistance).toString()])

    // Update top speed
    if (newData.speed > topSpeed) {
      setTopSpeed(Math.round(newData.speed))
    }

    // Add to buffer for Firebase upload
    telemetryBuffer.current.push({
      ...newData,
      timestamp: Date.now() / 1000,
    })

    // Get AI prediction
    const startTime = Date.now()
    try {
      const prediction = await predictFocusSingle(newData)
      const endTime = Date.now()
      setLatency(endTime - startTime)

      if (prediction.focusScore !== undefined) {
        setFocusScore(Math.round(prediction.focusScore))
        setConfidence(prediction.confidence)
        
        if (prediction.focusScore >= 80) setFocusStatus('OPTIMAL FOCUS')
        else if (prediction.focusScore >= 50) setFocusStatus('MODERATE FOCUS')
        else setFocusStatus('DISTRACTED')
      }
    } catch (err) {
      // AI model not available
    }
  }

  // Format lap time
  const formatLapTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00.000'
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(3)
    return `${mins}:${secs.padStart(6, '0')}`
  }

  return (
    <div className="h-screen w-screen p-3 flex flex-col overflow-hidden" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <Header 
        trackName="LIVE SESSION"
        sessionType={sessionId ? `Session: ${sessionId}` : 'Connecting...'}
        isConnected={isConnected}
        currentLapTime={formatLapTime(currentData.lapTime)}
        accuracy={focusScore || 0}
        latency={latency}
        driverName={user?.displayName || 'Driver'}
        carNumber="--"
        theme={theme}
        onBack={() => navigate('/home')}
      />

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-3 mt-3 min-h-0">
        {/* Left Column - Lap History */}
        <div className="col-span-2 min-h-0">
          <LapHistory laps={lapHistory.length > 0 ? lapHistory : [
            { lap: '--', time: 'Waiting for data...', delta: null }
          ]} theme={theme} />
        </div>

        {/* Right Column - Main Telemetry */}
        <div className="col-span-10 flex flex-col gap-3 min-h-0">
          {/* Top Row */}
          <div className="grid grid-cols-3 gap-3 flex-[4] min-h-0">
            <CognitiveScore 
              score={focusScore} 
              status={focusStatus}
              confidence={confidence}
              theme={theme}
            />
            <SpeedTelemetry 
              currentSpeed={Math.round(currentData.speed)}
              speedHistory={speedHistory.length > 0 ? speedHistory : [0]}
              theme={theme}
            />
            <SteeringAngle 
              currentAngle={parseFloat(currentData.steeringAngle.toFixed(1))}
              steeringHistory={steeringHistory.length > 0 ? steeringHistory : [0]}
              theme={theme}
            />
          </div>

          {/* Bottom Row */}
          <div className="flex-[5] min-h-0">
            <PedalInput 
              throttleData={throttleHistory.length > 0 ? throttleHistory : [0]}
              brakeData={brakeHistory.length > 0 ? brakeHistory : [0]}
              distanceData={distanceLabels.length > 0 ? distanceLabels : ['0']}
              theme={theme}
            />
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <StatsFooter 
        topSpeed={topSpeed}
        maxG={0}
        avgThrottle={Math.round(currentData.throttle * 100)}
        avgBrake={Math.round(currentData.brake * 100)}
        theme={theme}
      />
    </div>
  )
}

export default DashboardPage
