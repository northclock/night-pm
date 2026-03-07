import { X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '../../store';
import { cn } from '@/lib/utils';

export function TabBar() {
  const openFiles = useAppStore((s) => s.openFiles);
  const activeFilePath = useAppStore((s) => s.activeFilePath);
  const setActiveFile = useAppStore((s) => s.setActiveFile);
  const closeFile = useAppStore((s) => s.closeFile);

  return (
    <div className="flex bg-sidebar border-b border-border overflow-x-auto">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        return (
          <div
            key={file.path}
            className={cn(
              'group flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r border-border select-none shrink-0 border-t-2',
              isActive
                ? 'bg-background text-foreground border-t-primary'
                : 'bg-sidebar text-muted-foreground hover:bg-secondary/50 border-t-transparent',
            )}
            onClick={() => setActiveFile(file.path)}
          >
            <span className="truncate max-w-[150px]">{file.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
            >
              <X size={12} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
