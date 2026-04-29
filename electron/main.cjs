/**
 * Claude Sight — Electron main process
 * ------------------------------------
 * Bridges the React renderer to the Claude Code CLI via two modes:
 *   1. Chat mode: `claude -p "<prompt>" --output-format stream-json --verbose`
 *      Each message spawns a fresh child; JSON events stream back as chat bubbles.
 *   2. PTY mode:  spawn `claude` interactively via node-pty for xterm.js
 *
 * Also exposes filesystem helpers (directory tree + file read) scoped to a
 * user-chosen project root, and a `claude mcp list` helper for the Skills panel.
 */

const spawn = require('cross-spawn');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Notification, Menu } = require('electron');

// node-pty is a native CJS module.
let pty = null;
try {
  pty = require('node-pty');
} catch (err) {
  console.warn('[claude-sight] node-pty failed to load — PTY terminal will be unavailable until you run `npm run rebuild`.');
  console.warn(err?.message);
}

const isDev = process.env.NODE_ENV === 'development';
const CLAUDE_BIN = process.env.CLAUDE_BIN || (process.platform === 'win32' ? 'claude.cmd' : 'claude');

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** Per-message streaming children keyed by messageId. */
const chatChildren = new Map();

/** Single persistent PTY (optional raw-terminal mode). */
let ptyProc = null;

/** Currently-selected project root (used by file tree + CLI cwd).
 *  Empty until the user picks a folder. The renderer must show a
 *  folder-picker / recents view while this is empty. */
let projectRoot = '';

/** Recent project paths file (newest first, capped at MAX_RECENTS). */
const MAX_RECENTS = 5;
function recentsFile() {
  return path.join(app.getPath('userData'), 'recent-projects.json');
}

async function readRecents() {
  try {
    const raw = await fs.readFile(recentsFile(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => typeof p === 'string').slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

async function writeRecents(list) {
  try {
    await fs.writeFile(recentsFile(), JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.warn('[claude-sight] failed to write recents:', err.message);
  }
}

async function pushRecent(p) {
  if (!p) return [];
  const current = await readRecents();
  const filtered = current.filter((x) => x !== p);
  const next = [p, ...filtered].slice(0, MAX_RECENTS);
  await writeRecents(next);
  return next;
}

async function removeRecent(p) {
  const current = await readRecents();
  const next = current.filter((x) => x !== p);
  await writeRecents(next);
  return next;
}

/* ------------------------------------------------------------------ */
/* Window                                                             */
/* ------------------------------------------------------------------ */

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#05070d',
    autoHideMenuBar: true,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('maximize', () => send('window:maximized', {}));
  mainWindow.on('unmaximize', () => send('window:unmaximized', {}));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killAllChatChildren();
  disposePty();
  if (process.platform !== 'darwin') app.quit();
});

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function isInsideProjectRoot(targetPath) {
  const resolvedRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(targetPath);
  // Ensure both end with a separator so C:\Project does not match C:\ProjectBackup
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  const targetWithSep = resolvedTarget.endsWith(path.sep) ? resolvedTarget : resolvedTarget + path.sep;
  return targetWithSep.startsWith(rootWithSep) || resolvedTarget === resolvedRoot;
}

function killAllChatChildren() {
  for (const [, child] of chatChildren) {
    try { child.kill('SIGINT'); } catch {}
  }
  chatChildren.clear();
}

function disposePty() {
  if (ptyProc) {
    try { ptyProc.kill(); } catch {}
    ptyProc = null;
  }
}

/**
 * Very small newline-delimited JSON splitter.
 * `claude -p --output-format stream-json` emits one JSON object per line.
 */
function createNdjsonParser(onEvent) {
  let buffer = '';
  return (chunk) => {
    buffer += chunk.toString('utf8');
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        onEvent(JSON.parse(line));
      } catch {
        // Surface non-JSON lines (e.g. startup banners) as raw text too.
        onEvent({ type: 'raw', text: line });
      }
    }
  };
}

/* ------------------------------------------------------------------ */
/* IPC — project root                                                 */
/* ------------------------------------------------------------------ */

