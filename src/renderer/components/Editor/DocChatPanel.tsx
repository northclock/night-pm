import { useState, useEffect, useRef } from 'react';
import { PaperPlaneTilt, X, Stop, CircleNotch, Bug } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBlock } from '../Thoughts/ThoughtsOverlay';
import { cn } from '@/lib/utils';
import type { AIMessage, AIResult } from '../../types';

interface DocChatPanelProps {
  filePath: string;
  onClose: () => void;
}

interface ChatEntry {
  id: number;
  role: 'user' | 'assistant';
  blocks: AIMessage[];
}

let entryId = 0;

export function DocChatPanel({ filePath, onClose }: DocChatPanelProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);
  const [lastResult, setLastResult] = useState<AIResult | null>(null);
  const [debug, setDebug] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  useEffect(() => {
    const cleanups = [
      window.nightAPI.ai.onMessage((msg: AIMessage) => {
        setEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, blocks: [...last.blocks, msg] }];
          }
          return [...prev, { id: ++entryId, role: 'assistant', blocks: [msg] }];
        });
      }),
      window.nightAPI.ai.onProgress((msg: AIMessage) => {
        setEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, blocks: [...last.blocks, msg] }];
          }
          return [...prev, { id: ++entryId, role: 'assistant', blocks: [msg] }];
        });
      }),
      window.nightAPI.ai.onDone((result: AIResult) => {
        setLoading(false);
        setLastResult(result);
      }),
    ];
    return () => cleanups.forEach((c) => c());
  }, [filePath]);

  async function handleSubmit() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);
    setLastResult(null);
    setEntries((prev) => [...prev, { id: ++entryId, role: 'user', blocks: [{ type: 'text', text }] }]);

    if (hasConversation) {
      await window.nightAPI.ai.thoughtFollowup(text, filePath);
    } else {
      await window.nightAPI.ai.thought(text, filePath);
      setHasConversation(true);
    }
  }

  function handleAbort() {
    window.nightAPI.ai.abort(filePath);
    setLoading(false);
  }

  function handleNewSession() {
    setEntries([]);
    setHasConversation(false);
    setLastResult(null);
    window.nightAPI.ai.abort(filePath);
  }

  const fileName = filePath.split('/').pop() ?? 'document';

  return (
    <div className="h-full flex flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-foreground truncate flex-1">{fileName}</span>
        {hasConversation && (
          <Button variant="ghost" size="xs" className="text-[10px] text-muted-foreground" onClick={handleNewSession}>
            New
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-6 w-6', debug ? 'text-primary' : 'text-muted-foreground/40')}
          onClick={() => setDebug((d) => !d)}
          title={debug ? 'Hide debug info' : 'Show debug info'}
        >
          <Bug size={12} />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2 space-y-2">
          {entries.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-8">
              Ask the AI about this document or request changes.
            </div>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className={cn('flex', entry.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[95%] space-y-1', entry.role === 'user' && 'text-right')}>
                {entry.blocks.map((block, i) => (
                  <MessageBlock key={i} block={block} isUser={entry.role === 'user'} debug={debug} />
                ))}
              </div>
            </div>
          ))}
          {loading && entries[entries.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <CircleNotch size={12} className="animate-spin" /> Thinking...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {lastResult && (
        <div className="px-3 py-1.5 border-t border-border/50 flex items-center gap-3 text-[10px] text-muted-foreground bg-sidebar/30">
          <span>{lastResult.inputTokens + lastResult.outputTokens} tokens</span>
          {lastResult.cost > 0 && <span>${lastResult.cost.toFixed(4)}</span>}
          <span>{lastResult.numTurns} turn{lastResult.numTurns !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="flex items-center gap-1 px-2 py-2 border-t border-border">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="Ask about this document..."
          className="h-8 text-xs"
          disabled={loading}
        />
        {loading ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleAbort}>
            <Stop size={14} />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleSubmit} disabled={!input.trim()}>
            <PaperPlaneTilt size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
