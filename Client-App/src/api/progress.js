const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
const PROGRESS_ENDPOINT_PREFIXES = ['/api/progress', '/api/watch/progress'];

function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJsonResponse(res) {
  try {
    return await res.json();
  } catch {
    return { success: false, error: 'Invalid server response' };
  }
}

async function requestProgressWithFallback(pathSuffix = '', options = {}) {
  let lastError = '';

  for (const prefix of PROGRESS_ENDPOINT_PREFIXES) {
    const res = await fetch(`${API_BASE}${prefix}${pathSuffix}`, options);
    const data = await parseJsonResponse(res);

    if (res.ok && data?.success) {
      return data;
    }

    // Try legacy/new route pair when one side is not available yet.
    if (res.status === 404) {
      lastError = data?.error || data?.message || 'Progress endpoint not found';
      continue;
    }

    lastError = data?.error || data?.message || `Request failed (${res.status})`;
    return { success: false, error: lastError };
  }

  return {
    success: false,
    error: `${lastError || 'Progress endpoint unavailable'}. Please restart backend server.`
  };
}

export async function fetchProgress() {
  return requestProgressWithFallback('', {
    headers: {
      ...getAuthHeaders()
    }
  });
}

export async function updateWeeklyGoal(weeklyGoal) {
  return requestProgressWithFallback('/weekly-goal', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ weekly_goal: weeklyGoal })
  });
}