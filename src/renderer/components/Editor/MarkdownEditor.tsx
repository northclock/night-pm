import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import TurndownService from 'turndown';
import {
  TextB, TextItalic, TextHOne, TextHTwo, TextHThree,
  ListBullets, ListNumbers, Code, Quotes, Minus, ArrowCounterClockwise, ArrowClockwise, FloppyDisk,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { OpenFile } from '../../types';
import { useAppStore } from '../../store';

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
function markdownToHtml(md: string): string { return marked.parse(md, { async: false }) as string; }
function htmlToMarkdown(html: string): string { return turndown.turndown(html); }
function isHtml(content: string): boolean { return content.trimStart().startsWith('<'); }

interface MarkdownEditorProps { file: OpenFile; }

export function MarkdownEditor({ file }: MarkdownEditorProps) {
  const updateFileContent = useAppStore((s) => s.updateFileContent);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [ready, setReady] = useState(false);
  const suppressFileWatch = useRef(false);

  const initialHtml = file.content && !isHtml(file.content) ? markdownToHtml(file.content) : (file.content ?? '');

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none p-6 min-h-full outline-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-code:text-primary prose-a:text-primary',
      },
    },
    onCreate: () => setReady(true),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      updateFileContent(file.path, html);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => { saveAsMarkdown(file.path, html); }, 2000);
    },
  });

  useEffect(() => {
    if (editor && file.content !== undefined) {
      if (suppressFileWatch.current) { suppressFileWatch.current = false; return; }
      const html = isHtml(file.content) ? file.content : markdownToHtml(file.content);
      if (html !== editor.getHTML()) editor.commands.setContent(html);
    }
  }, [file.path, file.content]);

  useEffect(() => { return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }; }, []);

  const saveAsMarkdown = useCallback(async (filePath: string, html: string) => {
    try { suppressFileWatch.current = true; await window.nightAPI.fs.writeFile(filePath, htmlToMarkdown(html)); } catch (err) { console.error('Failed to save:', err); }
  }, []);

  const handleManualSave = useCallback(() => {
    if (editor) { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); saveAsMarkdown(file.path, editor.getHTML()); }
  }, [editor, file.path, saveAsMarkdown]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleManualSave(); } }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleManualSave]);

  if (!editor || !ready) return null;

  const tools: { icon: React.ElementType; action: () => void; active?: boolean; label: string }[] = [
    { icon: TextB, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), label: 'Bold' },
    { icon: TextItalic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), label: 'Italic' },
    { icon: TextHOne, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), label: 'Heading 1' },
    { icon: TextHTwo, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), label: 'Heading 2' },
    { icon: TextHThree, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }), label: 'Heading 3' },
    { icon: ListBullets, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), label: 'Bullet List' },
    { icon: ListNumbers, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), label: 'Ordered List' },
    { icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock'), label: 'Code Block' },
    { icon: Quotes, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), label: 'Blockquote' },
    { icon: Minus, action: () => editor.chain().focus().setHorizontalRule().run(), label: 'Horizontal Rule' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-sidebar overflow-x-auto">
        {tools.map((t, i) => (
          <span key={t.label}>
            {(i === 2 || i === 5 || i === 9) && <Separator orientation="vertical" className="h-4 mx-1" />}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={cn('h-7 w-7', t.active && 'bg-primary/20 text-primary')} onClick={t.action}>
                  <t.icon size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{t.label}</TooltipContent>
            </Tooltip>
          </span>
        ))}
        <Separator orientation="vertical" className="h-4 mx-1" />
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor.chain().focus().undo().run()}><ArrowCounterClockwise size={14} /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Undo</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor.chain().focus().redo().run()}><ArrowClockwise size={14} /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Redo</TooltipContent></Tooltip>
        <div className="flex-1" />
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleManualSave}><FloppyDisk size={14} /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Save</TooltipContent></Tooltip>
      </div>
      <div className="flex-1 overflow-y-auto bg-background">
        <EditorContent editor={editor} className="min-h-full" />
      </div>
    </div>
  );
}
