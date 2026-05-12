import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Header from '../components/Header'
import CognitiveScore from '../components/CognitiveScore'
import SpeedTelemetry from '../components/SpeedTelemetry'
import SteeringAngle from '../components/SteeringAngle'
import LapHistory from '../components/LapHistory'
import PedalInput from '../components/PedalInput'
import StatsFooter from '../components/StatsFooter'
import { generateMockData } from '../utils/mockData'

function DashboardPage() {
  const { user, theme } = useApp()
  const navigate = useNavigate()
  const [telemetryData, setTelemetryData] = useState(generateMockData())
  const [isConnected, setIsConnected] = useState(true)

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetryData(generateMockData())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-screen w-screen p-3 flex flex-col overflow-hidden" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <Header 
        trackName="MONACO GRAND PRIX"
        sessionType="Q3 Session"
        isConnected={isConnected}
        currentLapTime={telemetryData.currentLapTime}
        accuracy={telemetryData.modelAccuracy}
        latency={telemetryData.latency}
        driverName={user?.displayName || 'Driver'}
        carNumber="44"
        theme={theme}
        onBack={() => navigate('/home')}
      />

      {/* Main Content - fills remaining space */}
      <div className="flex-1 grid grid-cols-12 gap-3 mt-3 min-h-0">
        {/* Left Column - Lap History */}
        <div className="col-span-2 min-h-0">
          <LapHistory laps={telemetryData.lapHistory} theme={theme} />
        </div>

        {/* Right Column - Main Telemetry */}
        <div className="col-span-10 flex flex-col gap-3 min-h-0">
          {/* Top Row - Cognitive Score + Speed + Steering */}
          <div className="grid grid-cols-3 gap-3 flex-[4] min-h-0">
            <CognitiveScore 
              score={telemetryData.focusScore} 
              status={telemetryData.focusStatus}
              confidence={telemetryData.confidence}
              theme={theme}
            />
            <SpeedTelemetry 
              currentSpeed={telemetryData.speed}
              speedHistory={telemetryData.speedHistory}
              theme={theme}
            />
            <SteeringAngle 
              currentAngle={telemetryData.steeringAngle}
              steeringHistory={telemetryData.steeringHistory}
              theme={theme}
            />
          </div>

          {/* Bottom Row - Combined Pedal Input */}
          <div className="flex-[5] min-h-0">
            <PedalInput 
              throttleData={telemetryData.throttleHistory}
              brakeData={telemetryData.brakeHistory}
              distanceData={telemetryData.distanceLabels}
              theme={theme}
            />
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <StatsFooter 
        topSpeed={telemetryData.topSpeed}
        maxG={telemetryData.maxG}
        avgThrottle={telemetryData.avgThrottle}
        avgBrake={telemetryData.avgBrake}
        theme={theme}
      />
    </div>
  )
}

export default DashboardPage
