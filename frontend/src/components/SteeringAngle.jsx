import React from 'react'
import { Navigation } from 'lucide-react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

function SteeringAngle({ currentAngle, steeringHistory, theme }) {
  const primary = theme?.primary || '#00A19B'
  const card = theme?.card || '#12131a'
  const border = theme?.border || '#1e2028'

  const data = {
    labels: steeringHistory.map((_, i) => i),
    datasets: [{
      data: steeringHistory,
      borderColor: '#C8CCCE',
      borderWidth: 1.5,
      backgroundColor: 'rgba(200, 204, 206, 0.03)',
      fill: true,
      tension: 0.3,
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
        min: -60, max: 60,
        grid: { color: 'rgba(30, 32, 40, 0.8)', drawBorder: false },
        ticks: { color: '#565F64', font: { size: 8, family: 'JetBrains Mono' }, stepSize: 30, maxTicksLimit: 5 },
      },
    },
    animation: { duration: 800, easing: 'easeInOutQuart' },
  }

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-xl border p-3" style={{ backgroundColor: card, borderColor: border }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5" style={{ color: primary }} />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white">Steering Angle</h3>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-xl font-mono font-bold text-white">{currentAngle}</span>
          <span className="text-[10px] text-[#8a8a9a]">°</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}

export default SteeringAngle
