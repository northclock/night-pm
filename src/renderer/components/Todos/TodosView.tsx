import { useState, useEffect, useCallback } from 'react';
import { Plus, Funnel } from '@phosphor-icons/react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { OpenFile, Todo } from '../../types';
import { TodoItem } from './TodoItem';
import { TodoForm } from './TodoForm';

interface TodosViewProps { file: OpenFile; }
type StatusFilter = 'all' | 'created' | 'blocked' | 'done';

export function TodosView({ file }: TodosViewProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  useEffect(() => {
    try { setTodos(JSON.parse(file.content || '[]')); } catch { setTodos([]); }
  }, [file.content]);

  const saveTodos = useCallback(async (newTodos: Todo[]) => {
    setTodos(newTodos);
    await window.nightAPI.fs.writeFile(file.path, JSON.stringify(newTodos, null, 2));
  }, [file.path]);

  function handleAdd(data: Omit<Todo, 'id' | 'createdOn' | 'updatedOn'>) {
    const now = new Date().toISOString();
    saveTodos([...todos, { ...data, id: uuidv4(), createdOn: now, updatedOn: now }]);
    setShowForm(false);
  }
  function handleUpdate(data: Omit<Todo, 'id' | 'createdOn' | 'updatedOn'>) {
    if (!editingTodo) return;
    saveTodos(todos.map((t) => t.id === editingTodo.id ? { ...t, ...data, updatedOn: new Date().toISOString() } : t));
    setShowForm(false); setEditingTodo(null);
  }
  function handleDelete(id: string) { saveTodos(todos.filter((t) => t.id !== id)); }
  function handleToggleStatus(id: string) {
    const next: Record<string, Todo['status']> = { created: 'done', blocked: 'created', done: 'created' };
    saveTodos(todos.map((t) => t.id !== id ? t : { ...t, status: next[t.status] || 'created', updatedOn: new Date().toISOString() }));
  }

  const filtered = filter === 'all' ? todos : todos.filter((t) => t.status === filter);
  const counts = { all: todos.length, created: todos.filter((t) => t.status === 'created').length, blocked: todos.filter((t) => t.status === 'blocked').length, done: todos.filter((t) => t.status === 'done').length };

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">To-Dos</h2>
        <Button variant="outline" size="sm" className="gap-1.5 text-primary border-primary/30" onClick={() => { setEditingTodo(null); setShowForm(true); }}>
          <Plus size={14} /> Add Task
        </Button>
      </div>
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
          <div className="text-sm text-muted-foreground text-center py-8">{filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}</div>
        ) : filtered.map((todo) => (
          <TodoItem key={todo.id} todo={todo} onToggle={() => handleToggleStatus(todo.id)} onEdit={() => { setEditingTodo(todo); setShowForm(true); }} onDelete={() => handleDelete(todo.id)} />
        ))}
      </div>
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingTodo(null); } }}>
        <DialogContent className="sm:max-w-[420px] p-0">
          <TodoForm todo={editingTodo} onSave={editingTodo ? handleUpdate : handleAdd} onCancel={() => { setShowForm(false); setEditingTodo(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
