import { useState, useCallback } from 'react';
import {
  CaretRight,
  CaretDown,
  File,
  Folder,
  FolderOpen,
  CalendarBlank,
  CheckSquare,
  Users,
  Brain,
  FileText,
  Crosshair,
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAppStore } from '../../store';
import { cn } from '@/lib/utils';
import type { DirEntry } from '../../types';

const SPECIAL_ICONS: Record<string, React.ReactNode> = {
  'calendar.json': <CalendarBlank size={14} className="text-night-peach" weight="duotone" />,
  'todos.json': <CheckSquare size={14} className="text-night-green" weight="duotone" />,
  'contacts.json': <Users size={14} className="text-primary" weight="duotone" />,
  'thoughts.json': <Brain size={14} className="text-night-accent2" weight="duotone" />,
};

function getFileIcon(name: string) {
  if (SPECIAL_ICONS[name]) return SPECIAL_ICONS[name];
  if (name.endsWith('.md')) return <FileText size={14} className="text-muted-foreground" />;
  return <File size={14} className="text-muted-foreground" />;
}

interface FileTreeProps {
  entries: DirEntry[];
  depth: number;
  basePath: string;
  onRefresh: () => void;
}

export function FileTree({ entries, depth, basePath, onRefresh }: FileTreeProps) {
  return (
    <div>
      {entries.map((entry) => (
        <FileTreeItem key={entry.path} entry={entry} depth={depth} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

interface FileTreeItemProps {
  entry: DirEntry;
  depth: number;
  onRefresh: () => void;
}

function FileTreeItem({ entry, depth, onRefresh }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirEntry[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [renameTo, setRenameTo] = useState(entry.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const openFile = useAppStore((s) => s.openFile);
  const activeFilePath = useAppStore((s) => s.activeFilePath);
  const selectedProjectPath = useAppStore((s) => s.selectedProjectPath);
  const setSelectedProject = useAppStore((s) => s.setSelectedProject);

  const isSelectedProject = entry.isDirectory && entry.path === selectedProjectPath;

  const toggleExpand = useCallback(async () => {
    if (!entry.isDirectory) return;
    if (!expanded) {
      try {
        const entries = await window.nightAPI.fs.readDir(entry.path);
        setChildren(entries);
      } catch (err) {
        console.error('Failed to read dir:', err);
      }
    }
    setExpanded(!expanded);
  }, [entry, expanded]);

  async function handleClick() {
    if (entry.isDirectory) {
      await toggleExpand();
    } else {
      try {
        const content = await window.nightAPI.fs.readFile(entry.path);
        openFile({ path: entry.path, name: entry.name, content });
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    }
  }

  async function handleDoubleClick() {
    if (entry.isDirectory) {
      setSelectedProject(entry.path);
      await window.nightAPI.app.setActiveProject(entry.path);
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  }

  async function handleDelete() {
    setMenuOpen(false);
    if (entry.isDirectory) await window.nightAPI.fs.deleteDir(entry.path);
    else await window.nightAPI.fs.deleteFile(entry.path);
    onRefresh();
  }

  async function handleRename() {
    if (!renameTo.trim() || renameTo === entry.name) { setRenaming(false); return; }
    const parentDir = entry.path.substring(0, entry.path.lastIndexOf('/'));
    try {
      await window.nightAPI.fs.rename(entry.path, `${parentDir}/${renameTo}`);
      setRenaming(false);
      onRefresh();
    } catch (err) { console.error('Failed to rename:', err); }
  }

  async function handleNewFile() {
    setMenuOpen(false);
    if (!entry.isDirectory) return;
    const fileName = prompt('File name:');
    if (!fileName) return;
    await window.nightAPI.fs.createFile(`${entry.path}/${fileName}`, '');
    if (!expanded) await toggleExpand();
    else setChildren(await window.nightAPI.fs.readDir(entry.path));
  }

  async function handleNewFolder() {
    setMenuOpen(false);
    if (!entry.isDirectory) return;
    const folderName = prompt('Folder name:');
    if (!folderName) return;
    await window.nightAPI.fs.createDir(`${entry.path}/${folderName}`);
    if (!expanded) await toggleExpand();
    else setChildren(await window.nightAPI.fs.readDir(entry.path));
  }

  const isActive = activeFilePath === entry.path;
  const paddingLeft = 12 + depth * 16;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-0.5 pr-2 cursor-pointer select-none text-[13px] hover:bg-accent/50',
          isSelectedProject && 'bg-primary/10 text-primary border-l-2 border-l-primary',
          !isSelectedProject && isActive && 'bg-accent text-accent-foreground',
          !isSelectedProject && !isActive && 'text-muted-foreground',
        )}
        style={{ paddingLeft: isSelectedProject ? paddingLeft - 2 : paddingLeft }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {entry.isDirectory ? (
          <>
            {expanded ? <CaretDown size={14} className="shrink-0" /> : <CaretRight size={14} className="shrink-0" />}
            {isSelectedProject ? (
              <Crosshair size={14} className="text-primary shrink-0" weight="bold" />
            ) : expanded ? (
              <FolderOpen size={14} className="text-night-yellow shrink-0" weight="duotone" />
            ) : (
              <Folder size={14} className="text-night-yellow shrink-0" weight="duotone" />
            )}
          </>
        ) : (
          <>
            <span className="w-[14px] shrink-0" />
            {getFileIcon(entry.name)}
          </>
        )}
        {renaming ? (
          <Input
            value={renameTo}
            onChange={(e) => setRenameTo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
            onBlur={handleRename}
            className="h-5 text-xs flex-1 px-1"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={cn('truncate', isSelectedProject && 'font-semibold')}>{entry.name}</span>
        )}
      </div>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger className="hidden" />
        <DropdownMenuContent
          className="min-w-[170px]"
          style={{ position: 'fixed', left: menuPos.x, top: menuPos.y }}
        >
          {entry.isDirectory && !isSelectedProject && (
            <>
              <DropdownMenuItem onClick={() => { setMenuOpen(false); setSelectedProject(entry.path); window.nightAPI.app.setActiveProject(entry.path); }}>
                <Crosshair size={14} className="mr-2" /> Set as Active Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {entry.isDirectory && (
            <>
              <DropdownMenuItem onClick={handleNewFile}>New File</DropdownMenuItem>
              <DropdownMenuItem onClick={handleNewFolder}>New Folder</DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => { setMenuOpen(false); setRenaming(true); setRenameTo(entry.name); }}>Rename</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {expanded && children.length > 0 && (
        <FileTree entries={children} depth={depth + 1} basePath={entry.path} onRefresh={onRefresh} />
      )}
    </div>
  );
}
