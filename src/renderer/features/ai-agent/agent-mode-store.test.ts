/**
 * Unit tests for Agent Mode Store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentModeStore } from './agent-mode-store';
import type { AgentStreamEvent } from '@shared/contracts/agent-schemas';

describe('useAgentModeStore', () => {
  beforeEach(() => {
    useAgentModeStore.getState().reset();
  });

  it('should initialize with idle status', () => {
    const state = useAgentModeStore.getState();
    expect(state.status).toBe('idle');
    expect(state.messages).toHaveLength(0);
    expect(state.planSteps).toHaveLength(0);
    expect(state.activeToolCalls).toHaveLength(0);
    expect(state.error).toBeNull();
  });

  it('should handle message stream event', () => {
    const event: AgentStreamEvent = {
      type: 'message',
      message: {
        id: 'msg-1',
        role: 'assistant',
        content: 'Hello!',
        timestamp: new Date().toISOString(),
      },
    };

    useAgentModeStore.getState().handleStreamEvent(event);

    const state = useAgentModeStore.getState();
    expect(state.messages).toHaveLength(1);
    const firstMsg = state.messages[0];
    expect(firstMsg).toBeDefined();
    expect(firstMsg!.content).toBe('Hello!');
    expect(firstMsg!.role).toBe('assistant');
  });

  it('should handle tool-call stream event', () => {
    const event: AgentStreamEvent = {
      type: 'tool-call',
      toolCall: {
        id: 'tc-1',
        toolName: 'readFile',
        args: { path: '/test.md' },
        status: 'pending',
      },
    };

    useAgentModeStore.getState().handleStreamEvent(event);

    const state = useAgentModeStore.getState();
    expect(state.activeToolCalls).toHaveLength(1);
    const firstCall = state.activeToolCalls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall!.toolName).toBe('readFile');
    expect(state.status).toBe('waiting-for-approval');
  });

  it('should handle tool-result stream event', () => {
    // First add a tool call
    useAgentModeStore.getState().handleStreamEvent({
      type: 'tool-call',
      toolCall: {
        id: 'tc-1',
        toolName: 'readFile',
        args: { path: '/test.md' },
        status: 'pending',
      },
    });

    // Then add the result
    useAgentModeStore.getState().handleStreamEvent({
      type: 'tool-result',
      toolCallId: 'tc-1',
      result: 'file content here',
    });

    const state = useAgentModeStore.getState();
    const firstCall = state.activeToolCalls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall!.status).toBe('completed');
    expect(firstCall!.result).toBe('file content here');
  });

  it('should handle status stream event', () => {
    useAgentModeStore.getState().handleStreamEvent({
      type: 'status',
      status: 'executing',
    });

    expect(useAgentModeStore.getState().status).toBe('executing');
  });

  it('should handle plan stream event', () => {
    useAgentModeStore.getState().handleStreamEvent({
      type: 'plan',
      steps: [
        { id: 's-1', description: 'Read the file', status: 'pending' },
        { id: 's-2', description: 'Process content', status: 'pending' },
      ],
    });

    const state = useAgentModeStore.getState();
    expect(state.planSteps).toHaveLength(2);
    const firstStep = state.planSteps[0];
    expect(firstStep).toBeDefined();
    expect(firstStep!.description).toBe('Read the file');
  });

  it('should handle error stream event', () => {
    useAgentModeStore.getState().handleStreamEvent({
      type: 'error',
      error: { code: 'TEST_ERROR', message: 'Something went wrong' },
    });

    const state = useAgentModeStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Something went wrong');
  });

  it('should handle done stream event', () => {
    // Set status to thinking first
    useAgentModeStore.getState().handleStreamEvent({
      type: 'status',
      status: 'thinking',
    });

    useAgentModeStore.getState().handleStreamEvent({
      type: 'done',
    });

    expect(useAgentModeStore.getState().status).toBe('idle');
  });

  it('should clear conversation', () => {
    // Add some messages
    useAgentModeStore.getState().handleStreamEvent({
      type: 'message',
      message: {
        id: 'msg-1',
        role: 'user',
        content: 'Test',
        timestamp: new Date().toISOString(),
      },
    });

    useAgentModeStore.getState().clearConversation();

    const state = useAgentModeStore.getState();
    expect(state.messages).toHaveLength(0);
    expect(state.status).toBe('idle');
    expect(state.planSteps).toHaveLength(0);
  });

  it('should reset to initial state', () => {
    useAgentModeStore.getState().handleStreamEvent({
      type: 'status',
      status: 'thinking',
    });
    useAgentModeStore.getState().handleStreamEvent({
      type: 'error',
      error: { code: 'ERR', message: 'test' },
    });

    useAgentModeStore.getState().reset();

    const state = useAgentModeStore.getState();
    expect(state.status).toBe('idle');
    expect(state.messages).toHaveLength(0);
    expect(state.error).toBeNull();
  });
});
