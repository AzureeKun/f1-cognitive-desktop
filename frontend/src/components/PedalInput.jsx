import React from 'react'
import { Footprints } from 'lucide-react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

function PedalInput({ throttleData, brakeData, distanceData, theme }) {
  const primary = theme?.primary || '#00A19B'
  const card = theme?.card || '#12131a'
  const border = theme?.border || '#1e2028'

  const data = {
    labels: distanceData,
    datasets: [
      {
        label: 'Throttle',
        data: throttleData,
        borderColor: primary,
        backgroundColor: `${primary}25`,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 3,
      },
      {
        label: 'Brake',
        data: brakeData,
        borderColor: '#e74c3c',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 3,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: { color: '#8a8a9a', font: { size: 10, family: 'Inter' }, usePointStyle: true, pointStyle: 'circle', padding: 15, boxWidth: 6 },
      },
      tooltip: {
        backgroundColor: '#12131a',
        borderColor: '#1e2028',
        borderWidth: 1,
        titleColor: '#e8e8e8',
        bodyColor: '#C8CCCE',
        titleFont: { family: 'JetBrains Mono', size: 10 },
        bodyFont: { family: 'JetBrains Mono', size: 9 },
        padding: 8,
        cornerRadius: 6,
      },
    },
    scales: {
      x: {
        display: true,
        title: { display: true, text: 'Distance (m)', color: '#565F64', font: { size: 9, family: 'Inter' } },
        grid: { color: 'rgba(30, 32, 40, 0.6)', drawBorder: false },
        ticks: { color: '#565F64', font: { size: 8, family: 'JetBrains Mono' }, maxTicksLimit: 10 },
      },
      y: {
        display: true,
        title: { display: true, text: 'Input %', color: '#565F64', font: { size: 9, family: 'Inter' } },
        min: 0, max: 100,
        grid: { color: 'rgba(30, 32, 40, 0.6)', drawBorder: false },
        ticks: { color: '#565F64', font: { size: 8, family: 'JetBrains Mono' }, stepSize: 25 },
      },
    },
    animation: { duration: 800, easing: 'easeInOutQuart' },
  }

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-xl border p-3" style={{ backgroundColor: card, borderColor: border }}>
      <div className="flex items-center gap-2 mb-1">
        <Footprints className="w-3.5 h-3.5" style={{ color: primary }} />
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white">Combined Pedal Input</h3>
          <p className="text-[9px] text-[#8a8a9a]">Throttle vs Brake pressure over distance</p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}

export default PedalInput
