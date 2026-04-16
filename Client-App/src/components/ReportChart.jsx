import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Legend,
  Tooltip
} from 'chart.js';

ChartJS.register(
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Legend,
  Tooltip
);

export default function ReportChart({ data }) {
  if (!data || data.length === 0) return <div>No data available.</div>;

  const labels = data.map(d => new Date(d.recorded_at).toLocaleTimeString());

  const combinedTrendData = {
    labels,
    datasets: [
      {
        type: 'line',
        label: 'Heart Rate (bpm)',
        data: data.map(d => d.heart_rate ?? null),
        borderColor: '#FFB86C',
        backgroundColor: 'rgba(255,184,108,0.22)',
        yAxisID: 'y',
        tension: 0.35,
      },
      {
        type: 'bar',
        label: 'Rest Duration (min)',
        data: data.map(d => d.rest_duration ?? 0),
        backgroundColor: 'rgba(139, 233, 253, 0.45)',
        borderColor: 'rgba(139, 233, 253, 0.98)',
        borderWidth: 1,
        yAxisID: 'y1',
      }
    ]
  };

  const combinedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Heart Rate + Rest Duration Trend' }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Heart Rate (bpm)' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Rest Duration (min)' }
      }
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ width: '100%', height: '340px', minHeight: 260 }}>
        <Line data={combinedTrendData} options={combinedOptions} />
      </div>
    </div>
  );
}
