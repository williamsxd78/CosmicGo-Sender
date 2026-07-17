/**
 * IPC channel name constants shared between main and renderer.
 * Renderer talks only through the `cosmic` bridge exposed by preload.
 */
export const IPC = {
  // App / setup / auth
  APP_STATE: 'app:state',
  AUTH_SET_PASSWORD: 'auth:set-password',
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_CHANGE_PASSWORD: 'auth:change-password',
  AUTH_LOCK: 'auth:lock',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Providers
  PROVIDER_LIST: 'provider:list',
  PROVIDER_GET: 'provider:get',
  PROVIDER_CREATE: 'provider:create',
  PROVIDER_UPDATE: 'provider:update',
  PROVIDER_DELETE: 'provider:delete',
  PROVIDER_DUPLICATE: 'provider:duplicate',
  PROVIDER_TEST_CONNECTION: 'provider:test-connection',
  PROVIDER_SEND_TEST_EMAIL: 'provider:send-test-email',

  // Sender identities
  IDENTITY_LIST: 'identity:list',
  IDENTITY_UPSERT: 'identity:upsert',
  IDENTITY_DELETE: 'identity:delete',

  // Contacts
  CONTACT_LIST: 'contact:list',
  CONTACT_UPSERT: 'contact:upsert',
  CONTACT_DELETE: 'contact:delete',
  CONTACT_BULK_DELETE: 'contact:bulk-delete',
  CONTACT_IMPORT_CSV: 'contact:import-csv',
  CONTACT_EXPORT_CSV: 'contact:export-csv',

  // Lists
  LIST_LIST: 'list:list',
  LIST_UPSERT: 'list:upsert',
  LIST_DELETE: 'list:delete',
  LIST_ADD_CONTACTS: 'list:add-contacts',
  LIST_REMOVE_CONTACTS: 'list:remove-contacts',
  LIST_MEMBERS: 'list:members',

  // Templates
  TEMPLATE_LIST: 'template:list',
  TEMPLATE_UPSERT: 'template:upsert',
  TEMPLATE_DELETE: 'template:delete',

  // Suppression
  SUPPRESSION_LIST: 'suppression:list',
  SUPPRESSION_ADD: 'suppression:add',
  SUPPRESSION_REMOVE: 'suppression:remove',
  SUPPRESSION_IMPORT: 'suppression:import',
  SUPPRESSION_EXPORT: 'suppression:export',

  // Campaigns / send
  CAMPAIGN_LIST: 'campaign:list',
  CAMPAIGN_GET: 'campaign:get',
  CAMPAIGN_PREFLIGHT: 'campaign:preflight',
  CAMPAIGN_CREATE_AND_START: 'campaign:create-and-start',
  CAMPAIGN_PAUSE: 'campaign:pause',
  CAMPAIGN_RESUME: 'campaign:resume',
  CAMPAIGN_CANCEL: 'campaign:cancel',
  CAMPAIGN_RETRY_FAILED: 'campaign:retry-failed',
  CAMPAIGN_RECIPIENTS: 'campaign:recipients',
  CAMPAIGN_EXPORT: 'campaign:export',
  CAMPAIGN_PROGRESS_EVENT: 'campaign:progress-event', // main -> renderer

  // Dashboard
  DASHBOARD_STATS: 'dashboard:stats',

  // Logs
  LOG_ACTIVITY: 'log:activity',
  LOG_TECHNICAL: 'log:technical',

  // Files / dialogs
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  FILE_READ_TEXT: 'file:read-text',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
