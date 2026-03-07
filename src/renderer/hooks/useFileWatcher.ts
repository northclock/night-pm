import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';

export function useFileWatcher() {
  const openFiles = useAppStore((s) => s.openFiles);
  const updateFileContent = useAppStore((s) => s.updateFileContent);
  const watchedPaths = useRef(new Set<string>());

  useEffect(() => {
    const cleanup = window.nightAPI.fs.onFileChanged(
      (filePath: string, content: string) => {
        updateFileContent(filePath, content);
      },
    );
    return cleanup;
  }, [updateFileContent]);

  useEffect(() => {
    const currentPaths = new Set(openFiles.map((f) => f.path));

    for (const p of currentPaths) {
      if (!watchedPaths.current.has(p)) {
        window.nightAPI.fs.watch(p);
        watchedPaths.current.add(p);
      }
    }

    for (const p of watchedPaths.current) {
      if (!currentPaths.has(p)) {
        window.nightAPI.fs.unwatch(p);
        watchedPaths.current.delete(p);
      }
    }
  }, [openFiles]);

  useEffect(() => {
    return () => {
      for (const p of watchedPaths.current) {
        window.nightAPI.fs.unwatch(p);
      }
      watchedPaths.current.clear();
    };
  }, []);
}