ipcMain.handle('window:minimize', () => { if (mainWindow) mainWindow.minimize(); return { ok: true }; });
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return { ok: false };
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return { ok: true, maximized: mainWindow.isMaximized() };
});
ipcMain.handle('window:close', () => { if (mainWindow) mainWindow.close(); return { ok: true }; });

async function readClaudeConfig() {
  const configPath = path.join(projectRoot, '.claude.json');
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeClaudeConfig(config) {
  const configPath = path.join(projectRoot, '.claude.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

ipcMain.handle('config:get', async () => {
  const config = await readClaudeConfig();
  return { config };
});

ipcMain.handle('config:set', async (_evt, { key, value }) => {
  const config = await readClaudeConfig();
  if (value === undefined) delete config[key];
  else config[key] = value;
  await writeClaudeConfig(config);
  return { ok: true };
});

ipcMain.handle('project:get', () => ({ root: projectRoot }));

ipcMain.handle('project:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a project folder for Claude',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return { root: projectRoot, canceled: true };
  projectRoot = result.filePaths[0];
  await pushRecent(projectRoot);
  return { root: projectRoot, canceled: false };
});

/** Set project root to a known path (e.g. clicking a recent). */
ipcMain.handle('project:set', async (_evt, { root }) => {
  if (!root || typeof root !== 'string') return { ok: false, error: 'invalid path' };
  // Verify the path exists and is a directory before switching.
  try {
    const stat = await fs.stat(root);
    if (!stat.isDirectory()) return { ok: false, error: 'not a directory' };
  } catch (err) {
    // Stale recent — auto-prune and report.
    await removeRecent(root);
    return { ok: false, error: 'path no longer exists', pruned: true };
  }
  projectRoot = root;
  await pushRecent(projectRoot);
  return { ok: true, root: projectRoot };
});

ipcMain.handle('recents:list', async () => ({ recents: await readRecents() }));
ipcMain.handle('recents:remove', async (_evt, { path: p }) => ({ recents: await removeRecent(p) }));
ipcMain.handle('recents:clear', async () => {
  await writeRecents([]);
  return { recents: [] };
});

/* ------------------------------------------------------------------ */
/* IPC — filesystem tree + file read                                  */
/* ------------------------------------------------------------------ */

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-electron', 'release', '.next', '.cache', '.venv', '__pycache__']);

async function readTree(dir, depth = 0, max = 6) {
  if (depth > max) return [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.claude' && entry.name !== '.env.example') continue;
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const node = {
      name: entry.name,
      path: full,
      isDir: entry.isDirectory()
    };
    if (entry.isDirectory()) node.children = []; // lazy-loaded on expand
    out.push(node);
  }
  out.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
  return out;
}

ipcMain.handle('fs:tree', async (_evt, dirPath) => {
  const target = dirPath || projectRoot;
  if (!isInsideProjectRoot(target)) {
    return { root: projectRoot, children: [], error: 'Path outside project root' };
  }
  const children = await readTree(target);
  return { root: target, children };
});

ipcMain.handle('fs:readFile', async (_evt, filePath) => {
  // Constrain to projectRoot for safety.
  if (!isInsideProjectRoot(filePath)) {
    return { error: 'Path outside project root' };
  }
  const resolved = path.resolve(filePath);
  try {
    const stat = await fs.stat(resolved);
    if (stat.size > 2_000_000) return { error: 'File too large to preview (>2MB)' };
    const content = await fs.readFile(resolved, 'utf8');
    return { content, ext: path.extname(resolved).slice(1).toLowerCase() };
  } catch (err) {
    return { error: err.message };
  }
});

/* ------------------------------------------------------------------ */
/* IPC — Claude CLI chat streaming                                    */
/* ------------------------------------------------------------------ */

/**
 * Send a prompt to `claude -p` with stream-json output.
 * The child process is remembered by messageId so the renderer can stop it.
 */
ipcMain.handle('claude:send', async (_evt, { messageId, prompt, sessionId, planMode, images, redirectFromMessageId, paneCwd }) => {
  if (!messageId || !prompt) return { error: 'messageId and prompt required' };

  // Mid-stream redirect: stop the previous in-flight child for this pane,
  // then start a new prompt that resumes the same sessionId.
  if (redirectFromMessageId) {
    const prevChild = chatChildren.get(redirectFromMessageId);
    if (prevChild) { try { prevChild.kill('SIGINT'); } catch {} }
    chatChildren.delete(redirectFromMessageId);
  }

  // Kill any pre-existing child for this id (defensive).
  const prev = chatChildren.get(messageId);
  if (prev) { try { prev.kill('SIGINT'); } catch {} }

  // Append image references inline — claude resolves @<path> as Read targets.
  let finalPrompt = prompt;
  if (Array.isArray(images) && images.length) {
    finalPrompt += '\n\n' + images.map((p) => `Attached image: ${p}`).join('\n');
  }

  const args = ['-p', finalPrompt, '--output-format', 'stream-json', '--verbose'];
  if (sessionId) args.push('--resume', sessionId);
  if (planMode) {
    args.push('--append-system-prompt',
      'PLAN MODE: First present a clear, numbered plan of what you intend to do, then STOP and wait for the user to approve before making any file changes or running tools. If the user has already approved a plan, proceed.');
  }
  const cwd = paneCwd || projectRoot || process.cwd();

  let child;
  try {
    child = spawn(CLAUDE_BIN, args, {
      cwd,
      env: process.env
    });
  } catch (err) {
    send('claude:stream', { messageId, event: { type: 'error', message: `Failed to spawn \`${CLAUDE_BIN}\`: ${err.message}` } });
    return { ok: false, error: err.message };
  }

  chatChildren.set(messageId, child);

  const parseOut = createNdjsonParser((event) => {
    send('claude:stream', { messageId, event });
  });

  child.stdout.on('data', parseOut);

  let stderrBuf = '';
  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString('utf8');
    send('claude:stream', { messageId, event: { type: 'stderr', text: chunk.toString('utf8') } });
  });

  child.on('error', (err) => {
    send('claude:stream', { messageId, event: { type: 'error', message: err.message } });
  });

  child.on('close', (code, signal) => {
    chatChildren.delete(messageId);
    send('claude:stream', {
      messageId,
      event: { type: 'done', code, signal, stderr: stderrBuf }
    });
    // Background notification: only when window is not focused.
    maybeNotifyTaskDone(code === 0);
  });

  return { ok: true };
});

