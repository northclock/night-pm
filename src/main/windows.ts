import { BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'node:path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let thoughtsWindow: BrowserWindow | null = null;

export function getMainWindow() {
  return mainWindow;
}

export function getThoughtsWindow() {
  return thoughtsWindow;
}

export function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 10 },
    backgroundColor: '#0b1120',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-changed', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-changed', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function createThoughtsWindow() {
  if (thoughtsWindow && !thoughtsWindow.isDestroyed()) {
    thoughtsWindow.showInactive();
    thoughtsWindow.focus();
    return thoughtsWindow;
  }

  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 600;
  const winHeight = 400;

  thoughtsWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.round((screenWidth - winWidth) / 2),
    y: Math.round((screenHeight - winHeight) / 3),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    backgroundColor: '#00000000',
    hasShadow: true,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  thoughtsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    thoughtsWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#thoughts`);
  } else {
    thoughtsWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: 'thoughts' },
    );
  }

  thoughtsWindow.on('closed', () => {
    thoughtsWindow = null;
  });

  return thoughtsWindow;
}

export function hideThoughtsWindow() {
  if (thoughtsWindow && !thoughtsWindow.isDestroyed()) {
    thoughtsWindow.hide();
  }
}

export function toggleThoughtsWindow() {
  if (thoughtsWindow && !thoughtsWindow.isDestroyed() && thoughtsWindow.isVisible()) {
    thoughtsWindow.hide();
  } else {
    const win = createThoughtsWindow();
    win.showInactive();
    win.focus();
  }
}

export function registerWindowIpc() {
  ipcMain.handle('thoughts:hide', () => {
    hideThoughtsWindow();
  });
}
