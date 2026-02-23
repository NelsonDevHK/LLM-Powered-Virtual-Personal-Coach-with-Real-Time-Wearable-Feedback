import axios from 'axios';

// Support both OLLAMA_URL (full) and OLLAMA_HOST (base) for flexibility
const OLLAMA_BASE = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MODEL_NAME = process.env.OLLAMA_LLM_MODEL_NAME || process.env.OLLAMA_MODEL || 'phi4-mini';
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000); // 120s default to surface server errors



function normalizeMessages(input) {
    // Accept a plain string, a single message object, or an array of messages
    if (!input) return [{ role: 'user', content: '' }];
    if (typeof input === 'string') return [{ role: 'user', content: input }];
    if (Array.isArray(input)) return input;
    if (typeof input === 'object' && input.role && input.content) return [input];
    return [{ role: 'user', content: String(input) }];
}

//helper function for ollama endpoint, support different /api/..
function buildEndpoint(url) {
    // If the provided URL already points to an /api/... path, use it as-is
    // otherwise, append /api/chat (Ollama default)
        if (/\/api\//.test(url)) return url;
        return `${String(url).replace(/\/$/, '')}/api/generate`;
}

async function getLLMResponse(question) {
        const endpoint = buildEndpoint(OLLAMA_BASE);
        const isGenerate = /\/api\/generate\/?$/.test(endpoint);
        const messages = normalizeMessages(question);
        const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
        const payload = isGenerate
            ? { model: MODEL_NAME, prompt, stream: false }
            : { model: MODEL_NAME, messages, stream: false };

    try {
        const response = await axios.post(endpoint, payload, {
            headers: { Accept: 'application/json' },
            timeout: TIMEOUT_MS,
        });

        const data = response?.data;

            // If it's a normal (non-stream) Ollama response
        if (data && typeof data === 'object') {
            // Ollama returns { message: { role, content }, ... }
                const content = data?.message?.content
                    || data?.response // /api/generate
                    || data?.output
                    || '';
            if (content) return content;
            // Fallback to stringifying if unknown shape
            return JSON.stringify(data);
        }

        // If server returned NDJSON as a string (rare for stream=false, but handle anyway)
        if (typeof data === 'string') {
            const parts = data
                .split('\n')
                .filter((line) => line.trim())
                .map((line) => {
                    try { return JSON.parse(line); } catch { return {}; }
                });
            const assembled = parts
                .map((p) => p?.message?.content || p?.response || '')
                .join('');
            return assembled || data;
        }

        // Ultimate fallback
        return '';
    } catch (err) {
        // Propagate detailed errors so the API route can return proper HTTP 500
        if (err?.response) {
            const status = err.response.status;
            const data = typeof err.response.data === 'string'
                ? err.response.data
                : JSON.stringify(err.response.data);
            throw new Error(`Ollama API error ${status}: ${data}`);
        }
        if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
            throw new Error('❌ 錯誤：連唔到 Ollama 伺服器！請確認 Ollama 是否運行。');
        }
        console.error('Ollama error:', err?.message || err);
        throw new Error(err?.message || '未知錯誤');
    }
}

export { getLLMResponse };