import { useState, useEffect, useCallback, useMemo } from 'react';

const CHILD_COLORS = [
  '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

export interface ChildProject<T> {
  name: string;
  path: string;
  color: string;
  items: T[];
  visible: boolean;
}

export interface DisplayItem<T> {
  item: T;
  _color: string;
  _projectName: string;
}

async function scanChildProjectFile<T>(projectDir: string, filename: string): Promise<ChildProject<T>[]> {
  const results: ChildProject<T>[] = [];
  try {
    const entries = await window.nightAPI.fs.readDir(projectDir);
    let colorIdx = 0;
    for (const entry of entries) {
      if (!entry.isDirectory || entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'docs') continue;
      const nipmPath = `${entry.path}/project.nipm`;
      const filePath = `${entry.path}/${filename}`;
      try {
        const nipmExists = await window.nightAPI.fs.exists(nipmPath);
        if (!nipmExists) continue;
        const fileExists = await window.nightAPI.fs.exists(filePath);
        if (!fileExists) continue;
        const raw = await window.nightAPI.fs.readFile(filePath);
        const items: T[] = JSON.parse(raw);
        if (items.length === 0) continue;
        results.push({
          name: entry.name,
          path: entry.path,
          color: CHILD_COLORS[colorIdx % CHILD_COLORS.length],
          items,
          visible: true,
        });
        colorIdx++;
      } catch { /* skip malformed */ }
    }
  } catch { /* skip unreadable */ }
  return results;
}

export function useChildProjectData<T>(filePath: string, filename: string) {
  const [showChildren, setShowChildren] = useState(false);
  const [children, setChildren] = useState<ChildProject<T>[]>([]);
  const [loaded, setLoaded] = useState(false);

  const projectDir = filePath.endsWith(`/${filename}`)
    ? filePath.slice(0, -(filename.length + 1))
    : null;

  useEffect(() => {
    if (!showChildren || !projectDir || loaded) return;
    scanChildProjectFile<T>(projectDir, filename).then((cals) => {
      setChildren(cals);
      setLoaded(true);
    });
  }, [showChildren, projectDir, loaded, filename]);

  useEffect(() => {
    setLoaded(false);
    setChildren([]);
  }, [filePath]);

  const toggleChildren = useCallback(() => {
    setShowChildren((v) => !v);
  }, []);

  const toggleChildVisibility = useCallback((name: string) => {
    setChildren((prev) =>
      prev.map((c) => c.name === name ? { ...c, visible: !c.visible } : c),
    );
  }, []);

  const childDisplayItems: DisplayItem<T>[] = useMemo(() => {
    if (!showChildren) return [];
    return children
      .filter((c) => c.visible)
      .flatMap((c) =>
        c.items.map((item) => ({ item, _color: c.color, _projectName: c.name })),
      );
  }, [showChildren, children]);

  return {
    showChildren,
    toggleChildren,
    children,
    loaded,
    childDisplayItems,
    toggleChildVisibility,
    hasProject: !!projectDir,
  };
}
