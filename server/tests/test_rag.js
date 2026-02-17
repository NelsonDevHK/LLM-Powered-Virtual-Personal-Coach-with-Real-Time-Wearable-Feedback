// Minimal test to verify RAG loading and retrieval
const path = require('path');
const RunnerRAGEngine = require('../services/rag');

(async () => {
  const engine = new RunnerRAGEngine();

  // Resolve the JSON path relative to this test file
  const jsonPath = path.resolve(__dirname, '../../data/fitness_advice.json');
  console.log('Test JSON path:', jsonPath);

  await engine.loadKnowledgeBase(jsonPath);

  // Happy path test query
  const userData = {
    running_level: 'beginner',
    current_motion: 'running',
    heart_rate: 175,
    age: 30,
  };

  const result = await engine.handleUserQuery(userData);
  console.log('User data:', result.user_data);
  console.log('Retrieved advice count:', result.retrieved_advice.length);
  console.log('Top advice snippet:', (result.retrieved_advice[0] || '').slice(0, 120));

  // Edge case: generic level and moderate HR
  const resultAny = await engine.handleUserQuery({
    running_level: 'any',
    current_motion: 'walking',
    heart_rate: 145,
    age: 60,
  });
  console.log('Retrieved advice (any level) count:', resultAny.retrieved_advice.length);
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
