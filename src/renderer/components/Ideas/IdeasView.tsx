import { useState, useEffect, useCallback } from 'react';
import { Plus, Lightbulb, Tag, Trash } from '@phosphor-icons/react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { OpenFile, Idea } from '../../types';

interface Props { file: OpenFile; }

export function IdeasView({ file }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  useEffect(() => {
    try { setIdeas(JSON.parse(file.content || '[]')); } catch { setIdeas([]); }
  }, [file.content]);

  const saveIdeas = useCallback(async (updated: Idea[]) => {
    setIdeas(updated);
    await window.nightAPI.fs.writeFile(file.path, JSON.stringify(updated, null, 2));
  }, [file.path]);

  function handleSave(title: string, description: string, tags: string[]) {
    if (editingIdea) {
      saveIdeas(ideas.map((i) => i.id === editingIdea.id ? { ...i, title, description, tags } : i));
    } else {
      saveIdeas([...ideas, { id: uuidv4(), title, description, createdOn: new Date().toISOString(), tags }]);
    }
    setShowForm(false);
    setEditingIdea(null);
  }

  function handleDelete(id: string) {
    saveIdeas(ideas.filter((i) => i.id !== id));
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb size={20} className="text-night-yellow" weight="duotone" />
          <h2 className="text-lg font-semibold text-foreground">Ideas</h2>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-primary border-primary/30" onClick={() => { setEditingIdea(null); setShowForm(true); }}>
          <Plus size={14} /> Add Idea
        </Button>
      </div>

      {ideas.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">No ideas yet — capture your half-baked thoughts here.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <Card key={idea.id} className="group cursor-pointer hover:border-primary/30 transition-colors" onClick={() => { setEditingIdea(idea); setShowForm(true); }}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">{idea.title}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleDelete(idea.id); }}>
                    <Trash size={12} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {idea.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-3">{idea.description}</p>}
                {idea.tags && idea.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {idea.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] gap-1">
                        <Tag size={10} /> {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">{new Date(idea.createdOn).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingIdea(null); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>{editingIdea ? 'Edit Idea' : 'New Idea'}</DialogTitle></DialogHeader>
          <IdeaForm idea={editingIdea} onSave={handleSave} onCancel={() => { setShowForm(false); setEditingIdea(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IdeaForm({ idea, onSave, onCancel }: { idea: Idea | null; onSave: (t: string, d: string, tags: string[]) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(idea?.title || '');
  const [description, setDescription] = useState(idea?.description || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(idea?.tags || []);

  function addTag() {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) return;
    setTags([...tags, tag]);
    setTagInput('');
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Idea title..." autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your idea..." rows={3} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tags</Label>
        <div className="flex flex-wrap gap-1 mb-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer text-[10px]" onClick={() => setTags(tags.filter((t) => t !== tag))}>
              {tag} ×
            </Badge>
          ))}
        </div>
        <div className="flex gap-1">
          <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add tag..." className="h-7 text-xs" />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addTag}>Add</Button>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSave(title, description, tags)} disabled={!title.trim()}>Save</Button>
      </div>
    </div>
  );
}
