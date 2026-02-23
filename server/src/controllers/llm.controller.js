// src/controllers/llm.controller.js
import llmService from '../services/llm.service.js';
import logger from '../utils/logger.js';

class LlmController {
  async getResponse(req, res, next) {
    try {
      const userId = req.params.userId;
      logger.info(`LlmController: Request for user_id=${userId}`);
      
      const result = await llmService.getResponse(userId);
      
      res.json(result);
    } catch (err) {
      logger.error('LlmController Error:', err);
      next(err);
    }
  }
}

export default new LlmController();