function maybeNotifyTaskDone(ok) {
  try {
    if (!Notification.isSupported()) return;
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) return;
    const n = new Notification({
      title: ok ? 'Claude finished' : 'Claude stopped',
      body: ok ? 'Your task is done.' : 'Task ended with an error or was stopped.',
      silent: false
    });
    n.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    n.show();
  } catch {}
}

/* ------------------------------------------------------------------ */
/* IPC — Claude CLI raw command execution (e.g. mcp add, config set)  */
/* ------------------------------------------------------------------ */

/**
 * Detect `mcp add <name> <github-url>` so we can also clone the repo and
 * surface its bundled skills/agents/commands in the Skills panel.
 * Returns { name, url } when a github URL is detected, else null.
 */
function detectGithubMcpAdd(args) {
  if (!Array.isArray(args) || args.length < 4) return null;
  if (args[0] !== 'mcp' || args[1] !== 'add') return null;
  const name = args[2];
  // The URL is usually the last token; sometimes preceded by flags.
  for (let i = args.length - 1; i >= 3; i -= 1) {
    const t = args[i];
    if (/^https?:\/\/github\.com\//i.test(t) || /^git@github\.com:/i.test(t)) {
      return { name, url: t };
    }
  }
  return null;
}

/** Clone a github repo into <home>/.claude/plugins/<name>. */
function cloneRepoForPlugin({ name, url }) {
  return new Promise((resolve) => {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    if (!home) return resolve({ ok: false, error: 'no home dir' });
    const dest = path.join(home, '.claude', 'plugins', name);

    // If already cloned, do a `git pull` instead.
    fs.access(dest)
      .then(() => {
        const child = spawn('git', ['-C', dest, 'pull', '--ff-only'], { env: process.env });
        let err = '';
        child.stderr.on('data', (c) => (err += c.toString('utf8')));
        child.on('close', (code) => resolve({ ok: code === 0, dest, updated: true, error: code === 0 ? null : err.trim() || `git pull exited ${code}` }));
        child.on('error', (e) => resolve({ ok: false, error: e.message }));
      })
      .catch(async () => {
        // Ensure parent dir exists.
        try { await fs.mkdir(path.dirname(dest), { recursive: true }); } catch {}
        const child = spawn('git', ['clone', '--depth', '1', url, dest], { env: process.env });
        let err = '';
        child.stderr.on('data', (c) => (err += c.toString('utf8')));
        child.on('close', (code) => resolve({ ok: code === 0, dest, cloned: true, error: code === 0 ? null : err.trim() || `git clone exited ${code}` }));
        child.on('error', (e) => resolve({ ok: false, error: e.message }));
      });
  });
}

