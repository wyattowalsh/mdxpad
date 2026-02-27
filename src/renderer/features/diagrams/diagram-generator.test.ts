/**
 * Unit tests for Diagram Generator.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidMermaidSyntax,
  parseMermaidResponse,
  buildDiagramPrompt,
} from './diagram-generator';

describe('isValidMermaidSyntax', () => {
  it('should accept flowchart syntax', () => {
    expect(isValidMermaidSyntax('flowchart TD\n  A-->B')).toBe(true);
  });

  it('should accept graph syntax', () => {
    expect(isValidMermaidSyntax('graph LR\n  A-->B')).toBe(true);
  });

  it('should accept sequenceDiagram syntax', () => {
    expect(isValidMermaidSyntax('sequenceDiagram\n  A->>B: Hello')).toBe(true);
  });

  it('should accept classDiagram syntax', () => {
    expect(isValidMermaidSyntax('classDiagram\n  class Animal')).toBe(true);
  });

  it('should accept stateDiagram syntax', () => {
    expect(isValidMermaidSyntax('stateDiagram\n  [*] --> Active')).toBe(true);
  });

  it('should accept erDiagram syntax', () => {
    expect(isValidMermaidSyntax('erDiagram\n  CUSTOMER ||--o{ ORDER : places')).toBe(true);
  });

  it('should accept gantt syntax', () => {
    expect(isValidMermaidSyntax('gantt\n  title A Gantt Diagram')).toBe(true);
  });

  it('should accept pie syntax', () => {
    expect(isValidMermaidSyntax('pie\n  "Dogs" : 50')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidMermaidSyntax('')).toBe(false);
  });

  it('should reject plain text', () => {
    expect(isValidMermaidSyntax('This is not a diagram')).toBe(false);
  });

  it('should reject code that does not start with a diagram type', () => {
    expect(isValidMermaidSyntax('const x = 1;\nflowchart TD')).toBe(false);
  });
});

describe('parseMermaidResponse', () => {
  it('should parse fenced mermaid code', () => {
    const result = parseMermaidResponse('```mermaid\nflowchart TD\n  A-->B\n```');
    expect(result.success).toBe(true);
    expect(result.mermaidCode).toBe('flowchart TD\n  A-->B');
  });

  it('should parse raw mermaid code', () => {
    const result = parseMermaidResponse('flowchart TD\n  A-->B');
    expect(result.success).toBe(true);
    expect(result.mermaidCode).toBe('flowchart TD\n  A-->B');
  });

  it('should return error for empty response', () => {
    const result = parseMermaidResponse('');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error for invalid syntax', () => {
    const result = parseMermaidResponse('This is not mermaid code');
    expect(result.success).toBe(false);
    expect(result.error).toContain('valid Mermaid syntax');
  });

  it('should handle response with surrounding text', () => {
    const response =
      'Here is your diagram:\n```mermaid\nsequenceDiagram\n  A->>B: Hello\n```\nEnjoy!';
    const result = parseMermaidResponse(response);
    expect(result.success).toBe(true);
    expect(result.mermaidCode).toBe('sequenceDiagram\n  A->>B: Hello');
  });
});

describe('buildDiagramPrompt', () => {
  it('should build prompt with description', () => {
    const prompt = buildDiagramPrompt('Login authentication flow');
    expect(prompt).toContain('Login authentication flow');
  });

  it('should include preferred type when specified', () => {
    const prompt = buildDiagramPrompt('Login flow', 'sequence');
    expect(prompt).toContain('Login flow');
    expect(prompt).toContain('sequence');
  });

  it('should not include type when not specified', () => {
    const prompt = buildDiagramPrompt('Login flow');
    expect(prompt).not.toContain('Use diagram type');
  });
});
