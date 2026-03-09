import { useState, useEffect, useCallback } from 'react';
import { X, Eye, EyeSlash, Plus, Trash, CircleNotch, Check, ArrowClockwise, Copy, Circle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppSettings, ProviderId, ProviderAvailability, McpServerStatus } from '../../types';
import { useAppStore } from '../../store';

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'claude',
  claude: { authMode: 'auto', anthropicApiKey: '', vertexProjectId: '', vertexRegion: 'global', model: '', permissionMode: 'bypassPermissions', effort: 'high' },
  gemini: { apiKey: '', model: 'gemini-2.5-pro' },
  codex: { apiKey: '', model: '' },
  opencode: { provider: 'anthropic', apiKey: '', model: '' },
  maxTurns: 25,
  skills: [],
  lastProjectPath: '',
  selectedProjectPath: '',
};

const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: 'Claude',
  gemini: 'Gemini',
  codex: 'Codex',
  opencode: 'OpenCode',
};

interface SettingsPanelProps { onClose: () => void; }

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentMd, setAgentMd] = useState('');
  const [providerMd, setProviderMd] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [providers, setProviders] = useState<ProviderAvailability[]>([]);
  const [autoSaveFlash, setAutoSaveFlash] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<McpServerStatus | null>(null);
  const [mcpRestarting, setMcpRestarting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const selectedProjectPath = useAppStore((s) => s.selectedProjectPath);

  const refreshMcpStatus = useCallback(() => {
    window.nightAPI.mcp.status().then(setMcpStatus).catch(() => {});
  }, []);

  useEffect(() => {
    window.nightAPI.settings.get().then((s) => { setSettings(s); setLoading(false); });
    window.nightAPI.ai.detectProviders().then(setProviders).catch(() => {});
    refreshMcpStatus();
  }, [refreshMcpStatus]);

  useEffect(() => {
    if (!selectedProjectPath) return;
    window.nightAPI.fs.readFile(`${selectedProjectPath}/.nightpm/AGENT.md`).then(setAgentMd).catch(() => setAgentMd(''));
  }, [selectedProjectPath]);

  useEffect(() => {
    if (!selectedProjectPath) return;
    const filename = providerOverrideFilename(settings.provider);
    window.nightAPI.fs.readFile(`${selectedProjectPath}/.nightpm/${filename}`).then(setProviderMd).catch(() => setProviderMd(''));
  }, [selectedProjectPath, settings.provider]);

  function providerOverrideFilename(id: ProviderId) {
    return `${PROVIDER_LABELS[id].toUpperCase()}.md`;
  }

  const persistSettings = useCallback((newSettings: AppSettings) => {
    window.nightAPI.settings.set(newSettings);
    setAutoSaveFlash(true);
    setTimeout(() => setAutoSaveFlash(false), 1500);
  }, []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      persistSettings(next);
      return next;
    });
  }

  const saveAgentMd = useCallback(async () => {
    if (!selectedProjectPath) return;
    await window.nightAPI.fs.createDir(`${selectedProjectPath}/.nightpm`);
    await window.nightAPI.fs.writeFile(`${selectedProjectPath}/.nightpm/AGENT.md`, agentMd);
    setAutoSaveFlash(true);
    setTimeout(() => setAutoSaveFlash(false), 1500);
  }, [selectedProjectPath, agentMd]);

  const saveProviderMd = useCallback(async () => {
    if (!selectedProjectPath) return;
    await window.nightAPI.fs.createDir(`${selectedProjectPath}/.nightpm`);
    const filename = providerOverrideFilename(settings.provider);
    await window.nightAPI.fs.writeFile(`${selectedProjectPath}/.nightpm/${filename}`, providerMd);
    setAutoSaveFlash(true);
    setTimeout(() => setAutoSaveFlash(false), 1500);
  }, [selectedProjectPath, settings.provider, providerMd]);

  function addSkill() {
    if (!skillInput.trim()) return;
    update('skills', [...(settings.skills || []), skillInput.trim()]);
    setSkillInput('');
  }

  function removeSkill(idx: number) {
    update('skills', (settings.skills || []).filter((_, i) => i !== idx));
  }

  if (loading) return <div className="h-full flex items-center justify-center text-muted-foreground text-sm"><CircleNotch size={16} className="animate-spin mr-2" /> Loading settings...</div>;

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Settings</h2>
          {autoSaveFlash && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 animate-in fade-in">
              <Check size={10} className="text-green-500" /> Auto-saved
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X size={16} /></Button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-6">

        <section>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">AI Provider</h3>
          <div className="space-y-3">
            <Select value={settings.provider} onValueChange={(v) => update('provider', v as ProviderId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['claude', 'gemini', 'codex', 'opencode'] as ProviderId[]).map((id) => (
                  <SelectItem key={id} value={id}>{PROVIDER_LABELS[id]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {providers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {providers.map((p) => (
                  <Badge key={p.id} variant={p.available ? 'default' : 'secondary'} className="text-[10px] gap-1">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${p.available ? 'bg-green-400' : 'bg-muted-foreground/50'}`} />
                    {p.displayName}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </section>

        <Separator />

        {settings.provider === 'claude' && <ClaudeConfig settings={settings} update={update} showKey={showKey} setShowKey={setShowKey} />}
        {settings.provider === 'gemini' && <GeminiConfig settings={settings} update={update} showKey={showKey} setShowKey={setShowKey} />}
        {settings.provider === 'codex' && <CodexConfig settings={settings} update={update} showKey={showKey} setShowKey={setShowKey} />}
        {settings.provider === 'opencode' && <OpenCodeConfig settings={settings} update={update} showKey={showKey} setShowKey={setShowKey} />}

        <Separator />

        <section>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">General</h3>
          <div className="space-y-1.5">
            <Label>Max Turns</Label>
            <Input type="number" value={settings.maxTurns} onChange={(e) => update('maxTurns', parseInt(e.target.value) || 25)} />
          </div>
        </section>

        <Separator />

        <section>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Skills</h3>
          <div className="space-y-2">
            <div className="flex gap-1">
              <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addSkill(); }} placeholder="Skill name..." className="h-7 text-xs" />
              <Button size="sm" className="h-7 text-xs" onClick={addSkill}><Plus size={12} /></Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(settings.skills || []).map((s, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-[10px]">
                  {s}
                  <button onClick={() => removeSkill(i)} className="hover:text-destructive"><Trash size={10} /></button>
                </Badge>
              ))}
              {!(settings.skills?.length) && <p className="text-[11px] text-muted-foreground">No skills configured</p>}
            </div>
          </div>
        </section>

        <Separator />

        <section>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Project Instructions</h3>
          {selectedProjectPath ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>AGENT.md <span className="text-muted-foreground font-normal">(shared across providers)</span></Label>
                <p className="text-[11px] text-muted-foreground">Stored in <code className="text-primary">.nightpm/AGENT.md</code></p>
                <Textarea value={agentMd} onChange={(e) => setAgentMd(e.target.value)} onBlur={saveAgentMd} rows={6} placeholder="Enter project-specific instructions shared across all providers..." className="text-xs font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>{providerOverrideFilename(settings.provider)} <span className="text-muted-foreground font-normal">({PROVIDER_LABELS[settings.provider]} override)</span></Label>
                <p className="text-[11px] text-muted-foreground">Stored in <code className="text-primary">.nightpm/{providerOverrideFilename(settings.provider)}</code></p>
                <Textarea value={providerMd} onChange={(e) => setProviderMd(e.target.value)} onBlur={saveProviderMd} rows={4} placeholder={`Enter ${PROVIDER_LABELS[settings.provider]}-specific instructions...`} className="text-xs font-mono" />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Select a project to edit project instructions</p>
          )}
        </section>

        <Separator />

        <section>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Project</h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Active Project</Label>
              <Input value={settings.selectedProjectPath || '(none selected)'} readOnly className="text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>Last Opened Directory</Label>
              <Input value={settings.lastProjectPath || '(none)'} readOnly className="text-muted-foreground" />
            </div>
          </div>
        </section>

        <Separator />

        <McpServerSection
          status={mcpStatus}
          restarting={mcpRestarting}
          copied={copied}
          onRestart={async () => {
            setMcpRestarting(true);
            try { const s = await window.nightAPI.mcp.restart(); setMcpStatus(s); }
            catch { /* ignore */ }
            finally { setMcpRestarting(false); }
          }}
          onRefresh={refreshMcpStatus}
          onCopy={(key, text) => {
            navigator.clipboard.writeText(text);
            setCopied(key);
            setTimeout(() => setCopied(null), 2000);
          }}
        />
      </div>
    </div>
  );
}

type ConfigProps = {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
};

function ApiKeyField({ value, onChange, showKey, setShowKey, placeholder }: { value: string; onChange: (v: string) => void; showKey: boolean; setShowKey: (v: boolean) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Input type={showKey ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-10" />
      <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowKey(!showKey)}>
        {showKey ? <EyeSlash size={14} /> : <Eye size={14} />}
      </Button>
    </div>
  );
}

function ClaudeConfig({ settings, update, showKey, setShowKey }: ConfigProps) {
  const c = settings.claude;
  const set = (patch: Partial<typeof c>) => update('claude', { ...c, ...patch });

  return (
    <section>
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Claude Configuration</h3>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Auth Mode</Label>
          <Select value={c.authMode} onValueChange={(v) => set({ authMode: v as 'auto' | 'vertex' | 'api-key' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (use CLI&apos;s own auth)</SelectItem>
              <SelectItem value="vertex">Vertex AI</SelectItem>
              <SelectItem value="api-key">API Key</SelectItem>
            </SelectContent>
          </Select>
          {c.authMode === 'auto' && (
            <p className="text-[11px] text-muted-foreground">Uses whatever authentication your Claude CLI already has configured.</p>
          )}
        </div>

        {c.authMode === 'api-key' ? (
          <div className="space-y-1.5">
            <Label>Anthropic API Key</Label>
            <ApiKeyField value={c.anthropicApiKey} onChange={(v) => set({ anthropicApiKey: v })} showKey={showKey} setShowKey={setShowKey} placeholder="sk-ant-..." />
          </div>
        ) : c.authMode === 'vertex' ? (
          <>
            <div className="space-y-1.5">
              <Label>Vertex Project ID</Label>
              <Input value={c.vertexProjectId} onChange={(e) => set({ vertexProjectId: e.target.value })} placeholder="my-gcp-project" />
            </div>
            <div className="space-y-1.5">
              <Label>Region</Label>
              <Input value={c.vertexRegion} onChange={(e) => set({ vertexRegion: e.target.value })} placeholder="global" />
            </div>
          </>
        ) : null}

        <div className="space-y-1.5">
          <Label>Model</Label>
          <Select value={c.model || 'default'} onValueChange={(v) => set({ model: v === 'default' ? '' : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default (CLI default)</SelectItem>
              <SelectGroup>
                <SelectLabel>Opus</SelectLabel>
                <SelectItem value="claude-opus-4-6">Claude Opus 4.6</SelectItem>
                <SelectItem value="claude-opus-4-5-20251101">Claude Opus 4.5</SelectItem>
                <SelectItem value="claude-opus-4-20250514">Claude Opus 4</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Sonnet</SelectLabel>
                <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
                <SelectItem value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</SelectItem>
                <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Haiku</SelectLabel>
                <SelectItem value="claude-haiku-4-5">Claude Haiku 4.5</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Permission Mode</Label>
          <Select value={c.permissionMode} onValueChange={(v) => set({ permissionMode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bypassPermissions">Bypass (auto-approve all)</SelectItem>
              <SelectItem value="acceptEdits">Accept Edits</SelectItem>
              <SelectItem value="default">Default (prompt)</SelectItem>
              <SelectItem value="plan">Plan Mode (read-only)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Effort</Label>
          <Select value={c.effort} onValueChange={(v) => set({ effort: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="max">Max</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}

function GeminiConfig({ settings, update, showKey, setShowKey }: ConfigProps) {
  const g = settings.gemini;
  const set = (patch: Partial<typeof g>) => update('gemini', { ...g, ...patch });

  return (
    <section>
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Gemini Configuration</h3>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>API Key</Label>
          <ApiKeyField value={g.apiKey} onChange={(v) => set({ apiKey: v })} showKey={showKey} setShowKey={setShowKey} placeholder="AIza..." />
          <p className="text-[11px] text-muted-foreground">Optional if your Gemini CLI is already authenticated.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Model</Label>
          <Select value={g.model || 'gemini-2.5-pro'} onValueChange={(v) => set({ model: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Gemini 3.x</SelectLabel>
                <SelectItem value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview)</SelectItem>
                <SelectItem value="gemini-3-flash-preview">Gemini 3 Flash (Preview)</SelectItem>
                <SelectItem value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite (Preview)</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Gemini 2.5</SelectLabel>
                <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}

function CodexConfig({ settings, update, showKey, setShowKey }: ConfigProps) {
  const cx = settings.codex;
  const set = (patch: Partial<typeof cx>) => update('codex', { ...cx, ...patch });

  return (
    <section>
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Codex Configuration</h3>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>API Key</Label>
          <ApiKeyField value={cx.apiKey} onChange={(v) => set({ apiKey: v })} showKey={showKey} setShowKey={setShowKey} placeholder="sk-..." />
          <p className="text-[11px] text-muted-foreground">Optional if your Codex CLI is already authenticated.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Model</Label>
          <Select value={cx.model || 'default'} onValueChange={(v) => set({ model: v === 'default' ? '' : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default (CLI default)</SelectItem>
              <SelectGroup>
                <SelectLabel>GPT-5.x</SelectLabel>
                <SelectItem value="gpt-5.4">GPT-5.4</SelectItem>
                <SelectItem value="gpt-5.3-codex">GPT-5.3 Codex</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Reasoning</SelectLabel>
                <SelectItem value="o3-pro">o3-pro</SelectItem>
                <SelectItem value="o3">o3</SelectItem>
                <SelectItem value="o4-mini">o4-mini</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}

function OpenCodeConfig({ settings, update, showKey, setShowKey }: ConfigProps) {
  const oc = settings.opencode;
  const set = (patch: Partial<typeof oc>) => update('opencode', { ...oc, ...patch });

  return (
    <section>
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">OpenCode Configuration</h3>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Provider</Label>
          <Select value={oc.provider || 'anthropic'} onValueChange={(v) => set({ provider: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="google">Google</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>API Key</Label>
          <ApiKeyField value={oc.apiKey} onChange={(v) => set({ apiKey: v })} showKey={showKey} setShowKey={setShowKey} placeholder="API key..." />
          <p className="text-[11px] text-muted-foreground">Optional if your OpenCode CLI is already authenticated.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Model</Label>
          <Input value={oc.model} onChange={(e) => set({ model: e.target.value })} placeholder="e.g. claude-sonnet-4-6, gpt-5.4" />
        </div>
      </div>
    </section>
  );
}

function CopyBlock({ label, value, copyKey, copied, onCopy }: {
  label: string; value: string; copyKey: string;
  copied: string | null; onCopy: (key: string, text: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px]">{label}</Label>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onCopy(copyKey, value)}>
          {copied === copyKey ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
        </Button>
      </div>
      <pre className="text-[10px] bg-background border border-border rounded p-2 overflow-x-auto whitespace-pre font-mono text-muted-foreground select-all leading-relaxed">{value}</pre>
    </div>
  );
}

function McpServerSection({ status, restarting, copied, onRestart, onRefresh, onCopy }: {
  status: McpServerStatus | null; restarting: boolean;
  copied: string | null;
  onRestart: () => void; onRefresh: () => void;
  onCopy: (key: string, text: string) => void;
}) {
  const port = status?.port ?? 7777;
  const sseUrl = status?.url ?? `http://127.0.0.1:${port}/sse`;

  const claudeConfig = JSON.stringify({
    mcpServers: {
      "night-pm": { url: sseUrl },
    },
  }, null, 2);

  const cursorConfig = JSON.stringify({
    mcpServers: {
      "night-pm": { url: sseUrl },
    },
  }, null, 2);

  const windsurf = JSON.stringify({
    mcpServers: {
      "night-pm": { serverUrl: sseUrl },
    },
  }, null, 2);

  return (
    <section>
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">MCP Server</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Circle
              size={8}
              weight="fill"
              className={status?.running ? 'text-green-500' : 'text-red-400'}
            />
            <span className="text-xs text-foreground">
              {status?.running ? `Running on port ${status.port}` : 'Stopped'}
            </span>
            {status?.running && status.connections > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4">
                {status.connections} client{status.connections !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh} title="Refresh status">
              <ArrowClockwise size={12} />
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={onRestart} disabled={restarting}>
              {restarting ? <CircleNotch size={10} className="animate-spin mr-1" /> : null}
              Restart
            </Button>
          </div>
        </div>

        {status?.running && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px]">SSE Endpoint</Label>
              <div className="flex items-center gap-1">
                <Input value={sseUrl} readOnly className="text-xs font-mono h-7 text-muted-foreground" />
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onCopy('url', sseUrl)}>
                  {copied === 'url' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Copy the config below to connect Night PM from other apps.
              </p>

              <CopyBlock
                label="Claude Desktop — claude_desktop_config.json"
                value={claudeConfig}
                copyKey="claude"
                copied={copied}
                onCopy={onCopy}
              />

              <CopyBlock
                label="Cursor — .cursor/mcp.json"
                value={cursorConfig}
                copyKey="cursor"
                copied={copied}
                onCopy={onCopy}
              />

              <CopyBlock
                label="Windsurf"
                value={windsurf}
                copyKey="windsurf"
                copied={copied}
                onCopy={onCopy}
              />

              <CopyBlock
                label="Generic SSE URL"
                value={sseUrl}
                copyKey="generic"
                copied={copied}
                onCopy={onCopy}
              />
            </div>
          </>
        )}

        {!status?.running && (
          <p className="text-[11px] text-muted-foreground">
            The MCP server is not running. Click Restart to start it.
          </p>
        )}
      </div>
    </section>
  );
}