ipcMain.handle('claude:exec', async (_evt, { messageId, command }) => {
  if (!messageId || !command) return { error: 'messageId and command required' };

  const args = command.trim().split(/\s+/);
  let child;
  try {
    child = spawn(CLAUDE_BIN, args, {
      cwd: projectRoot,
      env: process.env,
    });
  } catch (err) {
    send('claude:stream', { messageId, event: { type: 'error', message: `Failed to spawn \`${CLAUDE_BIN}\`: ${err.message}` } });
    return { ok: false, error: err.message };
  }

  chatChildren.set(messageId, child);

  let stderrBuf = '';
  child.stdout.on('data', (chunk) => {
    send('claude:stream', { messageId, event: { type: 'stdout', text: chunk.toString('utf8') } });
  });

  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString('utf8');
    send('claude:stream', { messageId, event: { type: 'stderr', text: chunk.toString('utf8') } });
  });

  child.on('error', (err) => {
    send('claude:stream', { messageId, event: { type: 'error', message: err.message } });
  });

  child.on('close', async (code, signal) => {
    chatChildren.delete(messageId);
    send('claude:stream', {
      messageId,
      event: { type: 'done', code, signal, stderr: stderrBuf }
    });
    if (code !== 0) return;

    // If this was `mcp add <name> <github-url>`, also clone the repo so
    // any bundled skills become discoverable in the Skills panel.
    const ghAdd = detectGithubMcpAdd(args);
    if (ghAdd) {
      send('claude:stream', {
        messageId,
        event: { type: 'stdout', text: `\nFetching skills from ${ghAdd.url} …\n` }
      });
      const result = await cloneRepoForPlugin(ghAdd);
      if (result.ok) {
        send('claude:stream', {
          messageId,
          event: { type: 'stdout', text: `Installed plugin to ${result.dest}\n` }
        });
      } else {
        send('claude:stream', {
          messageId,
          event: { type: 'stderr', text: `Skill install warning: ${result.error || 'unknown error'}\n` }
        });
      }
    }

    // Always refresh the MCP/Skills panel after a successful CLI command.
    setTimeout(() => { ipcMain.emit('mcp:refresh'); }, 500);
  });

  return { ok: true };
});

ipcMain.on('mcp:refresh', () => {
  send('mcp:refresh', {});
});

ipcMain.handle('claude:stop', (_evt, { messageId }) => {
  if (messageId) {
    const child = chatChildren.get(messageId);
    if (child) {
      try { child.kill('SIGINT'); } catch {}
      chatChildren.delete(messageId);
      return { ok: true, stopped: [messageId] };
    }
    return { ok: false, error: 'unknown messageId' };
  }
  // Stop everything.
  const ids = [...chatChildren.keys()];
  killAllChatChildren();
  return { ok: true, stopped: ids };
});

/* ------------------------------------------------------------------ */
/* IPC — Skills discovery (real Claude Code SKILL.md) + MCP list      */
/* ------------------------------------------------------------------ */

/**
 * Parse the YAML frontmatter of a SKILL.md file.
 * Very forgiving parser — we only need `name` and `description`.
 */
