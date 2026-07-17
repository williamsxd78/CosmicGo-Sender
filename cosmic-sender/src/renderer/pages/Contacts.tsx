import { useEffect, useState } from 'react';
import { PageHeader, EmptyState, Field } from '../components/UI';
import { Plus, Search, Trash2, Upload, Download } from 'lucide-react';
import { useUI } from '../store/ui';

export default function Contacts() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [importer, setImporter] = useState<any | null>(null);
  const { toast, openConfirm } = useUI();

  const refresh = async () => {
    const r = await window.cosmic.listContacts({ search, limit: 500 });
    if (r.ok) { setRows((r.data as any).rows); setTotal((r.data as any).total); }
  };
  useEffect(() => { void refresh(); }, [search]);

  const save = async () => {
    if (!editing) return;
    const res = await window.cosmic.upsertContact(editing);
    if (!res.ok) return toast({ kind: 'error', title: 'Save failed', description: res.error });
    toast({ kind: 'success', title: 'Contact saved' });
    setEditing(null);
    await refresh();
  };

  const remove = (id: string) => openConfirm({
    title: 'Delete contact?', destructive: true, confirmLabel: 'Delete',
    onConfirm: async () => { await window.cosmic.deleteContact(id); await refresh(); },
  });

  const exportCsv = async () => {
    const res = await window.cosmic.exportContactsCsv();
    if (!res.ok) return toast({ kind: 'error', title: 'Export failed', description: res.error });
    await window.cosmic.saveFile({ defaultPath: 'contacts.csv', filters: [{ name: 'CSV', extensions: ['csv'] }], content: res.data });
    toast({ kind: 'success', title: 'Contacts exported' });
  };

  const openImport = async () => {
    const res = await window.cosmic.openFile({ filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (!res.ok) return;
    const d = res.data as any;
    if (d.canceled || !d.filePaths?.length) return;
    const filePath = d.filePaths[0];
    // Ask main to read + detect headers
    const raw = await window.cosmic.readTextFile(filePath);
    if (!raw.ok) return toast({ kind: 'error', title: 'Failed to read file' });
    const lines = (raw.data as string).split(/\r?\n/).filter(Boolean).slice(0, 6);
    const headers = (lines[0] ?? '').replace(/^\uFEFF/, '').split(',').map((s: string) => s.trim().replace(/^"|"$/g, ''));
    const preview = lines.slice(1).map((line: string) => {
      const cols = line.split(',');
      const o: Record<string, string> = {};
      headers.forEach((h: string, i: number) => { o[h] = (cols[i] ?? '').replace(/^"|"$/g, ''); });
      return o;
    });
    const map: Record<string, string> = {};
    headers.forEach((h: string) => {
      const norm = h.toLowerCase();
      if (norm.includes('email')) map[h] = 'email';
      else if (norm.includes('first')) map[h] = 'first_name';
      else if (norm.includes('last')) map[h] = 'last_name';
      else if (norm.includes('full')) map[h] = 'full_name';
      else if (norm.includes('company')) map[h] = 'company';
      else if (norm.includes('phone')) map[h] = 'phone';
      else if (norm.includes('city')) map[h] = 'city';
      else if (norm.includes('state')) map[h] = 'state';
      else if (norm.includes('country')) map[h] = 'country';
      else if (norm.includes('tag')) map[h] = 'tags';
      else if (norm === 'notes') map[h] = 'notes';
      else map[h] = '';
    });
    setImporter({ filePath, headers, preview, map, duplicateHandling: 'SKIP' });
  };

  const runImport = async () => {
    const res = await window.cosmic.importContactsCsv({
      filePath: importer.filePath,
      columnMap: importer.map,
      duplicateHandling: importer.duplicateHandling,
      source: 'csv-import',
    });
    if (!res.ok) return toast({ kind: 'error', title: 'Import failed', description: res.error });
    const r = res.data as any;
    toast({
      kind: 'success',
      title: 'Import complete',
      description: `Imported ${r.imported}, updated ${r.updated}, skipped duplicates ${r.duplicates}, invalid ${r.invalid}, suppressed ${r.suppressed}.`,
    });
    setImporter(null);
    await refresh();
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="Contacts"
        subtitle={`Total contacts: ${total}. Personalization variables like {first_name}, {company} come from these fields.`}
        actions={
          <>
            <button data-testid="contacts-import" className="cs-btn cs-btn-ghost" onClick={openImport}><Upload size={14}/> Import CSV</button>
            <button data-testid="contacts-export" className="cs-btn cs-btn-ghost" onClick={exportCsv}><Download size={14}/> Export CSV</button>
            <button data-testid="contacts-add" className="cs-btn cs-btn-primary" onClick={() => setEditing({ email: '', first_name: '', last_name: '', company: '', tags: [] })}><Plus size={14}/> Add</button>
          </>
        }
      />

      <div className="px-8 mb-4">
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cosmic-muted" />
          <input data-testid="contacts-search" className="cs-input pl-9" placeholder="Search email, name, company…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="px-8">
        {rows.length === 0 ? (
          <EmptyState testid="contacts-empty" title="No contacts yet" description="Add a contact or import a CSV to get started." />
        ) : (
          <div className="cs-card overflow-hidden">
            <table className="w-full text-sm" data-testid="contacts-table">
              <thead className="text-xs uppercase tracking-widest text-cosmic-muted border-b border-cosmic-border">
                <tr>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Company</th>
                  <th className="text-left px-4 py-3">Country</th>
                  <th className="text-left px-4 py-3">Consent</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer" onClick={() => setEditing({ ...r, tags: JSON.parse(r.tags || '[]') })}>
                    <td className="px-4 py-2 font-mono text-xs">{r.email}</td>
                    <td className="px-4 py-2">{[r.first_name, r.last_name].filter(Boolean).join(' ')}</td>
                    <td className="px-4 py-2 text-cosmic-muted">{r.company ?? ''}</td>
                    <td className="px-4 py-2 text-cosmic-muted">{r.country ?? ''}</td>
                    <td className="px-4 py-2"><span className="cs-badge cs-badge-muted">{r.consent_status}</span></td>
                    <td className="px-2">
                      <button className="text-red-400" onClick={(e) => { e.stopPropagation(); remove(r.id); }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="cs-card p-6 w-[640px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-2xl mb-4">{editing.id ? 'Edit contact' : 'Add contact'}</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><input data-testid="contact-email" className="cs-input" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              <Field label="Phone"><input className="cs-input" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
              <Field label="First name"><input className="cs-input" value={editing.first_name ?? ''} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} /></Field>
              <Field label="Last name"><input className="cs-input" value={editing.last_name ?? ''} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} /></Field>
              <Field label="Company"><input className="cs-input" value={editing.company ?? ''} onChange={(e) => setEditing({ ...editing, company: e.target.value })} /></Field>
              <Field label="Country"><input className="cs-input" value={editing.country ?? ''} onChange={(e) => setEditing({ ...editing, country: e.target.value })} /></Field>
              <Field label="City"><input className="cs-input" value={editing.city ?? ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></Field>
              <Field label="State"><input className="cs-input" value={editing.state ?? ''} onChange={(e) => setEditing({ ...editing, state: e.target.value })} /></Field>
              <Field label="Tags (comma separated)">
                <input className="cs-input" value={(editing.tags ?? []).join(',')} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} />
              </Field>
              <Field label="Consent">
                <select className="cs-input" value={editing.consent_status ?? 'UNKNOWN'} onChange={(e) => setEditing({ ...editing, consent_status: e.target.value })}>
                  <option value="UNKNOWN">Unknown</option>
                  <option value="OPTED_IN">Opted in</option>
                  <option value="OPTED_OUT">Opted out</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="cs-btn cs-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="cs-btn cs-btn-primary" onClick={save} data-testid="contact-save">Save contact</button>
            </div>
          </div>
        </div>
      )}

      {importer && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="cs-card p-6 w-[760px] max-w-[95vw] max-h-[92vh] overflow-y-auto" data-testid="csv-importer">
            <div className="font-display text-2xl mb-2">CSV import</div>
            <div className="text-sm text-cosmic-muted mb-4">Map CSV columns to contact fields. Emails are validated; suppressed addresses are skipped.</div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-cosmic-muted"><tr><th className="text-left py-2">CSV column</th><th className="text-left">Preview</th><th className="text-left">Map to</th></tr></thead>
              <tbody>
                {importer.headers.map((h: string) => (
                  <tr key={h} className="border-t border-white/5">
                    <td className="py-2 font-mono">{h}</td>
                    <td className="py-2 text-cosmic-muted">{importer.preview[0]?.[h] ?? ''}</td>
                    <td className="py-2">
                      <select className="cs-input" value={importer.map[h]} onChange={(e) => setImporter({ ...importer, map: { ...importer.map, [h]: e.target.value } })}>
                        <option value="">— ignore —</option>
                        <option value="email">Email</option>
                        <option value="first_name">First name</option>
                        <option value="last_name">Last name</option>
                        <option value="full_name">Full name</option>
                        <option value="phone">Phone</option>
                        <option value="company">Company</option>
                        <option value="city">City</option>
                        <option value="state">State</option>
                        <option value="country">Country</option>
                        <option value="tags">Tags</option>
                        <option value="custom_1">Custom 1</option>
                        <option value="custom_2">Custom 2</option>
                        <option value="custom_3">Custom 3</option>
                        <option value="notes">Notes</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4">
              <Field label="Duplicate handling">
                <select className="cs-input" value={importer.duplicateHandling} onChange={(e) => setImporter({ ...importer, duplicateHandling: e.target.value })}>
                  <option value="SKIP">Skip duplicates</option>
                  <option value="UPDATE">Update existing</option>
                  <option value="FILL_MISSING">Fill missing fields only</option>
                  <option value="REPLACE">Replace existing</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="cs-btn cs-btn-ghost" onClick={() => setImporter(null)}>Cancel</button>
              <button className="cs-btn cs-btn-primary" data-testid="csv-import-run" onClick={runImport}>Run import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
