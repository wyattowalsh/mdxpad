/**
 * IPC channel definitions.
 * Centralized IPC channel registry per constitution §3.3.
 * All channels MUST be defined here—no magic strings.
 *
 * Channel naming: mdxpad:{domain}:{action}
 */

/**
 * All IPC channels for mdxpad.
 * Grouped by domain per Constitution §3.3.
 */
export const IPC_CHANNELS = {
  /** File operations (Spec 004) */
  file: {
    open: 'mdxpad:file:open',
    save: 'mdxpad:file:save',
    saveAs: 'mdxpad:file:save-as',
    export: 'mdxpad:file:export',
    read: 'mdxpad:file:read',
    write: 'mdxpad:file:write',
    change: 'mdxpad:file:change',
  },
  /** Window operations (Spec 004) */
  window: {
    close: 'mdxpad:window:close',
    minimize: 'mdxpad:window:minimize',
    maximize: 'mdxpad:window:maximize',
  },
  /** Application lifecycle */
  app: {
    getVersion: 'mdxpad:app:get-version',
    getSecurityInfo: 'mdxpad:app:get-security-info',
    ready: 'mdxpad:app:ready',
  },
  /** Editor operations */
  editor: {
    isDirty: 'mdxpad:editor:is-dirty',
    isDirtyResponse: 'mdxpad:editor:is-dirty:response',
    save: 'mdxpad:editor:save',
  },
  /** Template operations (Spec 016) */
  template: {
    list: 'mdxpad:template:list',
    get: 'mdxpad:template:get',
    save: 'mdxpad:template:save',
    delete: 'mdxpad:template:delete',
    import: 'mdxpad:template:import',
    export: 'mdxpad:template:export',
    validate: 'mdxpad:template:validate',
    createFromTemplate: 'mdxpad:template:create',
    showOpenDialog: 'mdxpad:template:show-open-dialog',
    showSaveDialog: 'mdxpad:template:show-save-dialog',
  },
  /** Cloud sync operations (Fleet Wave 3) */
  sync: {
    listProviders: 'mdxpad:sync:list-providers',
    connectProvider: 'mdxpad:sync:connect-provider',
    status: 'mdxpad:sync:status',
    pushDocument: 'mdxpad:sync:push-document',
    pullDocument: 'mdxpad:sync:pull-document',
  },
  /** Collaboration primitive operations (Fleet Wave 3) */
  collaboration: {
    list: 'mdxpad:collaboration:list',
    addComment: 'mdxpad:collaboration:add-comment',
    resolveThread: 'mdxpad:collaboration:resolve-thread',
    addSuggestion: 'mdxpad:collaboration:add-suggestion',
    applySuggestion: 'mdxpad:collaboration:apply-suggestion',
  },
  /** Extension platform operations (Fleet Wave 4) */
  extension: {
    list: 'mdxpad:extension:list',
    install: 'mdxpad:extension:install',
    setPermission: 'mdxpad:extension:set-permission',
  },
  /** Workspace operations (Fleet Wave 4) */
  workspace: {
    open: 'mdxpad:workspace:open',
    save: 'mdxpad:workspace:save',
    createProject: 'mdxpad:workspace:create-project',
    addLink: 'mdxpad:workspace:add-link',
    getBacklinks: 'mdxpad:workspace:get-backlinks',
    queryMetadataCollection: 'mdxpad:workspace:query-metadata-collection',
    aggregateMetadataCollection: 'mdxpad:workspace:aggregate-metadata-collection',
  },
  /** Publishing + provenance operations (Fleet Wave 4) */
  publish: {
    run: 'mdxpad:publish:run',
    listProvenance: 'mdxpad:publish:list-provenance',
    getBacklinks: 'mdxpad:publish:get-backlinks',
  },
  /** Git operations (Wave 2) */
  git: {
    status: 'mdxpad:git:status',
    add: 'mdxpad:git:add',
    commit: 'mdxpad:git:commit',
    log: 'mdxpad:git:log',
    diff: 'mdxpad:git:diff',
    branches: 'mdxpad:git:branches',
    checkout: 'mdxpad:git:checkout',
    isRepo: 'mdxpad:git:is-repo',
  },
  /** Full-text search operations (Wave 2) */
  search: {
    query: 'mdxpad:search:query',
    index: 'mdxpad:search:index',
    status: 'mdxpad:search:status',
  },
  /** Content import operations (Wave 2) */
  import: {
    fromHtml: 'mdxpad:import:from-html',
    fromNotion: 'mdxpad:import:from-notion',
    fromGoogleDocs: 'mdxpad:import:from-google-docs',
  },
  /** Citation management operations (Wave 2) */
  citation: {
    parseBibtex: 'mdxpad:citation:parse-bibtex',
    format: 'mdxpad:citation:format',
    bibliography: 'mdxpad:citation:bibliography',
  },
} as const;

