import { useState, useEffect } from 'react';
import { FolderOpen, Plus, ArrowsClockwise, GearSix, Crosshair, Terminal, Sun, Moon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '../../store';
import { FileTree } from './FileTree';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onOpenSettings: () => void;
  onOpenConsole: () => void;
}

export function Sidebar({ onOpenSettings, onOpenConsole }: SidebarProps) {
  const rootPath = useAppStore((s) => s.rootPath);
  const setRootPath = useAppStore((s) => s.setRootPath);
  const selectedProjectPath = useAppStore((s) => s.selectedProjectPath);
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);
  const fileTree = useAppStore((s) => s.fileTree);
  const setFileTree = useAppStore((s) => s.setFileTree);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    window.nightAPI.settings.get().then((settings) => {
      if (settings.lastProjectPath && !rootPath) {
        setRootPath(settings.lastProjectPath);
        refreshTree(settings.lastProjectPath);
      }
      if (settings.selectedProjectPath) {
        setSelectedProject(settings.selectedProjectPath);
        window.nightAPI.app.setActiveProject(settings.selectedProjectPath);
      }
    });
  }, []);

  async function handleOpenDirectory() {
    const dirPath = await window.nightAPI.dialog.openDirectory();
    if (dirPath) {
      setRootPath(dirPath);
      await window.nightAPI.settings.set({ lastProjectPath: dirPath });
      await refreshTree(dirPath);
    }
  }

  async function refreshTree(dirPath?: string) {
    const target = dirPath || rootPath;
    if (!target) return;
    try {
      const entries = await window.nightAPI.fs.readDir(target);
      setFileTree(entries);
    } catch (err) {
      console.error('Failed to read directory:', err);
    }
  }

  async function handleNewProject() {
    if (!newProjectName.trim()) return;
    let targetPath = rootPath;
    if (!targetPath) {
      const dirPath = await window.nightAPI.dialog.openDirectory();
      if (!dirPath) return;
      targetPath = dirPath;
      setRootPath(dirPath);
      await window.nightAPI.settings.set({ lastProjectPath: dirPath });
    }
    try {
      const projectPath = await window.nightAPI.project.scaffold(targetPath, newProjectName.trim());
      setSelectedProject(projectPath);
      await window.nightAPI.app.setActiveProject(projectPath);
      setNewProjectName('');
      setShowNewProject(false);
      await refreshTree(targetPath);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  }

  const selectedName = selectedProjectPath?.split('/').pop() ?? null;

  return (
    <div className="h-full bg-sidebar flex flex-col border-r border-sidebar-border">
      <div className="p-3 flex items-center gap-2 border-b border-sidebar-border">
        <span className="text-sm font-semibold text-sidebar-foreground flex-1 truncate">
          {rootPath ? rootPath.split('/').pop() : 'Night PM'}
        </span>
        {rootPath && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refreshTree()} title="Refresh">
            <ArrowsClockwise size={14} />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onOpenConsole} title="AI Console">
          <Terminal size={14} />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onOpenSettings} title="Settings">
          <GearSix size={14} />
        </Button>
      </div>

      {selectedName && (
        <div className="px-3 py-2 border-b border-sidebar-border bg-primary/5 flex items-center gap-2">
          <Crosshair size={12} className="text-primary shrink-0" />
          <span className="text-[11px] text-primary truncate">
            Active: <span className="font-semibold">{selectedName}</span>
          </span>
        </div>
      )}

      <div className="p-2 flex gap-1">
        <Button variant="secondary" size="sm" className="flex-1 text-xs gap-1.5" onClick={handleOpenDirectory}>
          <FolderOpen size={13} />
          Open
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10" onClick={() => setShowNewProject(!showNewProject)}>
          <Plus size={13} />
          New Project
        </Button>
      </div>

      {showNewProject && (
        <div className="px-2 pb-2">
          <div className="flex gap-1">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNewProject()}
              placeholder="Project name..."
              className="h-7 text-xs"
              autoFocus
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleNewProject}>
              Create
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {rootPath ? (
          <FileTree entries={fileTree} depth={0} basePath={rootPath} onRefresh={refreshTree} />
        ) : (
          <div className="p-4 text-xs text-muted-foreground text-center">
            Open a directory to browse projects
          </div>
        )}
      </ScrollArea>

      <div className="px-3 py-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs text-muted-foreground h-7"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={14} weight="duotone" /> : <Moon size={14} weight="duotone" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </Button>
      </div>
    </div>
  );
}
