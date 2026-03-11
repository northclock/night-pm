import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TextB, TextItalic, TextStrikethrough, TextUnderline,
  TextHOne, TextHTwo, TextHThree,
  ListBullets, ListNumbers, ListChecks, Code, Quotes, Minus,
  ArrowCounterClockwise, ArrowClockwise, FloppyDisk, ChatCircle,
  Table as TableIcon, Image as ImageIcon, TextAlignLeft, TextAlignCenter,
  TextAlignRight, Highlighter, YoutubeLogo,
  MathOperations, CaretRight,
} from '@phosphor-icons/react';
import { Allotment } from 'allotment';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { OpenFile } from '../../types';
import { useAppStore } from '../../store';
import { DocChatPanel } from './DocChatPanel';
import { SlashCommandMenu } from './SlashCommandMenu';
import { EditorBubbleMenu } from './EditorBubbleMenu';

import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import ImageExt from '@tiptap/extension-image';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import Youtube from '@tiptap/extension-youtube';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import Focus from '@tiptap/extension-focus';
import Mathematics from '@tiptap/extension-mathematics';
import 'katex/dist/katex.min.css';

const lowlight = createLowlight(common);

interface MarkdownEditorProps { file: OpenFile; }

export function MarkdownEditor({ file }: MarkdownEditorProps) {
  const updateFileContent = useAppStore((s) => s.updateFileContent);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [ready, setReady] = useState(false);
  const suppressFileWatch = useRef(false);
  const [showChat, setShowChat] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Markdown,
      TableKit.configure({ table: { resizable: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      ImageExt.configure({ inline: false, allowBase64: true }),
      Details,
      DetailsContent,
      DetailsSummary,
      Youtube.configure({ inline: false }),
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return 'Heading';
          return "Type '/' for commands...";
        },
      }),
      CharacterCount,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      Focus.configure({ className: 'has-focus', mode: 'deepest' }),
      Mathematics,
    ],
    content: file.content ?? '',
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: 'tiptap-editor max-w-none p-6 min-h-full outline-none',
      },
    },
    onCreate: () => setReady(true),
    onUpdate: ({ editor }) => {
      const md = editor.getMarkdown();
      updateFileContent(file.path, md);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => { saveMarkdown(file.path, md); }, 2000);
    },
  });

  useEffect(() => {
    if (editor && file.content !== undefined) {
      if (suppressFileWatch.current) { suppressFileWatch.current = false; return; }
      const currentMd = editor.getMarkdown();
      if (file.content !== currentMd) {
        editor.commands.setContent(file.content, { contentType: 'markdown' });
      }
    }
  }, [file.path, file.content]);

  useEffect(() => { return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }; }, []);

  const saveMarkdown = useCallback(async (filePath: string, md: string) => {
    try { suppressFileWatch.current = true; await window.nightAPI.fs.writeFile(filePath, md); } catch (err) { console.error('Failed to save:', err); }
  }, []);

  const handleManualSave = useCallback(() => {
    if (editor) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveMarkdown(file.path, editor.getMarkdown());
    }
  }, [editor, file.path, saveMarkdown]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleManualSave(); } }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleManualSave]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertImage = useCallback(() => {
    const url = window.prompt('Image URL');
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const insertYoutube = useCallback(() => {
    const url = window.prompt('YouTube URL');
    if (url) editor?.chain().focus().setYoutubeVideo({ src: url }).run();
  }, [editor]);

  const insertMath = useCallback(() => {
    editor?.chain().focus().insertContent({ type: 'mathematics', attrs: { latex: 'E = mc^2' } }).run();
  }, [editor]);

  if (!editor || !ready) return null;

  const charCount = editor.storage.characterCount;

  const tools: { icon: React.ElementType; action: () => void; active?: boolean; label: string }[] = [
    { icon: TextB, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), label: 'Bold' },
    { icon: TextItalic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), label: 'Italic' },
    { icon: TextUnderline, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), label: 'Underline' },
    { icon: TextStrikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), label: 'Strikethrough' },
    { icon: Highlighter, action: () => editor.chain().focus().toggleHighlight().run(), active: editor.isActive('highlight'), label: 'Highlight' },
  ];

  const headingTools: { icon: React.ElementType; action: () => void; active?: boolean; label: string }[] = [
    { icon: TextHOne, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), label: 'Heading 1' },
    { icon: TextHTwo, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), label: 'Heading 2' },
    { icon: TextHThree, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }), label: 'Heading 3' },
  ];

  const listTools: { icon: React.ElementType; action: () => void; active?: boolean; label: string }[] = [
    { icon: ListBullets, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), label: 'Bullet List' },
    { icon: ListNumbers, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), label: 'Ordered List' },
    { icon: ListChecks, action: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive('taskList'), label: 'Task List' },
  ];

  const blockTools: { icon: React.ElementType; action: () => void; active?: boolean; label: string }[] = [
    { icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock'), label: 'Code Block' },
    { icon: Quotes, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), label: 'Blockquote' },
    { icon: Minus, action: () => editor.chain().focus().setHorizontalRule().run(), label: 'Horizontal Rule' },
    { icon: TableIcon, action: insertTable, label: 'Insert Table' },
    { icon: ImageIcon, action: insertImage, label: 'Insert Image' },
    { icon: YoutubeLogo, action: insertYoutube, label: 'YouTube Video' },
    { icon: MathOperations, action: insertMath, label: 'Math Formula' },
    { icon: CaretRight, action: () => editor.chain().focus().setDetails().run(), label: 'Collapsible Section' },
  ];

  const alignTools: { icon: React.ElementType; action: () => void; active?: boolean; label: string }[] = [
    { icon: TextAlignLeft, action: () => editor.chain().focus().setTextAlign('left').run(), active: editor.isActive({ textAlign: 'left' }), label: 'Align Left' },
    { icon: TextAlignCenter, action: () => editor.chain().focus().setTextAlign('center').run(), active: editor.isActive({ textAlign: 'center' }), label: 'Align Center' },
    { icon: TextAlignRight, action: () => editor.chain().focus().setTextAlign('right').run(), active: editor.isActive({ textAlign: 'right' }), label: 'Align Right' },
  ];

  function renderToolGroup(group: typeof tools) {
    return group.map((t) => (
      <Tooltip key={t.label}>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className={cn('h-7 w-7', t.active && 'bg-primary/20 text-primary')} onClick={t.action}>
            <t.icon size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{t.label}</TooltipContent>
      </Tooltip>
    ));
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-sidebar overflow-x-auto">
        {renderToolGroup(tools)}
        <Separator orientation="vertical" className="h-4 mx-1" />
        {renderToolGroup(headingTools)}
        <Separator orientation="vertical" className="h-4 mx-1" />
        {renderToolGroup(listTools)}
        <Separator orientation="vertical" className="h-4 mx-1" />
        {renderToolGroup(blockTools)}
        <Separator orientation="vertical" className="h-4 mx-1" />
        {renderToolGroup(alignTools)}
        <Separator orientation="vertical" className="h-4 mx-1" />
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor.chain().focus().undo().run()}><ArrowCounterClockwise size={14} /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Undo</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor.chain().focus().redo().run()}><ArrowClockwise size={14} /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Redo</TooltipContent></Tooltip>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground tabular-nums mr-2">
          {charCount.characters()} chars &middot; {charCount.words()} words
        </span>
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={cn('h-7 w-7', showChat && 'bg-primary/20 text-primary')} onClick={() => setShowChat(!showChat)}><ChatCircle size={14} /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">AI Chat</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleManualSave}><FloppyDisk size={14} /></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Save</TooltipContent></Tooltip>
      </div>
      <div className="flex-1 overflow-hidden">
        <Allotment>
          <Allotment.Pane>
            <div className="h-full overflow-y-auto bg-background">
              <EditorBubbleMenu editor={editor} />
              <SlashCommandMenu editor={editor} />
              <EditorContent editor={editor} className="min-h-full" />
            </div>
          </Allotment.Pane>
          {showChat && (
            <Allotment.Pane preferredSize={340} minSize={240} maxSize={600}>
              <DocChatPanel filePath={file.path} onClose={() => setShowChat(false)} />
            </Allotment.Pane>
          )}
        </Allotment>
      </div>
    </div>
  );
}
