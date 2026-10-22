const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => {
  const listener = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('glance', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  ask: (req) => ipcRenderer.invoke('ask', req),
  cancel: (id) => ipcRenderer.send('ask:cancel', id),
  transcribe: (audio, mime) => ipcRenderer.invoke('transcribe', audio, mime),
  hide: () => ipcRenderer.send('window:hide'),
  quit: () => ipcRenderer.send('window:quit'),
  onChunk: on('ask:chunk'),
  onShortcut: on('shortcut'),
  onClickThrough: on('clickthrough'),
  platform: process.platform,
});
