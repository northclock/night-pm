import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './main/ipc-handlers';
import { createMainWindow, getThoughtsWindow, registerWindowIpc } from './main/windows';
import { registerShortcuts, unregisterShortcuts } from './main/shortcuts';
import { startConversation, sendFollowup, stopConversation, listSessions, getActiveProviderId } from './main/engine';
import { loadSettings, saveSettings } from './main/settings';
import { detectProviders } from './main/detect-providers';
import { scanProjectTree } from './main/mcp-tools';
import { startMcpHttpServer, stopMcpHttpServer, getStatus as getMcpStatus } from './main/mcp-http';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';

if (started) {
  app.quit();
}

app.setName('Night PM');

let activeProjectPath: string | null = null;
let rootDirPath: string | null = null;

function setActiveProject(projectPath: string) {
  activeProjectPath = projectPath;
  void saveSettings({ selectedProjectPath: projectPath });
}

function sendToWindow(win: BrowserWindow | null, channel: string, ...args: unknown[]) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

app.on('ready', () => {
  void (async () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  registerIpcHandlers();
  registerWindowIpc();
  registerShortcuts();
  createMainWindow();

  const settings = await loadSettings();
  activeProjectPath = settings.selectedProjectPath || null;
  rootDirPath = settings.lastProjectPath || null;

  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', async (_event, newSettings: Record<string, unknown>) => {
    if (typeof newSettings.lastProjectPath === 'string') rootDirPath = newSettings.lastProjectPath;
    return saveSettings(newSettings as Parameters<typeof saveSettings>[0]);
  });

  ipcMain.handle('app:setActiveProject', async (_event, projectPath: string) => {
    setActiveProject(projectPath);
  });

  // ── Provider detection ──
  ipcMain.handle('ai:detect-providers', () => detectProviders());
  ipcMain.handle('ai:get-active-provider', () => getActiveProviderId());

  // ── MCP HTTP Server ──
  startMcpHttpServer(
    () => activeProjectPath,
    () => rootDirPath,
    setActiveProject,
  ).catch((e) => console.error('[MCP HTTP] Failed to start:', e));

  ipcMain.handle('mcp:status', () => getMcpStatus());
  ipcMain.handle('mcp:restart', async () => {
    await stopMcpHttpServer();
    return startMcpHttpServer(
      () => activeProjectPath,
      () => rootDirPath,
      setActiveProject,
    );
  });

  // ── Project listing ──
  ipcMain.handle('project:list', async () => {
    if (!rootDirPath) return [];
    return scanProjectTree(rootDirPath);
  });

  // ── AI: Thoughts (also handles doc chat via optional filePath) ──
  ipcMain.handle('ai:thought', async (event, text: string, filePath?: string, projectPath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getThoughtsWindow();

    if (projectPath) {
      setActiveProject(projectPath);
    }

    const targetProject = activeProjectPath;
    if (!targetProject) {
      sendToWindow(win, 'ai:message', { type: 'error', message: 'No project selected. Open a directory in the sidebar, then double-click a project folder or right-click it and choose "Set as Active Project".' });
      return;
    }

    const thoughtsPath = path.join(targetProject, 'thoughts.json');
    let thoughts: unknown[] = [];
    try {
      const raw = await fsPromises.readFile(thoughtsPath, 'utf-8');
      thoughts = JSON.parse(raw);
    } catch { /* empty */ }
    const logText = filePath ? `Re ${path.basename(filePath)}: ${text}` : text;
    thoughts.push({ thought: logText, actionsTriggered: [], createdOn: new Date().toISOString() });
    await fsPromises.mkdir(path.dirname(thoughtsPath), { recursive: true });
    await fsPromises.writeFile(thoughtsPath, JSON.stringify(thoughts, null, 2), 'utf-8');

    const send = (ch: string, ...args: unknown[]) => sendToWindow(win, ch, ...args);
    const key = filePath ? `doc:${filePath}` : 'thought';
    const prompt = filePath
      ? `The user is editing the document at: ${filePath}\n\n${text}`
      : text;

    await startConversation(
      key, targetProject, prompt, send,
      'ai:message', 'ai:progress', 'ai:done',
      { isThought: true, rootPath: rootDirPath ?? undefined, setActiveProject },
    );
  });

  ipcMain.handle('ai:thought-followup', async (event, text: string, filePath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender) || getThoughtsWindow();
    const send = (ch: string, ...args: unknown[]) => sendToWindow(win, ch, ...args);
    const key = filePath ? `doc:${filePath}` : 'thought';
    await sendFollowup(key, text, send, 'ai:message', 'ai:progress', 'ai:done');
  });

  ipcMain.handle('ai:abort', (_event, filePath?: string) => {
    const key = filePath ? `doc:${filePath}` : 'thought';
    stopConversation(key);
  });

  // ── AI: Console ──
  ipcMain.handle('ai:console-run', async (event, command: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!activeProjectPath) {
      if (win) sendToWindow(win, 'ai:console-message', { type: 'error', message: 'No project selected. Open a directory in the sidebar, then double-click a project folder or right-click it and choose "Set as Active Project".' });
      return;
    }
    if (!win) return;
    const send = (ch: string, ...args: unknown[]) => sendToWindow(win, ch, ...args);

    await startConversation(
      'console', activeProjectPath, command, send,
      'ai:console-message', 'ai:console-progress', 'ai:console-done',
      { rootPath: rootDirPath ?? undefined, setActiveProject },
    );
  });

  ipcMain.handle('ai:console-followup', async (event, text: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const send = (ch: string, ...args: unknown[]) => sendToWindow(win, ch, ...args);
    await sendFollowup('console', text, send, 'ai:console-message', 'ai:console-progress', 'ai:console-done');
  });

  ipcMain.handle('ai:console-abort', () => {
    stopConversation('console');
  });

  // ── Sessions ──
  ipcMain.handle('ai:sessions-list', async () => {
    if (!activeProjectPath) return [];
    return listSessions(activeProjectPath);
  });

  ipcMain.handle('ai:session-resume', async (_event, sessionId: string) => {
    if (!activeProjectPath) return;
    const win = getThoughtsWindow();
    const send = (ch: string, ...args: unknown[]) => sendToWindow(win, ch, ...args);
    await startConversation(
      'thought', activeProjectPath, '', send,
      'ai:message', 'ai:progress', 'ai:done',
      { isThought: true, resumeSessionId: sessionId, rootPath: rootDirPath ?? undefined, setActiveProject },
    );
  });

  })();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('will-quit', () => {
  unregisterShortcuts();
  stopConversation('thought');
  stopConversation('console');
  stopMcpHttpServer().catch(() => {});
});
