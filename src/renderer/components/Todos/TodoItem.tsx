import { Circle, CheckCircle, WarningCircle, PencilSimple, Trash } from '@phosphor-icons/react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import type { Todo } from '../../types';

interface TodoItemProps {
  todo: Todo;
  onToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  accentColor?: string;
  projectName?: string;
}

const STATUS_CONFIG = {
  created: { icon: Circle, color: 'text-primary', bg: 'bg-primary/10', label: 'To Do' },
  blocked: { icon: WarningCircle, color: 'text-night-yellow', bg: 'bg-night-yellow/10', label: 'Blocked' },
  done: { icon: CheckCircle, color: 'text-night-green', bg: 'bg-night-green/10', label: 'Done' },
};

export function TodoItem({ todo, onToggle, onEdit, onDelete, accentColor, projectName }: TodoItemProps) {
  const config = STATUS_CONFIG[todo.status];
  const Icon = config.icon;

  return (
    <div
      className={`group flex items-start gap-3 p-3 rounded-lg hover:brightness-110 transition-all ${accentColor ? '' : config.bg}`}
      style={accentColor ? { backgroundColor: `${accentColor}10`, borderLeft: `3px solid ${accentColor}` } : undefined}
    >
      <button onClick={onToggle} className={`mt-0.5 ${config.color}`} disabled={!onToggle}>
        <Icon size={18} weight="duotone" />
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${todo.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {projectName && <span className="text-[11px] font-semibold mr-1.5" style={{ color: accentColor }}>{projectName}:</span>}
          {todo.title}
        </div>
        {todo.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{todo.description}</div>}
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
          {todo.dueDate && <span>Due: {format(parseISO(todo.dueDate), 'MMM d, yyyy')}</span>}
          <span>Created: {format(parseISO(todo.createdOn), 'MMM d, yyyy')}</span>
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}><PencilSimple size={13} /></Button>}
          {onDelete && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}><Trash size={13} /></Button>}
        </div>
      )}
    </div>
  );
}
