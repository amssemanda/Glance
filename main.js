const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  screen,
  session,
} = require('electron');
const path = require('path');
const settings = require('./src/settings');
const { streamChat, transcribe } = require('./src/llm');
const { buildMessages } = require('./src/prompts');

let win;
let clickThrough = false;
const inflight = new Map();

function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: 440,
    height: 640,
    minWidth: 320,
    minHeight: 240,
    x: width - 460,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer/index.html'));
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else win.show();
}

function setClickThrough(enabled) {
  clickThrough = enabled;
  win.setIgnoreMouseEvents(enabled, { forward: true });
  win.webContents.send('clickthrough', enabled);
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function captureScreen() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { width, height } = display.size;
  const scale = display.scaleFactor || 1;

  const wasVisible = win.isVisible();
  if (wasVisible) {
    win.hide();
    await delay(150);
  }
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
    });
    const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
    if (!source) throw new Error('No screen available to capture (check screen recording permission).');
    let image = source.thumbnail;
    if (image.getSize().width > 1600) image = image.resize({ width: 1600, quality: 'good' });
    return image.toJPEG(80).toString('base64');
  } finally {
    if (wasVisible) win.showInactive();
  }
}

function requireKey(s) {
  if (!s.apiKey && s.baseUrl.includes('api.openai.com')) {
    throw new Error('Add your API key in Settings (gear icon) first.');
  }
}

ipcMain.handle('settings:get', () => settings.load());
ipcMain.handle('settings:save', (_e, next) => settings.save(next));

ipcMain.handle('ask', async (event, { id, question, withScreen, transcript, history }) => {
  const s = settings.load();
  requireKey(s);
  const controller = new AbortController();
  inflight.set(id, controller);
  try {
    const screenshot = withScreen ? await captureScreen() : null;
    const messages = buildMessages({
      question,
      screenshot,
      transcript,
      history,
      customInstructions: s.customInstructions,
    });
    let full = '';
    for await (const delta of streamChat({ ...s, messages, signal: controller.signal })) {
      full += delta;
      event.sender.send('ask:chunk', { id, delta });
    }
    return full;
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  } finally {
    inflight.delete(id);
  }
});

ipcMain.on('ask:cancel', (_e, id) => inflight.get(id)?.abort());

ipcMain.handle('transcribe', async (_e, audio, mime) => {
  const s = settings.load();
  requireKey(s);
  return transcribe({ ...s, model: s.transcribeModel, audio: Buffer.from(audio), mime });
});

ipcMain.on('window:hide', () => win?.hide());
ipcMain.on('window:quit', () => app.quit());

function registerShortcuts() {
  const shortcuts = {
    'CommandOrControl+Shift+Space': toggleWindow,
    'CommandOrControl+Shift+Enter': () => {
      win.show();
      win.webContents.send('shortcut', 'ask-screen');
    },
    'CommandOrControl+Shift+L': () => win.webContents.send('shortcut', 'toggle-listen'),
    'CommandOrControl+Shift+K': () => {
      win.show();
      win.webContents.send('shortcut', 'suggest');
    },
    'CommandOrControl+Shift+X': () => setClickThrough(!clickThrough),
  };
  for (const [accelerator, fn] of Object.entries(shortcuts)) {
    if (!globalShortcut.register(accelerator, fn)) {
      console.warn(`Could not register shortcut ${accelerator}`);
    }
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(['media', 'display-capture'].includes(permission));
  });

  // System audio (the other side of a call) via loopback; supported on Windows.
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, callback) => {
    const [source] = await desktopCapturer.getSources({ types: ['screen'] });
    callback(process.platform === 'win32' ? { video: source, audio: 'loopback' } : { video: source });
  });

  createWindow();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
