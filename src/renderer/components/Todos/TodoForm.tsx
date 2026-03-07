import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Todo } from '../../types';

interface TodoFormProps {
  todo?: Todo | null;
  onSave: (data: Omit<Todo, 'id' | 'createdOn' | 'updatedOn'>) => void;
  onCancel: () => void;
}

export function TodoForm({ todo, onSave, onCancel }: TodoFormProps) {
  const [title, setTitle] = useState(todo?.title ?? '');
  const [description, setDescription] = useState(todo?.description ?? '');
  const [dueDate, setDueDate] = useState(todo?.dueDate ? todo.dueDate.substring(0, 10) : '');
  const [status, setStatus] = useState<Todo['status']>(todo?.status ?? 'created');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: description.trim(), dueDate: dueDate || '', status });
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">{todo ? 'Edit Task' : 'New Task'}</h3>
      <div className="space-y-1.5">
        <Label htmlFor="todo-title">Title</Label>
        <Input id="todo-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="todo-desc">Description</Label>
        <Textarea id="todo-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Due Date</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as Todo['status'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created">To Do</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">{todo ? 'Update' : 'Create'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
