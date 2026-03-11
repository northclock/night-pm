import { useState, useEffect, useCallback, useRef } from 'react';
import { FloatingMenu, type Editor } from '@tiptap/react';
import {
  TextHOne, TextHTwo, TextHThree,
  ListBullets, ListNumbers, ListChecks,
  Code, Quotes, Minus, Table, Image, YoutubeLogo,
  MathOperations, CaretRight, Paragraph,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface CommandItem {
  title: string;
  description: string;
  icon: React.ElementType;
  category: string;
  action: (editor: Editor) => void;
}

const COMMANDS: CommandItem[] = [
  {
    title: 'Text', description: 'Plain paragraph text', icon: Paragraph, category: 'Basic',
    action: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    title: 'Heading 1', description: 'Large section heading', icon: TextHOne, category: 'Basic',
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2', description: 'Medium section heading', icon: TextHTwo, category: 'Basic',
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3', description: 'Small section heading', icon: TextHThree, category: 'Basic',
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet List', description: 'Unordered list of items', icon: ListBullets, category: 'Lists',
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Numbered List', description: 'Ordered list of items', icon: ListNumbers, category: 'Lists',
    action: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    title: 'Task List', description: 'List with checkboxes', icon: ListChecks, category: 'Lists',
    action: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    title: 'Code Block', description: 'Syntax-highlighted code', icon: Code, category: 'Advanced',
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Blockquote', description: 'Quoted text block', icon: Quotes, category: 'Advanced',
    action: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    title: 'Divider', description: 'Horizontal separator', icon: Minus, category: 'Advanced',
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    title: 'Table', description: '3x3 table with header', icon: Table, category: 'Advanced',
    action: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Image', description: 'Embed an image from URL', icon: Image, category: 'Media',
    action: (e) => {
      const url = window.prompt('Image URL');
      if (url) e.chain().focus().setImage({ src: url }).run();
    },
  },
  {
    title: 'YouTube', description: 'Embed a YouTube video', icon: YoutubeLogo, category: 'Media',
    action: (e) => {
      const url = window.prompt('YouTube URL');
      if (url) e.chain().focus().setYoutubeVideo({ src: url }).run();
    },
  },
  {
    title: 'Math', description: 'LaTeX math formula', icon: MathOperations, category: 'Advanced',
    action: (e) => e.chain().focus().insertContent({ type: 'mathematics', attrs: { latex: 'E = mc^2' } }).run(),
  },
  {
    title: 'Toggle', description: 'Collapsible section', icon: CaretRight, category: 'Advanced',
    action: (e) => e.chain().focus().setDetails().run(),
  },
];

interface SlashCommandMenuProps {
  editor: Editor;
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = COMMANDS.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase()),
  );

  const categories = [...new Set(filtered.map((c) => c.category))];

  const executeCommand = useCallback(
    (cmd: CommandItem) => {
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 50), from, '\n');
      const slashMatch = textBefore.match(/\/([^/]*)$/);
      if (slashMatch) {
        const deleteFrom = from - slashMatch[0].length;
        editor.chain().deleteRange({ from: deleteFrom, to: from }).run();
      }
      cmd.action(editor);
      setIsOpen(false);
      setQuery('');
      setSelectedIndex(0);
    },
    [editor],
  );

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) executeCommand(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        setSelectedIndex(0);
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, filtered, selectedIndex, executeCommand]);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 50), from, '\n');
      const match = textBefore.match(/\/([^/\n]*)$/);

      if (match) {
        setIsOpen(true);
        setQuery(match[1]);
        setSelectedIndex(0);
      } else {
        setIsOpen(false);
        setQuery('');
      }
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor]);

  useEffect(() => {
    if (menuRef.current) {
      const selected = menuRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen || filtered.length === 0) return null;

  let itemIndex = 0;

  return (
    <div
      ref={menuRef}
      className="slash-command-menu fixed z-50 w-72 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl"
      style={{
        top: (() => {
          const coords = editor.view.coordsAtPos(editor.state.selection.from);
          return coords.bottom + 4;
        })(),
        left: (() => {
          const coords = editor.view.coordsAtPos(editor.state.selection.from);
          return coords.left;
        })(),
      }}
    >
      {categories.map((cat) => (
        <div key={cat}>
          <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {cat}
          </div>
          {filtered
            .filter((c) => c.category === cat)
            .map((cmd) => {
              const idx = itemIndex++;
              return (
                <button
                  key={cmd.title}
                  data-selected={idx === selectedIndex}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2 text-left text-sm transition-colors',
                    idx === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50',
                  )}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                    <cmd.icon size={16} />
                  </div>
                  <div>
                    <div className="font-medium text-xs">{cmd.title}</div>
                    <div className="text-[10px] text-muted-foreground">{cmd.description}</div>
                  </div>
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}
