import React from 'react'
import { Gauge } from 'lucide-react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

function SpeedTelemetry({ currentSpeed, speedHistory, theme }) {
  const primary = theme?.primary || '#00A19B'
  const card = theme?.card || '#12131a'
  const border = theme?.border || '#1e2028'

  const data = {
    labels: speedHistory.map((_, i) => i),
    datasets: [{
      data: speedHistory,
      borderColor: '#C8CCCE',
      borderWidth: 1.5,
      backgroundColor: 'rgba(200, 204, 206, 0.05)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: {
        display: true,
        min: 50, max: 320,
        grid: { color: 'rgba(30, 32, 40, 0.8)', drawBorder: false },
        ticks: { color: '#565F64', font: { size: 8, family: 'JetBrains Mono' }, stepSize: 100, maxTicksLimit: 4 },
      },
    },
    animation: { duration: 800, easing: 'easeInOutQuart' },
  }

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-xl border p-3" style={{ backgroundColor: card, borderColor: border }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5" style={{ color: primary }} />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white">Speed Telemetry</h3>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-mono font-bold text-white">{currentSpeed}</span>
          <span className="text-[10px] text-[#8a8a9a]">km/h</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}

export default SpeedTelemetry
