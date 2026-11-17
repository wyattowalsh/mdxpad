/**
 * Unit tests for Diagram Store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDiagramStore, extractMermaidCode } from './diagram-store';

describe('useDiagramStore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    useDiagramStore.getState().reset();
  });

  it('should initialize with idle status', () => {
    const state = useDiagramStore.getState();
    expect(state.status).toBe('idle');
    expect(state.description).toBe('');
    expect(state.mermaidCode).toBe('');
    expect(state.error).toBeNull();
    expect(state.history).toHaveLength(0);
  });

  it('should update description', () => {
    useDiagramStore.getState().setDescription('Login flow diagram');
    expect(useDiagramStore.getState().description).toBe('Login flow diagram');
  });

  it('should clear generated code', () => {
    useDiagramStore.setState({
      mermaidCode: 'flowchart TD\n  A-->B',
      status: 'success',
    });

    useDiagramStore.getState().clearGenerated();

    const state = useDiagramStore.getState();
    expect(state.mermaidCode).toBe('');
    expect(state.status).toBe('idle');
  });

  it('should clear error', () => {
    useDiagramStore.setState({ error: 'test error' });
    useDiagramStore.getState().clearError();
    expect(useDiagramStore.getState().error).toBeNull();
  });

  it('should reset to initial state', () => {
    useDiagramStore.getState().setDescription('test');
    useDiagramStore.setState({
      mermaidCode: 'code',
      status: 'success',
      history: [
        {
          description: 'test',
          mermaidCode: 'code',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    useDiagramStore.getState().reset();

    const state = useDiagramStore.getState();
    expect(state.description).toBe('');
    expect(state.mermaidCode).toBe('');
    expect(state.status).toBe('idle');
    expect(state.history).toHaveLength(0);
  });

  it('should not generate with empty description', async () => {
    useDiagramStore.getState().setDescription('');
    await useDiagramStore.getState().generate();

    const state = useDiagramStore.getState();
    expect(state.status).toBe('idle');
  });

  it('says when diagram generation is unavailable', async () => {
    useDiagramStore.getState().setDescription('login flow');
    await useDiagramStore.getState().generate();

    const state = useDiagramStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Diagram generation is not available');
  });

  it('stores a diagram returned by the model', async () => {
    vi.stubGlobal('mdxpad', {
      ai: {
        generateText: vi.fn().mockResolvedValue({
          success: true,
          text: '```mermaid\nflowchart TD\n  A-->B\n```',
        }),
      },
    });
    useDiagramStore.getState().setDescription('login flow');
    await useDiagramStore.getState().generate();

    const state = useDiagramStore.getState();
    expect(state.status).toBe('success');
    expect(state.mermaidCode).toBe('flowchart TD\n  A-->B');
  });
});

describe('extractMermaidCode', () => {
  it('should extract from mermaid code fence', () => {
    const text = 'Here is the diagram:\n```mermaid\nflowchart TD\n  A-->B\n```\nDone.';
    expect(extractMermaidCode(text)).toBe('flowchart TD\n  A-->B');
  });

  it('should extract from generic code fence', () => {
    const text = '```\nsequenceDiagram\n  A->>B: Hello\n```';
    expect(extractMermaidCode(text)).toBe('sequenceDiagram\n  A->>B: Hello');
  });

  it('should return raw text when no code fence', () => {
    const text = 'flowchart TD\n  A-->B';
    expect(extractMermaidCode(text)).toBe('flowchart TD\n  A-->B');
  });

  it('should trim whitespace', () => {
    const text = '  \n  flowchart LR\n  A-->B  \n  ';
    expect(extractMermaidCode(text)).toBe('flowchart LR\n  A-->B');
  });

  it('should handle empty input', () => {
    expect(extractMermaidCode('')).toBe('');
    expect(extractMermaidCode('   ')).toBe('');
  });
});
