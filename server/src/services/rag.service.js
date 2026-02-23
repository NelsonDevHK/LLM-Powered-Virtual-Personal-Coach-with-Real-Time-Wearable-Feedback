// src/services/rag.service.js
import { queryRAG } from './rag/index.js';
import { RagPromptBuilder } from './prompts/builder.js';
import user_data from './user_data.js';
import logger from '../utils/logger.js';

class RagService {
  async getAdvice(userId) {
    logger.info(`RagService: Processing advice for user_id=${userId}`);
    
    // 1. Get Data
    const userDict = await user_data.getRagData(userId);
    
    // 2. Build Prompt
    const promptBuilder = new RagPromptBuilder();
    const prompt = await promptBuilder.builder(userDict);
    
    // 3. Query RAG
    const advice = await queryRAG(prompt);
    
    //debug log
    if (!advice || (Array.isArray(advice) && advice.length === 0)) {
      logger.warn(`RagService: No advice returned for user_id=${userId} with prompt: ${prompt}`);
    } else {
      logger.info(`RagService: Received advice for user_id=${userId}: ${JSON.stringify(advice, null, 2)}`);
    }

    // 4. Return Pure Data
    return { advice };
  }

  // 給 LLM Service 用的內部方法，只返回內容列表
  async getAdviceContent(userId) {
    const { advice } = await this.getAdvice(userId);
    return Array.isArray(advice) ? advice.map(item => item.content) : [];
  }
}

export default new RagService();