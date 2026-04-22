/**
 * LLM Service - Handles all interactions with the LLM for both coaching and session summaries
 * Unified handler for ask endpoint requests
 * - Handles both string questions and message arrays
 * - Manages context assembly, RAG retrieval, prompt building, LLM invocation
 */
import { getGroupedUserData } from './grouped_user_data.js';
import { getLLMResponse } from './llm_client.js';
import { AskPromptBuilder, LlmPromptBuilder } from './prompts/builder.js';
import user_data from './db.service.js';
import ragService from './rag.service.js';
import llmGateService from './llm_gate.service.js';
import logger from '../utils/logger.js';

const LLM_MIN_INTERVAL_MS = Number(process.env.LLM_MIN_INTERVAL_MS || 1200);
const ASK_MIN_INTERVAL_MS = Number(process.env.ASK_MIN_INTERVAL_MS || 1500);

class LlmService {
  /**
   * Canonical ask endpoint handler
   * @param {number} userId
   * @param {Object} options
   * @param {string} options.question - Plain text question (alternative to messages)
   * @param {Array} options.messages - OpenAI-style messages array (alternative to question)
   * @returns {Promise<Object>} { response: llmResponse, userMessage: string, wasMessage: boolean }
   */
  async getResponse(userId, options = {}) {
    const { question, messages } = options;
    
    // logger.info(`LlmService.getResponse called for user_id=${userId} with options: ${JSON.stringify(options)}`);

    if (!question && !messages) {
      throw new Error('Either "question" (string) or "messages" (array) must be provided');
    }

    return llmGateService.runExclusive(
      userId,
      'ask-route',
      async () => {
        logger.info(`LlmService.getResponse: Processing ask for user_id=${userId}`);

        // Step 1: Fetch grouped user data (full wearable history)
        const grouped = await this._getGroupedUserData(userId);
        logger.info(`LlmService: Fetched grouped user data for user_id=${userId}`);
        logger.info(`LlmService: Grouped user data details: ${JSON.stringify(grouped, null, 2)}`);

        // Step 2: Extract user query for logging and RAG
        const userQuery = this._extractUserQuery(question, messages);
        logger.info(`LlmService: User query: "${userQuery}"`);

        // Step 3: Fetch RAG advice (context-aware with grouped data)
        logger.info(`LlmService: Start Fetching RAG advice for user_id=${userId} with grouped data context`);
        const ragAdviceArr = await this._fetchRagAdvice(userId, grouped);
        const ragAdvice = ragAdviceArr && ragAdviceArr.length > 0 ? ragAdviceArr : [];
        const ragJoined = ragAdvice.join('\n');
        const ragPreview = ragJoined.length > 180 ? `${ragJoined.slice(0, 180)}...` : ragJoined;
        logger.info(
          `LlmService: RAG context for user_id=${userId} | count=${ragAdvice.length} | joinedChars=${ragJoined.length} | preview="${ragPreview || 'none'}"`
        );

        // Step 4: Build prompt using AskPromptBuilder
        const prompt = await this._buildAskPrompt(grouped, ragAdvice, userQuery, messages);
        logger.info(`LlmService: Built ask prompt with ${(ragAdvice || []).length} RAG items`);

        // Step 5: Invoke LLM
        const llmResponseRaw = await this._invokeLLM(prompt);
        const llmResponse = this._enforceMetricGrounding(llmResponseRaw, grouped);
        logger.info(`LlmService: LLM response received for user_id=${userId}`);

        // Step 6: Format result
        const result = await this._formatAskResult(llmResponse, userQuery, messages);
        
        return result;
      },
      { minIntervalMs: ASK_MIN_INTERVAL_MS }
    );
  }

