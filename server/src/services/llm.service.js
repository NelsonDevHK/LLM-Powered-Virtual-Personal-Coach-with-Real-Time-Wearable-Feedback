// src/services/llm.service.js
import { getLLMResponse } from './llm_client.js';
import { LlmPromptBuilder } from './prompts/builder.js';
import user_data from './db.service.js';
import ragService from './rag.service.js'; // 依賴 RagService
import llmGateService from './llm_gate.service.js';
import logger from '../utils/logger.js';

const LLM_MIN_INTERVAL_MS = Number(process.env.LLM_MIN_INTERVAL_MS || 1200);

class LlmService {
  async getResponse(userId) {
    return llmGateService.runExclusive(
      userId,
      'llm-response',
      async () => {
        logger.info(`LlmService: Processing response for user_id=${userId}`);

        // 1. Get User Data
        const userDict = await user_data.getLlmData(userId);

        // 2. Get RAG Context (skip gate to avoid nested lock deadlock)
        const ragContents = await ragService.getAdviceContent(userId, null, { useGate: false });

        // 3. Build Prompt
        const promptBuilder = new LlmPromptBuilder();
        const prompt = await promptBuilder.builder(userDict, ragContents);
        logger.info(`LlmService: Built prompt for user_id=${userId}: ${prompt}`);

        // 4. Call LLM
        const llmResponse = await getLLMResponse(prompt);

        return { response: llmResponse };
      },
      { minIntervalMs: LLM_MIN_INTERVAL_MS }
    );
  }

  async getSessionSummary(userId) {
    return llmGateService.runExclusive(
      userId,
      'llm-summary',
      async () => {
        logger.info(`LlmService: Processing session summary for user_id=${userId}`);

        // 1. Get User Data
        const userDict = await user_data.getLlmData(userId);

        // 2. Build Prompt for Session Summary
        const promptBuilder = new LlmPromptBuilder(); // need add the new summary prompt builder method in the builder.js
        const prompt = await promptBuilder.buildSessionSummaryPrompt(userDict);
        logger.info(`LlmService: Built session summary prompt for user_id=${userId}: ${prompt}`);

        // 3. Call LLM for Session Summary
        const llmResponse = await getLLMResponse(prompt);

        return { summary: llmResponse };
      },
      { minIntervalMs: LLM_MIN_INTERVAL_MS }
    );
  }
}

export default new LlmService();