import * as path from 'node:path';

export const app = {
  getAppPath: () => path.resolve(process.cwd()),
  getPath: (name: string) => {
    if (name === 'userData') return path.join(process.cwd(), '.test-userdata');
    return process.cwd();
  },
};

export const ipcMain = {
  handle: () => {},
  on: () => {},
};

export const BrowserWindow = class {
  loadURL() {}
  on() {}
  webContents = { send: () => {} };
};
