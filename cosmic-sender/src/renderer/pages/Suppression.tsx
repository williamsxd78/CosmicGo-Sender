import { useEffect, useState } from 'react';
import { PageHeader, EmptyState, Field } from '../components/UI';
import { Plus, Trash2, Upload, Download, Search } from 'lucide-react';
import { useUI } from '../store/ui';

export default function Suppression() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ email: '', reason: 'MANUAL', notes: '' });
  const { toast, openConfirm } = useUI();

  const refresh = async () => {
    const r = await window.cosmic.listSuppression(search || undefined);
    if (r.ok) setRows(r.data as any[]);
  };
  useEffect(() => { void refresh(); }, [search]);

  const remove = (email: string) => openConfirm({
    title: `Remove "${email}" from suppression?`,
    description: 'Future campaigns will be allowed to include this address again.',
    confirmLabel: 'Remove',
    destructive: true,
    onConfirm: async () => {
      await window.cosmic.removeSuppression(email);
      await refresh();
    },
  });

  const add = async () => {
    const res = await window.cosmic.addSuppression(form);
    if (!res.ok) return toast({ kind: 'error', title: 'Failed', description: res.error });
    setAdding(false);
    setForm({ email: '', reason: 'MANUAL', notes: '' });
    await refresh();
  };

  const importCsv = async () => {
    const res = await window.cosmic.openFile({ filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (!res.ok) return;
    const d = res.data as any;
    if (d.canceled || !d.filePaths?.length) return;
    const r = await window.cosmic.importSuppression(d.filePaths[0]);
    if (!r.ok) return toast({ kind: 'error', title: 'Import failed', description: r.error });
    toast({ kind: 'success', title: `Imported ${(r.data as any).imported} entries` });
    await refresh();
  };

  const exportCsv = async () => {
    const r = await window.cosmic.exportSuppression();
    if (!r.ok) return toast({ kind: 'error', title: 'Export failed', description: r.error });
    await window.cosmic.saveFile({ defaultPath: 'suppression.csv', filters: [{ name: 'CSV', extensions: ['csv'] }], content: r.data });
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="Suppression List"
        subtitle="Emails on this list are never contacted. Suppression is checked automatically before any send."
        actions={
          <>
            <button data-testid="suppression-import" className="cs-btn cs-btn-ghost" onClick={importCsv}><Upload size={14}/> Import</button>
            <button data-testid="suppression-export" className="cs-btn cs-btn-ghost" onClick={exportCsv}><Download size={14}/> Export</button>
            <button data-testid="suppression-add" className="cs-btn cs-btn-primary" onClick={() => setAdding(true)}><Plus size={14}/> Add</button>
          </>
        }
      />
      <div className="px-8 mb-4">
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cosmic-muted" />
          <input className="cs-input pl-9" placeholder="Search email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="px-8">
        {rows.length === 0 ? (
          <EmptyState testid="suppression-empty" title="Suppression list is empty" />
        ) : (
          <div className="cs-card overflow-hidden">
            <table className="w-full text-sm" data-testid="suppression-table">
              <thead className="text-xs uppercase text-cosmic-muted border-b border-cosmic-border">
                <tr><th className="text-left px-4 py-3">Email</th><th className="text-left px-4 py-3">Reason</th><th className="text-left px-4 py-3">Source</th><th className="text-left px-4 py-3">Added</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email} className="border-b border-white/5">
                    <td className="px-4 py-2 font-mono text-xs">{r.email}</td>
                    <td className="px-4 py-2"><span className="cs-badge cs-badge-warn">{r.reason}</span></td>
                    <td className="px-4 py-2 text-cosmic-muted">{r.source ?? ''}</td>
                    <td className="px-4 py-2 text-cosmic-muted font-mono text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-2"><button className="text-red-400" onClick={() => remove(r.email)}><Trash2 size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => setAdding(false)}>
          <div className="cs-card p-6 w-[480px]" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-2xl mb-4">Add to suppression</div>
            <Field label="Email"><input className="cs-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Reason">
              <select className="cs-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                {['MANUAL','UNSUBSCRIBED','HARD_BOUNCE','COMPLAINT','INVALID','DO_NOT_CONTACT','IMPORTED'].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Notes"><input className="cs-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 mt-6">
              <button className="cs-btn cs-btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
              <button className="cs-btn cs-btn-primary" onClick={add}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
