// test/guide_test.mjs
// Verifies checkAnswer, quickAnswer, buildFactsFor, factsToBullets, and trimToTwoSentences in Node.

import assert from 'node:assert/strict';
import {
  checkAnswer,
  quickAnswer,
  buildFactsFor,
  buildMessages,
  factsToBullets,
  trimToTwoSentences,
  SYSTEM_PROMPT,
} from '../src/ai/guide.js';

// Summer Triangle facts for brightness and distance testing
const summerTriangleFacts = {
  target: 'The Summer Triangle',
  puzzle: 'Find three bright stars that form a big triangle.',
  up_now: true,
  direction: 'E',
  height: 'high',
  brightest_star: 'Vega',
  faintest_star: 'Deneb',
  nearest_star: 'Altair',
  farthest_star: 'Deneb',
  stars: [
    { name: 'Vega', brightness: 'very bright', light_years: 25 },
    { name: 'Altair', brightness: 'bright', light_years: 17 },
    { name: 'Deneb', brightness: 'medium-bright', light_years: 1400 },
  ],
};

const mockFacts = {
  target: 'Vega',
  puzzle: 'The bright harp star',
  up_now: true,
  direction: 'E',
  height: 'mid-sky',
  stars: [{ name: 'Vega', brightness: 'very bright', light_years: 25 }],
  fact_after_found: 'Vega was the first star ever photographed.',
};

const mockNotUpFacts = {
  target: 'Sirius',
  puzzle: 'The scorching dog star',
  up_now: false,
  good_from: '23:00',
  best_time: '01:30',
};

// 1. Summer Triangle / Deneb test: "Deneb is the brightest" must FAIL
{
  const result = checkAnswer(
    'Deneb is the brightest star in the Summer Triangle.',
    summerTriangleFacts
  );
  assert.equal(
    result,
    false,
    '"Deneb is the brightest" must fail against Summer Triangle facts where Vega is brightest'
  );
}

// 2. checkAnswer validations
{
  // Valid answer passes
  assert.equal(
    checkAnswer('Vega is very bright and about 25 light-years away.', mockFacts),
    true,
    'Valid factual answer should pass'
  );

  // NOT_IN_FACTS passes as a valid grounded reply
  assert.equal(
    checkAnswer('NOT_IN_FACTS', mockFacts),
    true,
    'NOT_IN_FACTS must be accepted as valid by checkAnswer'
  );

  // Reject star name not in the facts
  assert.equal(
    checkAnswer('Look at Betelgeuse in the night sky.', mockFacts),
    false,
    'Star name not in facts (Betelgeuse) must be rejected'
  );

  // Reject number not in the facts
  assert.equal(
    checkAnswer('Vega is 500 light-years away from Earth.', mockFacts),
    false,
    'Number not in facts (500) must be rejected'
  );

  // Reject repeated sentences (degeneration loop)
  assert.equal(
    checkAnswer('Vega is very bright. Vega is very bright.', mockFacts),
    false,
    'Repeated sentence must be rejected'
  );

  // Reject when target not up and claims visible now
  assert.equal(
    checkAnswer('Look up now to see Sirius right now in the sky.', mockNotUpFacts),
    false,
    'Claiming visible now when not up must be rejected'
  );

  // Reject error / traceback
  assert.equal(checkAnswer('Error: out of memory', mockFacts), false);
  assert.equal(checkAnswer('Traceback (most recent call last):', mockFacts), false);
}

// 3. SYSTEM_PROMPT & factsToBullets
{
  const expectedPrompt = `You are a stargazing guide. Answer using ONLY the facts.
Copy names and numbers exactly. At most 2 short sentences.
If the facts do not answer the question, reply only: NOT_IN_FACTS`;
  assert.equal(SYSTEM_PROMPT, expectedPrompt, 'SYSTEM_PROMPT must match required text');

  const bullets = factsToBullets(summerTriangleFacts);
  assert.ok(bullets.includes('- Brightest: Vega'), 'Bullets should include brightest star');
  assert.ok(bullets.includes('- Vega: very bright, 25 light years'), 'Bullets should include star info');

  const tailoredFacts = {
    target: 'The Summer Triangle',
    nearest_star: 'Altair',
    nearest_light_years: 17,
    farthest_star: 'Deneb',
    farthest_light_years: 1400,
    stars: [
      { name: 'Vega', light_years: 25 },
      { name: 'Altair', light_years: 17 },
      { name: 'Deneb', light_years: 1400 },
    ],
  };
  const messages = buildMessages(tailoredFacts, 'How far is it?');
  const promptText = messages.map((m) => m.content).join('\n');
  const estTokens = Math.ceil(promptText.length / 4);
  assert.ok(estTokens < 120, `Prompt token estimate (${estTokens}) must be under 120 tokens`);
}

