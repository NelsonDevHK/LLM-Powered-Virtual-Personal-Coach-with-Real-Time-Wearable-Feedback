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

  const cardioTrendData = {
    labels,
    datasets: [
      {
        label: 'Heart Rate (bpm)',
        data: data.map(d => d.heart_rate ?? null),
        borderColor: '#FFB86C',
        backgroundColor: 'rgba(255,184,108,0.22)',
        yAxisID: 'y',
        tension: 0.35,
      }
    ]
  };

  const recoverySleepData = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'Set Count',
        data: data.map(d => d.set_count ?? 0),
        backgroundColor: 'rgba(80, 250, 123, 0.4)',
        borderColor: 'rgba(80, 250, 123, 0.95)',
        borderWidth: 1,
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'Rest Duration (min)',
        data: data.map(d => d.rest_duration ?? 0),
        backgroundColor: 'rgba(241, 250, 140, 0.4)',
        borderColor: 'rgba(241, 250, 140, 0.95)',
        borderWidth: 1,
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: 'Sleep Duration (min)',
        data: data.map(d => d.sleep_duration ?? null),
        borderColor: 'rgba(189, 147, 249, 0.95)',
        backgroundColor: 'rgba(189, 147, 249, 0.25)',
        yAxisID: 'y1',
        tension: 0.35,
      },
      {
        type: 'line',
        label: 'Sleep Quality (1-5)',
        data: data.map(d => d.sleep_quality ?? null),
        borderColor: 'rgba(255, 121, 198, 0.95)',
        backgroundColor: 'rgba(255, 121, 198, 0.25)',
        yAxisID: 'y2',
        tension: 0.35,
      }
    ]
  };

  const cardioOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    stacked: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Cardio Trend (wearable_data)' }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Heart Rate (bpm)' }
      }
    }
  };

  const recoveryOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Recovery + Sleep (wearable_data)' }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Sets / Rest (min)' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Sleep Duration (min)' }
      },
      y2: {
        type: 'linear',
        display: true,
        position: 'right',
        min: 0,
        max: 5,
        offset: true,
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Sleep Quality' }
      }
    }
  };

  return (
    <div style={{ width: '100%', display: 'grid', gap: '16px' }}>
      <div style={{ width: '100%', height: '280px', minHeight: 240 }}>
        <Line data={cardioTrendData} options={cardioOptions} />
      </div>
      <div style={{ width: '100%', height: '300px', minHeight: 260 }}>
        <Line data={recoverySleepData} options={recoveryOptions} />
      </div>
    </div>
  );
}
