import { ChromaClient } from 'chromadb';
import fs from 'fs';
import path from 'path';
import config from '../../config/rag.config.js';
import embeddingService from './embedding.js';

import logger from '../../utils/logger.js';
class RAGEngine {
  constructor() {
    this.client = null;
    this.collection = null;
    this.isInitialized = false;
  }

async initialize() {
  if (this.isInitialized) {
    logger.info('RAG Engine already initialized.');
    return;
  }

  try {
    // Create Chroma client BEFORE using it
    this.client = new ChromaClient({
      serverUrl: `http://${config.CHROMA_HOST}:${config.CHROMA_PORT}`,
    });

    await this.client.heartbeat();
    logger.info('[RAG] Connected to Chroma Server successfully.');

    // get or create collection
    this.collection = await this.client.getOrCreateCollection({
      name: config.COLLECTION_NAME,
      metadata: { 'hnsw:space': 'cosine' },
    });

    this.isInitialized = true;
    logger.info(`[RAG] Engine initialized. Collection: ${config.COLLECTION_NAME}`);

    await this.loadAndStoreAdvice();
  } catch (err) {
  console.error('RAW RAG init error:', err);   // add this line
  logger.error(
    'Error initializing RAG Engine:',
    err?.response?.data || err?.message || err
  );
  throw new Error('Failed to initialize RAG Engine');
}
}

  /**
   * Load json from DATA_PATH, generate embeddings, and store in ChromaDB
   */
  async loadAndStoreAdvice() {
    const count = await this.collection.count();
    if (count > 0) {
      console.log(`Collection already has ${count} entries. Skipping load.`);
      return;
    }

    const filePath = path.resolve(process.cwd(), config.DATA_PATH);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Data file not found: ${filePath}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`[RAG] Loaded ${data.length} items from JSON.`);

    const ids = [];
    const documents = [];
    const metadatas = [];

    const textsToEmbed = data.map(item => item.content);

    console.log(`[RAG] Generating embeddings for ${textsToEmbed.length} items...`);
    const generatedEmbeddings = await embeddingService.generateEmbeddings(textsToEmbed);

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      ids.push(String(item.id));
      documents.push(item.content);
      metadatas.push({
        running_level: Array.isArray(item.metadata.running_level)
          ? item.metadata.running_level.join(',')
          : item.metadata.running_level,
        heart_rate_zone: item.metadata.heart_rate_zone,
        scenario: item.metadata.scenario,
        focus: item.metadata.focus,
      });
    }

    await this.collection.add({
      ids,
      documents,
      metadatas,
      embeddings: generatedEmbeddings,
    });

    console.log(`[RAG] Stored ${ids.length} items into Chroma.`);
  }

  /**
   * Query the database
   * @param {string} queryText
   * @param {number} top_k
   */
  async query(queryText, top_k = 3) {
    if (!this.isInitialized) await this.initialize();

    console.log(`[RAG] Query received: ${queryText}`);

    const queryEmbedding = await embeddingService.generateEmbeddings([queryText]);

    const results = await this.collection.query({
      queryEmbeddings: queryEmbedding,
      nResults: top_k,
    });

    return this.formatResults(results);
  }

  formatResults(raw) {
    const results = [];
    const ids = raw.ids[0] || [];
    const documents = raw.documents[0] || [];
    const metadatas = raw.metadatas[0] || [];
    const distances = raw.distances[0] || [];

    for (let i = 0; i < ids.length; i++) {
      results.push({
        rank: i + 1,
        id: ids[i],
        content: documents[i],
        metadata: metadatas[i],
        distance: distances[i] ? parseFloat(distances[i].toFixed(4)) : 0,
      });
    }
    return results;
  }
}

export default new RAGEngine();