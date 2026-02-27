/**
 * Agent Tools Definition
 *
 * Defines the available tools for the AI agent with their descriptions
 * and parameter schemas. Used by the renderer to display tool information
 * and by the main process for tool execution.
 *
 * @module src/renderer/features/ai-agent/agent-tools
 */

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export interface AgentToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly {
    readonly name: string;
    readonly type: string;
    readonly description: string;
    readonly required: boolean;
  }[];
  readonly requiresApproval: boolean;
}

/**
 * Registry of tools available to the AI agent.
 * Used for display in the UI and documentation.
 */
export const AGENT_TOOLS: readonly AgentToolDefinition[] = [
  {
    name: 'readFile',
    description: 'Read the contents of a file',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Absolute or workspace-relative file path',
        required: true,
      },
    ],
    requiresApproval: false,
  },
  {
    name: 'writeFile',
    description: 'Write content to a file',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Absolute or workspace-relative file path',
        required: true,
      },
      {
        name: 'content',
        type: 'string',
        description: 'Content to write to the file',
        required: true,
      },
    ],
    requiresApproval: true,
  },
  {
    name: 'searchFiles',
    description: 'Search for files matching a pattern in the workspace',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search term or glob pattern',
        required: true,
      },
    ],
    requiresApproval: false,
  },
  {
    name: 'listDirectory',
    description: 'List contents of a directory',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Directory path to list',
        required: true,
      },
    ],
    requiresApproval: false,
  },
] as const;

/**
 * Gets a tool definition by name.
 */
export function getToolDefinition(name: string): AgentToolDefinition | undefined {
  return AGENT_TOOLS.find((t) => t.name === name);
}

/**
 * Returns whether a tool requires user approval before execution.
 */
export function toolRequiresApproval(name: string): boolean {
  return getToolDefinition(name)?.requiresApproval ?? true;
}

/**
 * Returns tool names that are considered safe (no approval needed).
 */
export function getSafeToolNames(): string[] {
  return AGENT_TOOLS.filter((t) => !t.requiresApproval).map((t) => t.name);
}
