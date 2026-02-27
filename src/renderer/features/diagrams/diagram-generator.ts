/**
 * Diagram Generator
 *
 * Natural language to Mermaid diagram generation.
 * Sends natural language descriptions to AI with a system prompt
 * for Mermaid syntax, then parses and validates the output.
 *
 * @module src/renderer/features/diagrams/diagram-generator
 */

// =============================================================================
// TYPES
// =============================================================================

export interface DiagramGenerationResult {
  success: boolean;
  mermaidCode?: string;
  error?: string;
}

// =============================================================================
// VALIDATION
// =============================================================================

/** Valid Mermaid diagram types that can start a diagram definition. */
const VALID_DIAGRAM_STARTS = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'quadrantChart',
  'requirementDiagram',
  'gitGraph',
  'mindmap',
  'timeline',
  'xychart-beta',
  'block-beta',
  'sankey-beta',
  'packet-beta',
] as const;

/**
 * Validates that a string contains valid Mermaid syntax.
 * Performs a basic structural check (not full parsing).
 */
export function isValidMermaidSyntax(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) return false;

  const firstLine = (trimmed.split('\n')[0] ?? '').trim().toLowerCase();
  return VALID_DIAGRAM_STARTS.some(
    (start) =>
      firstLine.startsWith(start.toLowerCase()) ||
      firstLine.startsWith(`${start.toLowerCase()} `) ||
      firstLine.startsWith(`${start.toLowerCase()}\n`)
  );
}

/**
 * Extracts and validates Mermaid code from AI response text.
 */
export function parseMermaidResponse(text: string): DiagramGenerationResult {
  // Try fenced code block first
  const fenceMatch = /```mermaid\s*\n([\s\S]*?)```/.exec(text);
  const code = fenceMatch ? (fenceMatch[1] ?? '').trim() : text.trim();

  if (!code) {
    return { success: false, error: 'Empty response from AI' };
  }

  if (!isValidMermaidSyntax(code)) {
    // Try extracting from a generic code fence as fallback
    const genericMatch = /```\s*\n([\s\S]*?)```/.exec(text);
    if (genericMatch) {
      const fallbackCode = (genericMatch[1] ?? '').trim();
      if (isValidMermaidSyntax(fallbackCode)) {
        return { success: true, mermaidCode: fallbackCode };
      }
    }
    return { success: false, error: 'AI response does not contain valid Mermaid syntax' };
  }

  return { success: true, mermaidCode: code };
}

// =============================================================================
// PROMPT CONSTRUCTION
// =============================================================================

/**
 * Builds the user prompt for diagram generation.
 * Optionally includes the diagram type if the user specifies one.
 */
export function buildDiagramPrompt(description: string, preferredType?: string): string {
  const parts = [`Create a Mermaid diagram for: ${description}`];

  if (preferredType) {
    parts.push(`Use diagram type: ${preferredType}`);
  }

  return parts.join('\n');
}
