// src/services/rag.service.js
import { queryRAG } from './rag/index.js';
import { RagPromptBuilder } from './prompts/builder.js';
import user_data from './db.service.js';
import llmGateService from './llm_gate.service.js';
import logger from '../utils/logger.js';

const RAG_MIN_INTERVAL_MS = Number(process.env.RAG_MIN_INTERVAL_MS || 800);

class RagService {
  async getAdvice(userId, groupedUserData = null, options = {}) {
    const useGate = options.useGate !== false;

    const run = async () => {
      logger.info(`RagService: Processing advice for user_id=${userId}`);

      // 1. Get Data
      let userDict;
      if (groupedUserData) {
        userDict = groupedUserData;
      } else {
        userDict = await user_data.getRagData(userId);
      }

      // 2. Build Prompt
      const promptBuilder = new RagPromptBuilder();
      const prompt = await promptBuilder.builder(userDict);

      // 3. Query RAG
      const advice = await queryRAG(prompt);

      //debug log
      if (!advice || (Array.isArray(advice) && advice.length === 0)) {
        logger.warn(`RagService: No advice returned for user_id=${userId} with prompt: ${prompt}`);
      } else {
        logger.info(`RagService: Received advice for user_id=${userId}`);
      }

      // 4. Return Pure Data
      return { advice };
    };

    if (!useGate) {
      return run();
    }

    return llmGateService.runExclusive(
      userId,
      'rag-query',
      run,
      { minIntervalMs: RAG_MIN_INTERVAL_MS }
    );
  }

  // 給 LLM Service 用的內部方法，只返回內容列表
  async getAdviceContent(userId, groupedUserData = null, options = {}) {
    const { advice } = await this.getAdvice(userId, groupedUserData, options);
    return Array.isArray(advice) ? advice.map(item => item.content) : [];
  }
}

export default new RagService();