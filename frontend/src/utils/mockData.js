// Mock data generator to simulate real-time F1 telemetry
// This will be replaced with actual WebSocket/API data from the backend

export function generateMockData() {
  const speed = Math.floor(180 + Math.random() * 130) // 180-310 km/h
  const steeringAngle = (Math.random() * 80 - 40).toFixed(1) // -40 to +40 degrees
  const focusScore = Math.floor(75 + Math.random() * 23) // 75-98%
  const throttle = Math.random()
  const brake = Math.random() * 0.4

  // Generate history arrays for charts
  const speedHistory = generateWaveData(30, 150, 300, 'sine')
  const steeringHistory = generateWaveData(30, -45, 45, 'sine')
  const throttleHistory = generatePedalData(50, 'throttle')
  const brakeHistory = generatePedalData(50, 'brake')
  const distanceLabels = Array.from({ length: 50 }, (_, i) => (i * 4).toString())

  // Focus status based on score
  let focusStatus = 'OPTIMAL FOCUS'
  if (focusScore < 80) focusStatus = 'DISTRACTED'
  else if (focusScore < 90) focusStatus = 'MODERATE FOCUS'

  return {
    speed,
    steeringAngle: parseFloat(steeringAngle),
    focusScore,
    focusStatus,
    confidence: (0.85 + Math.random() * 0.13).toFixed(2),
    currentLapTime: '1:10.245',
    modelAccuracy: 96,
    latency: Math.floor(8 + Math.random() * 8),
    topSpeed: Math.floor(300 + Math.random() * 20),
    maxG: (3.5 + Math.random() * 2).toFixed(1),
    avgThrottle: Math.floor(65 + Math.random() * 20),
    avgBrake: Math.floor(15 + Math.random() * 15),
    speedHistory,
    steeringHistory,
    throttleHistory,
    brakeHistory,
    distanceLabels,
    lapHistory: [
      { lap: 14, time: '1:10.245', delta: -0.12 },
      { lap: 13, time: '1:10.367', delta: -0.01 },
      { lap: 12, time: '1:10.312', delta: +0.4 },
      { lap: 11, time: '1:10.712', delta: null },
    ]
  }
}

function generateWaveData(points, min, max, type) {
  const data = []
  for (let i = 0; i < points; i++) {
    const t = i / points
    let value
    if (type === 'sine') {
      value = ((Math.sin(t * Math.PI * 4 + Math.random() * 0.3) + 1) / 2) * (max - min) + min
    } else {
      value = Math.random() * (max - min) + min
    }
    data.push(parseFloat(value.toFixed(1)))
  }
  return data
}

function generatePedalData(points, type) {
  const data = []
  for (let i = 0; i < points; i++) {
    const t = i / points
    let value
    if (type === 'throttle') {
      // Throttle: high on straights, low in corners
      value = Math.max(0, Math.sin(t * Math.PI * 3) * 100)
    } else {
      // Brake: spikes before corners
      value = Math.max(0, Math.sin(t * Math.PI * 3 + Math.PI * 0.8) * 80)
    }
    data.push(parseFloat(value.toFixed(1)))
  }
  return data
}
