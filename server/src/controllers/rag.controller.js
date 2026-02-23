// src/controllers/rag.controller.js
import ragService from '../services/rag.service.js';
import logger from '../utils/logger.js';

class RagController {
  async getAdvice(req, res, next) {
    try {
      const userId = req.params.userId;
      logger.info(`RagController: Request for user_id=${userId}`);
      
      const result = await ragService.getAdvice(userId);
      
      res.json(result);
    } catch (err) {
      logger.error('RagController Error:', err);
      next(err); // 交給 app.js 的錯誤處理中間件
    }
  }
}

export default new RagController();