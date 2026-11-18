import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  ExportCliInvokeRequest,
  ExportCliInvokeResponse,
  ExportJobLifecycleRequest,
  ExportJobLifecycleResponse,
  ExportPresetCrudRequest,
  ExportPresetCrudResponse,
  LlmsGenerationRequest,
  LlmsGenerationResponse,
} from '@shared/contracts/export-schemas';
import type {
  ExportCliOutput,
  ExportJob,
  ExportJobStatus,
  ExportPreset,
} from '@shared/types/export-model';
import { recordLocalTelemetryEvent } from '../lib/telemetry/local-telemetry';
import { announceFinishedExport } from './announce-export';

let cliInvokeRequestId = 0;
let llmsGenerationRequestId = 0;

type CliRunStatus = 'idle' | 'running' | 'success' | 'error';
type LlmsGenerationSuccess = Extract<LlmsGenerationResponse, { ok: true }>;

interface ExportApiBridge {
  jobLifecycle(request: ExportJobLifecycleRequest): Promise<ExportJobLifecycleResponse>;
  presetCrud(request: ExportPresetCrudRequest): Promise<ExportPresetCrudResponse>;
  cliInvoke(request: ExportCliInvokeRequest): Promise<ExportCliInvokeResponse>;
  llmsGenerate(request: LlmsGenerationRequest): Promise<LlmsGenerationResponse>;
}

interface MdxpadWithExportApi {
  export: ExportApiBridge;
}

function hasExportApi(value: unknown): value is MdxpadWithExportApi {
  if (typeof value !== 'object' || value === null || !('export' in value)) {
    return false;
  }

  const exportValue = (value as { export?: unknown }).export;
  if (typeof exportValue !== 'object' || exportValue === null) {
    return false;
  }

  const candidate = exportValue as Partial<ExportApiBridge>;
  return (
    typeof candidate.jobLifecycle === 'function' &&
    typeof candidate.presetCrud === 'function' &&
    typeof candidate.cliInvoke === 'function' &&
    typeof candidate.llmsGenerate === 'function'
  );
}

