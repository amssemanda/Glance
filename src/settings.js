const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  transcribeModel: 'whisper-1',
  captureSystemAudio: false,
  autoSuggest: false,
  customInstructions: '',
};

const file = () => path.join(app.getPath('userData'), 'settings.json');

function encrypt(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return { plain: value };
  return { enc: safeStorage.encryptString(value).toString('base64') };
}

function decrypt(stored) {
  if (!stored) return '';
  if (stored.enc) {
    try {
      return safeStorage.decryptString(Buffer.from(stored.enc, 'base64'));
    } catch {
      return '';
    }
  }
  return stored.plain || '';
}

function load() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch {}
  const { apiKey, ...rest } = raw;
  return {
    ...DEFAULTS,
    ...rest,
    apiKey: decrypt(apiKey) || process.env.OPENAI_API_KEY || '',
  };
}

function save(next) {
  const merged = { ...load(), ...next };
  const { apiKey, ...rest } = merged;
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify({ ...rest, apiKey: encrypt(apiKey) }, null, 2));
  return merged;
}

module.exports = { load, save, DEFAULTS };
