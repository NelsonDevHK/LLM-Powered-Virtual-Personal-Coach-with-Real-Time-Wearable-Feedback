  // tests/test_rag_controller.js
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import RagController from '../src/controllers/rag.js';
import user_data from '../src/services/user_data.js';
import RagPromptBuilder from '../src/services/prompts/builder.js';
import * as ragService from '../src/services/rag.js';
import logger from '../src/utils/logger.js';

describe('RagController.getAdvice', () => {
  let getRagDataMock;
  let builderMock;
  let queryRAGMock;
  let loggerInfoMock;
  let loggerErrorMock;

  beforeEach(() => {
    // Mock dependencies used in getAdvice
    getRagDataMock = mock.method(user_data, 'getRagData', async (userId) => {
      return { id: userId, some: 'data' };
    });

    builderMock = mock.method(
      RagPromptBuilder.prototype,
      'builder',
      async (userDict) => {
        return `prompt-for-${userDict.id}`;
      }
    );

    queryRAGMock = mock.method(
      ragService,
      'queryRAG',
      async (prompt) => {
        return `advice-for-${prompt}`;
      }
    );

    // Mock logger to avoid noisy output and allow assertions if needed
    loggerInfoMock = mock.method(logger, 'info', () => {});
    loggerErrorMock = mock.method(logger, 'error', () => {});
  });

  afterEach(() => {
    mock.restoreAll?.() || mock.restore(); // depending on Node version
  });

  function makeMockRes() {
    const res = {};
    res.statusCode = 200;

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };

    res.jsonPayload = undefined;
    res.json = (payload) => {
      res.jsonPayload = payload;
      return res;
    };

    return res;
  }

  it('should return advice for a valid userId (happy path)', async () => {
    const req = { params: { userId: '123' } };
    const res = makeMockRes();

    await RagController.getAdvice(req, res);

    // Check service interactions
    assert.equal(getRagDataMock.mock.callCount(), 1);
    assert.equal(builderMock.mock.callCount(), 1);
    assert.equal(queryRAGMock.mock.callCount(), 1);

    // Check response
    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonPayload);
    assert.ok('advice' in res.jsonPayload);
    assert.equal(
      res.jsonPayload.advice,
      'advice-for-prompt-for-123'
    );
  });

  it('should handle errors and return 500 with error message', async () => {
    // Force getRagData to throw
    getRagDataMock.mock.mockImplementation(async () => {
      throw new Error('DB failure');
    });

    const req = { params: { userId: '123' } };
    const res = makeMockRes();

    await RagController.getAdvice(req, res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.jsonPayload, { error: 'Failed to get advice' });
    assert.equal(loggerErrorMock.mock.callCount(), 1);
  });
});