function getExportApi(): ExportApiBridge {
  const maybeMdxpad = (window as unknown as { mdxpad?: unknown }).mdxpad;
  if (!hasExportApi(maybeMdxpad)) {
    throw new Error('Export API is not available');
  }
  return maybeMdxpad.export;
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function upsertJob(draft: ExportStoreState, job: ExportJob): void {
  const existingIndex = draft.jobs.findIndex((existingJob) => existingJob.id === job.id);
  if (existingIndex === -1) {
    draft.jobs.push(job);
    draft.jobsSortDirty = true;
  } else {
    draft.jobs[existingIndex] = job;
    // Update-in-place does not change sort order (createdAt is immutable)
  }
}

function upsertPreset(presets: ExportPreset[], preset: ExportPreset): void {
  const existingIndex = presets.findIndex((existingPreset) => existingPreset.id === preset.id);
  if (existingIndex === -1) {
    presets.push(preset);
  } else {
    presets[existingIndex] = preset;
  }

  presets.sort((left, right) => left.name.localeCompare(right.name));
}

function applyJobLifecycleResponse(
  draft: ExportStoreState,
  response: ExportJobLifecycleResponse
): void {
  if (!response.ok) {
    draft.jobsError = response.error;
    return;
  }

  draft.jobsError = null;
  if ('jobs' in response) {
    draft.jobs = [...response.jobs].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
    return;
  }

  upsertJob(draft, response.job);
}

function applyPresetCrudResponse(
  draft: ExportStoreState,
  response: ExportPresetCrudResponse
): void {
  if (!response.ok) {
    draft.presetsError = response.error;
    return;
  }

  draft.presetsError = null;
  if ('presets' in response) {
    draft.presets = [...response.presets].sort((left, right) =>
      left.name.localeCompare(right.name)
    );
    return;
  }

  if ('preset' in response) {
    upsertPreset(draft.presets, response.preset);
    return;
  }

  draft.presets = draft.presets.filter((preset) => preset.id !== response.deletedId);
}

function createInitialState(): ExportStoreState {
  return {
    jobs: [],
    presets: [],
    jobsSortDirty: false,
    isLoadingJobs: false,
    isLoadingPresets: false,
    cliRunStatus: 'idle',
    isRunningCli: false,
    activeCliJobId: null,
    cliOutput: null,
    llmsResult: null,
    isGeneratingLlms: false,
    jobsError: null,
    presetsError: null,
    cliError: null,
    llmsError: null,
  };
}

export interface ExportStoreState {
  jobs: ExportJob[];
  presets: ExportPreset[];
  /** When true, `jobs` needs re-sorting before being read in sorted order. */
  jobsSortDirty: boolean;
  isLoadingJobs: boolean;
  isLoadingPresets: boolean;
  cliRunStatus: CliRunStatus;
  isRunningCli: boolean;
  activeCliJobId: string | null;
  cliOutput: ExportCliOutput | null;
  llmsResult: LlmsGenerationSuccess | null;
  isGeneratingLlms: boolean;
  jobsError: string | null;
  presetsError: string | null;
  cliError: string | null;
  llmsError: string | null;
}

export interface ExportStoreActions {
  runJobLifecycle: (
    request: ExportJobLifecycleRequest
  ) => Promise<ExportJobLifecycleResponse | null>;
  loadJobs: (status?: ExportJobStatus) => Promise<void>;
  runPresetCrud: (request: ExportPresetCrudRequest) => Promise<ExportPresetCrudResponse | null>;
  loadPresets: () => Promise<void>;
  invokeCli: (request: ExportCliInvokeRequest) => Promise<void>;
  generateLlms: (request: LlmsGenerationRequest) => Promise<void>;
  clearError: (scope?: 'jobs' | 'presets' | 'cli' | 'llms' | 'all') => void;
  reset: () => void;
}

export type ExportStore = ExportStoreState & ExportStoreActions;

export const useExportStore = create<ExportStore>()(
  immer((set, get) => ({
    ...createInitialState(),

    runJobLifecycle: async (request) => {
      set((draft) => {
        draft.isLoadingJobs = true;
        draft.jobsError = null;
      });

      try {
        const response = await getExportApi().jobLifecycle(request);
        set((draft) => {
          applyJobLifecycleResponse(draft, response);
          draft.isLoadingJobs = false;
        });
        return response;
      } catch (error) {
        set((draft) => {
          draft.isLoadingJobs = false;
          draft.jobsError = toErrorMessage(error, 'Failed to manage export jobs');
        });
        return null;
      }
    },

    loadJobs: async (status) => {
      const request: ExportJobLifecycleRequest =
        status === undefined ? { action: 'list' } : { action: 'list', status };
      await get().runJobLifecycle(request);
    },

    runPresetCrud: async (request) => {
      set((draft) => {
        draft.isLoadingPresets = true;
        draft.presetsError = null;
      });

      try {
        const response = await getExportApi().presetCrud(request);
        set((draft) => {
          applyPresetCrudResponse(draft, response);
          draft.isLoadingPresets = false;
        });
        return response;
      } catch (error) {
        set((draft) => {
          draft.isLoadingPresets = false;
          draft.presetsError = toErrorMessage(error, 'Failed to manage export presets');
        });
        return null;
      }
    },

    loadPresets: async () => {
      await get().runPresetCrud({ action: 'list' });
    },

    invokeCli: async (request) => {
      const requestId = ++cliInvokeRequestId;
      set((draft) => {
        draft.isRunningCli = true;
        draft.cliRunStatus = 'running';
        draft.cliError = null;
        draft.activeCliJobId = request.job.id;
      });
      recordLocalTelemetryEvent('export', 'invoke-cli', 'started', {
        details: { format: request.job.format },
      });

      try {
        const response = await getExportApi().cliInvoke(request);
        const current = requestId === cliInvokeRequestId;
        set((draft) => {
          if (response.ok) {
            upsertJob(draft, response.output.job);
          } else if (response.output) {
            upsertJob(draft, response.output.job);
          }
          if (!current) {
            return;
          }
          draft.isRunningCli = false;
          if (response.ok) {
            draft.cliRunStatus = 'success';
            draft.cliOutput = response.output;
            draft.activeCliJobId = response.output.job.id;
            return;
          }
          draft.cliRunStatus = 'error';
          draft.cliError = response.error;
          draft.cliOutput = response.output ?? null;
          if (response.output) {
            draft.activeCliJobId = response.output.job.id;
          }
        });
        if (response.ok) {
          announceFinishedExport(response.output.job);
          if (current) {
            recordLocalTelemetryEvent('export', 'invoke-cli', 'succeeded', {
              details: { exitCode: response.output.exitCode },
            });
          }
        } else {
          if (response.output) {
            announceFinishedExport(response.output.job);
          }
          if (current) {
            recordLocalTelemetryEvent('export', 'invoke-cli', 'failed', {
              details: { code: response.code },
            });
          }
        }
      } catch (error) {
        if (requestId !== cliInvokeRequestId) {
          return;
        }
        set((draft) => {
          draft.isRunningCli = false;
          draft.cliRunStatus = 'error';
          draft.cliError = toErrorMessage(error, 'Failed to run export CLI');
        });
        recordLocalTelemetryEvent('export', 'invoke-cli', 'failed', {
          details: { code: 'EXCEPTION' },
        });
      }
    },

    generateLlms: async (request) => {
      const requestId = ++llmsGenerationRequestId;
      set((draft) => {
        draft.isGeneratingLlms = true;
        draft.llmsResult = null;
        draft.llmsError = null;
      });
      recordLocalTelemetryEvent('export', 'generate-llms', 'started', {
        details: { target: request.target },
      });

      try {
        const response = await getExportApi().llmsGenerate(request);
        if (requestId !== llmsGenerationRequestId) {
          return;
        }
        set((draft) => {
          draft.isGeneratingLlms = false;
          if (response.ok) {
            draft.llmsResult = response;
            return;
          }
          draft.llmsError = response.error;
        });
        if (response.ok) {
          recordLocalTelemetryEvent('export', 'generate-llms', 'succeeded', {
            details: { bytesWritten: response.bytesWritten },
          });
        } else {
          recordLocalTelemetryEvent('export', 'generate-llms', 'failed', {
            details: { code: response.code },
          });
        }
      } catch (error) {
        if (requestId !== llmsGenerationRequestId) {
          return;
        }
        set((draft) => {
          draft.isGeneratingLlms = false;
          draft.llmsError = toErrorMessage(error, 'Failed to generate llms file');
        });
        recordLocalTelemetryEvent('export', 'generate-llms', 'failed', {
          details: { code: 'EXCEPTION' },
        });
      }
    },

    clearError: (scope = 'all') =>
      set((draft) => {
        if (scope === 'all' || scope === 'jobs') {
          draft.jobsError = null;
        }
        if (scope === 'all' || scope === 'presets') {
          draft.presetsError = null;
        }
        if (scope === 'all' || scope === 'cli') {
          draft.cliError = null;
        }
        if (scope === 'all' || scope === 'llms') {
          draft.llmsError = null;
        }
      }),

    reset: () => {
      cliInvokeRequestId += 1;
      llmsGenerationRequestId += 1;
      set((draft) => {
        Object.assign(draft, createInitialState());
      });
    },
  }))
);

let cachedSortedJobs: ExportJob[] = [];
let cachedJobsRef: ExportJob[] = [];
let cachedJobsDirty = false;

/**
 * Returns jobs sorted by createdAt. Sorting is deferred to read-time
 * so that mutations (upsertJob) stay O(1) for status/progress updates.
 */
export const selectExportJobs = (state: ExportStore): ExportJob[] => {
  if (state.jobs === cachedJobsRef && state.jobsSortDirty === cachedJobsDirty) {
    return cachedSortedJobs;
  }
  cachedJobsRef = state.jobs;
  cachedJobsDirty = state.jobsSortDirty;

  if (state.jobsSortDirty) {
    cachedSortedJobs = [...state.jobs].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
  } else {
    cachedSortedJobs = state.jobs;
  }
  return cachedSortedJobs;
};
export const selectExportPresets = (state: ExportStore): ExportPreset[] => state.presets;
export const selectIsLoadingJobs = (state: ExportStore): boolean => state.isLoadingJobs;
export const selectIsLoadingPresets = (state: ExportStore): boolean => state.isLoadingPresets;
export const selectCliRunStatus = (state: ExportStore): CliRunStatus => state.cliRunStatus;
export const selectIsCliRunning = (state: ExportStore): boolean => state.isRunningCli;
export const selectCliOutput = (state: ExportStore): ExportCliOutput | null => state.cliOutput;
export const selectLlmsResult = (state: ExportStore): LlmsGenerationSuccess | null =>
  state.llmsResult;
