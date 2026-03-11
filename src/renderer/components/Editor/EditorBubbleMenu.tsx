import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { useState } from 'react';
import {
  TextB, TextItalic, TextUnderline, TextStrikethrough,
  Code, Highlighter, LinkSimple, TextSubscript, TextSuperscript,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Purple', value: '#e9d5ff' },
];

const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
];

interface EditorBubbleMenuProps {
  editor: Editor;
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const toggleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 150, placement: 'top', maxWidth: 'none' }}
      className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-xl"
    >
      <ToolBtn
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <TextB size={14} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <TextItalic size={14} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Underline"
      >
        <TextUnderline size={14} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Strikethrough"
      >
        <TextStrikethrough size={14} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="Inline Code"
      >
        <Code size={14} />
      </ToolBtn>

      <Separator orientation="vertical" className="h-4 mx-0.5" />

      <ToolBtn
        active={editor.isActive('subscript')}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        label="Subscript"
      >
        <TextSubscript size={14} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('superscript')}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        label="Superscript"
      >
        <TextSuperscript size={14} />
      </ToolBtn>

      <Separator orientation="vertical" className="h-4 mx-0.5" />

      <div className="relative">
        <ToolBtn
          active={editor.isActive('highlight')}
          onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); }}
          label="Highlight"
        >
          <Highlighter size={14} />
        </ToolBtn>
        {showHighlightPicker && (
          <div className="absolute top-full left-0 mt-1 flex gap-1 rounded-md border border-border bg-popover p-1.5 shadow-lg z-50">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.name}
                className="h-5 w-5 rounded-sm border border-border/50 hover:scale-110 transition-transform"
                style={{ backgroundColor: c.value }}
                title={c.name}
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color: c.value }).run();
                  setShowHighlightPicker(false);
                }}
              />
            ))}
            <button
              className="h-5 w-5 rounded-sm border border-border/50 hover:scale-110 transition-transform text-[8px] flex items-center justify-center text-muted-foreground"
              title="Remove highlight"
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                setShowHighlightPicker(false);
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <ToolBtn
          active={false}
          onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); }}
          label="Text Color"
        >
          <span className="text-xs font-bold leading-none" style={{ color: editor.getAttributes('textStyle').color || 'currentColor' }}>A</span>
        </ToolBtn>
        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1 flex gap-1 rounded-md border border-border bg-popover p-1.5 shadow-lg z-50">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.name}
                className="h-5 w-5 rounded-sm border border-border/50 hover:scale-110 transition-transform flex items-center justify-center"
                style={{ backgroundColor: c.value || 'transparent' }}
                title={c.name}
                onClick={() => {
                  if (c.value) {
                    editor.chain().focus().setColor(c.value).run();
                  } else {
                    editor.chain().focus().unsetColor().run();
                  }
                  setShowColorPicker(false);
                }}
              >
                {!c.value && <span className="text-[8px] text-muted-foreground">—</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <Separator orientation="vertical" className="h-4 mx-0.5" />

      <ToolBtn
        active={editor.isActive('link')}
        onClick={toggleLink}
        label={editor.isActive('link') ? 'Remove Link' : 'Add Link'}
      >
        <LinkSimple size={14} />
      </ToolBtn>
    </BubbleMenu>
  );
}

function ToolBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', active && 'bg-primary/20 text-primary')}
      onClick={onClick}
      title={label}
    >
      {children}
    </Button>
  );
}