/**
 * @deprecated Placeholder for future channel definitions. Currently unused.
 */
export const IPC_CHANNELS_DEFERRED = {} as const;

/**
 * Event channels (main → renderer).
 * Used with webContents.send / ipcRenderer.on pattern.
 */
export const IPC_EVENTS = {
  /** File change notification from watcher */
  fileChange: 'mdxpad:file:change',
  /** Recovered documents notification from crash recovery */
  filesRecovered: 'mdxpad:file:recovered',
  /** Menu events - command palette toggle */
  menuCommandPalette: 'mdxpad:menu:command-palette',
  /** Menu events - new file */
  menuNewFile: 'mdxpad:menu:new-file',
  /** Menu events - open file dialog */
  menuOpenFileDialog: 'mdxpad:menu:open-file-dialog',
  /** Menu events - open file (with data) */
  menuOpenFile: 'mdxpad:menu:open-file',
  /** Menu events - save file */
  menuSaveFile: 'mdxpad:menu:save-file',
  /** Menu events - save file as */
  menuSaveFileAs: 'mdxpad:menu:save-file-as',
  /** Menu events - export file */
  menuExportFile: 'mdxpad:menu:export-file',
} as const;

/**
 * Type helper to extract channel string literals.
 */
export type IpcChannel =
  | (typeof IPC_CHANNELS.file)[keyof typeof IPC_CHANNELS.file]
  | (typeof IPC_CHANNELS.window)[keyof typeof IPC_CHANNELS.window]
  | (typeof IPC_CHANNELS.app)[keyof typeof IPC_CHANNELS.app]
  | (typeof IPC_CHANNELS.editor)[keyof typeof IPC_CHANNELS.editor]
  | (typeof IPC_CHANNELS.template)[keyof typeof IPC_CHANNELS.template]
  | (typeof IPC_CHANNELS.sync)[keyof typeof IPC_CHANNELS.sync]
  | (typeof IPC_CHANNELS.collaboration)[keyof typeof IPC_CHANNELS.collaboration]
  | (typeof IPC_CHANNELS.extension)[keyof typeof IPC_CHANNELS.extension]
  | (typeof IPC_CHANNELS.workspace)[keyof typeof IPC_CHANNELS.workspace]
  | (typeof IPC_CHANNELS.publish)[keyof typeof IPC_CHANNELS.publish]
  | (typeof IPC_CHANNELS.git)[keyof typeof IPC_CHANNELS.git]
  | (typeof IPC_CHANNELS.search)[keyof typeof IPC_CHANNELS.search]
  | (typeof IPC_CHANNELS.import)[keyof typeof IPC_CHANNELS.import]
  | (typeof IPC_CHANNELS.citation)[keyof typeof IPC_CHANNELS.citation];

/**
 * Type helper for event channels.
 */
export type IpcEvent = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];

/**
 * Security configuration info returned by getSecurityInfo.
 */
export interface SecurityInfo {
  contextIsolation: boolean;
  sandbox: boolean;
  nodeIntegration: boolean;
  webSecurity: boolean;
}

/**
 * Payload types for legacy IPC channels.
 * @deprecated New domains (AI, export, workspace) use Zod schemas in
 * `shared/contracts/` for runtime validation instead of this compile-time registry.
 * Retained for backward compatibility with app-level channels.
 * TODO: Migrate remaining app channels to Zod schema contracts.
 */
export interface IpcPayloads {
  [IPC_CHANNELS.app.getVersion]: {
    request: void;
    response: string;
  };
  [IPC_CHANNELS.app.getSecurityInfo]: {
    request: void;
    response: SecurityInfo;
  };
  // Note: Full payload types for file/window channels are defined
  // in file-schemas.ts using Zod schemas for runtime validation.
  // See IPC_SCHEMAS in contracts/file-schemas.ts for the authoritative
  // request/response schema registry.
}

/**
 * Helper type to get request type for a channel.
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated -- helper for legacy IpcPayloads
export type IpcRequest<C extends keyof IpcPayloads> = IpcPayloads[C]['request'];

/**
 * Helper type to get response type for a channel.
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated -- helper for legacy IpcPayloads
export type IpcResponse<C extends keyof IpcPayloads> = IpcPayloads[C]['response'];
