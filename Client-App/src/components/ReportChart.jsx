import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Legend,
  Tooltip
} from 'chart.js';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Legend,
  Tooltip
);

export default function ReportChart({ data }) {
  if (!data || data.length === 0) return <div>No data available.</div>;

  const chartData = {
    labels: data.map(d => new Date(d.recorded_at).toLocaleTimeString()),
    datasets: [
      {
        label: 'Heart Rate',
        data: data.map(d => d.heart_rate),
        borderColor: '#FFB86C',
        backgroundColor: 'rgba(255,184,108,0.2)',
        yAxisID: 'y',
      },
      {
        label: 'Current Speed',
        data: data.map(d => d.current_speed),
        borderColor: '#8be9fd',
        backgroundColor: 'rgba(139,233,253,0.2)',
        yAxisID: 'y1',
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    stacked: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Session Report' }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Heart Rate' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Speed' }
      }
    }
  };

  // Chart wrapper for aspect ratio and full width
  return (
    <div style={{ width: '100%', height: '400px', minHeight: 300 }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
