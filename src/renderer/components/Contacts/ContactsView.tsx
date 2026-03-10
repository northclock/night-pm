import { useState, useEffect, useCallback } from 'react';
import { Plus, MagnifyingGlass } from '@phosphor-icons/react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { OpenFile, Contact } from '../../types';
import { ContactCard } from './ContactCard';
import { ContactForm } from './ContactForm';
import { useChildProjectData } from '../../hooks/useChildProjectData';
import { ChildrenToggleButton, ChildrenLegend } from '../ui/ChildrenToggleBar';

interface ContactsViewProps { file: OpenFile; }

export function ContactsView({ file }: ContactsViewProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const {
    showChildren, toggleChildren, children: childProjects,
    loaded: childrenLoaded, childDisplayItems, toggleChildVisibility, hasProject,
  } = useChildProjectData<Contact>(file.path, 'contacts.json');

  useEffect(() => {
    try { setContacts(JSON.parse(file.content || '[]')); } catch { setContacts([]); }
  }, [file.content]);

  const saveContacts = useCallback(async (c: Contact[]) => {
    setContacts(c);
    await window.nightAPI.fs.writeFile(file.path, JSON.stringify(c, null, 2));
  }, [file.path]);

  function handleAdd(data: Omit<Contact, 'id'>) { saveContacts([...contacts, { ...data, id: uuidv4() }]); setShowForm(false); }
  function handleUpdate(data: Omit<Contact, 'id'>) {
    if (!editingContact) return;
    saveContacts(contacts.map((c) => c.id === editingContact.id ? { ...c, ...data } : c));
    setShowForm(false); setEditingContact(null);
  }
  function handleDelete(id: string) { saveContacts(contacts.filter((c) => c.id !== id)); }

  const allContacts = [...contacts, ...childDisplayItems.map((d) => d.item)];
  const childColorMap = new Map(childDisplayItems.map((d) => [d.item.id, { color: d._color, name: d._projectName }]));
  const childItemIds = new Set(childDisplayItems.map((d) => d.item.id));

  const filtered = allContacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Contacts</h2>
        <div className="flex items-center gap-2">
          <ChildrenToggleButton showChildren={showChildren} onToggle={toggleChildren} hasProject={hasProject} />
          <Button variant="outline" size="sm" className="gap-1.5 text-primary border-primary/30" onClick={() => { setEditingContact(null); setShowForm(true); }}>
            <Plus size={14} /> Add Contact
          </Button>
        </div>
      </div>
      <ChildrenLegend showChildren={showChildren} children={childProjects} loaded={childrenLoaded} onToggleChild={toggleChildVisibility} />
      <div className="relative mb-4">
        <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts..." className="pl-8" />
      </div>
      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">{search ? 'No matching contacts' : 'No contacts yet'}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((c) => {
            const isChild = childItemIds.has(c.id);
            const childInfo = childColorMap.get(c.id);
            return (
              <ContactCard
                key={`${childInfo?.name ?? 'own'}-${c.id}`}
                contact={c}
                allContacts={allContacts}
                onEdit={isChild ? undefined : () => { setEditingContact(c); setShowForm(true); }}
                onDelete={isChild ? undefined : () => handleDelete(c.id)}
                accentColor={childInfo?.color}
                projectName={childInfo?.name}
              />
            );
          })}
        </div>
      )}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingContact(null); } }}>
        <DialogContent className="sm:max-w-[460px] p-0">
          <ContactForm contact={editingContact} allContacts={contacts} onSave={editingContact ? handleUpdate : handleAdd} onCancel={() => { setShowForm(false); setEditingContact(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
