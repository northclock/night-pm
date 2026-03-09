import { useState, useEffect } from 'react';
import { X, Eye, EyeSlash, FloppyDisk, Check, Plus, Trash, CircleNotch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppSettings, ProviderId, ProviderAvailability } from '../../types';
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
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentMd, setAgentMd] = useState('');
  const [providerMd, setProviderMd] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [providers, setProviders] = useState<ProviderAvailability[]>([]);
  const selectedProjectPath = useAppStore((s) => s.selectedProjectPath);

  useEffect(() => {
    window.nightAPI.settings.get().then((s) => { setSettings(s); setLoading(false); });
    window.nightAPI.ai.detectProviders().then(setProviders).catch(() => {});
  }, []);

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

  async function handleSave() {
    await window.nightAPI.settings.set(settings);
    if (selectedProjectPath) {
      await window.nightAPI.fs.createDir(`${selectedProjectPath}/.nightpm`);
      if (agentMd !== undefined) {
        await window.nightAPI.fs.writeFile(`${selectedProjectPath}/.nightpm/AGENT.md`, agentMd);
      }
      if (providerMd !== undefined) {
        const filename = providerOverrideFilename(settings.provider);
        await window.nightAPI.fs.writeFile(`${selectedProjectPath}/.nightpm/${filename}`, providerMd);
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function addSkill() {
    if (!skillInput.trim()) return;
    update('skills', [...(settings.skills || []), skillInput.trim()]);
    setSkillInput('');
  }

  function removeSkill(idx: number) {
    update('skills', (settings.skills || []).filter((_, i) => i !== idx));
  }

  function availabilityFor(id: ProviderId) {
    return providers.find((p) => p.id === id);
  }

  if (loading) return <div className="h-full flex items-center justify-center text-muted-foreground text-sm"><CircleNotch size={16} className="animate-spin mr-2" /> Loading settings...</div>;

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar">
        <h2 className="text-sm font-semibold text-foreground">Settings</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X size={16} /></Button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-6">

        {/* ── Provider Selector ── */}
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

        {/* ── Provider-specific Config ── */}
        {settings.provider === 'claude' && <ClaudeConfig settings={settings} update={update} showKey={showKey} setShowKey={setShowKey} />}
        {settings.provider === 'gemini' && <GeminiConfig settings={settings} update={update} showKey={showKey} setShowKey={setShowKey} />}
        {settings.provider === 'codex' && <CodexConfig settings={settings} update={update} showKey={showKey} setShowKey={setShowKey} />}
        {settings.provider === 'opencode' && <OpenCodeConfig settings={settings} update={update} showKey={showKey} setShowKey={setShowKey} />}

        <Separator />

        {/* ── Shared: Max Turns ── */}
        <section>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">General</h3>
          <div className="space-y-1.5">
            <Label>Max Turns</Label>
            <Input type="number" value={settings.maxTurns} onChange={(e) => update('maxTurns', parseInt(e.target.value) || 25)} />
          </div>
        </section>

        <Separator />

        {/* ── Skills ── */}
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

        {/* ── Project Instructions ── */}
        <section>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Project Instructions</h3>
          {selectedProjectPath ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>AGENT.md <span className="text-muted-foreground font-normal">(shared across providers)</span></Label>
                <p className="text-[11px] text-muted-foreground">Stored in <code className="text-primary">.nightpm/AGENT.md</code></p>
                <Textarea value={agentMd} onChange={(e) => { setAgentMd(e.target.value); setSaved(false); }} rows={6} placeholder="Enter project-specific instructions shared across all providers..." className="text-xs font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>{providerOverrideFilename(settings.provider)} <span className="text-muted-foreground font-normal">({PROVIDER_LABELS[settings.provider]} override)</span></Label>
                <p className="text-[11px] text-muted-foreground">Stored in <code className="text-primary">.nightpm/{providerOverrideFilename(settings.provider)}</code></p>
                <Textarea value={providerMd} onChange={(e) => { setProviderMd(e.target.value); setSaved(false); }} rows={4} placeholder={`Enter ${PROVIDER_LABELS[settings.provider]}-specific instructions...`} className="text-xs font-mono" />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Select a project to edit project instructions</p>
          )}
        </section>

        <Separator />

        {/* ── Project Info (read-only) ── */}
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
      </div>

      <div className="px-4 py-3 border-t border-border bg-sidebar">
        <Button className="w-full gap-2" variant={saved ? 'outline' : 'default'} onClick={handleSave}>
          {saved ? <><Check size={15} /> Saved</> : <><FloppyDisk size={15} /> Save Settings</>}
        </Button>
      </div>
    </div>
  );
}

/* ─── Provider Config Sub-components ─── */

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
