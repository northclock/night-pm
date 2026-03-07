import { useState, useEffect, useRef, useCallback } from 'react';
import { PaperPlaneTilt, Brain, X, Stop, Wrench, Lightning, CircleNotch, CaretDown, CaretRight, Bug } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { AIMessage, AIResult } from '../../types';
import { cn } from '@/lib/utils';

interface ChatEntry {
  id: number;
  role: 'user' | 'assistant';
  blocks: AIMessage[];
}

let entryId = 0;

function hideWindow() { window.nightAPI.ai.hide(); }

export function ThoughtsOverlay() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);
  const [lastResult, setLastResult] = useState<AIResult | null>(null);
  const [debug, setDebug] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [entries]);

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
        setIsProcessing(false);
        setLastResult(result);
      }),
    ];
    return () => cleanups.forEach((c) => c());
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput('');
    setEntries((prev) => [...prev, { id: ++entryId, role: 'user', blocks: [{ type: 'text', text }] }]);
    setIsProcessing(true);
    setLastResult(null);

    if (hasConversation) {
      await window.nightAPI.ai.thoughtFollowup(text);
    } else {
      await window.nightAPI.ai.thought(text);
      setHasConversation(true);
    }
  }, [input, isProcessing, hasConversation]);

  function handleNewSession() {
    setEntries([]);
    setHasConversation(false);
    setLastResult(null);
    window.nightAPI.ai.abort();
  }

  return (
    <div className="h-full w-full flex flex-col rounded-xl overflow-hidden bg-background/95 backdrop-blur-sm border border-border shadow-2xl">
      <div className="thoughts-drag flex items-center gap-2 px-4 py-2.5 bg-sidebar/80 border-b border-border cursor-grab active:cursor-grabbing">
        <Brain size={16} className="text-night-accent2" weight="duotone" />
        <span className="text-xs font-semibold text-foreground flex-1">Quick Thought</span>
        {hasConversation && (
          <Button variant="ghost" size="xs" className="text-[10px] gap-1 text-muted-foreground" onClick={handleNewSession}>
            New
          </Button>
        )}
        {isProcessing && (
          <Button variant="ghost" size="xs" className="text-[10px] gap-1 text-destructive" onClick={() => window.nightAPI.ai.abort()}>
            <Stop size={10} /> Stop
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
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={hideWindow}><X size={14} /></Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-3 space-y-3">
          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 py-10">
              <Brain size={32} className="text-night-accent2/40" weight="duotone" />
              <p className="text-xs text-center">Type a thought, task, or note.<br />AI will categorize and act on it.</p>
            </div>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className={cn('flex', entry.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[90%] space-y-1', entry.role === 'user' && 'text-right')}>
                {entry.blocks.map((block, i) => (
                  <MessageBlock key={i} block={block} isUser={entry.role === 'user'} debug={debug} />
                ))}
              </div>
            </div>
          ))}
          {isProcessing && entries[entries.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <CircleNotch size={14} className="animate-spin" /> Thinking...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {lastResult && (
        <div className="px-4 py-1.5 border-t border-border/50 flex items-center gap-3 text-[10px] text-muted-foreground bg-sidebar/30">
          <span>{lastResult.inputTokens + lastResult.outputTokens} tokens</span>
          {lastResult.cost > 0 && <span>${lastResult.cost.toFixed(4)}</span>}
          <span>{lastResult.numTurns} turn{lastResult.numTurns !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="px-3 pb-3 pt-1">
        <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2 focus-within:border-primary transition-colors">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } if (e.key === 'Escape') hideWindow(); }}
            placeholder={hasConversation ? 'Follow up...' : 'Enter a thought...'}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-auto p-0 text-sm"
            disabled={isProcessing}
          />
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={handleSubmit} disabled={!input.trim() || isProcessing}>
            <PaperPlaneTilt size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBlock({ block, isUser, debug }: { block: AIMessage; isUser: boolean; debug: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (block.type === 'text') {
    return (
      <div className={cn(
        'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap inline-block',
        isUser ? 'bg-primary/20 text-foreground' : 'bg-secondary text-foreground',
      )}>
        {block.text}
      </div>
    );
  }

  if (block.type === 'error') {
    return (
      <div className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs">
        {block.message}
      </div>
    );
  }

  if (block.type === 'tool_use') {
    return (
      <div className="bg-accent/50 rounded-lg px-3 py-1.5 text-xs border border-border/50">
        <button className="flex items-center gap-1.5 text-primary w-full text-left" onClick={() => setExpanded(!expanded)}>
          {expanded ? <CaretDown size={10} /> : <CaretRight size={10} />}
          <Wrench size={11} />
          <span className="font-medium">{block.tool}</span>
        </button>
        {expanded && (
          <pre className="mt-1.5 text-[10px] text-muted-foreground overflow-auto max-h-32">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (block.type === 'tool_progress') {
    return (
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground py-0.5">
        <CircleNotch size={10} className="animate-spin text-primary" />
        <span>{block.tool}</span>
        <span className="opacity-50">{block.elapsedSeconds.toFixed(0)}s</span>
      </div>
    );
  }

  if (!debug) return null;

  if (block.type === 'tool_result') {
    return (
      <div className={cn('text-[11px] px-3 py-1 rounded', block.isError ? 'text-destructive bg-destructive/10' : 'text-night-green bg-night-green/10')}>
        {block.output}
      </div>
    );
  }

  if (block.type === 'thinking') {
    return (
      <div className="text-xs text-muted-foreground/60 italic px-3 py-1 border-l-2 border-muted">
        {block.text.length > 200 ? block.text.slice(0, 200) + '...' : block.text}
      </div>
    );
  }

  if (block.type === 'system') {
    return (
      <div className="text-[10px] text-muted-foreground/50 flex items-center gap-2 py-1">
        <Lightning size={10} weight="fill" />
        {block.model && <span>Model: {block.model}</span>}
        {block.tools && <span>{block.tools.length} tools</span>}
      </div>
    );
  }

  return null;
}
