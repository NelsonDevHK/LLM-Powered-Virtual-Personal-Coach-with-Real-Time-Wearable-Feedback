import React, { useEffect, useState } from 'react';
import ReportChart from './ReportChart.jsx';
import { getToken } from '../api/auth';
import '../AppReport.css';

// Helper to format session data for LLM prompt
function formatSessionForLLM(date, sessionData) {
  if (!sessionData.length) return 'No data.';
  const hr = sessionData.map(d => d.heart_rate).join(', ');
  const sp = sessionData.map(d => d.current_speed).join(', ');
  return `Session on ${date}:\nHeart rates: [${hr}]\nSpeeds: [${sp}]`;
}


export default function Report() {
  const [llmSummary, setLlmSummary] = useState('');
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState([]); // unique session dates
  const [selectedSession, setSelectedSession] = useState('');
  const [months, setMonths] = useState([]); // unique months
  const [selectedMonth, setSelectedMonth] = useState('');
  // For demo, use user_id 1. Replace with actual user_id from auth if available.
  const userId = 1;


  useEffect(() => {
    setLoading(true);
    const token = getToken();
    fetch(`http://localhost:3000/api/wearable/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData(res.data);
          // Extract unique months (YYYY-MM)
          const uniqueMonths = Array.from(new Set(res.data.map(d => d.recorded_at.slice(0, 7))));
          setMonths(uniqueMonths);
          const defaultMonth = uniqueMonths[0] || '';
          setSelectedMonth(defaultMonth);
          // Extract unique session dates for the default month
          const uniqueSessions = Array.from(new Set(res.data.filter(d => d.recorded_at.slice(0, 7) === defaultMonth).map(d => d.recorded_at.slice(0, 10))));
          setSessions(uniqueSessions);
          setSelectedSession(uniqueSessions[0] || '');
        } else setError(res.error || 'Failed to fetch data');
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [userId]);

  // When month changes, update sessions and selected session
  useEffect(() => {
    if (!selectedMonth || !data.length) return;
    const filteredSessions = Array.from(new Set(data.filter(d => d.recorded_at.slice(0, 7) === selectedMonth).map(d => d.recorded_at.slice(0, 10))));
    setSessions(filteredSessions);
    setSelectedSession(filteredSessions[0] || '');
  }, [selectedMonth, data]);


  // Filter data for selected session (by date)
  const sessionData = selectedSession
    ? data.filter(d => d.recorded_at.slice(0, 10) === selectedSession)
    : [];

  // Calculate stats for the selected session
  const heartRates = sessionData.map(d => d.heart_rate);
  const speeds = sessionData.map(d => d.current_speed);
  const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : '-';
  const min = arr => arr.length ? Math.min(...arr) : '-';
  const max = arr => arr.length ? Math.max(...arr) : '-';

  // Calculate best, worst, and average for the selected month
  const monthData = data.filter(d => d.recorded_at.slice(0, 7) === selectedMonth);
  // Group by session (date)
  const sessionGroups = {};
  monthData.forEach(d => {
    const date = d.recorded_at.slice(0, 10);
    if (!sessionGroups[date]) sessionGroups[date] = [];
    sessionGroups[date].push(d);
  });
  // For each session, calculate average heart rate and speed
  const sessionSummaries = Object.entries(sessionGroups).map(([date, arr]) => {
    const hr = arr.map(d => d.heart_rate);
    const sp = arr.map(d => d.current_speed);
    return {
      date,
      avgHeartRate: hr.length ? hr.reduce((a, b) => a + b, 0) / hr.length : 0,
      avgSpeed: sp.length ? sp.reduce((a, b) => a + b, 0) / sp.length : 0,
      minHeartRate: hr.length ? Math.min(...hr) : 0,
      maxHeartRate: hr.length ? Math.max(...hr) : 0,
      minSpeed: sp.length ? Math.min(...sp) : 0,
      maxSpeed: sp.length ? Math.max(...sp) : 0,
      count: arr.length
    };
  });
  // Find best (highest avg HR), worst (lowest avg HR), and average for the month
  const bestSession = sessionSummaries.reduce((best, curr) => curr.avgHeartRate > (best?.avgHeartRate ?? -Infinity) ? curr : best, null);
  const worstSession = sessionSummaries.reduce((worst, curr) => curr.avgHeartRate < (worst?.avgHeartRate ?? Infinity) ? curr : worst, null);
  const monthAvgHR = sessionSummaries.length ? (sessionSummaries.reduce((sum, s) => sum + s.avgHeartRate, 0) / sessionSummaries.length).toFixed(2) : '-';
  const monthAvgSpeed = sessionSummaries.length ? (sessionSummaries.reduce((sum, s) => sum + s.avgSpeed, 0) / sessionSummaries.length).toFixed(2) : '-';

  return (
    <div className="report-container">
      <h2>Report</h2>
      {loading && <p>Loading...</p>}
      {error && <p className="report-error">{error}</p>}
      {!loading && !error && (
        <>
          <div className="report-select-group">
            <div>
              <label htmlFor="month-toggle" className="report-label">Select Month:</label>
              <select
                id="month-toggle"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                {months.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="session-toggle" className="report-label">Select Session:</label>
              <select
                id="session-toggle"
                value={selectedSession}
                onChange={e => setSelectedSession(e.target.value)}
              >
                {sessions.map(date => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="report-main">
            <div className="report-left">
              <ReportChart data={sessionData} />
            </div>
            <div className="report-right">
              <h3>Monthly Performance</h3>
              <div style={{ marginBottom: 16 }}>
                <b>Average (All Sessions):</b><br/>
                Heart Rate: <b>{monthAvgHR}</b><br/>
                Speed: <b>{monthAvgSpeed}</b>
              </div>
              <div style={{ marginBottom: 16 }}>
                <b>Best Session:</b><br/>
                {bestSession ? (
                  <>
                    {bestSession.date}<br/>
                    Avg HR: <b>{bestSession.avgHeartRate.toFixed(2)}</b><br/>
                    Avg Speed: <b>{bestSession.avgSpeed.toFixed(2)}</b>
                  </>
                ) : 'N/A'}
              </div>
              <div style={{ marginBottom: 16 }}>
                <b>Worst Session:</b><br/>
                {worstSession ? (
                  <>
                    {worstSession.date}<br/>
                    Avg HR: <b>{worstSession.avgHeartRate.toFixed(2)}</b><br/>
                    Avg Speed: <b>{worstSession.avgSpeed.toFixed(2)}</b>
                  </>
                ) : 'N/A'}
              </div>
              <div className="report-month-meta">
                Sessions this month: <b>{sessionSummaries.length}</b>
              </div>
            </div>
          </div>
          <div className="report-summary">
            <div className="report-summary-inner">
              <h4>Session Summary ({selectedSession})</h4>
              <div>Heart Rate: Avg <b>{avg(heartRates)}</b> | Min <b>{min(heartRates)}</b> | Max <b>{max(heartRates)}</b></div>
              <div>Speed: Avg <b>{avg(speeds)}</b> | Min <b>{min(speeds)}</b> | Max <b>{max(speeds)}</b></div>
              <div>Data Points: <b>{sessionData.length}</b></div>
              <button
                className="report-btn"
                onClick={async () => {
                  setLlmLoading(true);
                  setLlmError('');
                  setLlmSummary('');
                  try {
                    const prompt = `Please summarize the following workout session for a user in a friendly, concise way. Highlight effort, trends, and any advice.\n${formatSessionForLLM(selectedSession, sessionData)}`;
                    const token = getToken();
                    const res = await fetch('http://localhost:3000/api/ask', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ question: prompt })
                    });
                    const data = await res.json();
                    if (data.result) setLlmSummary(data.result);
                    else setLlmError(data.error || 'No summary returned.');
                  } catch (e) {
                    setLlmError(e.message || 'Error fetching summary.');
                  } finally {
                    setLlmLoading(false);
                  }
                }}
                disabled={llmLoading || !sessionData.length}
              >
                {llmLoading ? 'Summarizing...' : 'Get LLM Summary'}
              </button>
              {llmError && <div className="report-error">{llmError}</div>}
              {llmSummary && <div className="report-llm-summary"><b>LLM Summary:</b><br/>{llmSummary}</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
