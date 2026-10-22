const api = window.glance;
const $ = (id) => document.getElementById(id);

const els = {
  messages: $('messages'),
  input: $('input'),
  withScreen: $('withScreen'),
  sendBtn: $('sendBtn'),
  suggestBtn: $('suggestBtn'),
  listenBtn: $('listenBtn'),
  listenDot: $('listenDot'),
  transcript: $('transcript'),
  transcriptPanel: $('transcriptPanel'),
  transcriptStatus: $('transcriptStatus'),
  settingsPanel: $('settingsPanel'),
  banner: $('clickThroughBanner'),
};

const SETTING_FIELDS = [
  'apiKey',
  'baseUrl',
  'model',
  'transcribeModel',
  'transcribeBaseUrl',
  'transcribeApiKey',
  'captureSystemAudio',
  'autoSuggest',
  'customInstructions',
];
const SUGGEST_PROMPT = `Based on the latest part of the transcript, help me respond right now:
1. **Say next** – 2-3 short options I could say, in first person.
2. **Facts** – any key facts, numbers, or definitions relevant to what was just said.
3. **Ask** – 1-2 smart follow-up questions.
Keep the whole thing under 120 words.`;
const AUTO_SUGGEST_COOLDOWN_MS = 15000;
const PROVIDERS = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', transcribeModel: 'whisper-1' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'google/gemma-4-31b-it:free', transcribeModel: '' },
};
const STT_PROVIDERS = {
  same: { transcribeBaseUrl: '' },
  groq: { transcribeBaseUrl: 'https://api.groq.com/openai/v1', transcribeModel: 'whisper-large-v3-turbo' },
  openai: { transcribeBaseUrl: 'https://api.openai.com/v1', transcribeModel: 'whisper-1' },
};

let settings = {};
let history = [];
let transcriptText = '';
let current = null;
let listener = null;
let lastAutoSuggest = 0;

// ---------- messages ----------
function clearEmpty() {
  els.messages.querySelector('.empty')?.remove();
}

function addMessage(role, text, tag) {
  clearEmpty();
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (tag) {
    const t = document.createElement('span');
    t.className = 'tag';
    t.textContent = tag;
    div.appendChild(t);
  }
  const body = document.createElement('div');
  if (role === 'assistant') body.innerHTML = window.renderMarkdown(text);
  else body.textContent = text;
  div.appendChild(body);
  els.messages.appendChild(div);
  els.messages.scrollTop = els.messages.scrollHeight;
  return body;
}

function setBusy(busy) {
  els.sendBtn.textContent = busy ? 'Stop' : 'Ask';
  els.suggestBtn.disabled = busy;
}

async function ask({ question = '', withScreen = false, includeTranscript = true, label }) {
  if (current) return;
  const id = crypto.randomUUID();
  const shownQuestion = question || (withScreen ? 'What’s on my screen?' : '');
  const tags = [withScreen && 'screen', includeTranscript && transcriptText && 'transcript'].filter(Boolean);
  addMessage('user', label || shownQuestion, tags.length ? `with ${tags.join(' + ')}` : '');

  const body = addMessage('assistant', '');
  body.classList.add('cursor');
  current = { id, text: '', body };
  setBusy(true);

  try {
    const full = await api.ask({
      id,
      question,
      withScreen,
      transcript: includeTranscript ? transcriptText : '',
      history,
    });
    const answer = full ?? current.text;
    history.push({ role: 'user', content: shownQuestion || label }, { role: 'assistant', content: answer });
    if (full === null) body.innerHTML = window.renderMarkdown(`${answer}\n\n*(stopped)*`);
  } catch (err) {
    body.parentElement.className = 'msg error';
    body.textContent = cleanError(err);
  } finally {
    body.classList.remove('cursor');
    current = null;
    setBusy(false);
  }
}