function parseFrontmatter(md) {
  if (!md.startsWith('---')) return {};
  const end = md.indexOf('\n---', 3);
  if (end === -1) return {};
  const yaml = md.slice(3, end).trim();
  const out = {};
  let currentKey = null;
  let currentBuf = '';
  for (const rawLine of yaml.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (m && !/^\s/.test(line)) {
      if (currentKey) out[currentKey] = currentBuf.trim();
      currentKey = m[1];
      currentBuf = m[2] || '';
    } else if (currentKey) {
      // Continuation line (indented wrap).
      currentBuf += ' ' + line.trim();
    }
  }
  if (currentKey) out[currentKey] = currentBuf.trim();
  // Strip surrounding quotes on string values.
  for (const k of Object.keys(out)) {
    out[k] = out[k].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

/**
 * Scan one directory for subfolders that contain SKILL.md.
 * Returns an array of { name, description, path, source }.
 */
async function scanSkillRoot(root, source, maxDepth = 8) {
  const found = [];
  /** @type {{dir: string, depth: number}[]} */
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    if (depth > maxDepth) continue;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch { continue; }
    // If this dir itself contains a SKILL.md, treat it as a skill.
    const hasSkill = entries.some((e) => e.isFile() && e.name.toLowerCase() === 'skill.md');
    if (hasSkill) {
      const skillFile = path.join(dir, entries.find((e) => e.name.toLowerCase() === 'skill.md').name);
      try {
        const content = await fs.readFile(skillFile, 'utf8');
        const fm = parseFrontmatter(content);
        const name = fm.name || path.basename(dir);
        const description = fm.description || '';
        found.push({
          id: `${source}:${name}`,
          name,
          description,
          path: skillFile,
          source
        });
      } catch {}
      // Don't descend into a skill folder's own subdirs.
      continue;
    }
    // Otherwise queue children.
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') && entry.name !== '.claude') continue;
      if (IGNORED_DIRS.has(entry.name)) continue;
      stack.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
    }
  }
  return found;
}

/**
 * Default skill-hosting locations Claude Code uses.
 * We look in:
 *   - <project>/.claude/skills
 *   - <home>/.claude/skills
 *   - %APPDATA%/Claude/**\/skills (plugin-installed skills on Windows)
 *   - ~/.config/Claude/**\/skills (Linux)
 *   - ~/Library/Application Support/Claude/**\/skills (macOS)
 */
function defaultSkillRoots() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const appdata = process.env.APPDATA || '';
  const xdgConfig = process.env.XDG_CONFIG_HOME || (home ? path.join(home, '.config') : '');
  const roots = [];
  if (projectRoot) roots.push({ path: path.join(projectRoot, '.claude', 'skills'), source: 'project' });
  if (home) roots.push({ path: path.join(home, '.claude', 'skills'), source: 'user' });
  // Plugins cloned via the in-app installer land here.
  if (home) roots.push({ path: path.join(home, '.claude', 'plugins'), source: 'plugin' });
  if (appdata) roots.push({ path: path.join(appdata, 'Claude'), source: 'plugin' });
  if (xdgConfig) roots.push({ path: path.join(xdgConfig, 'Claude'), source: 'plugin' });
  if (home && process.platform === 'darwin') {
    roots.push({ path: path.join(home, 'Library', 'Application Support', 'Claude'), source: 'plugin' });
  }
  return roots;
}

ipcMain.handle('skills:discover', async () => {
  const roots = defaultSkillRoots();
  const all = [];
  const seen = new Set();
  for (const { path: root, source } of roots) {
    const exists = await fs.access(root).then(() => true).catch(() => false);
    if (!exists) continue;
    try {
      const found = await scanSkillRoot(root, source);
      for (const s of found) {
        const key = s.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(s);
      }
    } catch {}
  }
  all.sort((a, b) => a.name.localeCompare(b.name));
  return { skills: all, roots: roots.map((r) => r.path) };
});

ipcMain.handle('skills:list', async () => {
  // Kept for backward-compat: returns MCP servers raw output.
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      const child = spawn(CLAUDE_BIN, ['mcp', 'list'], {
        cwd: projectRoot,
        env: process.env
      });
      let out = '';
      let err = '';
      child.stdout.on('data', (c) => (out += c.toString('utf8')));
      child.stderr.on('data', (c) => (err += c.toString('utf8')));
      child.on('close', () => settle({ raw: out, err }));
      child.on('error', (e) => settle({ raw: '', err: e.message }));
      // MCP health-check can be slow; cap at 12s and return partial output
      setTimeout(() => settle({ raw: out, err: err || 'timeout' }), 12000);
    } catch (e) {
      settle({ raw: '', err: e.message });
    }
  });
});

