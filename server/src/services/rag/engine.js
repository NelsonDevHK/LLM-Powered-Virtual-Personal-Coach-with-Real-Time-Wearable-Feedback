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
    logger.error(
      `RAG init error: ${err?.response?.data || err?.message || err}`
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
      logger.info(`[RAG][Engine] Collection already has ${count} entries. Skipping load.`);
      return;
    }

    const filePath = path.resolve(process.cwd(), config.DATA_PATH);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Data file not found: ${filePath}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  logger.info(`[RAG][Engine] Loaded ${data.length} items from JSON.`);

    const ids = [];
    const documents = [];
    const metadatas = [];

    const textsToEmbed = data.map(item => item.content);

    logger.info(`[RAG][Engine] Generating embeddings for ${textsToEmbed.length} items...`);
    const generatedEmbeddings = await embeddingService.generateEmbeddings(textsToEmbed);

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const rawLevel = item.metadata.fitness_level ?? item.metadata.running_level ?? 'any';
      const fitnessLevel = Array.isArray(rawLevel) ? rawLevel.join(',') : rawLevel;
      ids.push(String(item.id));
      documents.push(item.content);
      metadatas.push({
        fitness_level: fitnessLevel,
        heart_rate_zone: item.metadata.heart_rate_zone ?? 'any',
        activity_type: item.metadata.activity_type ?? 'any',
        scenario: item.metadata.scenario ?? 'general',
        focus: item.metadata.focus ?? 'general',
      });
    }

    await this.collection.add({
      ids,
      documents,
      metadatas,
      embeddings: generatedEmbeddings,
    });

    logger.info(`[RAG][Engine] Stored ${ids.length} items into Chroma.`);
  }

  /**
   * Query the database
   * @param {string} queryText
   * @param {number} top_k
   */
  async query(queryText, top_k = 3) {
    if (!this.isInitialized) await this.initialize();

    const queryPreview = queryText.length > 160 ? `${queryText.slice(0, 160)}...` : queryText;
    logger.info(
      `[RAG][Engine] query start | top_k=${top_k} | queryChars=${queryText.length} | preview="${queryPreview}"`
    );

    const queryEmbedding = await embeddingService.generateEmbeddings([queryText]);

    const results = await this.collection.query({
      queryEmbeddings: queryEmbedding,
      nResults: top_k,
    });

    const formatted = this.formatResults(results);
    const topDistances = formatted.map((item) => item.distance).join(',');
    const first = formatted[0];
    const firstMeta = first?.metadata ? JSON.stringify(first.metadata) : 'none';
    logger.info(
      `[RAG][Engine] query end | resultCount=${formatted.length} | topDistances=${topDistances || 'none'} | firstId=${first?.id || 'n/a'} | firstMeta=${firstMeta}`
    );

    return formatted;
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