function cleanError(err) {
  return String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

api.onChunk(({ id, delta }) => {
  if (!current || current.id !== id) return;
  current.text += delta;
  current.body.innerHTML = window.renderMarkdown(current.text);
  els.messages.scrollTop = els.messages.scrollHeight;
});

function send() {
  if (current) {
    api.cancel(current.id);
    return;
  }
  const question = els.input.value.trim();
  const withScreen = els.withScreen.checked;
  if (!question && !withScreen) return;
  els.input.value = '';
  ask({ question, withScreen });
}

function suggest() {
  if (!transcriptText.trim()) {
    addMessage('error', 'No transcript yet. Press the mic button (Ctrl/Cmd+Shift+L) to start listening.');
    return;
  }
  ask({ question: SUGGEST_PROMPT, label: 'Suggest what to say' });
}

// ---------- transcript ----------
function renderTranscript() {
  els.transcript.textContent = transcriptText || '';
  if (!transcriptText) els.transcript.innerHTML = '<span class="muted">Listening… speak to see text here.</span>';
  els.transcript.scrollTop = els.transcript.scrollHeight;
}

async function onSegment(audio, mime) {
  if (!settings.transcribeModel) {
    if (listener) toggleListening();
    addMessage('error', 'No speech-to-text configured. In Settings, pick a Speech-to-text provider (e.g. Groq, free) to use listening.');
    return;
  }
  try {
    const text = await api.transcribe(audio, mime);
    if (!text) return;
    transcriptText += (transcriptText ? ' ' : '') + text;
    renderTranscript();
    if (settings.autoSuggest && text.includes('?') && Date.now() - lastAutoSuggest > AUTO_SUGGEST_COOLDOWN_MS && !current) {
      lastAutoSuggest = Date.now();
      suggest();
    }
  } catch (err) {
    addMessage('error', cleanError(err));
  }
}

async function toggleListening() {
  if (listener) {
    listener.stop();
    listener = null;
    els.listenDot.classList.remove('on');
    els.listenBtn.classList.remove('active');
    els.transcriptStatus.textContent = '(off)';
    return;
  }
  listener = new window.Listener({ onSegment, onError: (err) => addMessage('error', err.message) });
  try {
    await listener.start({ systemAudio: settings.captureSystemAudio });
    els.listenDot.classList.add('on');
    els.listenBtn.classList.add('active');
    els.transcriptStatus.textContent = '(listening)';
    els.transcriptPanel.open = true;
    renderTranscript();
  } catch (err) {
    listener = null;
    addMessage('error', `Microphone error: ${err.message}`);
  }
}

// ---------- settings ----------
function detectProvider(baseUrl = '') {
  return Object.keys(PROVIDERS).find((k) => PROVIDERS[k].baseUrl === baseUrl) || 'custom';
}

function applyProvider() {
  const preset = PROVIDERS[$('provider').value];
  if (!preset) return;
  for (const [key, value] of Object.entries(preset)) {
    if (key === 'transcribeModel' && $('sttProvider').value !== 'same') continue;
    $(key).value = value;
  }
}

function detectSttProvider(url = '') {
  return Object.keys(STT_PROVIDERS).find((k) => STT_PROVIDERS[k].transcribeBaseUrl === url) || 'custom';
}

function applySttProvider() {
  const choice = $('sttProvider').value;
  const preset = STT_PROVIDERS[choice];
  if (preset) for (const [key, value] of Object.entries(preset)) $(key).value = value;
  if (choice === 'same') $('transcribeModel').value = PROVIDERS[$('provider').value]?.transcribeModel ?? $('transcribeModel').value;
  $('sttFields').classList.toggle('hidden', choice === 'same');
}

function openSettings() {
  $('provider').value = detectProvider(settings.baseUrl);
  $('sttProvider').value = detectSttProvider(settings.transcribeBaseUrl);
  $('sttFields').classList.toggle('hidden', $('sttProvider').value === 'same');
  for (const key of SETTING_FIELDS) {
    const el = $(key);
    if (el.type === 'checkbox') el.checked = !!settings[key];
    else el.value = settings[key] ?? '';
  }
  els.settingsPanel.classList.remove('hidden');
}

async function saveSettings() {
  const next = {};
  for (const key of SETTING_FIELDS) {
    const el = $(key);
    next[key] = el.type === 'checkbox' ? el.checked : el.value.trim();
  }
  settings = await api.saveSettings(next);
  els.settingsPanel.classList.add('hidden');
}

// ---------- wiring ----------
els.sendBtn.addEventListener('click', send);
els.suggestBtn.addEventListener('click', suggest);
els.listenBtn.addEventListener('click', toggleListening);
$('settingsBtn').addEventListener('click', openSettings);
$('settingsCancel').addEventListener('click', () => els.settingsPanel.classList.add('hidden'));
$('settingsSave').addEventListener('click', saveSettings);
$('provider').addEventListener('change', applyProvider);
$('sttProvider').addEventListener('change', applySttProvider);
$('baseUrl').addEventListener('input', (e) => ($('provider').value = detectProvider(e.target.value.trim())));
$('hideBtn').addEventListener('click', api.hide);
$('quitBtn').addEventListener('click', api.quit);
$('clearTranscriptBtn').addEventListener('click', () => {
  transcriptText = '';
  renderTranscript();
});

els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && current) api.cancel(current.id);
});

api.onShortcut((name) => {
  if (name === 'ask-screen') {
    const question = els.input.value.trim();
    els.input.value = '';
    ask({ question, withScreen: true });
  } else if (name === 'toggle-listen') toggleListening();
  else if (name === 'suggest') suggest();
});

api.onClickThrough((on) => els.banner.classList.toggle('hidden', !on));

(async () => {
  settings = await api.getSettings();
  if (!settings.apiKey && settings.baseUrl.includes('api.openai.com')) openSettings();
  els.input.focus();
})();
