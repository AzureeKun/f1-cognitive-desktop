import { useRef, useEffect, useCallback } from 'react'

/**
 * TelemetryTrace — High-performance canvas-based rolling telemetry graph.
 * Renders throttle (green) and brake (red) as scrolling line traces.
 * 
 * Props:
 *   throttle: number (0-100) — current throttle percentage
 *   brake: number (0-100) — current brake percentage
 *   bufferSize: number (default 180) — rolling window size (~3s at 60Hz)
 *   theme: object — { card, border, primary }
 */
export default function TelemetryTrace({ throttle = 0, brake = 0, bufferSize = 180, theme }) {
  const canvasRef = useRef(null)
  const bufferRef = useRef({ throttle: [], brake: [] })
  const rafRef = useRef(null)
  const needsDrawRef = useRef(true)

  // Push new data into rolling buffer (no React state = no re-renders)
  useEffect(() => {
    const buf = bufferRef.current
    buf.throttle.push(throttle)
    buf.brake.push(brake)
    if (buf.throttle.length > bufferSize) buf.throttle.shift()
    if (buf.brake.length > bufferSize) buf.brake.shift()
    needsDrawRef.current = true
  }, [throttle, brake, bufferSize])

  // Draw function — pure canvas, no DOM manipulation
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    const buf = bufferRef.current
    const len = buf.throttle.length

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Background
    ctx.fillStyle = theme?.card || '#12131a'
    ctx.fillRect(0, 0, width, height)

    // Gridlines at 25%, 50%, 75%, 100%
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for (const pct of [0.25, 0.5, 0.75, 1.0]) {
      const y = height - (pct * height)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Grid labels
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '9px Consolas, monospace'
    ctx.textAlign = 'right'
    for (const pct of [25, 50, 75, 100]) {
      const y = height - (pct / 100 * height) + 3
      ctx.fillText(`${pct}`, width - 4, y)
    }

    if (len < 2) return

    const stepX = width / (bufferSize - 1)

    // Draw line helper
    const drawLine = (data, color, alpha = 1.0) => {
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.lineWidth = 1.8
      ctx.lineJoin = 'round'

      const startIdx = bufferSize - len
      for (let i = 0; i < len; i++) {
        const x = (startIdx + i) * stepX
        const y = height - (data[i] / 100) * height
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1.0

      // Glow effect for current value
      if (len > 0) {
        const lastX = (startIdx + len - 1) * stepX
        const lastY = height - (data[len - 1] / 100) * height
        ctx.beginPath()
        ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }
    }

    // Draw throttle (green) then brake (red)
    drawLine(buf.throttle, '#10B981', 0.9)
    drawLine(buf.brake, '#EF4444', 0.9)

    // Legend
    ctx.font = '10px Segoe UI, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#10B981'
    ctx.fillText('● THR', 6, 14)
    ctx.fillStyle = '#EF4444'
    ctx.fillText('● BRK', 60, 14)
  }, [bufferSize, theme])

  // Animation loop — only redraws when new data arrives
  useEffect(() => {
    const loop = () => {
      if (needsDrawRef.current) {
        draw()
        needsDrawRef.current = false
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resizeObserver = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      const ctx = canvas.getContext('2d')
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      // Reset logical dimensions for drawing
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      needsDrawRef.current = true
    })
    resizeObserver.observe(canvas)
    // Initial size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    const ctx = canvas.getContext('2d')
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    return () => resizeObserver.disconnect()
  }, [])

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border" style={{ backgroundColor: theme?.card || '#12131a', borderColor: theme?.border || '#1e2028' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}
