/**
 * Unit tests for Slash Commands extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { autocompletion } from '@codemirror/autocomplete';
import { createSlashCommandCompletionSource } from './slash-commands';
import { BUILTIN_SLASH_COMMANDS, type SlashCommand } from './slash-command-definitions';

describe('BUILTIN_SLASH_COMMANDS', () => {
  it('contains built-in commands', () => {
    expect(BUILTIN_SLASH_COMMANDS.length).toBeGreaterThan(0);
  });

  it('each command has required fields', () => {
    for (const cmd of BUILTIN_SLASH_COMMANDS) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.label).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(cmd.template).toBeTruthy();
    }
  });

  it('includes heading command', () => {
    const found = BUILTIN_SLASH_COMMANDS.find((c) => c.name === 'heading');
    expect(found).toBeDefined();
    expect(found!.template).toContain('##');
  });

  it('includes code command', () => {
    const found = BUILTIN_SLASH_COMMANDS.find((c) => c.name === 'code');
    expect(found).toBeDefined();
    expect(found!.template).toContain('```');
  });

  it('includes image command', () => {
    const found = BUILTIN_SLASH_COMMANDS.find((c) => c.name === 'image');
    expect(found).toBeDefined();
    expect(found!.template).toContain('![');
  });

  it('includes table command', () => {
    const found = BUILTIN_SLASH_COMMANDS.find((c) => c.name === 'table');
    expect(found).toBeDefined();
    expect(found!.template).toContain('| Header');
  });

  it('includes divider command', () => {
    const found = BUILTIN_SLASH_COMMANDS.find((c) => c.name === 'divider');
    expect(found).toBeDefined();
    expect(found!.template).toContain('---');
  });

  it('includes quote command', () => {
    const found = BUILTIN_SLASH_COMMANDS.find((c) => c.name === 'quote');
    expect(found).toBeDefined();
    expect(found!.template).toBe('> ');
  });

  it('includes list command', () => {
    const found = BUILTIN_SLASH_COMMANDS.find((c) => c.name === 'list');
    expect(found).toBeDefined();
    expect(found!.template).toBe('- ');
  });

  it('includes todo command', () => {
    const found = BUILTIN_SLASH_COMMANDS.find((c) => c.name === 'todo');
    expect(found).toBeDefined();
    expect(found!.template).toContain('[ ]');
  });

  it('includes mermaid command', () => {
    const found = BUILTIN_SLASH_COMMANDS.find((c) => c.name === 'mermaid');
    expect(found).toBeDefined();
    expect(found!.template).toContain('mermaid');
  });

  it('includes math command', () => {
    const found = BUILTIN_SLASH_COMMANDS.find((c) => c.name === 'math');
    expect(found).toBeDefined();
    expect(found!.template).toContain('$$');
  });

  it('includes component command', () => {
    const found = BUILTIN_SLASH_COMMANDS.find((c) => c.name === 'component');
    expect(found).toBeDefined();
    expect(found!.template).toContain('<Component>');
  });

  it('has unique command names', () => {
    const names = BUILTIN_SLASH_COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('cursorOffset is non-negative when defined', () => {
    for (const cmd of BUILTIN_SLASH_COMMANDS) {
      if (cmd.cursorOffset !== undefined) {
        expect(cmd.cursorOffset).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('createSlashCommandCompletionSource', () => {
  it('returns a completion source function with default commands', () => {
    const source = createSlashCommandCompletionSource();
    expect(typeof source).toBe('function');
  });

  it('returns a completion source function with custom commands', () => {
    const custom: SlashCommand[] = [
      {
        name: 'callout',
        label: 'Callout',
        description: 'Insert a callout block',
        template: '<Callout>\n\n</Callout>',
      },
    ];

    const source = createSlashCommandCompletionSource(custom);
    expect(typeof source).toBe('function');
  });

  it('creates a valid EditorState when wrapped in autocompletion', () => {
    const source = createSlashCommandCompletionSource();
    const state = EditorState.create({
      doc: '/heading',
      extensions: [autocompletion({ override: [source] })],
    });
    expect(state.doc.toString()).toBe('/heading');
  });

  it('handles empty custom commands array', () => {
    const source = createSlashCommandCompletionSource([]);
    expect(typeof source).toBe('function');
  });

  it('merges custom commands with builtins', () => {
    const custom: SlashCommand[] = [
      {
        name: 'custom',
        label: 'Custom Block',
        description: 'A custom block',
        template: '<Custom />',
      },
    ];

    const source = createSlashCommandCompletionSource(custom);
    const state = EditorState.create({
      doc: '',
      extensions: [autocompletion({ override: [source] })],
    });
    expect(state).toBeDefined();
  });
});
