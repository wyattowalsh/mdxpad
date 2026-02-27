/**
 * Unit tests for Agent Tools.
 */

import { describe, it, expect } from 'vitest';
import {
  AGENT_TOOLS,
  getToolDefinition,
  toolRequiresApproval,
  getSafeToolNames,
} from './agent-tools';

describe('agent-tools', () => {
  describe('AGENT_TOOLS', () => {
    it('should define at least 4 tools', () => {
      expect(AGENT_TOOLS.length).toBeGreaterThanOrEqual(4);
    });

    it('should have unique tool names', () => {
      const names = AGENT_TOOLS.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('should include readFile tool', () => {
      const readFile = AGENT_TOOLS.find((t) => t.name === 'readFile');
      expect(readFile).toBeDefined();
      expect(readFile?.requiresApproval).toBe(false);
    });

    it('should include writeFile tool with approval required', () => {
      const writeFile = AGENT_TOOLS.find((t) => t.name === 'writeFile');
      expect(writeFile).toBeDefined();
      expect(writeFile?.requiresApproval).toBe(true);
    });
  });

  describe('getToolDefinition', () => {
    it('should return definition for known tool', () => {
      const def = getToolDefinition('readFile');
      expect(def).toBeDefined();
      expect(def?.name).toBe('readFile');
    });

    it('should return undefined for unknown tool', () => {
      const def = getToolDefinition('unknownTool');
      expect(def).toBeUndefined();
    });
  });

  describe('toolRequiresApproval', () => {
    it('should return false for safe tools', () => {
      expect(toolRequiresApproval('readFile')).toBe(false);
    });

    it('should return true for tools requiring approval', () => {
      expect(toolRequiresApproval('writeFile')).toBe(true);
    });

    it('should return true for unknown tools (safe default)', () => {
      expect(toolRequiresApproval('unknownTool')).toBe(true);
    });
  });

  describe('getSafeToolNames', () => {
    it('should return array of tool names not requiring approval', () => {
      const safe = getSafeToolNames();
      expect(safe.length).toBeGreaterThan(0);
      for (const name of safe) {
        expect(toolRequiresApproval(name)).toBe(false);
      }
    });

    it('should not include writeFile', () => {
      const safe = getSafeToolNames();
      expect(safe).not.toContain('writeFile');
    });
  });
});
