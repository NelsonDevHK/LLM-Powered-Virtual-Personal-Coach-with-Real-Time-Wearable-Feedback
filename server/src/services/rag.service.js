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
    const topK = Number(options.topK || 3);

    const run = async () => {
      logger.info(
        `RagService: query start | user_id=${userId} | source=${groupedUserData ? 'grouped' : 'db'} | top_k=${topK} | useGate=${useGate}`
      );

      // 1. Get Data
      let userDict;
      if (groupedUserData) {
        userDict = groupedUserData;
      } else {
        userDict = await user_data.getRagData(userId); //FAll Back system, will fetch from the DB
      }

      // 2. Build Prompt
      const promptBuilder = new RagPromptBuilder();
      const prompt = await promptBuilder.builder(userDict);
      // logger.info(`RagService: Full prompt details ${prompt}.`);

      // const promptPreview = prompt.length > 160 ? `${prompt.slice(0, 160)}...` : prompt;
      // logger.info(
      //   `RagService: prompt built | user_id=${userId} | promptChars=${prompt.length} | preview="${promptPreview}"`
      // );
      // 3. Add filter items for RAF query 
      let exerciseType = 'any';
      if (Array.isArray(userDict.wearable_data) && userDict.wearable_data.length > 0) {
        // Use the last entry's exercise_type (most recent)
        exerciseType = userDict.wearable_data[userDict.wearable_data.length - 1].exercise_type || 'any';
      }
      logger.info(`RagService: derived exerciseType='${exerciseType}' from grouped data (will be used as RAG filter)`);

      // 4. Query RAG
      const advice = await queryRAG(prompt, topK, { exerciseType: exerciseType });

      //debug log
      if (!advice || (Array.isArray(advice) && advice.length === 0)) {
        logger.warn(`RagService: No advice returned for user_id=${userId} with prompt: ${prompt}`);
      } else {
        const first = advice[0];
        const firstPreview = first?.content
          ? (first.content.length > 120 ? `${first.content.slice(0, 120)}...` : first.content)
          : 'none';
        logger.info(
          `RagService: query end | user_id=${userId} | resultCount=${advice.length} | firstId=${first?.id || 'n/a'} | firstDistance=${first?.distance ?? 'n/a'} | firstPreview="${firstPreview}"`
        );
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