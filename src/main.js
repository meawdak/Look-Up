import './styles.css';
import { makeObserver, compassWord, heightWord } from './sky/engine.js';
import { loadData, planTonight } from './sky/targets.js';
import { buildFacts, templateHint } from './ai/guide.js';
import { loadProgress, markFound, isFound, isLocked } from './game/progress.js';

const $ = (id) => document.getElementById(id);
const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// localStorage can be missing or blocked (private mode), so always guard it.
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// Application state
let appData = null;
let currentLoc = null;
let currentPlans = [];
let activeCountdown = null;

// Clean up any ongoing timer when leaving views
function clearActiveCountdown() {
  if (activeCountdown) {
    clearInterval(activeCountdown);
    activeCountdown = null;
  }
}

// GPS works offline on phones. If it fails, fall back to the last saved spot, then manual entry.
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(store.get('loc'));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lon: p.coords.longitude };
        store.set('loc', loc);
        resolve(loc);
      },
      () => resolve(store.get('loc')),
      { timeout: 10000, maximumAge: 6 * 3600e3 },
    );
  });
}

function askLocation() {
  const app = $('app');
  app.innerHTML = `
    <header>
      <h1>Look Up</h1>
    </header>
    <div class="card">
      <h2>Where are you?</h2>
      <p class="muted">Location was not available. Enter it once; it is saved on this device only.</p>
      <label>Latitude <input id="lat" inputmode="decimal" placeholder="e.g. 26.7"></label>
      <label>Longitude <input id="lon" inputmode="decimal" placeholder="e.g. 88.4"></label>
      <button id="save" class="btn-action btn-primary">Save and continue</button>
    </div>
    <footer class="muted">Phone down. Look up.</footer>`;

  $('save').onclick = () => {
    const lat = parseFloat($('lat').value);
    const lon = parseFloat($('lon').value);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      store.set('loc', { lat, lon });
      start();
    }
  };
}