// 4. trimToTwoSentences
{
  const threeSentences = 'First sentence. Second sentence! Third sentence?';
  assert.equal(trimToTwoSentences(threeSentences), 'First sentence. Second sentence!');

  const withNewlines = 'First sentence. Second sentence.\n\nExtra paragraph.';
  assert.equal(trimToTwoSentences(withNewlines), 'First sentence. Second sentence.');
}

// 5. buildFactsFor question-specific tests
{
  const mockPlan = {
    target: {
      id: 'summer-triangle',
      title: 'The Summer Triangle',
      puzzle: 'Find three bright stars.',
      stars: [91262, 97649, 102098],
      hints: ['Hint 1', 'Hint 2', 'Hint 3'],
      unlock_fact: 'Belong to three constellations.',
    },
    now: { alt: 45, az: 90 },
    window: {
      from: new Date('2026-07-01T20:00:00'),
      best: { date: new Date('2026-07-01T22:30:00') },
    },
    stars: [
      { name: 'Vega', mag: 0.03, ly: 25 },
      { name: 'Altair', mag: 0.77, ly: 17 },
      { name: 'Deneb', mag: 1.25, ly: 1400 },
    ],
  };

  const mockData = {
    starById: new Map([
      [91262, { name: 'Vega', mag: 0.03, ly: 25 }],
      [97649, { name: 'Altair', mag: 0.77, ly: 17 }],
      [102098, { name: 'Deneb', mag: 1.25, ly: 1400 }],
    ]),
  };

  // Category: "what"
  const whatFacts = buildFactsFor(mockPlan, mockData, 'what');
  assert.equal(whatFacts.brightest_star, 'Vega', 'Vega should be precomputed brightest');
  assert.equal(whatFacts.faintest_star, 'Deneb', 'Deneb should be precomputed faintest');
  assert.equal(whatFacts.hints, undefined, 'No hints array should be present');
  assert.equal(whatFacts.stars[0].brightness, 'very bright', 'Brightness should be in words');
  assert.equal(whatFacts.stars[0].mag, undefined, 'No raw magnitude number');

  // Category: "distance"
  const distFacts = buildFactsFor(mockPlan, mockData, 'distance');
  assert.equal(distFacts.nearest_star, 'Altair', 'Altair should be precomputed nearest');
  assert.equal(distFacts.farthest_star, 'Deneb', 'Deneb should be precomputed farthest');
  assert.equal(distFacts.hints, undefined, 'No hints array in distance facts');

  // Category: "find"
  const findFacts = buildFactsFor(mockPlan, mockData, 'find');
  assert.ok(findFacts.where_to_look, 'Where to look string should be present');
  assert.equal(findFacts.hints, undefined, 'No hints array in find facts');

  // Category: "other"
  const otherFacts = buildFactsFor(mockPlan, mockData, 'other');
  assert.equal(otherFacts.hints, undefined, 'No hints array in other facts');
  assert.equal(otherFacts.brightest_star, 'Vega');
  assert.equal(otherFacts.nearest_star, 'Altair');
}

// 6. quickAnswer tests
{
  const distanceAns = quickAnswer(summerTriangleFacts, 'How far away is it?');
  assert.ok(distanceAns.includes('light-years'), 'Distance question should mention light-years');

  const whatAns = quickAnswer(summerTriangleFacts, 'What am I looking at?');
  assert.ok(whatAns.includes('The Summer Triangle'), 'What question should mention target');

  const notUpAns = quickAnswer(mockNotUpFacts, 'How do I find it?');
  assert.ok(notUpAns.includes('not up yet'), 'Not up should state not up yet');
}

console.log('✓ All guide tests passed successfully!');
