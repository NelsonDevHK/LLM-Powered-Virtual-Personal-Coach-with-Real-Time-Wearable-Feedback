import React, { useEffect, useState } from 'react';
import ReportChart from './ReportChart.jsx';
import { getToken } from '../api/auth';
import '../AppReport.css';

// Helper to format session data for LLM prompt
function formatSessionForLLM(date, sessionData) {
  if (!sessionData.length) return 'No data.';
  const hr = sessionData.map(d => d.heart_rate).join(', ');
  const sets = sessionData.map(d => d.set_count ?? '-').join(', ');
  const rest = sessionData.map(d => d.rest_duration ?? '-').join(', ');
  const sleepDuration = sessionData.map(d => d.sleep_duration ?? '-').join(', ');
  const sleepQuality = sessionData.map(d => d.sleep_quality ?? '-').join(', ');
  const exerciseType = Array.from(new Set(sessionData.map(d => d.exercise_type || 'General'))).join(', ');
  return `Session on ${date}:\nExercise Type(s): ${exerciseType}\nHeart rates: [${hr}]\nSet count: [${sets}]\nRest duration (min): [${rest}]\nSleep duration (min): [${sleepDuration}]\nSleep quality (1-5): [${sleepQuality}]`;
}


export default function Report() {
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
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


  useEffect(() => {
    setLoading(true);
    const token = getToken();
    fetch(`${API_BASE}/api/wearable`, {
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
  }, [API_BASE]);

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
  const setCounts = sessionData.map(d => d.set_count).filter(v => Number.isFinite(Number(v))).map(Number);
  const restDurations = sessionData.map(d => d.rest_duration).filter(v => Number.isFinite(Number(v))).map(Number);
  const sleepDurations = sessionData.map(d => d.sleep_duration).filter(v => Number.isFinite(Number(v))).map(Number);
  const sleepQualities = sessionData.map(d => d.sleep_quality).filter(v => Number.isFinite(Number(v))).map(Number);
  const uniqueSleepDurations = Array.from(new Set(sleepDurations));
  const uniqueSleepQualities = Array.from(new Set(sleepQualities));
  const sessionSleepDurationDisplay = uniqueSleepDurations.length
    ? uniqueSleepDurations.join(', ')
    : '-';
  const sessionSleepQualityDisplay = uniqueSleepQualities.length
    ? uniqueSleepQualities.join(', ')
    : '-';
  const exerciseTypes = Array.from(new Set(sessionData.map(d => d.exercise_type || 'General')));
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
  // For each session, calculate average heart rate
  const sessionSummaries = Object.entries(sessionGroups).map(([date, arr]) => {
    const hr = arr.map(d => d.heart_rate);
    return {
      date,
      avgHeartRate: hr.length ? hr.reduce((a, b) => a + b, 0) / hr.length : 0,
      minHeartRate: hr.length ? Math.min(...hr) : 0,
      maxHeartRate: hr.length ? Math.max(...hr) : 0,
      count: arr.length
    };
  });
  // Find best (highest avg HR), worst (lowest avg HR), and average for the month
  const bestSession = sessionSummaries.reduce((best, curr) => curr.avgHeartRate > (best?.avgHeartRate ?? -Infinity) ? curr : best, null);
  const worstSession = sessionSummaries.reduce((worst, curr) => curr.avgHeartRate < (worst?.avgHeartRate ?? Infinity) ? curr : worst, null);
  const monthAvgHR = sessionSummaries.length ? (sessionSummaries.reduce((sum, s) => sum + s.avgHeartRate, 0) / sessionSummaries.length).toFixed(2) : '-';
  const monthAvgSleepDuration = monthData.length
    ? (monthData
      .map(d => Number(d.sleep_duration))
      .filter(Number.isFinite)
      .reduce((sum, v) => sum + v, 0)
      / Math.max(1, monthData.map(d => Number(d.sleep_duration)).filter(Number.isFinite).length)
    ).toFixed(1)
    : '-';
  const monthAvgSleepQuality = monthData.length
    ? (monthData
      .map(d => Number(d.sleep_quality))
      .filter(Number.isFinite)
      .reduce((sum, v) => sum + v, 0)
      / Math.max(1, monthData.map(d => Number(d.sleep_quality)).filter(Number.isFinite).length)
    ).toFixed(2)
    : '-';

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
              <div className="report-sleep-panel" style={{ marginTop: 16 }}>
                <b>Today Sleep Data</b><br/>
                Duration (min): <b>{sessionSleepDurationDisplay}</b><br/>
                Quality (1-5): <b>{sessionSleepQualityDisplay}</b>
              </div>
            </div>
            <div className="report-right">
              <h3>Monthly Performance</h3>
              <div style={{ marginBottom: 16 }}>
                <b>Average (All Sessions):</b><br/>
                Heart Rate: <b>{monthAvgHR}</b><br/>
                Sleep Duration: <b>{monthAvgSleepDuration}</b> min<br/>
                Sleep Quality: <b>{monthAvgSleepQuality}</b>/5
              </div>
              <div style={{ marginBottom: 16 }}>
                <b>Best Session:</b><br/>
                {bestSession ? (
                  <>
                    {bestSession.date}<br/>
                    Avg HR: <b>{bestSession.avgHeartRate.toFixed(2)}</b>
                  </>
                ) : 'N/A'}
              </div>
              <div style={{ marginBottom: 16 }}>
                <b>Worst Session:</b><br/>
                {worstSession ? (
                  <>
                    {worstSession.date}<br/>
                    Avg HR: <b>{worstSession.avgHeartRate.toFixed(2)}</b>
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
              <div>Set Count: Avg <b>{avg(setCounts)}</b> | Min <b>{min(setCounts)}</b> | Max <b>{max(setCounts)}</b></div>
              <div>Rest Duration (min): Avg <b>{avg(restDurations)}</b> | Min <b>{min(restDurations)}</b> | Max <b>{max(restDurations)}</b></div>
              <div>Sleep Duration (min): Avg <b>{avg(sleepDurations)}</b> | Min <b>{min(sleepDurations)}</b> | Max <b>{max(sleepDurations)}</b></div>
              <div>Sleep Quality (1-5): Avg <b>{avg(sleepQualities)}</b> | Min <b>{min(sleepQualities)}</b> | Max <b>{max(sleepQualities)}</b></div>
              <div>Exercise Type(s): <b>{exerciseTypes.length ? exerciseTypes.join(', ') : 'N/A'}</b></div>
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
                    const res = await fetch(`${API_BASE}/api/ask`, {
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
