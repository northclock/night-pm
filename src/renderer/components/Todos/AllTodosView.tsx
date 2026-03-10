import { useState, useEffect, useMemo } from 'react';
import { X, CheckSquare, Funnel, Eye, EyeSlash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAppStore } from '../../store';
import { TodoItem } from './TodoItem';
import type { Todo } from '../../types';

interface Props {
  onClose: () => void;
}

const PROJECT_COLORS = [
  '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

interface ProjectTodos {
  name: string;
  path: string;
  color: string;
  todos: Todo[];
  visible: boolean;
}

type StatusFilter = 'all' | 'created' | 'blocked' | 'done';

export function AllTodosView({ onClose }: Props) {
  const rootPath = useAppStore((s) => s.rootPath);
  const [projects, setProjects] = useState<ProjectTodos[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (!rootPath) { setLoading(false); return; }
    scanAllTodos(rootPath).then((p) => { setProjects(p); setLoading(false); });
  }, [rootPath]);

  async function scanAllTodos(dir: string): Promise<ProjectTodos[]> {
    const results: ProjectTodos[] = [];
    let colorIdx = 0;

    async function recurse(d: string): Promise<void> {
      let entries: Awaited<ReturnType<typeof window.nightAPI.fs.readDir>>;
      try {
        entries = await window.nightAPI.fs.readDir(d);
      } catch { return; }

      let isProject = false;
      let projectName = d.split('/').pop() || 'Unknown';

      for (const entry of entries) {
        if (entry.isFile && entry.name === 'project.nipm') {
          isProject = true;
          try {
            const raw = await window.nightAPI.fs.readFile(entry.path);
            const data = JSON.parse(raw);
            if (data.name) projectName = data.name;
          } catch { /* use folder name */ }
        }
      }

      if (isProject) {
        for (const entry of entries) {
          if (entry.isFile && entry.name === 'todos.json') {
            try {
              const raw = await window.nightAPI.fs.readFile(entry.path);
              const todos: Todo[] = JSON.parse(raw);
              if (todos.length > 0) {
                results.push({
                  name: projectName,
                  path: d,
                  color: PROJECT_COLORS[colorIdx % PROJECT_COLORS.length],
                  todos,
                  visible: true,
                });
                colorIdx++;
              }
            } catch { /* skip malformed */ }
          }
        }
      }

      for (const entry of entries) {
        if (entry.isDirectory && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await recurse(entry.path);
        }
      }
    }

    await recurse(dir);
    return results;
  }

  function toggleProject(name: string) {
    setProjects((prev) =>
      prev.map((p) => p.name === name ? { ...p, visible: !p.visible } : p),
    );
  }

  const allTodos = useMemo(() =>
    projects
      .filter((p) => p.visible)
      .flatMap((p) => p.todos.map((t) => ({ todo: t, color: p.color, projectName: p.name }))),
    [projects],
  );

  const filtered = filter === 'all' ? allTodos : allTodos.filter((t) => t.todo.status === filter);
  const counts = {
    all: allTodos.length,
    created: allTodos.filter((t) => t.todo.status === 'created').length,
    blocked: allTodos.filter((t) => t.todo.status === 'blocked').length,
    done: allTodos.filter((t) => t.todo.status === 'done').length,
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <CheckSquare size={18} className="text-primary" weight="duotone" />
          <h2 className="text-sm font-semibold text-foreground">All To-Dos</h2>
          <span className="text-xs text-muted-foreground">{allTodos.length} task{allTodos.length !== 1 ? 's' : ''} across {projects.filter((p) => p.visible).length} project{projects.filter((p) => p.visible).length !== 1 ? 's' : ''}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading todos...</div>
      ) : (
        <div className="flex-1 flex flex-col p-4 overflow-auto">
          {projects.length > 0 && (
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className="text-[11px] text-muted-foreground font-medium">Projects:</span>
              {projects.map((p) => (
                <button
                  key={p.name}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] transition-all border',
                    p.visible ? 'border-transparent' : 'border-border opacity-40',
                  )}
                  style={p.visible ? { backgroundColor: `${p.color}20`, color: p.color } : undefined}
                  onClick={() => toggleProject(p.name)}
                  title={p.visible ? `Hide ${p.name}` : `Show ${p.name}`}
                >
                  {p.visible ? <Eye size={12} /> : <EyeSlash size={12} />}
                  {p.name}
                  <span className="text-[10px] opacity-70">({p.todos.length})</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1 mb-4">
            {(['all', 'created', 'blocked', 'done'] as const).map((s) => (
              <Badge key={s} variant={filter === s ? 'default' : 'secondary'} className={cn('cursor-pointer gap-1.5', filter === s && 'bg-primary')} onClick={() => setFilter(s)}>
                <Funnel size={12} /> {s.charAt(0).toUpperCase() + s.slice(1)}
                <span className="ml-1 text-[10px] opacity-60">{counts[s]}</span>
              </Badge>
            ))}
          </div>

          <div className="space-y-1">
            {filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {filter === 'all' ? 'No tasks found across projects' : `No ${filter} tasks`}
              </div>
            ) : filtered.map((t) => (
              <TodoItem
                key={`${t.projectName}-${t.todo.id}`}
                todo={t.todo}
                accentColor={t.color}
                projectName={t.projectName}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
