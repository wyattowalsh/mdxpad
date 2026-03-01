/**
 * Plugin Sandbox Security Tests
 *
 * Verifies plugin sandbox (vm.createContext) does not expose dangerous APIs,
 * manifest validation rejects invalid data, and malicious code is contained.
 *
 * @module tests/security/plugin-sandbox-security
 */
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginLoader } from '@main/services/plugin/plugin-loader';
import { loadManifest } from '@main/services/plugin/plugin-manifest';
import { PluginManifestSchema } from '@shared/contracts/plugin-schemas';

vi.mock('electron', () => ({
  app: { getPath: (n: string) => (n === 'home' ? os.homedir() : os.tmpdir()) },
  ipcMain: { handle: vi.fn() },
}));

const MANIFEST = {
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'Security test plugin',
  permissions: [],
  entryPoint: 'index.js',
};

async function makePlugin(
  base: string,
  name: string,
  manifest: Record<string, unknown>,
  code: string
): Promise<string> {
  const dir = path.join(base, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  const entry = typeof manifest.entryPoint === 'string' ? manifest.entryPoint : 'index.js';
  await writeFile(path.join(dir, entry), code);
  return dir;
}

async function installLoadActivate(
  loader: PluginLoader,
  base: string,
  name: string,
  manifest: Record<string, unknown>,
  code: string
): Promise<void> {
  await makePlugin(base, name, manifest, code);
  await loader.installPlugin(path.join(base, name));
  await loader.loadPlugin(name);
  await loader.activatePlugin(name);
}

// ============================================================================
// Sandbox: Dangerous Module Access
// ============================================================================
describe('Plugin sandbox does not expose dangerous APIs', () => {
  let tempDir = '';
  let loader: PluginLoader;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-sandbox-sec-'));
    loader = new PluginLoader(tempDir);
  });
  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it.each([
    ['fs', 'no-fs'],
    ['child_process', 'no-cp'],
  ])('does not expose %s module', async (mod, name) => {
    const code = `
      var leaked = false;
      try { require('${mod}'); leaked = true; } catch(e) {}
      module.exports = { activate: function() { if (leaked) throw new Error('${mod} accessible'); } };
    `;
    await installLoadActivate(loader, tempDir, name, MANIFEST, code);
    expect(loader.isActivated(name)).toBe(true);
  });

  it('does not expose process global', async () => {
    const code = `
      var hasProcess = typeof process !== 'undefined' && process !== null;
      module.exports = { activate: function() { if (hasProcess) throw new Error('process accessible'); } };
    `;
    await installLoadActivate(loader, tempDir, 'no-process', MANIFEST, code);
    expect(loader.isActivated('no-process')).toBe(true);
  });

  it('does not allow require() of arbitrary modules', async () => {
    const mods = ['fs', 'child_process', 'net', 'http', 'os', 'path', 'crypto'];
    const checks = mods
      .map((m) => `try { require('${m}'); r.push('${m}'); } catch(e) {}`)
      .join('\n');
    const code = `var r=[];${checks}
      module.exports={activate:function(){if(r.length>0)throw new Error('Accessible: '+r.join(','));}};`;
    await installLoadActivate(loader, tempDir, 'no-require', MANIFEST, code);
    expect(loader.isActivated('no-require')).toBe(true);
  });

  it('does not expose Buffer, __dirname, or __filename', async () => {
    const code = `
      var bad = [];
      if (typeof Buffer !== 'undefined') bad.push('Buffer');
      if (typeof __dirname !== 'undefined') bad.push('__dirname');
      if (typeof __filename !== 'undefined') bad.push('__filename');
      module.exports = { activate: function() { if (bad.length) throw new Error(bad.join(',')); } };
    `;
    await installLoadActivate(loader, tempDir, 'no-globals', MANIFEST, code);
    expect(loader.isActivated('no-globals')).toBe(true);
  });

  it('provides mdxpad sandbox API with log function', async () => {
    const code = `
      var ok = typeof mdxpad !== 'undefined' && typeof mdxpad.log === 'function';
      module.exports = { activate: function() { if (!ok) throw new Error('API missing'); mdxpad.log('ok'); } };
    `;
    await installLoadActivate(loader, tempDir, 'has-api', MANIFEST, code);
    expect(loader.isActivated('has-api')).toBe(true);
  });

  it('does not grant file-read/write API without permission', async () => {
    const noPerms = { ...MANIFEST, permissions: [] };
    const code = `
      var bad = [];
      if (typeof mdxpad.readFile === 'function') bad.push('readFile');
      if (typeof mdxpad.writeFile === 'function') bad.push('writeFile');
      module.exports = { activate: function() { if (bad.length) throw new Error(bad.join(',')); } };
    `;
    await installLoadActivate(loader, tempDir, 'no-perms', noPerms, code);
    expect(loader.isActivated('no-perms')).toBe(true);
  });
});