// S1: Tonight Screen
function renderTonight() {
  clearActiveCountdown();
  const progress = loadProgress();
  const app = $('app');

  const locLine = currentLoc
    ? `${currentLoc.lat.toFixed(2)}°, ${currentLoc.lon.toFixed(2)}° · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '';

  let listHtml = '';
  if (!currentPlans.length) {
    listHtml = '<div class="card"><p>Nothing from the beginner list is well placed in the next 12 hours. Try again later tonight.</p></div>';
  } else {
    listHtml = currentPlans.map((p) => {
      const facts = buildFacts(p, appData);
      const name = p.body ? `${p.target.title}: ${p.body}` : p.target.title;
      const found = isFound(p.target.id, progress);
      const locked = isLocked(p.target, progress);

      if (locked) {
        // Find required target title to give helpful context
        const reqTarget = appData.targets.find((t) => t.id === p.target.requires);
        const reqTitle = reqTarget ? reqTarget.title : p.target.requires;
        return `
          <article class="card card-locked" aria-disabled="true">
            <h2>🔒 ${name}</h2>
            <p><span class="tag tag-locked">Locked</span><span class="muted">Level ${p.target.level}</span></p>
            <p class="muted">Requires: find ${reqTitle} first.</p>
          </article>`;
      }

      const nowLine = p.now && p.now.alt > 0
        ? `Now: ${compassWord(p.now.az)}, ${heightWord(p.now.alt)}`
        : 'Not up yet';

      const foundBadge = found ? '<span class="tag tag-found">✓ Found</span>' : '';
      const titlePrefix = found ? '✓ ' : '';

      return `
        <button class="card-clickable" type="button" data-id="${p.target.id}" aria-label="Open quest for ${name}">
          <h2>${titlePrefix}${name}</h2>
          <p><span class="tag">Level ${p.target.level}</span>${foundBadge}<span class="muted">${nowLine}</span></p>
          <p>Good from ${fmt(p.window.from)} to ${fmt(p.window.to)} · best ${fmt(p.window.best.date)}</p>
          <p class="muted">${templateHint(facts, 0)}</p>
        </button>`;
    }).join('');
  }

  app.innerHTML = `
    <header>
      <div class="nav-bar">
        <h1>Look Up</h1>
        <span class="tag">Level ${progress.level}</span>
      </div>
      <p id="where" class="muted">${locLine}</p>
    </header>
    <section id="tonight" aria-live="polite">${listHtml}</section>
    <footer class="muted">Phone down. Look up.</footer>`;

  // Attach click listeners to unlocked cards
  app.querySelectorAll('.card-clickable').forEach((btn) => {
    btn.onclick = () => {
      const targetId = btn.getAttribute('data-id');
      const selectedPlan = currentPlans.find((p) => p.target.id === targetId);
      if (selectedPlan) {
        renderQuest(selectedPlan);
      }
    };
  });
}

// S2: Quest Screen
function renderQuest(plan) {
  clearActiveCountdown();
  const progress = loadProgress();
  const facts = buildFacts(plan, appData);
  const name = plan.body ? `${plan.target.title}: ${plan.body}` : plan.target.title;
  const app = $('app');

  let revealedHintsCount = 0;
  const totalHints = Array.isArray(facts.hints) ? facts.hints.length : 0;

  // Level rules: Level 1 shows direction; Level 2 reveals direction on hint; Level 3 puzzle only.
  let locationGuidance = '';
  if (progress.level === 1 && facts.up_now) {
    locationGuidance = `<p class="muted">Now: Face ${facts.direction}, look ${facts.height}.</p>`;
  }

  app.innerHTML = `
    <nav class="nav-bar">
      <button id="btn-back" class="btn-back" type="button" aria-label="Back to Tonight list">← Tonight</button>
      <span class="tag">Level ${progress.level}</span>
    </nav>
    <article class="card">
      <h2>${name}</h2>
      ${locationGuidance}
      <p class="unlock-fact">"${facts.puzzle}"</p>
      <div id="hints-list" aria-live="polite"></div>
      <button id="btn-hint" class="btn-action" type="button">Give me a hint</button>
      <button id="btn-found" class="btn-action btn-primary" type="button">I found it!</button>
    </article>
    <footer class="muted">Phone down. Look up.</footer>`;

  $('btn-back').onclick = () => renderTonight();

  const hintBtn = $('btn-hint');
  const hintsList = $('hints-list');

  hintBtn.onclick = () => {
    if (revealedHintsCount < totalHints) {
      revealedHintsCount += 1;
      const hintText = templateHint(facts, revealedHintsCount);
      const hintElement = document.createElement('p');
      hintElement.className = 'hint-box';
      hintElement.textContent = `Hint ${revealedHintsCount}: ${hintText}`;
      hintsList.appendChild(hintElement);

      if (revealedHintsCount >= totalHints) {
        hintBtn.disabled = true;
        hintBtn.textContent = 'No more hints';
      }
    }
  };

  if (totalHints === 0) {
    hintBtn.disabled = true;
    hintBtn.textContent = 'No hints available';
  }

  $('btn-found').onclick = () => {
    markFound(plan.target.id, appData.targets);
    renderFound(plan);
  };
}

// S5: Found Screen
function renderFound(plan) {
  clearActiveCountdown();
  const name = plan.body ? `${plan.target.title}: ${plan.body}` : plan.target.title;
  const app = $('app');
  let remainingSeconds = 30;

  app.innerHTML = `
    <article class="card found-screen">
      <h2>✓ You found ${name}</h2>
      <p class="unlock-fact">"${plan.target.unlock_fact}"</p>
      <p class="muted">Put the phone away for 30 seconds and just look.</p>
      <div id="timer-display" class="timer-number" aria-live="polite">${remainingSeconds}s</div>
      <button id="btn-return" class="btn-action btn-primary" type="button">Return to Tonight</button>
    </article>
    <footer class="muted">Look up now.</footer>`;

  $('btn-return').onclick = () => {
    clearActiveCountdown();
    renderTonight();
  };

  activeCountdown = setInterval(() => {
    remainingSeconds -= 1;
    const timerDisplay = $('timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = `${remainingSeconds}s`;
    }
    if (remainingSeconds <= 0) {
      clearActiveCountdown();
      renderTonight();
    }
  }, 1000);
}

// Initialize application
async function start() {
  const [data, loc] = await Promise.all([loadData(), getLocation()]);
  appData = data;
  currentLoc = loc;

  if (!loc) {
    return askLocation();
  }

  currentPlans = planTonight(data, makeObserver(loc.lat, loc.lon));
  renderTonight();
}

start();
