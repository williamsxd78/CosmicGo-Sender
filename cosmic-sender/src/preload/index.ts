import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';

/**
 * A tightly scoped IPC bridge. The renderer can only call these channels;
 * no raw Node APIs are exposed. Every request returns `{ ok, data | error }`.
 */

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

function invoke<T = any>(channel: string, ...args: unknown[]): Promise<ApiResult<T>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<ApiResult<T>>;
}

const api = {
  // App / auth
  appState: () => invoke(IPC.APP_STATE),
  setInitialPassword: (password: string) => invoke(IPC.AUTH_SET_PASSWORD, { password }),
  login: (password: string) => invoke(IPC.AUTH_LOGIN, { password }),
  logout: () => invoke(IPC.AUTH_LOGOUT),
  lock: () => invoke(IPC.AUTH_LOCK),
  changePassword: (current: string, next: string) => invoke(IPC.AUTH_CHANGE_PASSWORD, { current, next }),

  // Settings
  getSettings: () => invoke(IPC.SETTINGS_GET),
  updateSettings: (patch: unknown) => invoke(IPC.SETTINGS_SET, patch),

  // Providers
  listProviders: () => invoke(IPC.PROVIDER_LIST),
  getProvider: (guid: string) => invoke(IPC.PROVIDER_GET, guid),
  createProvider: (input: unknown) => invoke(IPC.PROVIDER_CREATE, input),
  updateProvider: (guid: string, input: unknown) => invoke(IPC.PROVIDER_UPDATE, { guid, input }),
  deleteProvider: (guid: string) => invoke(IPC.PROVIDER_DELETE, guid),
  duplicateProvider: (guid: string) => invoke(IPC.PROVIDER_DUPLICATE, guid),
  testProvider: (guid: string) => invoke(IPC.PROVIDER_TEST_CONNECTION, guid),
  sendTestEmail: (payload: unknown) => invoke(IPC.PROVIDER_SEND_TEST_EMAIL, payload),

  // Identities
  listIdentities: (providerGuid?: string) => invoke(IPC.IDENTITY_LIST, providerGuid),
  upsertIdentity: (input: unknown) => invoke(IPC.IDENTITY_UPSERT, input),
  deleteIdentity: (id: string) => invoke(IPC.IDENTITY_DELETE, id),

  // Contacts
  listContacts: (opts?: unknown) => invoke(IPC.CONTACT_LIST, opts),
  upsertContact: (input: unknown) => invoke(IPC.CONTACT_UPSERT, input),
  deleteContact: (id: string) => invoke(IPC.CONTACT_DELETE, id),
  bulkDeleteContacts: (ids: string[]) => invoke(IPC.CONTACT_BULK_DELETE, ids),
  importContactsCsv: (payload: unknown) => invoke(IPC.CONTACT_IMPORT_CSV, payload),
  exportContactsCsv: () => invoke(IPC.CONTACT_EXPORT_CSV),

  // Lists
  listLists: () => invoke(IPC.LIST_LIST),
  upsertList: (input: unknown) => invoke(IPC.LIST_UPSERT, input),
  deleteList: (id: string) => invoke(IPC.LIST_DELETE, id),
  addListContacts: (list_id: string, contact_ids: string[]) => invoke(IPC.LIST_ADD_CONTACTS, { list_id, contact_ids }),
  removeListContacts: (list_id: string, contact_ids: string[]) => invoke(IPC.LIST_REMOVE_CONTACTS, { list_id, contact_ids }),
  listMembers: (listId: string) => invoke(IPC.LIST_MEMBERS, listId),

  // Templates
  listTemplates: () => invoke(IPC.TEMPLATE_LIST),
  upsertTemplate: (input: unknown) => invoke(IPC.TEMPLATE_UPSERT, input),
  deleteTemplate: (id: string) => invoke(IPC.TEMPLATE_DELETE, id),

  // Suppression
  listSuppression: (search?: string) => invoke(IPC.SUPPRESSION_LIST, search),
  addSuppression: (input: unknown) => invoke(IPC.SUPPRESSION_ADD, input),
  removeSuppression: (email: string) => invoke(IPC.SUPPRESSION_REMOVE, email),
  importSuppression: (filePath: string) => invoke(IPC.SUPPRESSION_IMPORT, filePath),
  exportSuppression: () => invoke(IPC.SUPPRESSION_EXPORT),

  // Campaigns
  listCampaigns: () => invoke(IPC.CAMPAIGN_LIST),
  getCampaign: (id: string) => invoke(IPC.CAMPAIGN_GET, id),
  preflight: (input: unknown) => invoke(IPC.CAMPAIGN_PREFLIGHT, input),
  createAndStartCampaign: (input: unknown, startNow: boolean) => invoke(IPC.CAMPAIGN_CREATE_AND_START, { input, startNow }),
  pauseCampaign: (id: string) => invoke(IPC.CAMPAIGN_PAUSE, id),
  resumeCampaign: (id: string) => invoke(IPC.CAMPAIGN_RESUME, id),
  cancelCampaign: (id: string) => invoke(IPC.CAMPAIGN_CANCEL, id),
  retryFailedCampaign: (id: string) => invoke(IPC.CAMPAIGN_RETRY_FAILED, id),
  listRecipients: (payload: unknown) => invoke(IPC.CAMPAIGN_RECIPIENTS, payload),
  exportCampaign: (id: string, format: 'csv' | 'json') => invoke(IPC.CAMPAIGN_EXPORT, { id, format }),

  // Dashboard
  dashboardStats: () => invoke(IPC.DASHBOARD_STATS),

  // Logs
  activityLogs: (payload?: unknown) => invoke(IPC.LOG_ACTIVITY, payload),
  technicalLogs: (payload?: unknown) => invoke(IPC.LOG_TECHNICAL, payload),

  // Dialogs
  openFile: (payload?: unknown) => invoke(IPC.DIALOG_OPEN_FILE, payload),
  saveFile: (payload: unknown) => invoke(IPC.DIALOG_SAVE_FILE, payload),
  readTextFile: (filePath: string) => invoke(IPC.FILE_READ_TEXT, filePath),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),

  // Event subscriptions
  onCampaignProgress: (cb: (row: unknown) => void) => {
    const handler = (_e: unknown, row: unknown) => cb(row);
    ipcRenderer.on(IPC.CAMPAIGN_PROGRESS_EVENT, handler);
    return () => ipcRenderer.off(IPC.CAMPAIGN_PROGRESS_EVENT, handler);
  },
  onSessionLocked: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('session:locked', handler);
    return () => ipcRenderer.off('session:locked', handler);
  },
};

contextBridge.exposeInMainWorld('cosmic', api);

export type CosmicApi = typeof api;
