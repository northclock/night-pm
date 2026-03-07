import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';

const watchers = new Map<string, fs.FSWatcher>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function notifyAllWindows(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}

export function registerIpcHandlers() {
  ipcMain.handle('fs:watch', (_event, filePath: string) => {
    if (watchers.has(filePath)) return;
    try {
      const watcher = fs.watch(filePath, () => {
        if (debounceTimers.has(filePath)) {
          clearTimeout(debounceTimers.get(filePath)!);
        }
        debounceTimers.set(
          filePath,
          setTimeout(async () => {
            debounceTimers.delete(filePath);
            try {
              const content = await fsPromises.readFile(filePath, 'utf-8');
              notifyAllWindows('fs:fileChanged', filePath, content);
            } catch {
              // file may have been deleted
            }
          }, 300),
        );
      });
      watchers.set(filePath, watcher);
    } catch {
      // file doesn't exist yet, that's ok
    }
  });

  ipcMain.handle('fs:unwatch', (_event, filePath: string) => {
    const watcher = watchers.get(filePath);
    if (watcher) {
      watcher.close();
      watchers.delete(filePath);
    }
    const timer = debounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(filePath);
    }
  });

  ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith('.'))
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }))
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
  });

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    try {
      return await fsPromises.readFile(filePath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
      throw err;
    }
  });

  ipcMain.handle(
    'fs:writeFile',
    async (_event, filePath: string, content: string) => {
      await fsPromises.writeFile(filePath, content, 'utf-8');
    },
  );

  ipcMain.handle(
    'fs:createFile',
    async (_event, filePath: string, content: string) => {
      await fsPromises.writeFile(filePath, content, 'utf-8');
    },
  );

  ipcMain.handle('fs:createDir', async (_event, dirPath: string) => {
    await fsPromises.mkdir(dirPath, { recursive: true });
  });

  ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    await fsPromises.unlink(filePath);
  });

  ipcMain.handle('fs:deleteDir', async (_event, dirPath: string) => {
    await fsPromises.rm(dirPath, { recursive: true, force: true });
  });

  ipcMain.handle(
    'fs:rename',
    async (_event, oldPath: string, newPath: string) => {
      await fsPromises.rename(oldPath, newPath);
    },
  );

  ipcMain.handle('fs:stat', async (_event, filePath: string) => {
    const stat = await fsPromises.stat(filePath);
    return {
      size: stat.size,
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
      mtime: stat.mtimeMs,
      ctime: stat.ctimeMs,
    };
  });

  ipcMain.handle('fs:exists', async (_event, filePath: string) => {
    return fs.existsSync(filePath);
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    'project:scaffold',
    async (_event, parentPath: string, name: string) => {
      const projectPath = path.join(parentPath, name);
      await fsPromises.mkdir(projectPath, { recursive: true });
      await fsPromises.mkdir(path.join(projectPath, 'docs'), {
        recursive: true,
      });

      await fsPromises.writeFile(
        path.join(projectPath, 'info.md'),
        `# ${name}\n\nProject description goes here.\n`,
        'utf-8',
      );
      await fsPromises.writeFile(
        path.join(projectPath, 'calendar.json'),
        '[]',
        'utf-8',
      );
      await fsPromises.writeFile(
        path.join(projectPath, 'todos.json'),
        '[]',
        'utf-8',
      );
      await fsPromises.writeFile(
        path.join(projectPath, 'contacts.json'),
        '[]',
        'utf-8',
      );
      await fsPromises.writeFile(
        path.join(projectPath, 'thoughts.json'),
        '[]',
        'utf-8',
      );

      return projectPath;
    },
  );
}
