import ollama from 'ollama';
import config from '../../config/rag_config.js';

class OllamaEmbeddingService {
  constructor() {
    this.model = config.OLLAMA_MODEL;
    // ensure the ollama client points to your host
    process.env.OLLAMA_HOST = config.OLLAMA_HOST;
    console.log('[Embedding] Initialized with model:', this.model, '| host:', process.env.OLLAMA_HOST);
  }

  /**
   * Generate embeddings for a list of texts
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async generateEmbeddings(texts) {
    const embeddings = [];
    for (let i = 0; i < texts.length; i++) {
      try {
        const res = await ollama.embeddings({
          model: this.model,
          prompt: texts[i],
        });
        // ollama returns { embedding: number[] }
        embeddings.push(res.embedding);
        console.log(`[Embedding] Text ${i} embedded.`);
      } catch (err) {
        console.error(`Error generating embedding for text ${i}:`, err?.response?.data || err?.message || err);
        throw new Error(`Failed to get embedding for text ${i}`);
      }
    }
    return embeddings;
  }

  async verifyModel() {
    try {
      await ollama.pull({ model: this.model });
      console.log(`[RAG] Model '${this.model}' verified.`);
    } catch (error) {
      console.error(`[RAG] Model verification failed: ${error.message}`);
      throw new Error(`Ollama model ${this.model} not found. Run: ollama pull ${this.model}`);
    }
  }
}

export default new OllamaEmbeddingService();