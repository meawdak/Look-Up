// Manages player progress: found targets and current level.
// Rule: guarded with try/catch because localStorage can be disabled or in private mode.

const STORAGE_KEY = 'lookup_progress';

// In-memory fallback if localStorage is blocked
let memoryState = {
  found: [],
  level: 1,
};

// Loads saved progress or returns the default state (Level 1, no targets found).
export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        found: Array.isArray(parsed.found) ? parsed.found : [],
        level: Number.isInteger(parsed.level) && parsed.level >= 1 ? parsed.level : 1,
      };
    }
  } catch {
    // localStorage is unavailable or blocked; use in-memory state
  }
  return { ...memoryState };
}

// Saves progress to localStorage.
export function saveProgress(progress) {
  memoryState = {
    found: Array.from(new Set(progress.found || [])),
    level: progress.level || 1,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
  } catch {
    // localStorage write failed; in-memory fallback preserves current session
  }
  return { ...memoryState };
}

// Checks if a target has been found.
export function isFound(targetId, progress = loadProgress()) {
  return progress.found.includes(targetId);
}

// Targets with "requires" stay locked until the prerequisite target is found.
export function isLocked(target, progress = loadProgress()) {
  if (target.requires && !progress.found.includes(target.requires)) {
    return true;
  }
  return false;
}

// Marks a target as found and recalculates the player's level.
// Level goes up after finding 3 targets at the current level (up to Level 3).
export function markFound(targetId, allTargets = []) {
  const progress = loadProgress();
  if (!progress.found.includes(targetId)) {
    progress.found.push(targetId);
  }

  // Check if player should advance from Level 1 -> 2 or Level 2 -> 3
  if (allTargets.length > 0) {
    if (progress.level === 1) {
      const foundL1 = allTargets.filter((t) => t.level === 1 && progress.found.includes(t.id)).length;
      if (foundL1 >= 3) progress.level = 2;
    }
    if (progress.level === 2) {
      const foundL2 = allTargets.filter((t) => t.level === 2 && progress.found.includes(t.id)).length;
      if (foundL2 >= 3) progress.level = 3;
    }
  }

  saveProgress(progress);
  return progress;
}
