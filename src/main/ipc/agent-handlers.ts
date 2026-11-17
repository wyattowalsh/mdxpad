/**
 * AI agent IPC handlers.
 *
 * Writes stay inside the approval gate. These handlers only start a turn,
 * decide one pending write, or stop the turn.
 *
 * @module src/main/ipc/agent-handlers
 */

import { ipcMain, type BrowserWindow } from 'electron';

import type { AgentService } from '@main/services/ai/agent-service';
import {
  AgentChannels,
  AgentResponseSchema,
  AgentSendMessageRequestSchema,
  AgentToolApprovalRequestSchema,
  type AgentResponse,
} from '@shared/contracts/agent-schemas';
import { createValidatedHandler } from '@shared/contracts/file-schemas';
import { trustedAgentFile } from './document-capability';
import { registerAuthorizedIpcHandler } from './ipc-sender-authorization';

function createSendHandler(service: AgentService) {
  return createValidatedHandler(AgentSendMessageRequestSchema, (args): Promise<AgentResponse> => {
    const trusted = trustedAgentFile(args.currentFilePath);
    void service.sendMessage(args.message, trusted?.root, trusted?.filePath).catch(() => undefined);
    return Promise.resolve(AgentResponseSchema.parse({ success: true }));
  });
}

function createApproveHandler(service: AgentService) {
  return createValidatedHandler(AgentToolApprovalRequestSchema, (args): Promise<AgentResponse> => {
    const accepted = service.decideWrite(args.toolCallId, args.approved);
    if (!accepted) {
      return Promise.resolve(
        AgentResponseSchema.parse({
          success: false,
          error: {
            code: 'UNKNOWN_TOOL_CALL',
            message: 'No write is waiting for that approval',
          },
        })
      );
    }
    return Promise.resolve(AgentResponseSchema.parse({ success: true }));
  });
}

export function registerAgentHandlers(service: AgentService, window: BrowserWindow): void {
  const handleSend = createSendHandler(service);
  const handleApprove = createApproveHandler(service);

  registerAuthorizedIpcHandler(ipcMain, window, AgentChannels.SEND_MESSAGE, (_event, args) =>
    handleSend(args)
  );
  registerAuthorizedIpcHandler(ipcMain, window, AgentChannels.APPROVE_TOOL, (_event, args) =>
    handleApprove(args)
  );
  registerAuthorizedIpcHandler(ipcMain, window, AgentChannels.CANCEL, () => {
    service.cancel();
    return AgentResponseSchema.parse({ success: true });
  });
  registerAuthorizedIpcHandler(ipcMain, window, AgentChannels.CLEAR, () => {
    service.clear();
    return AgentResponseSchema.parse({ success: true });
  });
}
