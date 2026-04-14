import 'dotenv/config';
import assert from 'node:assert/strict';
import { getLLMResponse } from '../src/services/llm_client.js';
import ragService from '../src/services/rag.service.js';
import { AskPromptBuilder } from '../src/services/prompts/builder.js';

function divider(label) {
  console.log(`\n===== ${label} =====`);
}

function short(text, max = 700) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}...`;
}

async function runWithoutRag(question) {
  divider('WITHOUT RAG');
  const response = await getLLMResponse(question);
  assert.ok(response && String(response).trim().length > 0, 'WITHOUT RAG returned empty response');
  console.log(short(response));
  return response;
}

async function runWithRag(question) {
  divider('WITH RAG');

  // Mock grouped profile + wearable snapshot to drive RAG retrieval without DB dependency.
  const groupedUserData = {
    user_id: 999,
    gender: 'female',
    age_group: 'Young adult',
    exercise_level: 'Beginner',
    wearable_data: [
      {
        heart_rate: 158,
        current_speed: 0,
        exercise_type: 'Strength',
        set_count: 3,
        sleep_duration: 330,
        sleep_quality: 2,
        rest_duration: 45,
      },
    ],
    conversation_history: [],
  };

  const ragAdvice = await ragService.getAdviceContent(999, groupedUserData, {
    useGate: false,
    topK: 3,
  });

  console.log(`RAG_ITEMS=${ragAdvice.length}`);
  if (ragAdvice.length > 0) {
    console.log(`RAG_TOP1=${short(ragAdvice[0], 180)}`);
  }

  const promptBuilder = new AskPromptBuilder();
  const systemPrompt = await promptBuilder.builder(groupedUserData, ragAdvice);
  const finalPrompt = `${systemPrompt}\n\nUser question: ${question}`;

  const response = await getLLMResponse(finalPrompt);
  assert.ok(response && String(response).trim().length > 0, 'WITH RAG returned empty response');
  console.log(short(response));
  return { response, ragAdvice };
}

async function main() {
  const question = process.argv.slice(2).join(' ').trim() ||
    'My heart rate is high and I slept poorly. What should I do for this workout?';

  console.log(`QUESTION=${question}`);

  const noRag = await runWithoutRag(question);
  const withRag = await runWithRag(question);

  divider('SUMMARY');
  console.log(`WITHOUT_RAG_CHARS=${String(noRag).length}`);
  console.log(`WITH_RAG_CHARS=${String(withRag.response).length}`);
  console.log(`RAG_ADVICE_COUNT=${withRag.ragAdvice.length}`);
  console.log('PASS: both calls returned non-empty responses.');
}

main().catch((err) => {
  console.error('\nTEST FAILED');
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
