import { create } from 'zustand';
import type { OpenFile, DirEntry } from './types';

interface AppState {
  rootPath: string | null;
  selectedProjectPath: string | null;
  projectPaths: string[];
  openFiles: OpenFile[];
  activeFilePath: string | null;
  fileTree: DirEntry[];
  sidebarWidth: number;

  setRootPath: (path: string | null) => void;
  setSelectedProject: (path: string | null) => void;
  setProjectPaths: (paths: string[]) => void;
  setFileTree: (tree: DirEntry[]) => void;
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
  setSidebarWidth: (width: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  rootPath: null,
  selectedProjectPath: null,
  projectPaths: [],
  openFiles: [],
  activeFilePath: null,
  fileTree: [],
  sidebarWidth: 260,

  setRootPath: (path) => set({ rootPath: path }),
  setSelectedProject: (path) => set({ selectedProjectPath: path }),
  setProjectPaths: (paths) => set({ projectPaths: paths }),
  setFileTree: (tree) => set({ fileTree: tree }),

  openFile: (file) =>
    set((state) => {
      const existing = state.openFiles.find((f) => f.path === file.path);
      if (existing) {
        return { activeFilePath: file.path };
      }
      return {
        openFiles: [...state.openFiles, file],
        activeFilePath: file.path,
      };
    }),

  closeFile: (filePath) =>
    set((state) => {
      const newFiles = state.openFiles.filter((f) => f.path !== filePath);
      let newActive = state.activeFilePath;
      if (state.activeFilePath === filePath) {
        const idx = state.openFiles.findIndex((f) => f.path === filePath);
        newActive = newFiles[Math.min(idx, newFiles.length - 1)]?.path ?? null;
      }
      return { openFiles: newFiles, activeFilePath: newActive };
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFileContent: (filePath, content) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === filePath ? { ...f, content } : f,
      ),
    })),

  setSidebarWidth: (width) => set({ sidebarWidth: width }),
}));
