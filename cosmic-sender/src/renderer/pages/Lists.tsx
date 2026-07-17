import { useEffect, useState } from 'react';
import { PageHeader, EmptyState, Field } from '../components/UI';
import { Plus, Trash2, Users } from 'lucide-react';
import { useUI } from '../store/ui';

export default function Lists() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [membersFor, setMembersFor] = useState<any | null>(null);
  const { toast, openConfirm } = useUI();

  const refresh = async () => {
    const r = await window.cosmic.listLists();
    if (r.ok) setRows(r.data as any[]);
  };
  useEffect(() => { void refresh(); }, []);

  const save = async () => {
    const res = await window.cosmic.upsertList(editing);
    if (!res.ok) return toast({ kind: 'error', title: 'Save failed', description: res.error });
    setEditing(null);
    await refresh();
  };

  const del = (row: any) => openConfirm({
    title: `Delete "${row.name}"?`, destructive: true, confirmLabel: 'Delete',
    onConfirm: async () => { await window.cosmic.deleteList(row.id); await refresh(); },
  });

  const openMembers = async (row: any) => {
    const m = await window.cosmic.listMembers(row.id);
    if (m.ok) setMembersFor({ list: row, members: m.data });
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="Contact Lists"
        subtitle="Group contacts into lists to target specific campaigns."
        actions={<button data-testid="list-add" className="cs-btn cs-btn-primary" onClick={() => setEditing({ name: '', description: '' })}><Plus size={14}/> New list</button>}
      />
      <div className="px-8">
        {rows.length === 0 ? (
          <EmptyState testid="lists-empty" title="No lists yet" description="Create your first list to organize your contacts." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rows.map((r) => (
              <div key={r.id} className="cs-card p-5" data-testid={`list-card-${r.name}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-cosmic-muted mt-0.5">{r.description}</div>
                  </div>
                  <span className="cs-badge cs-badge-info"><Users size={12}/> {r.member_count}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="cs-btn cs-btn-ghost" onClick={() => openMembers(r)}>View members</button>
                  <button className="cs-btn cs-btn-ghost" onClick={() => setEditing(r)}>Edit</button>
                  <button className="cs-btn cs-btn-ghost text-red-400" onClick={() => del(r)}><Trash2 size={14}/> Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="cs-card p-6 w-[520px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-2xl mb-4">{editing.id ? 'Edit list' : 'New list'}</div>
            <Field label="Name"><input data-testid="list-name" className="cs-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Description"><input className="cs-input" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 mt-6">
              <button className="cs-btn cs-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="cs-btn cs-btn-primary" onClick={save} data-testid="list-save">Save</button>
            </div>
          </div>
        </div>
      )}

      {membersFor && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => setMembersFor(null)}>
          <div className="cs-card p-6 w-[640px] max-w-[95vw] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-2xl">{membersFor.list.name}</div>
            <div className="text-xs text-cosmic-muted">{membersFor.members.length} members</div>
            <ul className="mt-3 text-sm divide-y divide-white/5">
              {membersFor.members.map((m: any) => <li key={m.id} className="py-2">{m.email} <span className="text-cosmic-muted">— {[m.first_name, m.last_name].filter(Boolean).join(' ')}</span></li>)}
              {membersFor.members.length === 0 && <li className="text-cosmic-muted">No contacts in this list yet. Add contacts on the New Send page.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
