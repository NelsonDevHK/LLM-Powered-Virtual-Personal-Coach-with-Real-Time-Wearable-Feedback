import { useEffect, useState } from 'react';
import { getToken } from '../api/auth';
import { fetchProgress, updateWeeklyGoal } from '../api/progress';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

const moodLabel = {
  happy: 'Happy',
  okay: 'Okay',
  sad: 'Sad'
};

export default function Dashboard() {
  const [pairStatus, setPairStatus] = useState(null);
  const [pairCode, setPairCode] = useState('');
  const [pairExpiresAt, setPairExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [goalInput, setGoalInput] = useState('4');
  const [goalSaving, setGoalSaving] = useState(false);

  const fetchPairStatus = async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/watch/pair-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPairStatus(data);
      }
    } catch (e) {
      setError('Failed to load pairing status');
    }
  };

  const fetchUserProgress = async () => {
    setProgressLoading(true);
    setProgressError('');
    try {
      const data = await fetchProgress();
      if (data.success) {
        setProgress(data.progress);
        setGoalInput(String(data.progress?.weekly_goal ?? 4));
      } else {
        setProgressError(data.error || 'Failed to load progress');
      }
    } catch (e) {
      setProgressError('Failed to load progress');
    } finally {
      setProgressLoading(false);
    }
  };

  useEffect(() => {
    fetchPairStatus();
    fetchUserProgress();
  }, []);

  const handleGeneratePairCode = async () => {
    setLoading(true);
    setError('');
    setPairCode('');

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/watch/pair-init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || data.message || 'Failed to create pairing code');
        return;
      }

      setPairCode(data.pairingCode);
      setPairExpiresAt(data.expiresAt);
    } catch (e) {
      setError('Failed to create pairing code');
    } finally {
      setLoading(false);
    }
  };

  const handleWeeklyGoalSave = async () => {
    setGoalSaving(true);
    setProgressError('');

    try {
      const weeklyGoal = Number(goalInput);
      const data = await updateWeeklyGoal(weeklyGoal);
      if (data.success) {
        setProgress(data.progress);
        setGoalInput(String(data.progress?.weekly_goal ?? weeklyGoal));
      } else {
        setProgressError(data.error || 'Failed to update weekly goal');
      }
    } catch (e) {
      setProgressError('Failed to update weekly goal');
    } finally {
      setGoalSaving(false);
    }
  };

  const feedCount = Number(progress?.feed_count || 0);
  const weeklyGoal = Math.max(1, Number(progress?.weekly_goal || 1));
  const currentStreak = Number(progress?.current_streak || 0);
  const weeklyFeedProgress = Math.min(feedCount, weeklyGoal);
  const streakProgress = Math.min(weeklyFeedProgress / weeklyGoal, 1);
  const streakPercent = Math.round(streakProgress * 100);

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 16px 32px' }}>
      <h2>Dashboard</h2>
      <p>Welcome! This is your dashboard.</p>

      <div style={{ marginTop: 24, padding: 16, border: '1px solid #444', borderRadius: 8, background: '#222534', color: '#fff' }}>
        {progressLoading && <p>Loading progress...</p>}
        {!progressLoading && progress && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div><b>Current streak:</b> {currentStreak}</div>
              <div><b>Weekly goal:</b> {weeklyGoal}</div>
              <div><b>Feed count:</b> {feedCount}</div>
            </div>

            <div>
              <div style={{ marginBottom: 6 }}>
                <b>Pet mood:</b> {moodLabel[progress.pet_mood] || progress.pet_mood || 'Okay'}
              </div>
              <div style={{ height: 10, background: '#394055', borderRadius: 999, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${streakPercent}%`,
                    height: '100%',
                    background: progress.pet_mood === 'happy' ? '#50fa7b' : progress.pet_mood === 'sad' ? '#ff5555' : '#ffb86c',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <small style={{ color: '#c8ccda' }}>
                Weekly feed progress: {weeklyFeedProgress}/{weeklyGoal} ({streakPercent}% this week)
              </small>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <label htmlFor="weekly-goal-input"><b>Weekly goal</b></label>
              <input
                id="weekly-goal-input"
                type="number"
                min="1"
                max="14"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                style={{ width: 110, padding: '0.55rem 0.7rem', borderRadius: 6, border: '1px solid #555', background: '#121521', color: '#fff' }}
              />
              <button onClick={handleWeeklyGoalSave} disabled={goalSaving}>
                {goalSaving ? 'Saving...' : 'Update goal'}
              </button>
            </div>

            {progress.last_workout_date && (
              <div><b>Last workout:</b> {progress.last_workout_date}</div>
            )}
          </div>
        )}
        {!progressLoading && progressError && <p style={{ color: '#ff6b6b' }}>{progressError}</p>}
        {!progressLoading && !progress && !progressError && <p>No progress data yet.</p>}
      </div>

      <div style={{ marginTop: 24, padding: 16, border: '1px solid #444', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Watch Pairing (Phase 1)</h3>

        {pairStatus?.paired ? (
          <p>
            Paired: {pairStatus.deviceModel || 'Apple Watch'} ({pairStatus.deviceUuid})
          </p>
        ) : (
          <p>No watch paired yet.</p>
        )}

        <button onClick={handleGeneratePairCode} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Pairing Code'}
        </button>

        {pairCode && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>{pairCode}</div>
            <small>Expires at: {new Date(pairExpiresAt).toLocaleString()}</small>
            <p style={{ marginTop: 8 }}>
              On watch: enter this code and confirm pairing. Then start workout to send feedback/session data.
            </p>
          </div>
        )}

        {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
      </div>
    </div>
  );
}
