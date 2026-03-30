import axios from 'axios';
import logger from '../utils/logger.js';

// Support both OLLAMA_URL (full) and OLLAMA_HOST (base) for flexibility
const OLLAMA_BASE = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MODEL_NAME = process.env.OLLAMA_LLM_MODEL_NAME || process.env.OLLAMA_MODEL || 'phi4-mini';
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000); // 120s default to surface server errors
// Keep at 0s in low-memory mode so the model unloads after each real request.
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '0s';
// One-shot preheat mode: warm briefly at startup for faster first reply.
const PREHEAT_ENABLED = String(process.env.OLLAMA_PREHEAT_ENABLED || 'true').toLowerCase() === 'true';
const PREHEAT_KEEP_ALIVE = process.env.OLLAMA_PREHEAT_KEEP_ALIVE || '15s';
const PREHEAT_MAX_TOKENS = Number(process.env.OLLAMA_PREHEAT_MAX_TOKENS || 8);
const PREHEAT_UNLOAD_AFTER_WARMUP = String(process.env.OLLAMA_PREHEAT_UNLOAD_AFTER_WARMUP || 'true').toLowerCase() !== 'false';



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

/**
 * Explicitly unload the model from Ollama to force KV cache release
 * Sends a dummy request with keep_alive=0s to trigger immediate unload
 */
async function unloadModel() {
    try {
        const endpoint = buildEndpoint(OLLAMA_BASE);
        const isGenerate = /\/api\/generate\/?$/.test(endpoint);
        
        // Send minimal request with keep_alive=0s to force unload
        const payload = isGenerate
            ? { model: MODEL_NAME, prompt: '', stream: false, keep_alive: '0s' }
            : { model: MODEL_NAME, messages: [], stream: false, keep_alive: '0s' };

        await axios.post(endpoint, payload, {
            headers: { Accept: 'application/json' },
            timeout: 5000, // Quick timeout for unload
        });
        
        logger.debug(`Model '${MODEL_NAME}' unloaded from memory`);
    } catch (err) {
        // Unload failures are non-critical, just log them
        logger.debug(`Unload signal sent to Ollama (may be already unloaded): ${err?.message}`);
    }
}

async function getLLMResponse(question) {
    logger.info('sending question to link {OLLAMA_BASE} with model {MODEL_NAME}');
    const endpoint = buildEndpoint(OLLAMA_BASE);
    const isGenerate = /\/api\/generate\/?$/.test(endpoint);
    const messages = normalizeMessages(question);
    const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const payload = isGenerate
        ? { model: MODEL_NAME, prompt, stream: false, keep_alive: OLLAMA_KEEP_ALIVE }
        : { model: MODEL_NAME, messages, stream: false, keep_alive: OLLAMA_KEEP_ALIVE };

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
    } finally {
        // CRITICAL: Always unload model after inference to prevent memory accumulation
        // This forces Ollama to release the KV cache immediately
        await unloadModel();
    }
}

/**
 * Pre-heat the Ollama model by making an initial lightweight call
 * This loads the model into memory/VRAM and eliminates the slow first request
 * Called on server startup to warm up the model before handling real requests
 */
async function preheatModel() {
    if (!PREHEAT_ENABLED) {
        logger.info('Skipping Ollama pre-heat (OLLAMA_PREHEAT_ENABLED=false).');
        return;
    }

    const endpoint = buildEndpoint(OLLAMA_BASE);
    const isGenerate = /\/api\/generate\/?$/.test(endpoint);
    const warmupPrompt = 'hi';
    const payload = isGenerate
        ? {
            model: MODEL_NAME,
            prompt: warmupPrompt,
            stream: false,
            keep_alive: PREHEAT_KEEP_ALIVE,
            options: { num_predict: PREHEAT_MAX_TOKENS, temperature: 0 }
        }
        : {
            model: MODEL_NAME,
            messages: [{ role: 'user', content: warmupPrompt }],
            stream: false,
            keep_alive: PREHEAT_KEEP_ALIVE,
            options: { num_predict: PREHEAT_MAX_TOKENS, temperature: 0 }
        };

    try {
        logger.info(
            `Pre-heating Ollama model '${MODEL_NAME}' at ${OLLAMA_BASE} ` +
            `(one-shot mode, keep_alive=${PREHEAT_KEEP_ALIVE})...`
        );
        const startTime = Date.now();
        
        await axios.post(endpoint, payload, {
            headers: { Accept: 'application/json' },
            timeout: TIMEOUT_MS,
        });

        const elapsed = Date.now() - startTime;
        logger.info(`Model pre-heat complete in ${elapsed}ms. Ready for requests.`);

        if (PREHEAT_UNLOAD_AFTER_WARMUP) {
            await unloadModel();
            logger.info('Pre-heat warmup finished and model was unloaded immediately.');
        }
    } catch (err) {
        logger.warn(`⚠️  Model pre-heat failed (non-blocking): ${err?.message || 'unknown error'}`);
        // Don't throw - pre-heat is non-blocking; server continues even if warm-up fails
    }
}

export { getLLMResponse, preheatModel, unloadModel };