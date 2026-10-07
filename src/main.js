import './styles.css';
import { makeObserver, compassWord, heightWord } from './sky/engine.js';
import { loadData, planTonight, positionFn } from './sky/targets.js';
import { buildFacts, buildFactsFor, templateHint, quickAnswer, checkAnswer } from './ai/guide.js';
import { loadProgress, markFound, isFound, isLocked } from './game/progress.js';
import {
  start as startPointing,
  stop as stopPointing,
  onPointing,
  angularDistance,
} from './sensors/pointing.js';
import {
  isDownloaded,
  download as downloadModel,
  load as loadModel,
  ask as askModel,
  isInferenceRunning,
} from './ai/model.js';

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
      <button id="btn-ask" class="btn-action" type="button">Ask the guide</button>
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

  $('btn-ask').onclick = () => {
    renderAskGuide(plan);
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
  let isOnTarget = false;
  let isFrozen = false;

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
        <div id="pointing-distance" class="muted" style="font-size: 0.95rem; margin: 4px 0 10px;"></div>
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
    if (isFrozen) return;

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

    const statusEl = $('pointing-status');
    const distEl = $('pointing-distance');
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

    // Hysteresis: enter below 10°, only leave above 15°
    if (!isOnTarget && d < 10) {
      isOnTarget = true;
    } else if (isOnTarget && d > 15) {
      isOnTarget = false;
    }

    // 1. When on target: freeze screen, hide arrows & distance, show message & vibrate once
    if (isOnTarget) {
      isFrozen = true;

      statusEl.className = 'pointing-status on-target';
      statusEl.textContent = '★ ON TARGET';

      arrowAzEl.style.display = 'none';
      arrowAltEl.style.display = 'none';
      if (distEl) distEl.style.display = 'none';

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
      return;
    }

    // When NOT on target:
    if (messageEl) {
      messageEl.style.display = 'none';
    }

    // Show distance text (shrinking as user gets closer)
    if (distEl) {
      distEl.style.display = 'block';
      distEl.textContent = `${Math.round(d)}° away`;
    }

    statusEl.className = 'pointing-status';
    if (d < 30) {
      statusEl.textContent = '● WARMER';
    } else {
      statusEl.textContent = '● COLDER';
    }

    // Azimuth arrow: hide when difference is under 5°
    let diffAz = (targetPos.az - currentAz) % 360;
    if (diffAz > 180) diffAz -= 360;
    if (diffAz < -180) diffAz += 360;

    if (Math.abs(diffAz) <= 5) {
      arrowAzEl.style.display = 'none';
    } else {
      arrowAzEl.style.display = 'block';
      if (diffAz > 0) {
        arrowAzEl.textContent = '→ Turn right';
      } else {
        arrowAzEl.textContent = '← Turn left';
      }
    }

    // Altitude arrow: "Height is right" when difference is under 5°
    const diffAlt = targetPos.alt - currentAlt;
    arrowAltEl.style.display = 'block';
    if (Math.abs(diffAlt) <= 5) {
      arrowAltEl.textContent = 'Height is right';
    } else if (diffAlt > 0) {
      arrowAltEl.textContent = '↑ Tilt up';
    } else {
      arrowAltEl.textContent = '↓ Tilt down';
    }
  });
}

