// Simple CLI to manually test getLLMResponse
// Usage:
//   node src/scripts/test_llm.js                 # interactive mode
//   node src/scripts/test_llm.js "Your question"  # one-shot

const readline = require('readline');
const dotenv = require('dotenv');

// Load .env from project root if present
dotenv.config();

const { getLLMResponse } = require('../services/llm_client');

async function askOnce(prompt) {
  const res = await getLLMResponse(prompt);
  console.log('\n--- LLM Response ---');
  console.log(res);
  console.log('--------------------\n');
}

async function interactive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log('LLM manual tester. Type your prompt and press Enter. Type ":q" to quit.');

  while (true) {
    const input = await question('> ');
    if (!input || input.trim() === ':q') break;
    try {
      await askOnce(input);
    } catch (e) {
      console.error('Error:', e?.message || e);
    }
  }

  rl.close();
}

(async function main() {
  const arg = process.argv.slice(2).join(' ').trim();
  if (arg) {
    await askOnce(arg);
    return;
  }
  await interactive();
})();
