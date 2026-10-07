import './styles.css';
import { makeObserver, compassWord, heightWord } from './sky/engine.js';
import { loadData, planTonight, positionFn } from './sky/targets.js';
import { buildFacts, templateHint } from './ai/guide.js';
import { loadProgress, markFound, isFound, isLocked } from './game/progress.js';
import {
  start as startPointing,
  stop as stopPointing,
  onPointing,
  angularDistance,
} from './sensors/pointing.js';

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
let activePointingCleanup = null;

// Clean up any ongoing timer when leaving views
function clearActiveCountdown() {
  if (activeCountdown) {
    clearInterval(activeCountdown);
    activeCountdown = null;
  }
}

function clearActivePointing() {
  if (activePointingCleanup) {
    activePointingCleanup();
    activePointingCleanup = null;
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
  clearActivePointing();
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
  clearActivePointing();
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
      <button id="btn-point" class="btn-action" type="button">Point & check</button>
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

  $('btn-point').onclick = async () => {
    try {
      await startPointing();
    } catch (err) {
      console.warn('Sensors could not be started:', err);
    }
    renderPointAndCheck(plan);
  };

  $('btn-found').onclick = () => {
    markFound(plan.target.id, appData.targets);
    renderFound(plan);
  };
}

// S3: Point & Check Screen
function renderPointAndCheck(plan) {
  clearActiveCountdown();
  if (activePointingCleanup) {
    activePointingCleanup();
    activePointingCleanup = null;
  }

  const name = plan.body ? `${plan.target.title}: ${plan.body}` : plan.target.title;
  const app = $('app');

  let unsubscribePointing = null;
  let targetUpdateInterval = null;
  let sensorTimeout = null;
  let autoReturnTimeout = null;
  let hasVibrated = false;

  function cleanup() {
    stopPointing();
    if (unsubscribePointing) {
      unsubscribePointing();
      unsubscribePointing = null;
    }
    if (targetUpdateInterval) {
      clearInterval(targetUpdateInterval);
      targetUpdateInterval = null;
    }
    if (sensorTimeout) {
      clearTimeout(sensorTimeout);
      sensorTimeout = null;
    }
    if (autoReturnTimeout) {
      clearTimeout(autoReturnTimeout);
      autoReturnTimeout = null;
    }
  }
  activePointingCleanup = cleanup;

  const posFn = currentLoc
    ? positionFn(plan.target, appData, makeObserver(currentLoc.lat, currentLoc.lon), new Date())
    : null;
  let targetPos = posFn ? posFn(new Date()) : plan.now;

  targetUpdateInterval = setInterval(() => {
    if (posFn) {
      targetPos = posFn(new Date());
    }
  }, 3000);

  app.innerHTML = `
    <nav class="nav-bar">
      <button id="btn-back-pointing" class="btn-back" type="button" aria-label="Back to Quest">← Quest</button>
    </nav>
    <article class="card pointing-card">
      <h2>${name}</h2>
      <p class="muted">Hold the phone up toward the sky.</p>

      <div id="sensor-loading" class="muted" style="margin: 24px 0;">
        Looking for compass sensors…
      </div>

      <div id="pointing-display" style="display: none;">
        <div id="pointing-status" class="pointing-status">● COLDER</div>
        <div id="arrow-az" class="arrow-big">← Turn left</div>
        <div id="arrow-alt" class="arrow-small">↑ Tilt up</div>
        <div id="pointing-message" class="on-target-msg" style="display: none;"></div>
        <div id="sensor-warning" class="muted" style="display: none; font-size: 0.85rem; margin-top: 8px;"></div>
      </div>

      <p class="muted calibration-tip">Tip: Wave the phone in a figure 8 to calibrate the compass.</p>

      <button id="btn-done-pointing" class="btn-action btn-primary" type="button" style="margin-top: 20px;">
        Done — I'll look myself
      </button>
    </article>
    <footer class="muted">Phone down. Look up.</footer>`;

  $('btn-back-pointing').onclick = () => {
    cleanup();
    activePointingCleanup = null;
    renderQuest(plan);
  };

  $('btn-done-pointing').onclick = () => {
    cleanup();
    activePointingCleanup = null;
    renderQuest(plan);
  };

  sensorTimeout = setTimeout(() => {
    const loadingEl = $('sensor-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `
        <p>No compass detected on this device.</p>
        <p class="muted">Laptops do not have orientation sensors. You can still find it by eye!</p>
      `;
    }
  }, 3000);

  unsubscribePointing = onPointing((reading) => {
    if (sensorTimeout) {
      clearTimeout(sensorTimeout);
      sensorTimeout = null;
    }

    const loadingEl = $('sensor-loading');
    const displayEl = $('pointing-display');
    if (loadingEl) loadingEl.style.display = 'none';
    if (displayEl) displayEl.style.display = 'block';

    if (!targetPos) return;

    const currentAlt = reading.alt;
    const currentAz = reading.az;
    const d = angularDistance(currentAlt, currentAz, targetPos.alt, targetPos.az);

    let diffAz = (targetPos.az - currentAz) % 360;
    if (diffAz > 180) diffAz -= 360;
    if (diffAz < -180) diffAz += 360;

    const diffAlt = targetPos.alt - currentAlt;

    const statusEl = $('pointing-status');
    const arrowAzEl = $('arrow-az');
    const arrowAltEl = $('arrow-alt');
    const messageEl = $('pointing-message');
    const warningEl = $('sensor-warning');

    if (!statusEl || !arrowAzEl || !arrowAltEl) return;

    if (warningEl) {
      if (reading.inaccurate) {
        warningEl.style.display = 'block';
        warningEl.textContent = 'Compass may be inaccurate.';
      } else {
        warningEl.style.display = 'none';
      }
    }

    if (Math.abs(diffAz) <= 5) {
      arrowAzEl.textContent = '● Ahead';
    } else if (diffAz > 0) {
      arrowAzEl.textContent = '→ Turn right';
    } else {
      arrowAzEl.textContent = '← Turn left';
    }

    if (Math.abs(diffAlt) <= 5) {
      arrowAltEl.textContent = '● Level';
    } else if (diffAlt > 0) {
      arrowAltEl.textContent = '↑ Tilt up';
    } else {
      arrowAltEl.textContent = '↓ Tilt down';
    }

    if (d < 10) {
      statusEl.className = 'pointing-status on-target';
      statusEl.textContent = '★ ON TARGET';

      if (messageEl) {
        messageEl.style.display = 'block';
        messageEl.textContent = 'Now lower the phone and find it with your eyes.';
      }

      if (!hasVibrated) {
        hasVibrated = true;
        try {
          if ('vibrate' in navigator) navigator.vibrate(200);
        } catch {}
      }

      if (!autoReturnTimeout) {
        autoReturnTimeout = setTimeout(() => {
          cleanup();
          activePointingCleanup = null;
          renderQuest(plan);
        }, 5000);
      }
    } else {
      statusEl.className = 'pointing-status';
      if (d < 30) {
        statusEl.textContent = '● WARMER';
      } else {
        statusEl.textContent = '● COLDER';
      }

      if (messageEl) {
        messageEl.style.display = 'none';
      }

      if (autoReturnTimeout) {
        clearTimeout(autoReturnTimeout);
        autoReturnTimeout = null;
      }
    }
  });
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