/* ------------------------------------------------------------------ */
/* IPC — settings.json (permissions, hooks, env)                      */
/* ------------------------------------------------------------------ */

function settingsFile(scope) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (scope === 'user') return path.join(home, '.claude', 'settings.json');
  if (!projectRoot) return null;
  return path.join(projectRoot, '.claude', 'settings.json');
}

ipcMain.handle('settings:get', async (_evt, { scope = 'project' } = {}) => {
  const file = settingsFile(scope);
  if (!file) return { settings: null, file: null, error: 'no scope' };
  try {
    const raw = await fs.readFile(file, 'utf8');
    return { settings: JSON.parse(raw), file };
  } catch (err) {
    return { settings: {}, file, error: err.code === 'ENOENT' ? null : err.message };
  }
});

ipcMain.handle('settings:set', async (_evt, { scope = 'project', settings }) => {
  const file = settingsFile(scope);
  if (!file) return { ok: false, error: 'no scope' };
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(settings ?? {}, null, 2), 'utf8');
    return { ok: true, file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ------------------------------------------------------------------ */
/* IPC — CLAUDE.md (project memory)                                   */
/* ------------------------------------------------------------------ */

ipcMain.handle('claudeMd:get', async (_evt, { scope = 'project' } = {}) => {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const file = scope === 'user'
    ? path.join(home, '.claude', 'CLAUDE.md')
    : (projectRoot ? path.join(projectRoot, 'CLAUDE.md') : null);
  if (!file) return { content: '', file: null };
  try {
    const content = await fs.readFile(file, 'utf8');
    return { content, file };
  } catch (err) {
    return { content: '', file, error: err.code === 'ENOENT' ? null : err.message };
  }
});

ipcMain.handle('claudeMd:set', async (_evt, { scope = 'project', content }) => {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const file = scope === 'user'
    ? path.join(home, '.claude', 'CLAUDE.md')
    : (projectRoot ? path.join(projectRoot, 'CLAUDE.md') : null);
  if (!file) return { ok: false, error: 'no scope' };
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content ?? '', 'utf8');
    return { ok: true, file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ------------------------------------------------------------------ */
/* IPC — past sessions browser                                        */
/* ------------------------------------------------------------------ */

/**
 * Claude Code stores per-project session transcripts as JSONL files under
 *   ~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
 * The encoding scheme has changed across versions, so we just scan all
 * project folders and filter sessions whose first event's `cwd` matches
 * the currently-selected projectRoot.
 */
async function listSessionFiles() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return [];
  const root = path.join(home, '.claude', 'projects');
  let folders;
  try {
    folders = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const d of folders) {
    if (!d.isDirectory()) continue;
    const dir = path.join(root, d.name);
    let files;
    try { files = await fs.readdir(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      out.push({ folder: d.name, file: path.join(dir, f), id: f.replace(/\.jsonl$/, '') });
    }
  }
  return out;
}

async function readSessionMeta(file) {
  // First & last few lines + size; cheap enough since most sessions are small.
  try {
    const stat = await fs.stat(file);
    const raw = await fs.readFile(file, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    let cwd = null, model = null, firstUserText = null, lastTs = null, turns = 0;
    for (const line of lines) {
      try {
        const ev = JSON.parse(line);
        if (!cwd && ev.cwd) cwd = ev.cwd;
        if (!model && ev.model) model = ev.model;
        if (ev.timestamp) lastTs = ev.timestamp;
        if (ev.type === 'user' && !firstUserText) {
          const c = ev.message?.content;
          if (typeof c === 'string') firstUserText = c.slice(0, 140);
          else if (Array.isArray(c)) {
            const t = c.find((b) => b?.type === 'text');
            if (t?.text) firstUserText = t.text.slice(0, 140);
          }
        }
        if (ev.type === 'assistant' || ev.type === 'user') turns += 1;
      } catch {}
    }
    return {
      cwd,
      model,
      preview: firstUserText || '(no user text)',
      turns,
      mtime: stat.mtimeMs,
      size: stat.size,
      lastTs
    };
  } catch (err) {
    return { error: err.message };
  }
}

ipcMain.handle('sessions:list', async () => {
  const files = await listSessionFiles();
  const items = [];
  for (const entry of files) {
    const meta = await readSessionMeta(entry.file);
    if (!meta || meta.error) continue;
    if (projectRoot && meta.cwd && path.resolve(meta.cwd) !== path.resolve(projectRoot)) continue;
    items.push({ id: entry.id, file: entry.file, ...meta });
  }
  items.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  return { sessions: items };
});

ipcMain.handle('sessions:read', async (_evt, { file }) => {
  if (!file) return { error: 'file required' };
  try {
    const raw = await fs.readFile(file, 'utf8');
    const events = raw.split('\n').filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
    return { events };
  } catch (err) {
    return { error: err.message };
  }
});

/* ------------------------------------------------------------------ */
/* IPC — Git status & ops                                             */
/* ------------------------------------------------------------------ */

function runGit(args, cwd) {
  return new Promise((resolve) => {
    if (!cwd) return resolve({ ok: false, error: 'no cwd' });
    const child = spawn('git', args, { cwd, env: process.env });
    let out = '', err = '';
    child.stdout.on('data', (c) => (out += c.toString('utf8')));
    child.stderr.on('data', (c) => (err += c.toString('utf8')));
    child.on('error', (e) => resolve({ ok: false, error: e.message }));
    child.on('close', (code) => resolve({ ok: code === 0, stdout: out, stderr: err, code }));
  });
}

ipcMain.handle('git:status', async () => {
  if (!projectRoot) return { ok: false, error: 'no project' };
  const inside = await runGit(['rev-parse', '--is-inside-work-tree'], projectRoot);
  if (!inside.ok) return { ok: false, error: 'not a git repo' };
  const branch = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], projectRoot);
  const porcelain = await runGit(['status', '--porcelain'], projectRoot);
  const ahead = await runGit(['rev-list', '--count', '@{u}..HEAD'], projectRoot);
  const behind = await runGit(['rev-list', '--count', 'HEAD..@{u}'], projectRoot);
  const dirtyCount = (porcelain.stdout || '').split('\n').filter(Boolean).length;
  return {
    ok: true,
    branch: (branch.stdout || '').trim() || 'HEAD',
    dirty: dirtyCount > 0,
    dirtyCount,
    ahead: parseInt((ahead.stdout || '').trim(), 10) || 0,
    behind: parseInt((behind.stdout || '').trim(), 10) || 0
  };
});

ipcMain.handle('git:exec', async (_evt, { args }) => {
  if (!projectRoot) return { ok: false, error: 'no project' };
  if (!Array.isArray(args)) return { ok: false, error: 'args must be array' };
  return runGit(args, projectRoot);
});

/* ------------------------------------------------------------------ */
/* IPC — image clipboard / file save                                  */
/* ------------------------------------------------------------------ */

ipcMain.handle('image:fromClipboard', async () => {
  try {
    const img = clipboard.readImage();
    if (img.isEmpty()) return { ok: false, error: 'clipboard has no image' };
    const buf = img.toPNG();
    const dir = path.join(os.tmpdir(), 'claude-sight-images');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `clip-${Date.now()}.png`);
    await fs.writeFile(file, buf);
    return { ok: true, file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('image:saveDropped', async (_evt, { name, dataBase64 }) => {
  try {
    const dir = path.join(os.tmpdir(), 'claude-sight-images');
    await fs.mkdir(dir, { recursive: true });
    const safe = (name || 'drop.png').replace(/[^\w.-]/g, '_');
    const file = path.join(dir, `${Date.now()}-${safe}`);
    await fs.writeFile(file, Buffer.from(dataBase64, 'base64'));
    return { ok: true, file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ------------------------------------------------------------------ */
/* IPC — MCP logs / diagnostics                                       */
/* ------------------------------------------------------------------ */

/**
 * Best-effort MCP log retrieval. Locations vary by Claude Code version, so
 * we probe a few well-known paths.
 */
ipcMain.handle('mcp:logs', async (_evt, { name }) => {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const candidates = [
    home && path.join(home, '.claude', 'logs', 'mcp', `${name}.log`),
    home && path.join(home, '.claude', 'logs', `mcp-${name}.log`),
    home && path.join(home, '.cache', 'claude', 'mcp', `${name}.log`)
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const stat = await fs.stat(p);
      if (stat.isFile()) {
        const raw = await fs.readFile(p, 'utf8');
        // Tail to last 200 lines
        const lines = raw.split('\n');
        const tail = lines.slice(Math.max(0, lines.length - 200)).join('\n');
        return { ok: true, file: p, content: tail };
      }
    } catch {}
  }
  // Fallback: run `claude mcp list` and `claude mcp get <name>` for status.
  return new Promise((resolve) => {
    const child = spawn(CLAUDE_BIN, ['mcp', 'get', name], { env: process.env });
    let out = '', err = '';
    child.stdout.on('data', (c) => (out += c.toString('utf8')));
    child.stderr.on('data', (c) => (err += c.toString('utf8')));
    child.on('close', () => resolve({
      ok: true,
      file: null,
      content: out || err || 'No log file found and `claude mcp get` returned nothing.',
      fallback: true
    }));
    child.on('error', () => resolve({ ok: false, content: 'Could not read MCP logs.' }));
  });
});

/* ------------------------------------------------------------------ */
/* IPC — export conversation                                          */
/* ------------------------------------------------------------------ */

ipcMain.handle('export:save', async (_evt, { defaultName, content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export conversation',
    defaultPath: defaultName || 'claude-session.md',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'Text', extensions: ['txt'] }
    ]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  try {
    await fs.writeFile(result.filePath, content ?? '', 'utf8');
    return { ok: true, file: result.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ------------------------------------------------------------------ */
/* IPC — file revert (used by diff "reject")                          */
/* ------------------------------------------------------------------ */

ipcMain.handle('file:writeIfInside', async (_evt, { filePath, content }) => {
  if (!filePath || typeof content !== 'string') return { ok: false, error: 'bad args' };
  if (!isInsideProjectRoot(filePath)) return { ok: false, error: 'outside project' };
  try {
    await fs.writeFile(filePath, content, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ------------------------------------------------------------------ */
/* IPC — Claude binary detection (onboarding)                         */
/* ------------------------------------------------------------------ */

ipcMain.handle('claude:detect', async () => {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const child = spawn(CLAUDE_BIN, ['--version'], { env: process.env });
      let out = '', err = '';
      child.stdout.on('data', (c) => (out += c.toString('utf8')));
      child.stderr.on('data', (c) => (err += c.toString('utf8')));
      child.on('close', (code) => settle({ ok: code === 0, version: (out || err).trim(), bin: CLAUDE_BIN }));
      child.on('error', (e) => settle({ ok: false, error: e.message, bin: CLAUDE_BIN }));
      setTimeout(() => settle({ ok: false, error: 'timeout', bin: CLAUDE_BIN }), 5000);
    } catch (e) {
      settle({ ok: false, error: e.message, bin: CLAUDE_BIN });
    }
  });
});

/* ------------------------------------------------------------------ */
/* IPC — generic notification (renderer-triggered)                    */
/* ------------------------------------------------------------------ */

ipcMain.handle('notify', async (_evt, { title, body }) => {
  try {
    if (!Notification.isSupported()) return { ok: false };
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) return { ok: false, suppressed: true };
    new Notification({ title: title || 'Claude Sight', body: body || '' }).show();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ------------------------------------------------------------------ */
/* IPC — optional raw PTY terminal                                    */
/* ------------------------------------------------------------------ */

ipcMain.handle('pty:start', (_evt, { cols = 120, rows = 32 } = {}) => {
  if (!pty) return { error: 'node-pty unavailable. Run `npm run rebuild`.' };
  disposePty();
  try {
    ptyProc = pty.spawn(CLAUDE_BIN, [], {
      name: 'xterm-256color',
      cols, rows,
      cwd: projectRoot,
      env: process.env
    });
    ptyProc.onData((data) => send('pty:data', data));
    ptyProc.onExit(({ exitCode, signal }) => {
      send('pty:exit', { exitCode, signal });
      ptyProc = null;
    });
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.on('pty:input', (_evt, data) => {
  if (ptyProc) { try { ptyProc.write(data); } catch {} }
});

ipcMain.on('pty:resize', (_evt, { cols, rows }) => {
  if (ptyProc) { try { ptyProc.resize(cols, rows); } catch {} }
});

ipcMain.handle('pty:stop', () => {
  disposePty();
  return { ok: true };
});
