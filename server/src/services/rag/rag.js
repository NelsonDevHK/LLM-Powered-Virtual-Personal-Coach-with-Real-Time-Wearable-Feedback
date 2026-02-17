// src/services/rag.js
const { ChromaClient } = require('chromadb');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class RunnerRAGEngine {
  constructor(chromaPath = '../database/chroma_running') {
    this.chromaPath = chromaPath;
    this.embeddingModel = OLLAMA_EMBEDDING_MODEL_NAME || 'nomic-embed-text';
    this.ollamaUrl = 'http://localhost:11434/api/embeddings';
    this.collection = null;
    this.setupCollectionWithFallback();
  }

  async setupCollectionWithFallback() {
    try {
      this.chromaClient = new ChromaClient({ path: this.chromaPath });
      this.collection = await this.chromaClient.getOrCreateCollection({ name: 'running_advice' });
      // Probe to check for corruption
      await this.collection.count();
    } catch (error) {
      console.warn('Chroma index corrupted, falling back to fresh path');
      const freshPath = `${this.chromaPath}_fresh`;
      this.chromaClient = new ChromaClient({ path: freshPath });
      this.collection = await this.chromaClient.getOrCreateCollection({ name: 'running_advice' });
    }
  }

  async safeEmbed(texts) {
    const embeddings = [];
    for (const text of texts) {
      try {
        const response = await axios.post(this.ollamaUrl, {
          model: this.embeddingModel,
          prompt: text,
          stream: false,
        }, { timeout: 30000 });
        let data = response.data;
        if (!data.embedding) {
          // Fallback for NDJSON-like responses
          const parts = response.data.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
          data = parts.reverse().find(p => p.embedding) || {};
        }
        embeddings.push(data.embedding || []);
      } catch (error) {
        console.error('Embedding error:', error);
        embeddings.push([]);  // Empty vector fallback
      }
    }
    return embeddings;
  }

  async loadKnowledgeBase(jsonPath) {
    const docs = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const normalizedIds = [];
    const normalizedTexts = [];
    const normalizedMetadatas = [];

    for (const doc of docs) {
      const docId = doc.id;
      const text = doc.content || '';
      const metadata = { ...doc.metadata };

      const runningLevel = metadata.running_level;
      if (Array.isArray(runningLevel)) {
        for (const level of runningLevel) {
          const md = { ...metadata, running_level: level };
          normalizedIds.push(`${docId}__rl_${level}`);
          normalizedTexts.push(text);
          normalizedMetadatas.push(md);
        }
      } else {
        normalizedIds.push(docId);
        normalizedTexts.push(text);
        normalizedMetadatas.push(metadata);
      }
    }

    const docEmbeddings = await this.safeEmbed(normalizedTexts);
    await this.collection.add({
      ids: normalizedIds,
      documents: normalizedTexts,
      metadatas: normalizedMetadatas,
      embeddings: docEmbeddings,
    });
    console.log(`Loaded ${normalizedIds.length} normalized running advice entries`);
  }

  buildQueryText(userData) {
    const hrZone = userData.heart_rate > 170 ? 'high' : (userData.heart_rate > 140 ? 'moderate' : 'low');
    const motionMap = { running: '跑步中', walking: '快走中', resting: '休息中' };
    let query = `${userData.running_level}跑者${motionMap[userData.current_motion] || '运动'}时心率${userData.heart_rate}bpm`;

    if (userData.heart_rate > 180) query += ' 心率过高危险';
    if (userData.age > 50) query += ` ${userData.age}岁高龄跑者`;

    return query;
  }

  async retrieveAdvice(userData, nResults = 5) {
    const queryText = this.buildQueryText(userData);
    const whereClause = { running_level: { $in: [userData.running_level, 'any'] } };
    const queryEmbedding = (await this.safeEmbed([queryText]))[0];

    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
      where: whereClause,
    });

    return results.documents?.[0] || [];
  }

  async handleUserQuery(userData) {
    if (!userData) return { error: '未提供用户数据' };
    const adviceList = await this.retrieveAdvice(userData);
    return { user_data: userData, retrieved_advice: adviceList };
  }
}

module.exports = RunnerRAGEngine;