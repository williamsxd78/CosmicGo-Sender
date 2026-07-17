import { useEffect, useState } from 'react';
import { PageHeader, EmptyState, Field } from '../components/UI';
import { Plus, Trash2, FileText } from 'lucide-react';
import { useUI } from '../store/ui';

export default function Templates() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const { toast, openConfirm } = useUI();

  const refresh = async () => {
    const r = await window.cosmic.listTemplates();
    if (r.ok) setRows(r.data as any[]);
  };
  useEffect(() => { void refresh(); }, []);

  const save = async () => {
    const res = await window.cosmic.upsertTemplate(editing);
    if (!res.ok) return toast({ kind: 'error', title: 'Save failed', description: res.error });
    toast({ kind: 'success', title: 'Template saved' });
    setEditing(null);
    await refresh();
  };

  const del = (row: any) => openConfirm({
    title: `Delete "${row.name}"?`, destructive: true, confirmLabel: 'Delete',
    onConfirm: async () => { await window.cosmic.deleteTemplate(row.id); await refresh(); },
  });

  return (
    <div className="pb-10">
      <PageHeader
        title="Templates"
        subtitle="Reusable HTML + plain-text email templates. Personalization variables and inline CSS are supported."
        actions={<button data-testid="template-add" className="cs-btn cs-btn-primary" onClick={() => setEditing({ name: '', category: 'CUSTOM', subject: '', preheader: '', html_body: '', text_body: '' })}><Plus size={14}/> New template</button>}
      />
      <div className="px-8">
        {rows.length === 0 ? (
          <EmptyState testid="templates-empty" title="No templates yet" description="Create your first template." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rows.map((r) => (
              <div key={r.id} className="cs-card p-5" data-testid={`template-card-${r.id}`}>
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-cosmic-accent" />
                  <span className="font-medium">{r.name}</span>
                </div>
                <div className="text-xs text-cosmic-muted mt-1">{r.category}</div>
                <div className="text-sm mt-3 line-clamp-2">{r.subject}</div>
                <div className="flex gap-2 mt-4">
                  <button className="cs-btn cs-btn-ghost" onClick={() => setEditing(r)}>Edit</button>
                  <button className="cs-btn cs-btn-ghost text-red-400" onClick={() => del(r)}><Trash2 size={14}/> Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="cs-card p-6 w-[820px] max-w-[96vw] max-h-[92vh] overflow-y-auto" data-testid="template-form">
            <div className="font-display text-2xl mb-4">{editing.id ? 'Edit template' : 'New template'}</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><input data-testid="template-name" className="cs-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Category">
                <select className="cs-input" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {['TRANSACTIONAL','ACCOUNT_UPDATE','NOTIFICATION','NEWSLETTER','ANNOUNCEMENT','SUPPORT','CUSTOM'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Subject"><input className="cs-input" value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></Field>
              <Field label="Preheader"><input className="cs-input" value={editing.preheader ?? ''} onChange={(e) => setEditing({ ...editing, preheader: e.target.value })} /></Field>
            </div>
            <Field label="HTML body">
              <textarea data-testid="template-html" className="cs-input min-h-[200px] font-mono text-xs" value={editing.html_body} onChange={(e) => setEditing({ ...editing, html_body: e.target.value })} />
            </Field>
            <Field label="Plain text body">
              <textarea className="cs-input min-h-[120px] font-mono text-xs" value={editing.text_body} onChange={(e) => setEditing({ ...editing, text_body: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 mt-6">
              <button className="cs-btn cs-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="cs-btn cs-btn-primary" onClick={save} data-testid="template-save">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
