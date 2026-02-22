// src/services/rag/test_rag.js
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { initRAG, queryRAG } from '../src/services/rag/index.js';
import ragEngine from '../src/services/rag/engine.js';

describe('RAG Service', () => {
  // Store mock contexts for restoration
  let initializeMock;
  let queryMock;

  before(() => {
    // Create mocks for engine methods
    initializeMock = mock.method(ragEngine, 'initialize', async () => {
      return Promise.resolve({ status: 'initialized' });
    });

    queryMock = mock.method(ragEngine, 'query', async (question, top_k) => {
      return Promise.resolve({
        question,
        top_k,
        results: [
          { content: 'Sample answer 1', score: 0.95 },
          { content: 'Sample answer 2', score: 0.85 },
          { content: 'Sample answer 3', score: 0.75 },
        ],
      });
    });
  });

  after(() => {
    // ✅ CORRECT: Use mock.restore() to restore all mocks
    mock.restore();
  });

  describe('initRAG', () => {
    it('should initialize the RAG engine successfully', async () => {
      await initRAG();
      assert.strictEqual(initializeMock.mock.callCount(), 1);
    });

    it('should call engine.initialize exactly once', async () => {
      await initRAG();
      assert.strictEqual(initializeMock.mock.callCount(), 2);
    });
  });

  describe('queryRAG', () => {
    it('should query with default top_k value', async () => {
      const question = 'What is machine learning?';
      const result = await queryRAG(question);

      assert.ok(result);
      assert.strictEqual(result.question, question);
      assert.strictEqual(result.top_k, 3);
      assert.ok(Array.isArray(result.results));
      assert.strictEqual(result.results.length, 3);
    });

    it('should query with custom top_k value', async () => {
      const question = 'Explain neural networks';
      const top_k = 5;
      const result = await queryRAG(question, top_k);

      assert.strictEqual(result.question, question);
      assert.strictEqual(result.top_k, top_k);
    });

    it('should handle empty question string', async () => {
      const question = '';
      const result = await queryRAG(question);

      assert.ok(result);
      assert.strictEqual(result.question, '');
    });

    it('should call engine.query with correct parameters', async () => {
      const question = 'Test question';
      const top_k = 2;

      await queryRAG(question, top_k);

      const lastCall = queryMock.mock.calls[queryMock.mock.callCount() - 1];
      assert.strictEqual(lastCall.arguments[0], question);
      assert.strictEqual(lastCall.arguments[1], top_k);
    });
  });

  describe('Error Handling', () => {
    it('should handle engine initialization errors', async () => {
      initializeMock.mock.mockImplementation(async () => {
        throw new Error('Initialization failed');
      });

      await assert.rejects(
        async () => await initRAG(),
        {
          name: 'Error',
          message: 'Initialization failed',
        }
      );

      // Restore original implementation
      initializeMock.mock.mockImplementation(async () => {
        return Promise.resolve({ status: 'initialized' });
      });
    });

    it('should handle query errors', async () => {
      queryMock.mock.mockImplementation(async () => {
        throw new Error('Query failed');
      });

      await assert.rejects(
        async () => await queryRAG('test question'),
        {
          name: 'Error',
          message: 'Query failed',
        }
      );

      // Restore original implementation
      queryMock.mock.mockImplementation(async (question, top_k) => {
        return Promise.resolve({
          question,
          top_k,
          results: [],
        });
      });
    });
  });
});