// S4: Ask the Guide Screen
async function renderAskGuide(plan) {
  clearActiveCountdown();
  clearActivePointing();

  const facts = buildFacts(plan, appData);
  const name = plan.body ? `${plan.target.title}: ${plan.body}` : plan.target.title;
  const app = $('app');

  let downloaded = await isDownloaded();
  if (downloaded) {
    loadModel().catch((e) => console.warn('Background model load failed:', e));
  }

  const defaultAnswer = templateHint(facts, 0);

  app.innerHTML = `
    <nav class="nav-bar">
      <button id="btn-back-ask" class="btn-back" type="button" aria-label="Back to Quest">← Quest</button>
    </nav>
    <article class="card">
      <h2>Ask about ${name}</h2>

      <div class="chips-container" role="group" aria-label="Quick questions">
        <button class="chip" type="button" data-q="What am I looking at?">What am I looking at?</button>
        <button class="chip" type="button" data-q="How far away is it?">How far away is it?</button>
        <button class="chip" type="button" data-q="How do I find it?">How do I find it?</button>
      </div>

      <form id="ask-form" class="ask-form">
        <input id="ask-input" type="text" placeholder="type a question…" autocomplete="off" />
        <button id="btn-ask-submit" type="submit" class="btn-primary">Ask</button>
      </form>

      <div id="guide-response" class="guide-box" aria-live="polite">
        <p class="guide-answer">Guide: "${defaultAnswer}"</p>
        <p class="guide-meta">${downloaded ? '' : 'Template answer (download guide for custom answers)'}</p>
      </div>

      <div id="download-section">
        ${
          !downloaded
            ? `
          <button id="btn-download-guide" class="btn-action" type="button">
            Download guide for offline use (~490 MB, use Wi-Fi)
          </button>
          <div id="dl-progress-wrapper" style="display: none; margin: 12px 0;">
            <progress id="dl-progress-bar" value="0" max="100"></progress>
            <div id="dl-progress-text" class="guide-meta" style="margin-top: 6px;">Downloading: 0%</div>
          </div>
        `
            : ''
        }
      </div>
    </article>
    <footer class="muted">Answers use only the app's sky data.</footer>`;

  let currentRequestId = 0;
  let aiTimerInterval = null;
  let activeAbortController = null;

  function stopAiTimer() {
    if (aiTimerInterval) {
      clearInterval(aiTimerInterval);
      aiTimerInterval = null;
    }
  }

  $('btn-back-ask').onclick = () => {
    stopAiTimer();
    currentRequestId++;
    if (activeAbortController) {
      try { activeAbortController.abort(); } catch {}
      activeAbortController = null;
    }
    renderQuest(plan);
  };

  const downloadBtn = $('btn-download-guide');
  if (downloadBtn) {
    downloadBtn.onclick = async () => {
      downloadBtn.disabled = true;
      const wrapper = $('dl-progress-wrapper');
      const progressBar = $('dl-progress-bar');
      const progressText = $('dl-progress-text');
      if (wrapper) wrapper.style.display = 'block';

      try {
        await downloadModel(({ loaded, total, percent }) => {
          if (progressBar) progressBar.value = percent;
          const loadedMB = (loaded / (1024 * 1024)).toFixed(0);
          const totalMB = total > 0 ? (total / (1024 * 1024)).toFixed(0) : '490';
          if (progressText) {
            progressText.textContent = `Downloading: ${Math.round(percent)}% (${loadedMB} MB / ${totalMB} MB)`;
          }
        });
        downloaded = true;
        if (wrapper) {
          wrapper.innerHTML = '<p class="guide-meta" style="color: var(--text);">Guide downloaded and ready for offline use!</p>';
        }
        downloadBtn.style.display = 'none';
      } catch (err) {
        console.error('Download failed:', err);
        if (wrapper) {
          wrapper.innerHTML = `<p class="guide-meta">Download failed: ${err.message || 'network error'}. Try again on Wi-Fi.</p>`;
        }
        downloadBtn.disabled = false;
      }
    };
  }

  function setBusy(busy) {
    app.querySelectorAll('.chip').forEach((chip) => {
      chip.disabled = busy;
      chip.classList.toggle('is-busy', busy);
    });
    const input = $('ask-input');
    if (input) input.disabled = busy;
    const submitBtn = $('btn-ask-submit');
    if (submitBtn) {
      submitBtn.disabled = busy;
      submitBtn.classList.toggle('is-busy', busy);
    }
  }

  async function handleQuestion(q) {
    const question = q.trim();
    if (!question) return;

    const responseEl = $('guide-response');
    if (!responseEl) return;

    // Build question-specific facts without raw magnitude numbers or hints array
    const qFacts = buildFactsFor(plan, appData, question);

    // 1. Immediately display the quick answer
    const immediateAnswer = quickAnswer(qFacts, question);
    responseEl.innerHTML = `
      <p class="guide-meta" style="color: var(--muted); font-weight: 600; margin-bottom: 4px;">Quick answer</p>
      <p id="guide-display-text" class="guide-answer">Guide: "${immediateAnswer}"</p>
      <div id="ai-status-container"></div>
    `;

    if (!downloaded) {
      const statusContainer = $('ai-status-container');
      if (statusContainer) {
        statusContainer.innerHTML = `<p class="guide-meta" style="margin-top: 8px;">Template answer. Download guide for custom AI answers.</p>`;
      }
      return;
    }

    // Check if inference is still running from previous question
    const wasFinishingOld = isInferenceRunning();

    // Abort previous background inference if running
    if (activeAbortController) {
      try { activeAbortController.abort(); } catch {}
    }
    activeAbortController = new AbortController();
    const abortSignal = activeAbortController.signal;

    // 2. Start model in background; show status line with counting timer & "Skip AI" button
    stopAiTimer();
    const reqId = ++currentRequestId;
    setBusy(true);

    let elapsedSeconds = 0;
    const statusContainer = $('ai-status-container');
    const statusMessage = wasFinishingOld
      ? 'Guide is still finishing the previous question…'
      : 'Guide is thinking… (can take a minute on slow devices)';

    if (statusContainer) {
      statusContainer.innerHTML = `
        <div class="ai-status-row">
          <span class="ai-status-text">${statusMessage} · <span id="ai-timer">0</span>s</span>
          <button id="btn-skip-ai" class="btn-skip" type="button">Skip AI</button>
        </div>
      `;
    }

    aiTimerInterval = setInterval(() => {
      elapsedSeconds++;
      const timerSpan = $('ai-timer');
      if (timerSpan) {
        timerSpan.textContent = elapsedSeconds;
      }
    }, 1000);

    const skipBtn = $('btn-skip-ai');
    if (skipBtn) {
      skipBtn.onclick = () => {
        stopAiTimer();
        currentRequestId++; // Cancel wait and ignore any late result
        if (activeAbortController) {
          try { activeAbortController.abort(); } catch {}
          activeAbortController = null;
        }
        const sc = $('ai-status-container');
        if (sc) sc.innerHTML = '';
        setBusy(false);
      };
    }

    const onToken = (streamedText) => {
      if (reqId !== currentRequestId) return;
      const answerTextEl = $('guide-display-text');
      if (answerTextEl) {
        if (streamedText.includes('NOT_IN_FACTS')) {
          answerTextEl.textContent = `Guide: "That's not in my sky data. I can tell you where it is, how far away it is, or how to find it."`;
        } else {
          answerTextEl.textContent = `Guide: "${streamedText}"`;
        }
      }
    };

    try {
      const { answer, seconds, loadSeconds, promptTokens } = await askModel(
        qFacts,
        question,
        null,
        abortSignal,
        onToken
      );

      // If user skipped or asked another question while running, ignore late result
      if (reqId !== currentRequestId) {
        return;
      }

      stopAiTimer();
      const sc = $('ai-status-container');
      if (sc) sc.innerHTML = '';
      setBusy(false);

      const NOT_IN_FACTS_MESSAGE =
        "That's not in my sky data. I can tell you where it is, how far away it is, or how to find it.";
      const finalAnswer = answer.includes('NOT_IN_FACTS') ? NOT_IN_FACTS_MESSAGE : answer;

      // 4. If AI answer arrives and passes checkAnswer(), replace the quick answer
      if (checkAnswer(answer, qFacts)) {
        const timingLine = loadSeconds
          ? `Model load: ${loadSeconds} s · Prompt: ${promptTokens} tokens · Answer: ${seconds} s`
          : `Prompt: ${promptTokens} tokens · Answer: ${seconds} s`;

        responseEl.innerHTML = `
          <p class="guide-meta" style="color: var(--muted); font-weight: 600; margin-bottom: 4px;">Guide answer (checked against sky data)</p>
          <p class="guide-answer">Guide: "${finalAnswer}"</p>
          <p class="guide-meta">${timingLine}</p>
        `;
      } else {
        responseEl.innerHTML = `
          <p class="guide-meta" style="color: var(--muted); font-weight: 600; margin-bottom: 4px;">Quick answer</p>
          <p class="guide-answer">Guide: "${immediateAnswer}"</p>
          <p class="guide-meta">AI answer did not match sky data. Kept quick answer.</p>
        `;
      }
    } catch (err) {
      if (reqId !== currentRequestId) {
        return;
      }
      stopAiTimer();
      const sc = $('ai-status-container');
      if (sc) sc.innerHTML = '';
      setBusy(false);
      console.warn('AI guide error, keeping quick answer:', err);
      responseEl.innerHTML = `
        <p class="guide-meta" style="color: var(--muted); font-weight: 600; margin-bottom: 4px;">Quick answer</p>
        <p class="guide-answer">Guide: "${immediateAnswer}"</p>
        <p class="guide-meta">Guide unavailable: ${err.message || 'error'}. Kept quick answer.</p>
      `;
    }
  }

  app.querySelectorAll('.chip').forEach((chip) => {
    chip.onclick = () => {
      const q = chip.getAttribute('data-q');
      handleQuestion(q);
    };
  });

  const form = $('ask-form');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const input = $('ask-input');
      if (input && input.value) {
        handleQuestion(input.value);
        input.value = '';
      }
    };
  }
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
