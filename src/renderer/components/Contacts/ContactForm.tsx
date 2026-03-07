import { useState } from 'react';
import { Plus, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Contact, RelatedContact } from '../../types';

interface ContactFormProps {
  contact?: Contact | null;
  allContacts: Contact[];
  onSave: (data: Omit<Contact, 'id'>) => void;
  onCancel: () => void;
}

export function ContactForm({ contact, allContacts, onSave, onCancel }: ContactFormProps) {
  const [name, setName] = useState(contact?.name ?? '');
  const [title, setTitle] = useState(contact?.title ?? '');
  const [info, setInfo] = useState(contact?.info ?? '');
  const [relatedContacts, setRelatedContacts] = useState<RelatedContact[]>(contact?.relatedContacts ?? []);

  const availableContacts = allContacts.filter(
    (c) => c.id !== contact?.id && !relatedContacts.some((rc) => rc.relatedContactId === c.id),
  );

  function addRelation() {
    if (availableContacts.length === 0) return;
    setRelatedContacts([...relatedContacts, { relatedContactId: availableContacts[0].id, relationship: '' }]);
  }
  function removeRelation(idx: number) { setRelatedContacts(relatedContacts.filter((_, i) => i !== idx)); }
  function updateRelation(idx: number, field: keyof RelatedContact, value: string) {
    setRelatedContacts(relatedContacts.map((rc, i) => (i === idx ? { ...rc, [field]: value } : rc)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), title: title.trim(), info: info.trim(), relatedContacts });
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">{contact ? 'Edit Contact' : 'New Contact'}</h3>
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label>Title / Role</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Info</Label>
        <Textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={3} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Related Contacts</Label>
          {availableContacts.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary" onClick={addRelation}>
              <Plus size={11} /> Add
            </Button>
          )}
        </div>
        {relatedContacts.map((rc, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <Select value={rc.relatedContactId} onValueChange={(v) => updateRelation(i, 'relatedContactId', v)}>
              <SelectTrigger className="flex-1 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {allContacts.filter((c) => c.id !== contact?.id).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="flex-1 h-7 text-xs" value={rc.relationship} onChange={(e) => updateRelation(i, 'relationship', e.target.value)} placeholder="Relationship..." />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRelation(i)}>
              <X size={12} />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">{contact ? 'Update' : 'Create'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
