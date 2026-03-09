import { useState, useEffect, useCallback } from 'react';
import { Plus, Lock, Trash } from '@phosphor-icons/react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { OpenFile, Secret } from '../../types';

interface Props { file: OpenFile; }

export function SecretsView({ file }: Props) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    try { setSecrets(JSON.parse(file.content || '[]')); } catch { setSecrets([]); }
  }, [file.content]);

  const saveSecrets = useCallback(async (updated: Secret[]) => {
    setSecrets(updated);
    await window.nightAPI.fs.writeFile(file.path, JSON.stringify(updated, null, 2));
  }, [file.path]);

  function handleAdd(text: string) {
    saveSecrets([...secrets, { id: uuidv4(), text, createdOn: new Date().toISOString() }]);
    setShowForm(false);
  }

  function handleDelete(id: string) {
    saveSecrets(secrets.filter((s) => s.id !== id));
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lock size={20} className="text-muted-foreground" weight="duotone" />
          <h2 className="text-lg font-semibold text-foreground">Secrets</h2>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 border-muted-foreground/30" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Add Secret
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        Private thoughts — never used for document generation.
      </p>

      {secrets.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">No secrets yet.</div>
      ) : (
        <div className="space-y-2">
          {secrets.map((secret) => (
            <div key={secret.id} className="group flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <Lock size={14} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground whitespace-pre-wrap">{secret.text}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(secret.createdOn).toLocaleDateString()}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => handleDelete(secret.id)}>
                <Trash size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>New Secret</DialogTitle></DialogHeader>
          <SecretForm onSave={handleAdd} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SecretForm({ onSave, onCancel }: { onSave: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('');

  return (
    <div className="space-y-4 pt-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your private thought..." rows={4} autoFocus />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSave(text)} disabled={!text.trim()}>Save</Button>
      </div>
    </div>
  );
}
