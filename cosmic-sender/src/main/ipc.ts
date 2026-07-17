import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { IPC } from '@shared/ipc';
import * as auth from './auth';
import * as settings from './settings';
import * as providers from './providers';
import * as contacts from './contacts';
import * as lists from './lists';
import * as templates from './templates';
import * as suppression from './suppression';
import * as campaigns from './campaigns';
import * as dashboard from './dashboard';
import { logActivity, logTechnical, listActivityLogs, listTechnicalLogs } from './logger';
import { credentialBackendName, readCredential } from './credentials';
import { testConnection, sendMessage } from './smtp';
import { CampaignEngine } from './campaigns';

const engine = new CampaignEngine();

function requireUnlocked(): void {
  if (!auth.isUnlocked()) throw new Error('LOCKED');
  auth.touchSession();
}

function wrap<T>(fn: () => T | Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string; code?: string }> {
  return Promise.resolve()
    .then(fn)
    .then((data) => ({ ok: true as const, data }))
    .catch((err: Error) => {
      const message = err.message || 'Unknown error';
      logTechnical('ipc', 'Handler error', { message, stack: err.stack }, 'error');
      return { ok: false as const, error: message, code: message === 'LOCKED' ? 'LOCKED' : undefined };
    });
}

export function registerIpc(mainWindow: () => BrowserWindow | null): void {
  engine.on('progress', (row) => {
    const w = mainWindow();
    if (w && !w.isDestroyed()) w.webContents.send(IPC.CAMPAIGN_PROGRESS_EVENT, row);
  });

  // App state / setup / auth --------------------------------------
  ipcMain.handle(IPC.APP_STATE, async () =>
    wrap(async () => ({
      first_run: !auth.hasPasswordSet(),
      unlocked: auth.isUnlocked(),
      credential_backend: await credentialBackendName(),
      platform: process.platform,
      app_version: app.getVersion(),
    })),
  );

  ipcMain.handle(IPC.AUTH_SET_PASSWORD, (_e, payload: { password: string }) =>
    wrap(async () => {
      await auth.setInitialPassword(payload.password);
      return { ok: true };
    }),
  );
  ipcMain.handle(IPC.AUTH_LOGIN, (_e, payload: { password: string }) =>
    wrap(async () => {
      const ok = await auth.verifyPassword(payload.password);
      if (!ok) throw new Error('Incorrect password');
      return { ok: true };
    }),
  );
  ipcMain.handle(IPC.AUTH_LOGOUT, () => wrap(async () => { auth.lockSession(); return { ok: true }; }));
  ipcMain.handle(IPC.AUTH_LOCK, () => wrap(async () => { auth.lockSession(); return { ok: true }; }));
  ipcMain.handle(IPC.AUTH_CHANGE_PASSWORD, (_e, payload: { current: string; next: string }) =>
    wrap(async () => {
      requireUnlocked();
      await auth.changePassword(payload.current, payload.next);
      return { ok: true };
    }),
  );

  // Settings ------------------------------------------------------
  ipcMain.handle(IPC.SETTINGS_GET, () => wrap(() => { requireUnlocked(); return settings.getSettings(); }));
  ipcMain.handle(IPC.SETTINGS_SET, (_e, patch: any) => wrap(() => { requireUnlocked(); return settings.updateSettings(patch); }));

  // Providers -----------------------------------------------------
  ipcMain.handle(IPC.PROVIDER_LIST, () => wrap(() => { requireUnlocked(); return providers.listProviders(); }));
  ipcMain.handle(IPC.PROVIDER_GET, (_e, guid: string) => wrap(() => { requireUnlocked(); return providers.getProviderRow(guid); }));
  ipcMain.handle(IPC.PROVIDER_CREATE, (_e, input: any) => wrap(async () => { requireUnlocked(); return providers.createProvider(input); }));
  ipcMain.handle(IPC.PROVIDER_UPDATE, (_e, payload: { guid: string; input: any }) =>
    wrap(async () => { requireUnlocked(); return providers.updateProvider(payload.guid, payload.input); }),
  );
  ipcMain.handle(IPC.PROVIDER_DELETE, (_e, guid: string) => wrap(async () => { requireUnlocked(); await providers.deleteProvider(guid); return { ok: true }; }));
  ipcMain.handle(IPC.PROVIDER_DUPLICATE, (_e, guid: string) => wrap(async () => { requireUnlocked(); return providers.duplicateProvider(guid); }));
  ipcMain.handle(IPC.PROVIDER_TEST_CONNECTION, (_e, guid: string) =>
    wrap(async () => {
      requireUnlocked();
      const row = providers.getProviderRow(guid);
      if (!row) throw new Error('Provider not found');
      const publicRow: any = {
        ...row,
        enabled: !!row.enabled,
        reply_to: row.reply_to ?? '',
        region: row.region ?? '',
        notes: row.notes ?? '',
        has_credentials: true,
        kind: row.kind,
      };
      const result = await testConnection(publicRow);
      logActivity(`Connection test ${result.ok ? 'succeeded' : 'failed'} for ${row.name}: ${result.message}`);
      return result;
    }),
  );
  ipcMain.handle(IPC.PROVIDER_SEND_TEST_EMAIL, (_e, payload: { guid: string; identity_id: string; to: string; subject: string; html: string; text: string }) =>
    wrap(async () => {
      requireUnlocked();
      const row = providers.getProviderRow(payload.guid);
      if (!row) throw new Error('Provider not found');
      const identity = providers.listIdentities(payload.guid).find((i) => i.id === payload.identity_id);
      if (!identity) throw new Error('Sender identity not found');
      const publicRow: any = { ...row, enabled: !!row.enabled, reply_to: row.reply_to ?? '', region: row.region ?? '', notes: row.notes ?? '', has_credentials: true, kind: row.kind };
      const result = await sendMessage({
        provider: publicRow,
        from: { name: identity.name, email: identity.email },
        replyTo: identity.reply_to || undefined,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      logActivity(`Test email to ${payload.to} — ${result.ok ? 'accepted by SMTP' : 'failed'}`);
      return result;
    }),
  );

  // Identities ----------------------------------------------------
  ipcMain.handle(IPC.IDENTITY_LIST, (_e, providerGuid?: string) => wrap(() => { requireUnlocked(); return providers.listIdentities(providerGuid); }));
  ipcMain.handle(IPC.IDENTITY_UPSERT, (_e, input: any) => wrap(() => { requireUnlocked(); return providers.upsertIdentity(input); }));
  ipcMain.handle(IPC.IDENTITY_DELETE, (_e, id: string) => wrap(() => { requireUnlocked(); providers.deleteIdentity(id); return { ok: true }; }));

  // Contacts ------------------------------------------------------
  ipcMain.handle(IPC.CONTACT_LIST, (_e, opts?: any) => wrap(() => { requireUnlocked(); return { rows: contacts.listContacts(opts), total: contacts.countContacts() }; }));
  ipcMain.handle(IPC.CONTACT_UPSERT, (_e, input: any) => wrap(() => { requireUnlocked(); return contacts.upsertContact(input); }));
  ipcMain.handle(IPC.CONTACT_DELETE, (_e, id: string) => wrap(() => { requireUnlocked(); contacts.deleteContact(id); return { ok: true }; }));
  ipcMain.handle(IPC.CONTACT_BULK_DELETE, (_e, ids: string[]) => wrap(() => { requireUnlocked(); return { removed: contacts.bulkDeleteContacts(ids) }; }));
  ipcMain.handle(IPC.CONTACT_IMPORT_CSV, (_e, payload: { filePath: string; columnMap: Record<string, string>; duplicateHandling: any; source?: string }) =>
    wrap(() => { requireUnlocked(); return contacts.importContactsCsv(payload); }),
  );
  ipcMain.handle(IPC.CONTACT_EXPORT_CSV, () => wrap(() => { requireUnlocked(); return contacts.exportContactsCsv(); }));

  // Lists ---------------------------------------------------------
  ipcMain.handle(IPC.LIST_LIST, () => wrap(() => { requireUnlocked(); return lists.listLists(); }));
  ipcMain.handle(IPC.LIST_UPSERT, (_e, input: any) => wrap(() => { requireUnlocked(); return lists.upsertList(input); }));
  ipcMain.handle(IPC.LIST_DELETE, (_e, id: string) => wrap(() => { requireUnlocked(); lists.deleteList(id); return { ok: true }; }));
  ipcMain.handle(IPC.LIST_ADD_CONTACTS, (_e, payload: { list_id: string; contact_ids: string[] }) => wrap(() => { requireUnlocked(); return { added: lists.addContactsToList(payload.list_id, payload.contact_ids) }; }));
  ipcMain.handle(IPC.LIST_REMOVE_CONTACTS, (_e, payload: { list_id: string; contact_ids: string[] }) => wrap(() => { requireUnlocked(); return { removed: lists.removeContactsFromList(payload.list_id, payload.contact_ids) }; }));
  ipcMain.handle(IPC.LIST_MEMBERS, (_e, listId: string) => wrap(() => { requireUnlocked(); return lists.listMembers(listId); }));

  // Templates -----------------------------------------------------
  ipcMain.handle(IPC.TEMPLATE_LIST, () => wrap(() => { requireUnlocked(); return templates.listTemplates(); }));
  ipcMain.handle(IPC.TEMPLATE_UPSERT, (_e, input: any) => wrap(() => { requireUnlocked(); return templates.upsertTemplate(input); }));
  ipcMain.handle(IPC.TEMPLATE_DELETE, (_e, id: string) => wrap(() => { requireUnlocked(); templates.deleteTemplate(id); return { ok: true }; }));

  // Suppression ---------------------------------------------------
  ipcMain.handle(IPC.SUPPRESSION_LIST, (_e, search?: string) => wrap(() => { requireUnlocked(); return suppression.listSuppression(search); }));
  ipcMain.handle(IPC.SUPPRESSION_ADD, (_e, input: any) => wrap(() => { requireUnlocked(); return suppression.addSuppression(input); }));
  ipcMain.handle(IPC.SUPPRESSION_REMOVE, (_e, email: string) => wrap(() => { requireUnlocked(); return { removed: suppression.removeSuppression(email) }; }));
  ipcMain.handle(IPC.SUPPRESSION_IMPORT, (_e, filePath: string) => wrap(() => { requireUnlocked(); return suppression.importSuppressionCsv(filePath); }));
  ipcMain.handle(IPC.SUPPRESSION_EXPORT, () => wrap(() => { requireUnlocked(); return suppression.exportSuppressionCsv(); }));

  // Campaigns -----------------------------------------------------
  ipcMain.handle(IPC.CAMPAIGN_LIST, () => wrap(() => { requireUnlocked(); return campaigns.listCampaigns(); }));
  ipcMain.handle(IPC.CAMPAIGN_GET, (_e, id: string) => wrap(() => { requireUnlocked(); return campaigns.getCampaign(id); }));
  ipcMain.handle(IPC.CAMPAIGN_PREFLIGHT, (_e, input: any) => wrap(() => { requireUnlocked(); return campaigns.preflight(input); }));
  ipcMain.handle(IPC.CAMPAIGN_CREATE_AND_START, (_e, payload: { input: any; startNow: boolean }) =>
    wrap(async () => {
      requireUnlocked();
      const row = campaigns.createCampaign(payload.input);
      if (payload.startNow) {
        engine.start(row.id).catch((err) => logTechnical('engine', 'start error', { message: err.message }, 'error'));
      }
      return row;
    }),
  );
  ipcMain.handle(IPC.CAMPAIGN_PAUSE, (_e, id: string) => wrap(() => { requireUnlocked(); engine.pause(id); return { ok: true }; }));
  ipcMain.handle(IPC.CAMPAIGN_RESUME, (_e, id: string) =>
    wrap(async () => {
      requireUnlocked();
      engine.resume(id).catch((err) => logTechnical('engine', 'resume error', { message: err.message }, 'error'));
      return { ok: true };
    }),
  );
  ipcMain.handle(IPC.CAMPAIGN_CANCEL, (_e, id: string) => wrap(() => { requireUnlocked(); engine.cancel(id); return { ok: true }; }));
  ipcMain.handle(IPC.CAMPAIGN_RETRY_FAILED, (_e, id: string) =>
    wrap(async () => {
      requireUnlocked();
      engine.retryFailed(id).catch((err) => logTechnical('engine', 'retry error', { message: err.message }, 'error'));
      return { ok: true };
    }),
  );
  ipcMain.handle(IPC.CAMPAIGN_RECIPIENTS, (_e, payload: { id: string; status?: string; limit?: number }) => wrap(() => { requireUnlocked(); return campaigns.listRecipients(payload.id, payload as any); }));
  ipcMain.handle(IPC.CAMPAIGN_EXPORT, (_e, payload: { id: string; format: 'csv' | 'json' }) => wrap(() => { requireUnlocked(); return campaigns.exportCampaign(payload.id, payload.format); }));

  // Dashboard -----------------------------------------------------
  ipcMain.handle(IPC.DASHBOARD_STATS, () => wrap(() => { requireUnlocked(); return dashboard.getDashboardStats(); }));

  // Logs ----------------------------------------------------------
  ipcMain.handle(IPC.LOG_ACTIVITY, (_e, payload?: { limit?: number; campaign_id?: string }) => wrap(() => { requireUnlocked(); return listActivityLogs(payload?.limit, payload?.campaign_id); }));
  ipcMain.handle(IPC.LOG_TECHNICAL, (_e, payload?: { limit?: number }) => wrap(() => { requireUnlocked(); return listTechnicalLogs(payload?.limit); }));

  // File / dialog -------------------------------------------------
  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async (_e, payload?: { filters?: Electron.FileFilter[]; multiSelections?: boolean }) => {
    const w = mainWindow();
    if (!w) return { ok: false as const, error: 'No window' };
    const res = await dialog.showOpenDialog(w, {
      properties: payload?.multiSelections ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: payload?.filters,
    });
    if (res.canceled) return { ok: true as const, data: { canceled: true, filePaths: [] } };
    // Attach file sizes for attachment sizing
    const withMeta = res.filePaths.map((p) => ({ path: p, name: path.basename(p), size_bytes: fs.statSync(p).size }));
    return { ok: true as const, data: { canceled: false, filePaths: res.filePaths, files: withMeta } };
  });
  ipcMain.handle(IPC.DIALOG_SAVE_FILE, async (_e, payload: { defaultPath?: string; filters?: Electron.FileFilter[]; content: string }) => {
    const w = mainWindow();
    if (!w) return { ok: false as const, error: 'No window' };
    const res = await dialog.showSaveDialog(w, { defaultPath: payload.defaultPath, filters: payload.filters });
    if (res.canceled || !res.filePath) return { ok: true as const, data: { canceled: true } };
    fs.writeFileSync(res.filePath, payload.content, 'utf-8');
    return { ok: true as const, data: { canceled: false, filePath: res.filePath } };
  });
  ipcMain.handle(IPC.FILE_READ_TEXT, (_e, filePath: string) => wrap(() => { requireUnlocked(); return fs.readFileSync(filePath, 'utf-8'); }));

  // External browser helper for links
  ipcMain.on('open-external', (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });
}

export function getEngine(): CampaignEngine {
  return engine;
}
