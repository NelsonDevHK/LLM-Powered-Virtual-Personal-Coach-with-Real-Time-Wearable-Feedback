// src/config/rag_config.js
import 'dotenv/config';

const config = {
  CHROMA_HOST: 'http://localhost:8000',
  COLLECTION_NAME: process.env.CHROMA_COLLECTION || 'running_advice',
  OLLAMA_MODEL: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
  DATA_PATH: process.env.ADVICES_DATA_PATH || './src/data/fitness_advice.json',
};

export default config;