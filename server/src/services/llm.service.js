// src/services/llm.service.js
import { getLLMResponse } from './llm_client.js';
import { LlmPromptBuilder } from './prompts/builder.js';
import user_data from './db.service.js';
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

    // 5. need implement later, to save the response to json file for future use, and also to save 
    
    
    return { response: llmResponse };
  }

  async getSessionSummary(userId) {
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
  }
}

export default new LlmService();