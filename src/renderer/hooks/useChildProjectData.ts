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
  let colorIdx = 0;

  async function recurse(dir: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof window.nightAPI.fs.readDir>>;
    try {
      entries = await window.nightAPI.fs.readDir(dir);
    } catch { return; }

    for (const entry of entries) {
      if (!entry.isDirectory || entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const nipmPath = `${entry.path}/project.nipm`;
      let isProject = false;
      let projectName = entry.name;

      try {
        const nipmExists = await window.nightAPI.fs.exists(nipmPath);
        if (nipmExists) {
          isProject = true;
          try {
            const nipmRaw = await window.nightAPI.fs.readFile(nipmPath);
            const nipmData = JSON.parse(nipmRaw);
            if (nipmData.name) projectName = nipmData.name;
          } catch { /* use folder name */ }
        }
      } catch { /* not a project */ }

      if (isProject) {
        const filePath = `${entry.path}/${filename}`;
        try {
          const fileExists = await window.nightAPI.fs.exists(filePath);
          if (fileExists) {
            const raw = await window.nightAPI.fs.readFile(filePath);
            const items: T[] = JSON.parse(raw);
            if (items.length > 0) {
              results.push({
                name: projectName,
                path: entry.path,
                color: CHILD_COLORS[colorIdx % CHILD_COLORS.length],
                items,
                visible: true,
              });
              colorIdx++;
            }
          }
        } catch { /* skip malformed */ }
      } else {
        await recurse(entry.path);
      }
    }
  }

  await recurse(projectDir);
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
