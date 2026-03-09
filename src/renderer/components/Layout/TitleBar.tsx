import { logoUrl } from '../../assets';

export function TitleBar() {
  return (
    <div className="title-bar flex items-center h-9 bg-sidebar border-b border-sidebar-border select-none">
      <div className="pl-20 flex-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground tracking-wide">
        <img src={logoUrl} alt="" className="w-4 h-4 opacity-70 dark:invert" draggable={false} />
        Night PM
      </div>
    </div>
  );
}
