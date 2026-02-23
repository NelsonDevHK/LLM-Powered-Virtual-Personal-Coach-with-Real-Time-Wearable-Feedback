// src/services/llm.service.js
import { getLLMResponse } from './llm_client.js';
import { LlmPromptBuilder } from './prompts/builder.js';
import user_data from './user_data.js';
import ragService from './rag.service.js'; // 依賴 RagService
import logger from '../utils/logger.js';

class LlmService {
  async getResponse(userId) {
    logger.info(`LlmService: Processing response for user_id=${userId}`);

    // 1. Get User Data
    const userDict = await user_data.getLlmData(userId);
    
    // 2. Get RAG Context (通過 Service 調用，不是 Controller)
    const ragContents = await ragService.getAdviceContent(userId);
    
    // 3. Build Prompt
    const promptBuilder = new LlmPromptBuilder();
    const prompt = await promptBuilder.builder(userDict, ragContents);
    logger.info(`LlmService: Built prompt for user_id=${userId}: ${prompt}`);
    
    // 4. Call LLM
    const llmResponse = await getLLMResponse(prompt);
    
    return { response: llmResponse };
  }
}

export default new LlmService();