  /**
   * Private helper: Fetch grouped user data with full wearable history
   * @private
   */
  async _getGroupedUserData(userId) {
    try {
      return await getGroupedUserData(userId);
    } catch (err) {
      logger.error(`Failed to fetch grouped user data for ${userId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Private helper: Extract user query from either question or messages
   * @private
   */
  _extractUserQuery(question, messages) {
    if (question) {
      return question;
    }
    if (Array.isArray(messages) && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      return lastMsg.content || '';
    }
    return '';
  }

  /**
   * Private helper: Fetch RAG advice with context-aware grouped data
   * call RAG service to get advice
   * @private
   */
  async _fetchRagAdvice(userId, groupedUserData) {
    try {
      const ragAdviceArr = await ragService.getAdviceContent(userId, groupedUserData, { useGate: false });
      return ragAdviceArr || [];
    } catch (err) {
      logger.warn(`RAG lookup failed for user ${userId}: ${err.message}`);
      return [];
    }
  }

  /**
   * Private helper: Build ask prompt using AskPromptBuilder
   * @private
   */
  async _buildAskPrompt(groupedUserData, ragAdvice, userQuery, messagesMode) {
    try {
      const promptBuilder = new AskPromptBuilder();
      
      if (messagesMode) {
        // For messages mode: just build coaching prompt, don't include in messages array
        const prompt = await promptBuilder.builder(groupedUserData, ragAdvice, userQuery);
        return prompt;
      } else {
        // For question mode: same prompt
        const prompt = await promptBuilder.builder(groupedUserData, ragAdvice, userQuery);
        return prompt;
      }
    } catch (err) {
      logger.error(`Failed to build ask prompt: ${err.message}`);
      throw err;
    }
  }

  /**
   * Private helper: Invoke LLM with string or messages
   * @private
   */
  async _invokeLLM(input) {
    try {
      const response = await getLLMResponse(input);
      return response;
    } catch (err) {
      logger.error(`LLM invocation failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Private helper: Format ask result with message info for persistence
   * @private
   */
  async _formatAskResult(llmResponse, userQuery, messagesMode) {
    return {
      response: llmResponse,
      userMessage: userQuery,
      wasMessagesMode: Array.isArray(messagesMode)
    };
  }

  /**
   * Private helper: ensure the final reply references concrete user metrics.
   * Adds a short metric-prefixed sentence only when the model output is too generic.
   * @private
   */
  _enforceMetricGrounding(response, groupedUserData) {
    const text = String(response || '').trim();
    if (!text) return text;

    const mentionsMetric = /(heart\s*rate|bpm|sleep|duration|calories|set\s*count|rest)/i.test(text);
    if (mentionsMetric) return text;

    const latest = Array.isArray(groupedUserData?.wearable_data) && groupedUserData.wearable_data.length > 0
      ? groupedUserData.wearable_data[0]
      : null;

    const hr = latest?.heart_rate ?? latest?.average_heart_rate ?? 'unknown';
    const sleep = latest?.sleep_duration ?? 'unknown';
    const duration = latest?.duration ?? 'unknown';

    const prefix = `Based on your metrics (heart rate: ${hr} bpm, sleep: ${sleep} hrs, duration: ${duration} min), `;
    return `${prefix}${text}`;
  }

  /**
    * Legacy session summary helper
    * Note: legacy /api/llm/fullLLM route has been removed.
    * Kept temporarily for backward compatibility at service layer.
   * @param {number} userId
   */
  async getSessionSummary(userId) {
    return llmGateService.runExclusive(
      userId,
      'llm-summary',
      async () => {
        logger.info(`LlmService: Processing session summary for user_id=${userId}`);

        // 1. Get User Data (old path - single wearable record)
        const userDict = await user_data.getLlmData(userId);

        // 2. Build Prompt for Session Summary
        const promptBuilder = new LlmPromptBuilder();
        const prompt = await promptBuilder.buildSessionSummaryPrompt(userDict);
        logger.info(`LlmService: Built session summary prompt for user_id=${userId}`);

        // 3. Call LLM for Session Summary
        const llmResponse = await getLLMResponse(prompt);

        return { summary: llmResponse };
      },
      { minIntervalMs: LLM_MIN_INTERVAL_MS }
    );
  }
}

export default new LlmService();