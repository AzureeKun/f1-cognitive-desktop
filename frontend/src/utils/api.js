/**
 * API Service - Connects frontend to Flask backend
 * All real-time telemetry and session data flows through here.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

/**
 * Start a new driving session
 */
export async function startSession(steamId, displayName, trackName, gameMode) {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steamId, displayName, trackName, gameMode }),
  })
  return res.json()
}

/**
 * End an active session
 */
export async function endSession(sessionId, totalLaps, bestLapTime) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/end`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalLaps, bestLapTime }),
  })
  return res.json()
}

/**
 * Get all sessions for a user
 */
export async function getSessions(steamId) {
  const res = await fetch(`${API_URL}/api/sessions?steamId=${steamId}`)
  return res.json()
}

/**
 * Get session detail
 */
export async function getSessionDetail(sessionId) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}`)
  return res.json()
}

/**
 * Submit telemetry data batch
 */
export async function submitTelemetry(sessionId, data) {
  const res = await fetch(`${API_URL}/api/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, data }),
  })
  return res.json()
}

/**
 * Get telemetry data for a session
 */
export async function getSessionTelemetry(sessionId, limit = 1000) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/telemetry?limit=${limit}`)
  return res.json()
}

/**
 * Get real-time focus prediction from AI model (single data point)
 */
export async function predictFocusSingle(telemetryPoint) {
  const res = await fetch(`${API_URL}/api/predict/single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(telemetryPoint),
  })
  return res.json()
}

/**
 * Get batch focus prediction from AI model
 */
export async function predictFocusBatch(dataArray) {
  const res = await fetch(`${API_URL}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: dataArray }),
  })
  return res.json()
}

/**
 * Save focus result for a session
 */
export async function saveFocusResult(sessionId, focusResult) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/focus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(focusResult),
  })
  return res.json()
}

/**
 * Get user stats
 */
export async function getUserStats(steamId) {
  const res = await fetch(`${API_URL}/api/users/${steamId}/stats`)
  return res.json()
}

/**
 * Check AI model status
 */
export async function getAIStatus() {
  const res = await fetch(`${API_URL}/api/ai/status`)
  return res.json()
}

/**
 * Health check
 */
export async function healthCheck() {
  const res = await fetch(`${API_URL}/api/health`)
  return res.json()
}