// ============================================================================
// Malicious Plugin Containment
// ============================================================================
describe('Malicious plugin code is contained', () => {
  let tempDir = '';
  let loader: PluginLoader;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-sandbox-mal-'));
    loader = new PluginLoader(tempDir);
  });
  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('contains infinite loop via timeout', async () => {
    const code = 'while(true){} module.exports={activate:function(){}};';
    await makePlugin(tempDir, 'inf-loop', MANIFEST, code);
    await loader.installPlugin(path.join(tempDir, 'inf-loop'));
    await expect(loader.loadPlugin('inf-loop')).rejects.toThrow(/Failed to load plugin/);
  }, 15_000);

  it('contains error-throwing activate()', async () => {
    const code = 'module.exports={activate:function(){throw new Error("malicious");}};';
    await makePlugin(tempDir, 'throw-act', MANIFEST, code);
    await loader.installPlugin(path.join(tempDir, 'throw-act'));
    await loader.loadPlugin('throw-act');
    await expect(loader.activatePlugin('throw-act')).rejects.toThrow(/Failed to activate/);
    expect(loader.isActivated('throw-act')).toBe(false);
  });

  it('contains syntax errors in plugin code', async () => {
    await makePlugin(tempDir, 'syntax-err', MANIFEST, 'this is not valid {{{{');
    await loader.installPlugin(path.join(tempDir, 'syntax-err'));
    await expect(loader.loadPlugin('syntax-err')).rejects.toThrow(/Failed to load plugin/);
  });

  it('prevents prototype pollution from plugin code', async () => {
    const code = `try{Object.prototype.polluted=true;}catch(e){}
      module.exports={activate:function(){}};`;
    await installLoadActivate(loader, tempDir, 'proto', MANIFEST, code);
    const testObj: Record<string, unknown> = {};
    expect(testObj.polluted).toBeUndefined();
  });

  it('prevents global object modification from leaking to host', async () => {
    const code = `try{globalThis.hostLeak='leaked';}catch(e){}
      module.exports={activate:function(){}};`;
    await installLoadActivate(loader, tempDir, 'global-leak', MANIFEST, code);
    expect((globalThis as Record<string, unknown>).hostLeak).toBeUndefined();
  });

  it('records error state for failed plugin load', async () => {
    await makePlugin(tempDir, 'crash', MANIFEST, 'throw new Error("deliberate crash");');
    await loader.installPlugin(path.join(tempDir, 'crash'));
    await expect(loader.loadPlugin('crash')).rejects.toThrow();
    const record = await loader.getRegistry().getPlugin('crash');
    expect(record?.state).toBe('error');
    expect(record?.error).toContain('deliberate crash');
  });
});

// ============================================================================
// Plugin Manifest Validation
// ============================================================================
describe('Plugin manifest validation rejects invalid manifests', () => {
  let tempDir = '';
  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-mval-'));
  });
  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it.each([
    ['missing name', { version: '1.0.0', description: 'x', permissions: [] }],
    ['empty name', { name: '', version: '1.0.0', description: 'x', permissions: [] }],
    [
      'name > 100 chars',
      { name: 'x'.repeat(101), version: '1.0.0', description: 'x', permissions: [] },
    ],
    [
      'desc > 500 chars',
      { name: 'T', version: '1.0.0', description: 'x'.repeat(501), permissions: [] },
    ],
    [
      'unknown permission',
      { name: 'T', version: '1.0.0', description: 'x', permissions: ['execute'] },
    ],
    ['missing permissions', { name: 'T', version: '1.0.0', description: 'x' }],
  ])('rejects manifest with %s', (_label, data) => {
    expect(PluginManifestSchema.safeParse(data).success).toBe(false);
  });

  it.each(['1.0', '1', 'v1.0.0', '1.0.0-beta', 'abc'])(
    'rejects invalid version format: %s',
    (version) => {
      const result = PluginManifestSchema.safeParse({
        name: 'T',
        version,
        description: 'x',
        permissions: [],
      });
      expect(result.success).toBe(false);
    }
  );

  it('accepts valid manifest with all known permissions', () => {
    const result = PluginManifestSchema.safeParse({
      name: 'Full',
      version: '2.0.0',
      description: 'All perms',
      permissions: ['file-read', 'file-write', 'ui', 'network'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects malformed JSON from disk', async () => {
    const dir = path.join(tempDir, 'bad-json');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'manifest.json'), 'not valid {');
    await expect(loadManifest(dir)).rejects.toThrow(/Invalid JSON/);
  });

  it('rejects invalid schema from disk', async () => {
    const dir = path.join(tempDir, 'bad-schema');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ name: '' }));
    await expect(loadManifest(dir)).rejects.toThrow(/Invalid plugin manifest/);
  });

  it('rejects missing manifest file', async () => {
    const dir = path.join(tempDir, 'no-file');
    await mkdir(dir, { recursive: true });
    await expect(loadManifest(dir)).rejects.toThrow(/manifest not found/);
  });
});

// ============================================================================
// Sandbox uses vm.createContext
// ============================================================================
describe('Plugin loader uses vm.createContext for sandboxing', () => {
  let tempDir = '';
  let loader: PluginLoader;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-vm-'));
    loader = new PluginLoader(tempDir);
  });
  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('runs plugin code in isolated vm context (no global object)', async () => {
    const code = `var iso = typeof global === 'undefined';
      module.exports={activate:function(){if(!iso)throw new Error('global accessible');}};`;
    await installLoadActivate(loader, tempDir, 'vm-check', MANIFEST, code);
    expect(loader.isActivated('vm-check')).toBe(true);
  });

  it('provides setTimeout but not setImmediate', async () => {
    const code = `var a=typeof setTimeout==='function',b=typeof setImmediate!=='undefined';
      module.exports={activate:function(){if(!a)throw new Error('no setTimeout');if(b)throw new Error('has setImmediate');}};`;
    await installLoadActivate(loader, tempDir, 'timer', MANIFEST, code);
    expect(loader.isActivated('timer')).toBe(true);
  });

  it('sandbox console is scoped to plugin logging', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = `console.log('hello');module.exports={activate:function(){}};`;
    await installLoadActivate(loader, tempDir, 'console-scope', MANIFEST, code);
    const pluginLogs = logSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('[plugin:')
    );
    expect(pluginLogs.length).toBeGreaterThan(0);
    logSpy.mockRestore();
  });
});
