import { useEffect, useState } from 'react';
import { getToken } from '../api/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function Dashboard() {
  const [pairStatus, setPairStatus] = useState(null);
  const [pairCode, setPairCode] = useState('');
  const [pairExpiresAt, setPairExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    fetchPairStatus();
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

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Welcome! This is your dashboard.</p>

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
