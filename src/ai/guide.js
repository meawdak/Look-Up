// The guide turns computed sky facts into friendly words.
// Rule: the sky engine decides WHAT is true; the language model only decides HOW to say it.
// This file has the no-AI fallback (templates) and the prompt builder the model will use (Day 4).
import { compassWord, heightWord } from '../sky/engine.js';

// The ONLY facts the model is allowed to use. Everything comes from our data, not from the model.
export function buildFacts(plan, data) {
  const t = plan.target;
  const stars = (t.stars || []).map((id) => data.starById.get(id)).filter(Boolean);
  const pos = plan.now;
  return {
    target: t.title,
    puzzle: t.puzzle,
    up_now: pos ? pos.alt > 0 : false,
    direction: pos ? compassWord(pos.az) : null,
    height: pos ? heightWord(pos.alt) : null,
    good_from: plan.window?.from?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? null,
    best_time: plan.window?.best?.date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? null,
    planet: plan.body ?? null,
    stars: stars.map((s) => ({ name: s.name ?? s.label, magnitude: s.mag, light_years: s.ly })),
    hints: t.hints,
    fact_after_found: t.unlock_fact,
  };
}

// Works with no model at all (weak phones, or before the model is downloaded).
export function templateHint(facts, level = 0) {
  if (!facts.up_now) return `${facts.target} is not up yet. Come back after ${facts.good_from} (best around ${facts.best_time}).`;
  if (level === 0) return `Face ${facts.direction} and look ${facts.height}. ${facts.puzzle}`;
  return facts.hints[Math.min(level - 1, facts.hints.length - 1)];
}

export const SYSTEM_PROMPT = `You are a friendly stargazing guide talking to a beginner who is standing outside at night.
Use ONLY the facts in the JSON you are given. Never add numbers, names or claims that are not in it.
If the answer is not in the facts, say you are not sure.
Answer in at most 2 short sentences. Encourage the person to look up at the real sky, not at the screen.`;

export function buildMessages(facts, userQuestion) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `FACTS:\n${JSON.stringify(facts)}\n\nQUESTION: ${userQuestion}` },
  ];
}
