import { ScrollArea } from '@/components/ui/scroll-area';
import type { OpenFile } from '../../types';

interface PlainTextViewerProps { file: OpenFile; }

export function PlainTextViewer({ file }: PlainTextViewerProps) {
  return (
    <ScrollArea className="h-full">
      <pre className="text-sm text-foreground font-mono whitespace-pre-wrap p-4">
        {file.content ?? ''}
      </pre>
    </ScrollArea>
  );
}
