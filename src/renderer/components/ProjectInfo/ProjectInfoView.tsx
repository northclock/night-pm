import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { OpenFile, ProjectInfo } from '../../types';

interface Props { file: OpenFile; }

export function ProjectInfoView({ file }: Props) {
  const [info, setInfo] = useState<ProjectInfo>({
    name: '', description: '', whoAmI: '', created: '', tags: [],
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    try {
      const parsed = JSON.parse(file.content || '{}');
      setInfo({ name: parsed.name || '', description: parsed.description || '', whoAmI: parsed.whoAmI || '', created: parsed.created || '', tags: parsed.tags || [] });
    } catch { /* empty */ }
  }, [file.content]);

  const save = useCallback(async (updated: ProjectInfo) => {
    setInfo(updated);
    await window.nightAPI.fs.writeFile(file.path, JSON.stringify(updated, null, 2));
  }, [file.path]);

  function addTag() {
    const tag = tagInput.trim();
    if (!tag || info.tags.includes(tag)) return;
    save({ ...info, tags: [...info.tags, tag] });
    setTagInput('');
  }

  function removeTag(tag: string) {
    save({ ...info, tags: info.tags.filter((t) => t !== tag) });
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-auto max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-foreground mb-6">Project Identity</h2>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs">Project Name</Label>
          <Input
            value={info.name}
            onChange={(e) => save({ ...info, name: e.target.value })}
            placeholder="Project name..."
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea
            value={info.description}
            onChange={(e) => setInfo({ ...info, description: e.target.value })}
            onBlur={() => save(info)}
            placeholder="Short project description..."
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Who Am I</Label>
          <Input
            value={info.whoAmI}
            onChange={(e) => save({ ...info, whoAmI: e.target.value })}
            placeholder="e.g., Senior PM, Tech Lead, Consultant..."
          />
          <p className="text-[11px] text-muted-foreground">
            Your role in this project — the AI will tailor its tone accordingly.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Tags</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {info.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeTag(tag)}>
                {tag} ×
              </Badge>
            ))}
          </div>
          <div className="flex gap-1">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              placeholder="Add tag..."
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addTag}>
              Add
            </Button>
          </div>
        </div>

        {info.created && (
          <p className="text-[11px] text-muted-foreground">
            Created: {new Date(info.created).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
