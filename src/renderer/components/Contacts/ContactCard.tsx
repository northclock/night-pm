import { User, PencilSimple, Trash, Link } from '@phosphor-icons/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Contact } from '../../types';

interface ContactCardProps {
  contact: Contact;
  allContacts: Contact[];
  onEdit?: () => void;
  onDelete?: () => void;
  accentColor?: string;
  projectName?: string;
}

export function ContactCard({ contact, allContacts, onEdit, onDelete, accentColor, projectName }: ContactCardProps) {
  return (
    <Card
      className="group hover:border-primary/30 transition-colors"
      style={accentColor ? { borderLeftWidth: 3, borderLeftColor: accentColor } : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${accentColor ? '' : 'bg-primary/20'}`}
            style={accentColor ? { backgroundColor: `${accentColor}20` } : undefined}
          >
            <User size={18} className="text-primary" weight="duotone" style={accentColor ? { color: accentColor } : undefined} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {projectName && <span className="text-[11px] font-semibold" style={{ color: accentColor }}>{projectName}:</span>}
              <span className="text-sm font-semibold text-foreground truncate">{contact.name}</span>
              {(onEdit || onDelete) && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEdit && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onEdit}><PencilSimple size={12} /></Button>}
                  {onDelete && <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={onDelete}><Trash size={12} /></Button>}
                </div>
              )}
            </div>
            {contact.title && <div className="text-xs text-primary mt-0.5" style={accentColor ? { color: accentColor } : undefined}>{contact.title}</div>}
            {contact.info && <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{contact.info}</div>}
            {contact.relatedContacts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {contact.relatedContacts.map((rc, i) => {
                  const related = allContacts.find((c) => c.id === rc.relatedContactId);
                  return (
                    <Badge key={i} variant="outline" className="text-[10px] gap-1">
                      <Link size={9} /> {related?.name ?? 'Unknown'} - {rc.relationship}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
