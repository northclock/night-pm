import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderOpen } from '@phosphor-icons/react';

export type MediaType = 'image' | 'youtube' | 'embed';

interface MediaInsertDialogProps {
  open: boolean;
  type: MediaType;
  onClose: () => void;
  onInsert: (url: string) => void;
}

const CONFIG: Record<MediaType, { title: string; description: string; placeholder: string; allowFileBrowse: boolean }> = {
  image: {
    title: 'Insert Image',
    description: 'Paste an image URL or browse for a local file.',
    placeholder: 'https://example.com/image.png',
    allowFileBrowse: true,
  },
  youtube: {
    title: 'Insert YouTube Video',
    description: 'Paste a YouTube video URL.',
    placeholder: 'https://www.youtube.com/watch?v=...',
    allowFileBrowse: false,
  },
  embed: {
    title: 'Embed URL',
    description: 'Paste any URL to embed as an iframe.',
    placeholder: 'https://example.com',
    allowFileBrowse: false,
  },
};

const IMAGE_FILTERS = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'] },
  { name: 'All Files', extensions: ['*'] },
];

export function MediaInsertDialog({ open, type, onClose, onInsert }: MediaInsertDialogProps) {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cfg = CONFIG[type];

  useEffect(() => {
    if (open) {
      setUrl('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleInsert = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onInsert(trimmed);
    setUrl('');
    onClose();
  }, [url, onInsert, onClose]);

  const handleBrowseFile = useCallback(async () => {
    const filePath = await window.nightAPI.dialog.openFile(IMAGE_FILTERS);
    if (filePath) {
      setUrl(filePath);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleInsert();
      }
    },
    [handleInsert],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Label htmlFor="media-url" className="text-xs font-medium">
            URL
          </Label>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              id="media-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={cfg.placeholder}
              className="flex-1"
            />
            {cfg.allowFileBrowse && (
              <Button variant="outline" size="icon" className="shrink-0" onClick={handleBrowseFile} title="Browse file">
                <FolderOpen size={16} />
              </Button>
            )}
          </div>
          {url && type === 'image' && (
            <div className="rounded-md border border-border bg-muted/30 p-2 flex items-center justify-center max-h-40 overflow-hidden">
              <img
                src={url.startsWith('/') ? `file://${url}` : url}
                alt="Preview"
                className="max-h-36 object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={!url.trim()}>
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
