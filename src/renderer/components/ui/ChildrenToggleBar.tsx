import { UsersThree, Eye, EyeSlash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChildProject } from '../../hooks/useChildProjectData';

interface ChildrenToggleBarProps<T> {
  showChildren: boolean;
  onToggle: () => void;
  children: ChildProject<T>[];
  loaded: boolean;
  hasProject: boolean;
  onToggleChild: (name: string) => void;
}

export function ChildrenToggleButton<T>({
  showChildren,
  onToggle,
  hasProject,
}: Pick<ChildrenToggleBarProps<T>, 'showChildren' | 'onToggle' | 'hasProject'>) {
  if (!hasProject) return null;
  return (
    <Button
      variant={showChildren ? 'default' : 'outline'}
      size="sm"
      className={cn('gap-1.5 text-xs', showChildren ? '' : 'text-muted-foreground')}
      onClick={onToggle}
      title="Show data from child projects"
    >
      <UsersThree size={14} />
      Children
    </Button>
  );
}

export function ChildrenLegend<T>({
  showChildren,
  children: childProjects,
  loaded,
  onToggleChild,
}: Pick<ChildrenToggleBarProps<T>, 'showChildren' | 'children' | 'loaded' | 'onToggleChild'>) {
  if (!showChildren) return null;

  if (!loaded) {
    return <p className="text-[11px] text-muted-foreground mb-2">Loading child data...</p>;
  }
  if (childProjects.length === 0) {
    return <p className="text-[11px] text-muted-foreground mb-2">No child projects found.</p>;
  }

  return (
    <div className="flex items-center gap-3 mb-3 flex-wrap">
      <span className="text-[11px] text-muted-foreground font-medium">Sub-projects:</span>
      {childProjects.map((c) => (
        <button
          key={c.name}
          className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] transition-all border',
            c.visible ? 'border-transparent' : 'border-border opacity-40',
          )}
          style={c.visible ? { backgroundColor: `${c.color}20`, color: c.color } : undefined}
          onClick={() => onToggleChild(c.name)}
          title={c.visible ? `Hide ${c.name}` : `Show ${c.name}`}
        >
          {c.visible ? <Eye size={12} /> : <EyeSlash size={12} />}
          {c.name}
          <span className="text-[10px] opacity-70">({c.items.length})</span>
        </button>
      ))}
    </div>
  );
}
