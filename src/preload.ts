import { contextBridge, ipcRenderer } from "electron";

function onIpc(channel: string, callback: (...args: unknown[]) => void) {
  const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
    callback(...args);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

contextBridge.exposeInMainWorld("nightAPI", {
  app: {
    setActiveProject: (p: string) =>
      ipcRenderer.invoke("app:setActiveProject", p),
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    onFullscreenChanged: (cb: (v: boolean) => void) =>
      onIpc("window:fullscreen-changed", cb as (...a: unknown[]) => void),
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (s: Record<string, unknown>) => ipcRenderer.invoke("settings:set", s),
  },
  ai: {
    thought: (text: string) => ipcRenderer.invoke("ai:thought", text),
    thoughtFollowup: (text: string) =>
      ipcRenderer.invoke("ai:thought-followup", text),
    abort: () => ipcRenderer.invoke("ai:abort"),
    consoleRun: (cmd: string) => ipcRenderer.invoke("ai:console-run", cmd),
    consoleFollowup: (text: string) =>
      ipcRenderer.invoke("ai:console-followup", text),
    consoleAbort: () => ipcRenderer.invoke("ai:console-abort"),
    listSessions: () => ipcRenderer.invoke("ai:sessions-list"),
    resumeSession: (id: string) => ipcRenderer.invoke("ai:session-resume", id),
    hide: () => ipcRenderer.invoke("thoughts:hide"),
    detectProviders: () => ipcRenderer.invoke("ai:detect-providers"),
    getActiveProvider: () => ipcRenderer.invoke("ai:get-active-provider"),
    onMessage: (cb: (msg: unknown) => void) => onIpc("ai:message", cb),
    onProgress: (cb: (msg: unknown) => void) => onIpc("ai:progress", cb),
    onDone: (cb: (result: unknown) => void) => onIpc("ai:done", cb),
    onConsoleMessage: (cb: (msg: unknown) => void) =>
      onIpc("ai:console-message", cb),
    onConsoleProgress: (cb: (msg: unknown) => void) =>
      onIpc("ai:console-progress", cb),
    onConsoleDone: (cb: (result: unknown) => void) =>
      onIpc("ai:console-done", cb),
  },
  fs: {
    readDir: (p: string) => ipcRenderer.invoke("fs:readDir", p),
    readFile: (p: string) => ipcRenderer.invoke("fs:readFile", p),
    writeFile: (p: string, c: string) =>
      ipcRenderer.invoke("fs:writeFile", p, c),
    createFile: (p: string, c: string) =>
      ipcRenderer.invoke("fs:createFile", p, c),
    createDir: (p: string) => ipcRenderer.invoke("fs:createDir", p),
    deleteFile: (p: string) => ipcRenderer.invoke("fs:deleteFile", p),
    deleteDir: (p: string) => ipcRenderer.invoke("fs:deleteDir", p),
    rename: (o: string, n: string) => ipcRenderer.invoke("fs:rename", o, n),
    stat: (p: string) => ipcRenderer.invoke("fs:stat", p),
    exists: (p: string) => ipcRenderer.invoke("fs:exists", p),
    watch: (p: string) => ipcRenderer.invoke("fs:watch", p),
    unwatch: (p: string) => ipcRenderer.invoke("fs:unwatch", p),
    onFileChanged: (cb: (path: string, content: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, p: string, c: string) =>
        cb(p, c);
      ipcRenderer.on("fs:fileChanged", handler);
      return () => {
        ipcRenderer.removeListener("fs:fileChanged", handler);
      };
    },
  },
  dialog: {
    openDirectory: () => ipcRenderer.invoke("dialog:openDirectory"),
  },
  project: {
    scaffold: (p: string, n: string) =>
      ipcRenderer.invoke("project:scaffold", p, n),
  },
});
