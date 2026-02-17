import axios from 'axios';
import 'dotenv/config';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
const MODEL_NAME = process.env.OLLAMA_MODEL_NAME || 'phi4-mini';



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
        return `${String(url).replace(/\/$/, '')}/api/chat`;
}

async function getLLMResponse(question) {
        const endpoint = buildEndpoint(OLLAMA_URL);
        const isGenerate = /\/api\/generate\/?$/.test(endpoint);
        const messages = normalizeMessages(question);
        const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
        const payload = isGenerate
            ? { model: MODEL_NAME, prompt, stream: false }
            : { model: MODEL_NAME, messages, stream: false };

    try {
        const response = await axios.post(endpoint, payload, {
            headers: { Accept: 'application/json' },
            timeout: 30000, // 30s timeout
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
        if (err?.code === 'ECONNABORTED') {
            return '❌ 錯誤：連唔到 Ollama 伺服器！請確認 Ollama 是否運行。';
        }
        if (err?.code === 'ETIMEDOUT') {
            return '❌ 錯誤：Ollama API 請求超時！請確認 Ollama 伺服器是否正常運行。';
        }
        console.error('Ollama error:', err?.response?.data || err?.message || err);
        return `❌ 發生錯誤: ${err?.message || '未知錯誤'}`;
    }
}

export { getLLMResponse };