import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './main/ipc-handlers';
import { createMainWindow, getThoughtsWindow, registerWindowIpc } from './main/windows';
import { registerShortcuts, unregisterShortcuts } from './main/shortcuts';
import { startConversation, sendFollowup, stopConversation, listSessions, getActiveProviderId } from './main/engine';
import { loadSettings, saveSettings } from './main/settings';
import { detectProviders } from './main/detect-providers';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';

if (started) {
  app.quit();
}

app.setName('Night PM');

let activeProjectPath: string | null = null;

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

  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', async (_event, newSettings: Record<string, unknown>) => saveSettings(newSettings as Parameters<typeof saveSettings>[0]));

  ipcMain.handle('app:setActiveProject', async (_event, projectPath: string) => {
    activeProjectPath = projectPath;
    await saveSettings({ selectedProjectPath: projectPath });
  });

  // ── Provider detection ──
  ipcMain.handle('ai:detect-providers', () => detectProviders());
  ipcMain.handle('ai:get-active-provider', () => getActiveProviderId());

  // ── AI: Thoughts ──
  ipcMain.handle('ai:thought', async (_event, text: string) => {
    if (!activeProjectPath) {
      const win = getThoughtsWindow();
      sendToWindow(win, 'ai:message', { type: 'error', message: 'No project selected. Open a directory in the sidebar, then double-click a project folder or right-click it and choose "Set as Active Project".' });
      return;
    }

    const thoughtsPath = path.join(activeProjectPath, 'thoughts.json');
    let thoughts: unknown[] = [];
    try {
      const raw = await fsPromises.readFile(thoughtsPath, 'utf-8');
      thoughts = JSON.parse(raw);
    } catch { /* empty */ }
    thoughts.push({ thought: text, actionsTriggered: [], createdOn: new Date().toISOString() });
    await fsPromises.mkdir(path.dirname(thoughtsPath), { recursive: true });
    await fsPromises.writeFile(thoughtsPath, JSON.stringify(thoughts, null, 2), 'utf-8');

    const win = getThoughtsWindow();
    const send = (ch: string, ...args: unknown[]) => sendToWindow(win, ch, ...args);

    await startConversation(
      'thought', activeProjectPath, text, send,
      'ai:message', 'ai:progress', 'ai:done',
      { isThought: true },
    );
  });

  ipcMain.handle('ai:thought-followup', async (_event, text: string) => {
    const win = getThoughtsWindow();
    const send = (ch: string, ...args: unknown[]) => sendToWindow(win, ch, ...args);
    await sendFollowup('thought', text, send, 'ai:message', 'ai:progress', 'ai:done');
  });

  ipcMain.handle('ai:abort', () => {
    stopConversation('thought');
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
      { isThought: true, resumeSessionId: sessionId },
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
});
