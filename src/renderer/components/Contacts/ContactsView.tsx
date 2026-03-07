import { useState, useEffect, useCallback } from 'react';
import { Plus, MagnifyingGlass } from '@phosphor-icons/react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { OpenFile, Contact } from '../../types';
import { ContactCard } from './ContactCard';
import { ContactForm } from './ContactForm';

interface ContactsViewProps { file: OpenFile; }

export function ContactsView({ file }: ContactsViewProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

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

  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Contacts</h2>
        <Button variant="outline" size="sm" className="gap-1.5 text-primary border-primary/30" onClick={() => { setEditingContact(null); setShowForm(true); }}>
          <Plus size={14} /> Add Contact
        </Button>
      </div>
      <div className="relative mb-4">
        <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts..." className="pl-8" />
      </div>
      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">{search ? 'No matching contacts' : 'No contacts yet'}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <ContactCard key={c.id} contact={c} allContacts={contacts} onEdit={() => { setEditingContact(c); setShowForm(true); }} onDelete={() => handleDelete(c.id)} />
          ))}
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
