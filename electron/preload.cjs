/**
 * Preload — exposes a narrow, typed API surface to the renderer via contextBridge.
 * Kept as CommonJS because Electron's sandbox-preload path resolves .cjs most reliably.
 */
const { contextBridge, ipcRenderer } = require('electron');

/** Subscribe helper — returns an unsubscribe function. */
function on(channel, handler) {
  const listener = (_evt, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('claudeSight', {
  // project root
  getProjectRoot: () => ipcRenderer.invoke('project:get'),
  chooseProjectRoot: () => ipcRenderer.invoke('project:choose'),
  setProjectRoot: (root) => ipcRenderer.invoke('project:set', { root }),

  // recent projects (persistent)
  recents: {
    list: () => ipcRenderer.invoke('recents:list'),
    remove: (path) => ipcRenderer.invoke('recents:remove', { path }),
    clear: () => ipcRenderer.invoke('recents:clear')
  },

  // filesystem
  readTree: (dir) => ipcRenderer.invoke('fs:tree', dir),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),

  // claude chat
  sendPrompt: (opts) => ipcRenderer.invoke('claude:send', opts),
  execCommand: ({ messageId, command }) =>
    ipcRenderer.invoke('claude:exec', { messageId, command }),
  stopPrompt: (messageId) => ipcRenderer.invoke('claude:stop', { messageId }),
  onStream: (handler) => on('claude:stream', handler),
  detectClaude: () => ipcRenderer.invoke('claude:detect'),

  // skills / mcp
  discoverSkills: () => ipcRenderer.invoke('skills:discover'),
  listSkills: () => ipcRenderer.invoke('skills:list'),
  mcpLogs: (name) => ipcRenderer.invoke('mcp:logs', { name }),

  // settings.json (permissions, hooks, env)
  settings: {
    get: (scope) => ipcRenderer.invoke('settings:get', { scope }),
    set: (scope, settings) => ipcRenderer.invoke('settings:set', { scope, settings })
  },

  // CLAUDE.md
  claudeMd: {
    get: (scope) => ipcRenderer.invoke('claudeMd:get', { scope }),
    set: (scope, content) => ipcRenderer.invoke('claudeMd:set', { scope, content })
  },

  // sessions browser
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    read: (file) => ipcRenderer.invoke('sessions:read', { file })
  },

  // git
  git: {
    status: () => ipcRenderer.invoke('git:status'),
    exec: (args) => ipcRenderer.invoke('git:exec', { args })
  },

  // images (clipboard / drop)
  image: {
    fromClipboard: () => ipcRenderer.invoke('image:fromClipboard'),
    saveDropped: (name, dataBase64) => ipcRenderer.invoke('image:saveDropped', { name, dataBase64 })
  },

  // export & misc
  exportSave: (defaultName, content) => ipcRenderer.invoke('export:save', { defaultName, content }),
  writeFileIfInside: (filePath, content) => ipcRenderer.invoke('file:writeIfInside', { filePath, content }),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),

  // window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onMaximized: (handler) => on('window:maximized', handler),
  onUnmaximized: (handler) => on('window:unmaximized', handler),
  onMcpRefresh: (handler) => on('mcp:refresh', handler),

  // config
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: ({ key, value }) => ipcRenderer.invoke('config:set', { key, value }),

  // raw pty (optional)
  pty: {
    start: (opts) => ipcRenderer.invoke('pty:start', opts),
    stop: () => ipcRenderer.invoke('pty:stop'),
    write: (data) => ipcRenderer.send('pty:input', data),
    resize: (cols, rows) => ipcRenderer.send('pty:resize', { cols, rows }),
    onData: (handler) => on('pty:data', handler),
    onExit: (handler) => on('pty:exit', handler)
  }
});
