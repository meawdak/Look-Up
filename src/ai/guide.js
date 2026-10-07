// The guide turns computed sky facts into friendly words.
// Rule: the sky engine decides WHAT is true; the language model only decides HOW to say it.
// This file has the no-AI fallback (templates) and the prompt builder the model will use (Day 4).
import { compassWord, heightWord } from '../sky/engine.js';

// Visual magnitude to plain words so the model never sees raw magnitude numbers.
export function brightnessInWords(mag) {
  if (mag == null) return null;
  if (mag < 0.5) return 'very bright';
  if (mag < 1.5) return 'bright';
  if (mag < 2.5) return 'medium-bright';
  if (mag < 4.0) return 'faint';
  return 'dim';
}

// Detect question category
export function detectQuestionCategory(question = '') {
  const q = String(question).toLowerCase();
  if (q.includes('what') || q.includes('looking at')) return 'what';
  if (q.includes('far') || q.includes('distance') || q.includes('light-year')) return 'distance';
  if (q.includes('find') || q.includes('where') || q.includes('look') || q.includes('how do i')) return 'find';
  return 'other';
}

// Base facts generator for Quest & Tonight screens
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

// Question-specific facts builder for the AI model:
// Strips raw magnitude numbers (replaces with words), strips hints array,
// and precomputes brightest/faintest/nearest/farthest stars by code.
export function buildFactsFor(planOrFacts, dataOrCategory, categoryArg = 'other') {
  let base;
  let category;

  if (typeof dataOrCategory === 'string') {
    base = planOrFacts;
    category = detectQuestionCategory(dataOrCategory);
  } else if (!dataOrCategory) {
    base = planOrFacts;
    category = 'other';
  } else {
    const plan = planOrFacts;
    const data = dataOrCategory;
    category = detectQuestionCategory(categoryArg);

    const t = plan.target || {};
    const starsFromTarget = (t.stars || []).map((id) => data?.starById?.get(id)).filter(Boolean);
    const stars = starsFromTarget.length > 0 ? starsFromTarget : (plan.stars || []);
    const pos = plan.now;

    base = {
      target: t.title,
      puzzle: t.puzzle,
      up_now: pos ? pos.alt > 0 : false,
      direction: pos ? compassWord(pos.az) : null,
      height: pos ? heightWord(pos.alt) : null,
      good_from: plan.window?.from?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? null,
      best_time: plan.window?.best?.date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? null,
      planet: plan.body ?? null,
      rawStars: stars,
      fact_after_found: t.unlock_fact,
    };
  }

  const starList = (base.rawStars || base.stars || []).map((s) => ({
    name: s.name ?? s.label,
    mag: s.mag != null ? s.mag : s.magnitude,
    ly: s.ly != null ? s.ly : s.light_years,
  }));

  let brightest_star = null;
  let faintest_star = null;
  let nearest_star = null;
  let farthest_star = null;
  let nearest_light_years = null;
  let farthest_light_years = null;

  if (starList.length > 0) {
    const withMag = starList.filter((s) => s.mag != null).sort((a, b) => a.mag - b.mag);
    if (withMag.length > 0) {
      brightest_star = withMag[0].name;
      faintest_star = withMag[withMag.length - 1].name;
    }

    const withLy = starList.filter((s) => s.ly != null).sort((a, b) => a.ly - b.ly);
    if (withLy.length > 0) {
      nearest_star = withLy[0].name;
      nearest_light_years = withLy[0].ly;
      farthest_star = withLy[withLy.length - 1].name;
      farthest_light_years = withLy[withLy.length - 1].ly;
    }
  }

  if (category === 'distance') {
    return {
      target: base.target,
      planet: base.planet || null,
      nearest_star: starList.length > 1 ? nearest_star : null,
      nearest_light_years: starList.length > 1 ? nearest_light_years : (starList[0]?.ly ?? null),
      farthest_star: starList.length > 1 ? farthest_star : null,
      farthest_light_years: starList.length > 1 ? farthest_light_years : null,
      stars: starList.map((s) => ({ name: s.name, light_years: s.ly })),
    };
  }

  if (category === 'what') {
    return {
      target: base.target,
      puzzle: base.puzzle,
      planet: base.planet || null,
      brightest_star: starList.length > 1 ? brightest_star : null,
      faintest_star: starList.length > 1 ? faintest_star : null,
      stars: starList.map((s) => ({ name: s.name, brightness: brightnessInWords(s.mag) })),
    };
  }

  if (category === 'find') {
    return {
      target: base.target,
      up_now: base.up_now,
      direction: base.direction,
      height: base.height,
      where_to_look: base.up_now && base.direction ? `Face ${base.direction} and look ${base.height}.` : null,
      good_from: base.good_from,
      best_time: base.best_time,
    };
  }

  // category === 'other'
  return {
    target: base.target,
    puzzle: base.puzzle,
    up_now: base.up_now,
    direction: base.direction,
    height: base.height,
    planet: base.planet || null,
    brightest_star: starList.length > 1 ? brightest_star : null,
    faintest_star: starList.length > 1 ? faintest_star : null,
    nearest_star: starList.length > 1 ? nearest_star : null,
    farthest_star: starList.length > 1 ? farthest_star : null,
    stars: starList.map((s) => ({
      name: s.name,
      brightness: brightnessInWords(s.mag),
      light_years: s.ly,
    })),
  };
}

