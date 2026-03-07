import { useState, useEffect, useRef, useCallback } from 'react';
import { PaperPlaneTilt, Stop, Trash, Terminal, X, CircleNotch, Wrench, CaretDown, CaretRight, ClockCounterClockwise, Lightning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '../../store';
import { cn } from '@/lib/utils';
import type { AIMessage, AIResult, SessionInfo } from '../../types';

interface LogEntry { id: number; role: 'user' | 'assistant' | 'system'; blocks: AIMessage[]; }
interface AIConsoleProps { onClose: () => void; }
let logId = 0;

export function AIConsole({ onClose }: AIConsoleProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);
  const [lastResult, setLastResult] = useState<AIResult | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedProjectPath = useAppStore((s) => s.selectedProjectPath);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [entries]);

  useEffect(() => {
    const cleanups = [
      window.nightAPI.ai.onConsoleMessage((msg: AIMessage) => {
        setEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, blocks: [...last.blocks, msg] }];
          }
          return [...prev, { id: ++logId, role: 'assistant', blocks: [msg] }];
        });
      }),
      window.nightAPI.ai.onConsoleProgress((msg: AIMessage) => {
        setEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, blocks: [...last.blocks, msg] }];
          }
          return [...prev, { id: ++logId, role: 'assistant', blocks: [msg] }];
        });
      }),
      window.nightAPI.ai.onConsoleDone((result: AIResult) => {
        setIsRunning(false);
        setLastResult(result);
      }),
    ];
    return () => cleanups.forEach((c) => c());
  }, []);

  const loadSessions = useCallback(async () => {
    const s = await window.nightAPI.ai.listSessions();
    setSessions(s);
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isRunning) return;
    if (!selectedProjectPath) {
      setEntries((prev) => [...prev, { id: ++logId, role: 'system', blocks: [{ type: 'error', message: 'No active project selected.' }] }]);
      return;
    }
    setInput('');
    setEntries((prev) => [...prev, { id: ++logId, role: 'user', blocks: [{ type: 'text', text }] }]);
    setIsRunning(true);
    setLastResult(null);

    if (hasConversation) {
      await window.nightAPI.ai.consoleFollowup(text);
    } else {
      await window.nightAPI.ai.consoleRun(text);
      setHasConversation(true);
    }
  }, [input, isRunning, selectedProjectPath, hasConversation]);

  function handleNewSession() {
    setEntries([]);
    setHasConversation(false);
    setLastResult(null);
    window.nightAPI.ai.consoleAbort();
  }

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[50vw] h-[50vw] rounded-full bg-primary/5 blur-[120px] mix-blend-screen animate-float" />
        <div className="absolute bottom-[10%] right-[10%] w-[45vw] h-[45vw] rounded-full bg-night-accent2/5 blur-[100px] mix-blend-screen animate-float" style={{ animationDelay: '-7s' }} />
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-sidebar/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-primary" weight="duotone" />
          <span className="text-xs font-semibold text-foreground">AI Console</span>
          {selectedProjectPath && <Badge variant="secondary" className="text-[10px]">{selectedProjectPath.split('/').pop()}</Badge>}
        </div>
        <div className="flex items-center gap-1">
          {hasConversation && (
            <Button variant="ghost" size="xs" className="text-[10px]" onClick={handleNewSession}>New</Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={() => { setShowSessions(!showSessions); if (!showSessions) loadSessions(); }} title="Sessions">
            <ClockCounterClockwise size={13} />
          </Button>
          {isRunning && (
            <Button variant="destructive" size="xs" className="text-[10px] gap-1" onClick={() => { window.nightAPI.ai.consoleAbort(); setIsRunning(false); }}>
              <Stop size={10} /> Stop
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={() => { setEntries([]); setLastResult(null); }}><Trash size={13} /></Button>
          <Button variant="ghost" size="icon-xs" onClick={onClose}><X size={14} /></Button>
        </div>
      </div>

      {showSessions && sessions.length > 0 && (
        <div className="relative z-10 border-b border-border/50 bg-sidebar/30 backdrop-blur-md max-h-40 overflow-auto">
          {sessions.map((s) => (
            <button
              key={s.sessionId}
              className="w-full text-left px-4 py-2 text-xs hover:bg-accent/50 border-b border-border/30 last:border-0"
              onClick={async () => {
                setShowSessions(false);
                setEntries([]);
                setHasConversation(true);
                setIsRunning(true);
                await window.nightAPI.ai.resumeSession(s.sessionId);
              }}
            >
              <div className="font-medium text-foreground truncate">{s.summary}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(s.lastModified).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="relative z-10 flex-1 min-h-0">
        <div className="px-4 py-3 space-y-3">
          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground/50 py-20">
              <Terminal size={28} />
              <p className="text-xs text-center">Send prompts to your AI provider with full capabilities.<br />Multi-turn conversation with project context.</p>
            </div>
          )}
          {entries.map((entry) => (
            <div key={entry.id}>
              {entry.role === 'user' && (
                <div className="flex gap-2 mb-2">
                  <span className="text-primary select-none shrink-0 font-mono text-sm">{'>'}</span>
                  <span className="text-foreground text-sm">{entry.blocks[0]?.type === 'text' ? entry.blocks[0].text : ''}</span>
                </div>
              )}
              {entry.role !== 'user' && entry.blocks.map((block, i) => (
                <ConsoleBlock key={i} block={block} />
              ))}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {lastResult && (
        <div className="relative z-10 px-4 py-1.5 border-t border-border/30 flex items-center gap-3 text-[10px] text-muted-foreground bg-sidebar/20 backdrop-blur-sm">
          <Lightning size={10} weight="fill" className="text-night-yellow" />
          <span>{lastResult.inputTokens + lastResult.outputTokens} tokens</span>
          {lastResult.cost > 0 && <span>${lastResult.cost.toFixed(4)}</span>}
          <span>{lastResult.numTurns} turn{lastResult.numTurns !== 1 ? 's' : ''}</span>
          {lastResult.sessionId && <span className="opacity-50 truncate max-w-[120px]">Session: {lastResult.sessionId.slice(0, 8)}</span>}
        </div>
      )}

      <div className="relative z-10 px-3 pb-3 pt-1">
        <div className="flex items-center gap-2 bg-secondary/30 backdrop-blur-md border border-border/50 rounded-lg px-3 py-2 focus-within:border-primary/50 transition-colors">
          <span className="text-primary text-sm font-mono select-none">{'>'}</span>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder={isRunning ? 'Processing...' : hasConversation ? 'Follow up...' : 'Enter a prompt...'}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-auto p-0 text-sm font-mono"
            disabled={isRunning}
          />
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={handleSubmit} disabled={!input.trim() || isRunning}>
            <PaperPlaneTilt size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConsoleBlock({ block }: { block: AIMessage }) {
  const [expanded, setExpanded] = useState(false);

  if (block.type === 'text') {
    return <div className="text-foreground/90 whitespace-pre-wrap text-sm pl-5 mb-1">{block.text}</div>;
  }
  if (block.type === 'tool_use') {
    return (
      <div className="bg-accent/30 rounded px-3 py-1.5 text-xs border border-border/30 mb-1 ml-5">
        <button className="flex items-center gap-1.5 text-primary w-full text-left" onClick={() => setExpanded(!expanded)}>
          {expanded ? <CaretDown size={10} /> : <CaretRight size={10} />}
          <Wrench size={11} />
          <span className="font-medium">{block.tool}</span>
        </button>
        {expanded && (
          <pre className="mt-1.5 text-[10px] text-muted-foreground overflow-auto max-h-32">{JSON.stringify(block.input, null, 2)}</pre>
        )}
      </div>
    );
  }
  if (block.type === 'tool_result') {
    return (
      <div className={cn('text-[11px] px-3 py-1 rounded ml-5 mb-1', block.isError ? 'text-destructive bg-destructive/10' : 'text-night-green bg-night-green/10')}>
        {block.output}
      </div>
    );
  }
  if (block.type === 'tool_progress') {
    return (
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground py-0.5 ml-5">
        <CircleNotch size={10} className="animate-spin text-primary" />
        <span>{block.tool}</span>
        <span className="opacity-50">{block.elapsedSeconds.toFixed(0)}s</span>
      </div>
    );
  }
  if (block.type === 'thinking') {
    return (
      <div className="text-xs text-muted-foreground/50 italic px-3 py-1 border-l-2 border-muted ml-5 mb-1">
        {block.text.length > 300 ? block.text.slice(0, 300) + '...' : block.text}
      </div>
    );
  }
  if (block.type === 'error') {
    return <div className="bg-destructive/10 text-destructive rounded px-3 py-2 text-xs ml-5 mb-1">{block.message}</div>;
  }
  if (block.type === 'system') {
    return (
      <div className="text-[10px] text-muted-foreground/50 flex items-center gap-2 py-1 ml-5">
        <Lightning size={10} weight="fill" />
        {block.model && <span>{block.model}</span>}
        {block.tools && <span>{block.tools.length} tools</span>}
      </div>
    );
  }
  return null;
}
