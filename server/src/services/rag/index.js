// src/services/rag/index.js
import ragEngine from './engine.js';

export const initRAG = async () => {
  await ragEngine.initialize();
};

export const queryRAG = async (question, top_k = 3) => {
  return await ragEngine.query(question, top_k);
};