// Works with no model at all (weak phones, or before the model is downloaded).
export function templateHint(facts, level = 0) {
  if (!facts.up_now) return `${facts.target} is not up yet. Come back after ${facts.good_from} (best around ${facts.best_time}).`;
  if (level === 0) return `Face ${facts.direction} and look ${facts.height}. ${facts.puzzle}`;
  if (Array.isArray(facts.hints)) {
    return facts.hints[Math.min(level - 1, facts.hints.length - 1)];
  }
  return `Look for ${facts.target} in the ${facts.direction || 'sky'}.`;
}

export const SYSTEM_PROMPT = `You are a stargazing guide. Answer using ONLY the facts.
Copy names and numbers exactly. At most 2 short sentences.
If the facts do not answer the question, reply only: NOT_IN_FACTS`;

export function factsToBullets(facts) {
  if (typeof facts === 'string') return facts;
  const lines = [];

  if (facts.target) {
    if (facts.puzzle) {
      lines.push(`- ${facts.target}: ${facts.puzzle}`);
    } else {
      lines.push(`- Target: ${facts.target}`);
    }
  }
  if (facts.planet) {
    lines.push(`- Planet: ${facts.planet}`);
  }
  if (facts.where_to_look) {
    lines.push(`- Where: ${facts.where_to_look}`);
  } else if (facts.direction && facts.height) {
    lines.push(`- Where: Face ${facts.direction}, look ${facts.height}`);
  }
  if (facts.up_now === false && facts.good_from) {
    lines.push(`- Not up now. Best after ${facts.good_from}`);
  }
  if (facts.brightest_star) {
    lines.push(`- Brightest: ${facts.brightest_star}`);
  }
  if (facts.faintest_star) {
    lines.push(`- Faintest: ${facts.faintest_star}`);
  }
  if (facts.nearest_star && facts.nearest_light_years) {
    lines.push(`- Nearest: ${facts.nearest_star} (${facts.nearest_light_years} light years)`);
  }
  if (facts.farthest_star && facts.farthest_light_years) {
    lines.push(`- Farthest: ${facts.farthest_star} (${facts.farthest_light_years} light years)`);
  }
  if (Array.isArray(facts.stars)) {
    for (const s of facts.stars) {
      const details = [];
      if (s.brightness) details.push(s.brightness);
      if (s.light_years != null) details.push(`${s.light_years} light years`);
      if (details.length > 0) {
        lines.push(`- ${s.name}: ${details.join(', ')}`);
      } else {
        lines.push(`- ${s.name}`);
      }
    }
  }
  return lines.join('\n');
}

export function trimToTwoSentences(text) {
  if (!text) return '';
  let clean = text.split('\n\n')[0].trim();
  const matches = [...clean.matchAll(/[.!?]+(?:\s+|$)/g)];
  if (matches.length >= 2) {
    const secondEnd = matches[1].index + matches[1][0].length;
    clean = clean.slice(0, secondEnd).trim();
  }
  return clean;
}

export function buildMessages(facts, userQuestion) {
  const bulletFacts = typeof facts === 'string' ? facts : factsToBullets(facts);
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `FACTS:\n${bulletFacts}\n\nQUESTION: ${userQuestion}` },
  ];
}

const KNOWN_STAR_NAMES = [
  'sirius', 'canopus', 'arcturus', 'vega', 'capella', 'rigel', 'procyon',
  'achernar', 'betelgeuse', 'hadar', 'altair', 'acrux', 'aldebaran', 'spica',
  'antares', 'pollux', 'fomalhaut', 'mimosa', 'deneb', 'regulus', 'adhara',
  'castor', 'gacrux', 'shaula', 'bellatrix', 'elnath', 'miaplacidus', 'alnilam',
  'alnair', 'alnitak', 'alioth', 'mirfak', 'dubhe', 'wezen', 'alkaid',
  'polaris', 'hamal', 'algol', 'almach', 'denebola', 'mizar', 'schedar',
  'mintaka', 'caph', 'merak', 'phecda', 'megrez', 'ruchbah',
];

