// src/ai/model.js
// Loads and runs the local Qwen2.5-0.5B model in WebAssembly via @wllama/wllama.
// Models are cached offline in browser OPFS (Origin Private File System).

import { Wllama } from '@wllama/wllama';
import wasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url';
import { buildMessages } from './guide.js';

export const MODEL_URL =
  'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf';

let wllama = null;
let loadPromise = null;
let isAsking = false;

export function getWllama() {
  if (!wllama) {
    wllama = new Wllama({ default: wasmUrl });
  }
  return wllama;
}

/**
 * Checks if the model has already been downloaded into OPFS.
 */
export async function isDownloaded() {
  try {
    const w = getWllama();
    const models = await w.modelManager.getModels();
    return models.some((m) => m.url === MODEL_URL);
  } catch (err) {
    console.warn('Could not check downloaded models:', err);
    return false;
  }
}

/**
 * Downloads the model from Hugging Face with progress tracking and caches it in OPFS.
 */
export async function download(onProgress) {
  const w = getWllama();
  if (w.isModelLoaded()) {
    return;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      await w.loadModelFromUrl(MODEL_URL, {
        progressCallback: ({ loaded, total }) => {
          if (typeof onProgress === 'function') {
            const percent = total > 0 ? (loaded / total) * 100 : 0;
            onProgress({ loaded, total, percent });
          }
        },
        n_ctx: 1024,
      });
    } catch (err) {
      loadPromise = null;
      throw err;
    }
  })();

  await loadPromise;

  // Request persistent storage so the browser does not evict cached model files
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      await navigator.storage.persist();
    } catch (e) {
      console.warn('navigator.storage.persist() call failed:', e);
    }
  }
}

let firstLoadSeconds = null;
let loadRecorded = false;

/**
 * Loads the model lazily from OPFS cache into WebAssembly context.
 * Singleton promise pattern: never calls loadModelFromUrl twice on the same instance.
 * Resets loadPromise to null on error so the user can retry.
 * Times out after 120s if the device runs out of memory or hangs.
 */
export async function load() {
  const w = getWllama();
  if (w.isModelLoaded()) {
    return;
  }
  if (loadPromise) {
    return loadPromise;
  }

  let timerId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error('Loading is taking too long — this device may not have enough memory'));
    }, 120_000);
  });

  const loadTask = (async () => {
    console.time('wllama-load');
    const start = performance.now();
    try {
      await w.loadModelFromUrl(MODEL_URL, { n_ctx: 1024 });
      console.timeEnd('wllama-load');
      if (!loadRecorded) {
        firstLoadSeconds = Number(((performance.now() - start) / 1000).toFixed(1));
        loadRecorded = true;
      }
    } catch (err) {
      console.timeEnd('wllama-load');
      throw err;
    } finally {
      if (timerId) clearTimeout(timerId);
    }
  })();

  loadPromise = Promise.race([loadTask, timeoutPromise]).catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

export {
  checkAnswer,
  quickAnswer,
  buildFactsFor,
  trimToTwoSentences,
  factsToBullets,
} from './guide.js';

let askQueue = Promise.resolve();
let isRunningInference = false;

export function isInferenceRunning() {
  return isRunningInference;
}

/**
 * Sends a question and sky facts to the local model.
 * Queues calls sequentially so wllama never runs concurrent WASM calls.
 * Reports status transitions ('loading', 'thinking') via onStatusChange.
 * Streams generated tokens via onToken callback.
 * Accepts abortSignal for cancellation.
 * Returns { answer, seconds, loadSeconds, promptTokens }.
 */
export async function ask(facts, question, onStatusChange, abortSignal, onToken) {
  const run = async () => {
    isRunningInference = true;
    try {
      const w = getWllama();
      let justLoadedSeconds = null;

      if (!w.isModelLoaded()) {
        if (typeof onStatusChange === 'function') {
          onStatusChange('loading');
        }
        await load();
        justLoadedSeconds = firstLoadSeconds;
        firstLoadSeconds = null; // Report first time only
      } else if (firstLoadSeconds != null) {
        justLoadedSeconds = firstLoadSeconds;
        firstLoadSeconds = null; // Report first time only
      }

      console.log('crossOriginIsolated:', typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false);
      try {
        console.log('wllama isMultithread:', w.isMultithread(), 'threads:', w.getNumThreads());
      } catch (e) {
        console.warn('Could not read wllama thread info:', e);
      }

      if (typeof onStatusChange === 'function') {
        onStatusChange('thinking');
      }

      const messages = buildMessages(facts, question);

      let promptTokens = null;
      if (typeof w.tokenize === 'function') {
        try {
          const fullPromptText = messages.map((m) => m.content).join('\n');
          const tokens = await w.tokenize(fullPromptText);
          promptTokens = Array.isArray(tokens) ? tokens.length : (tokens?.length || 0);
        } catch (e) {
          console.warn('wllama.tokenize failed:', e);
        }
      }

      console.time('wllama-inference');
      const startTime = performance.now();
      let accumulatedText = '';

      await w.createChatCompletion({
        messages,
        max_tokens: 40,
        temperature: 0.1,
        stop: ['\n\n'],
        abortSignal,
        stream: true,
        onData: (chunk) => {
          const token = chunk.choices?.[0]?.delta?.content || '';
          accumulatedText += token;
          if (chunk.usage?.prompt_tokens) {
            promptTokens = chunk.usage.prompt_tokens;
          }
          if (typeof onToken === 'function') {
            onToken(accumulatedText);
          }
        },
      });

      console.timeEnd('wllama-inference');
      const elapsedSeconds = (performance.now() - startTime) / 1000;

      if (!promptTokens) {
        const promptText = messages.map((m) => m.content).join('\n');
        promptTokens = Math.max(1, Math.round(promptText.length / 4));
      }
      console.log('Prompt token count:', promptTokens);

      const cleanedContent = trimToTwoSentences(accumulatedText.trim());

      return {
        answer: cleanedContent,
        seconds: Number(elapsedSeconds.toFixed(1)),
        loadSeconds: justLoadedSeconds,
        promptTokens,
      };
    } finally {
      isRunningInference = false;
    }
  };

  const promise = askQueue.then(run, run);
  askQueue = promise.catch(() => {});
  return promise;
}