// Validates an AI generated answer against the verified facts JSON
export function checkAnswer(answer, facts) {
  if (!answer || typeof answer !== 'string') return false;
  const text = answer.trim();
  if (text.length < 5) return false;

  // NOT_IN_FACTS is a correct grounded response
  if (text.includes('NOT_IN_FACTS')) {
    return true;
  }

  // Answer should not be an error payload or technical traceback
  if (text.startsWith('Error:') || text.toLowerCase().includes('traceback')) {
    return false;
  }

  // If the target is not up, ensure the AI doesn't claim it is currently visible
  if (facts.up_now === false) {
    const lower = text.toLowerCase();
    if (lower.includes('look up now') || lower.includes('visible right now')) {
      return false;
    }
  }

  // Reject repeated sentences (e.g. model caught in repetition loop)
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  const seenSentences = new Set();
  for (const s of sentences) {
    if (seenSentences.has(s)) {
      return false;
    }
    seenSentences.add(s);
  }

  const factsJson = JSON.stringify(facts).toLowerCase();
  const lowerText = text.toLowerCase();

  // Reject any star name not in the facts
  const allowedStarNames = new Set();
  if (facts.target) allowedStarNames.add(facts.target.toLowerCase());
  if (facts.brightest_star) allowedStarNames.add(facts.brightest_star.toLowerCase());
  if (facts.faintest_star) allowedStarNames.add(facts.faintest_star.toLowerCase());
  if (facts.nearest_star) allowedStarNames.add(facts.nearest_star.toLowerCase());
  if (facts.farthest_star) allowedStarNames.add(facts.farthest_star.toLowerCase());
  if (Array.isArray(facts.stars)) {
    for (const s of facts.stars) {
      if (s.name) allowedStarNames.add(s.name.toLowerCase());
      if (s.label) allowedStarNames.add(s.label.toLowerCase());
    }
  }

  for (const star of KNOWN_STAR_NAMES) {
    const starRegex = new RegExp(`\\b${star}\\b`, 'i');
    if (starRegex.test(lowerText)) {
      const isAllowed = allowedStarNames.has(star) || factsJson.includes(star);
      if (!isAllowed) {
        return false;
      }
    }
  }

  // Reject any number not in the facts
  const numbersInAnswer = text.match(/\b\d+(?:\.\d+)?\b/g) || [];
  if (numbersInAnswer.length > 0) {
    const numbersInFacts = new Set(factsJson.match(/\b\d+(?:\.\d+)?\b/g) || []);
    for (const num of numbersInAnswer) {
      if (!numbersInFacts.has(num)) {
        const numFloat = parseFloat(num);
        let found = false;
        for (const fn of numbersInFacts) {
          if (parseFloat(fn) === numFloat) {
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
      }
    }
  }

  // Reject contradictions with precomputed brightest / faintest
  if (facts.brightest_star) {
    const brightestLower = facts.brightest_star.toLowerCase();
    for (const star of KNOWN_STAR_NAMES) {
      if (star !== brightestLower && (allowedStarNames.has(star) || factsJson.includes(star))) {
        const wrongBrightestRegex1 = new RegExp(`\\b${star}\\s+(?:is\\s+the\\s+)?brightest\\b`, 'i');
        const wrongBrightestRegex2 = new RegExp(`\\bbrightest\\s+(?:star\\s+is\\s+)?${star}\\b`, 'i');
        if (wrongBrightestRegex1.test(lowerText) || wrongBrightestRegex2.test(lowerText)) {
          return false;
        }
      }
    }
  }

  if (facts.faintest_star) {
    const faintestLower = facts.faintest_star.toLowerCase();
    for (const star of KNOWN_STAR_NAMES) {
      if (star !== faintestLower && (allowedStarNames.has(star) || factsJson.includes(star))) {
        const wrongFaintestRegex = new RegExp(`\\b${star}\\s+(?:is\\s+the\\s+)?faintest\\b`, 'i');
        if (wrongFaintestRegex.test(lowerText)) {
          return false;
        }
      }
    }
  }

  return true;
}

// Generates an immediate computed quick answer based on sky facts
export function quickAnswer(facts, question = '') {
  const category = detectQuestionCategory(question);
  if (category === 'distance') {
    if (facts.stars?.length && facts.stars[0].light_years) {
      const s = facts.stars[0];
      return `${s.name || facts.target} is about ${s.light_years} light-years away from Earth. Look up to see its light.`;
    }
    if (facts.nearest_light_years) {
      return `${facts.nearest_star || facts.target} is about ${facts.nearest_light_years} light-years away. Look up to find it.`;
    }
    if (facts.planet) {
      return `${facts.planet} is millions of kilometres away within our Solar System. Look for its steady light.`;
    }
  }
  if (category === 'what') {
    if (facts.puzzle) {
      return `${facts.target}: "${facts.puzzle}"`;
    }
    return `${facts.target} is visible in the sky. Look up to spot it.`;
  }
  if (category === 'find') {
    if (facts.up_now && facts.direction && facts.height) {
      return `Face ${facts.direction} and look ${facts.height}. Look up with your eyes.`;
    }
    if (!facts.up_now && facts.good_from) {
      return `${facts.target} is not up yet. Come back after ${facts.good_from}.`;
    }
  }
  return templateHint(facts, 0);
}
