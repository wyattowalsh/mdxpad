/**
 * Tests for window factory.
 * Validates security settings and window configuration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow } from 'electron';

// Mock electron module
vi.mock('electron', () => {
  const mockBrowserWindow = vi.fn(function (this: any, options: any) {
    this.webContents = {
      getWebPreferences: vi.fn(() => options.webPreferences),
    };
    this.show = vi.fn();
    this.on = vi.fn();
    this.loadURL = vi.fn().mockResolvedValue(undefined);
    this.loadFile = vi.fn().mockResolvedValue(undefined);
    return this;
  });

  return {
    BrowserWindow: mockBrowserWindow,
  };
});

describe('createWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a BrowserWindow instance', async () => {
    const { createWindow } = await import('../window');
    const window = createWindow();

    expect(window).toBeDefined();
    expect(typeof window.show).toBe('function');
  });

  it('has proper security settings per constitution §3.2', async () => {
    const { createWindow } = await import('../window');
    const window = createWindow();

    const webPreferences = (window as any).webContents.getWebPreferences();

    expect(webPreferences.contextIsolation).toBe(true);
    expect(webPreferences.sandbox).toBe(true);
    expect(webPreferences.nodeIntegration).toBe(false);
    expect(webPreferences.webSecurity).toBe(true);
  });

  it('configures preload script path', async () => {
    const { createWindow } = await import('../window');
    const window = createWindow();

    const webPreferences = (window as any).webContents.getWebPreferences();

    expect(webPreferences.preload).toBeDefined();
    expect(webPreferences.preload).toContain('preload');
    expect(webPreferences.preload).toContain('index.js');
  });

  it('sets up macOS hiddenInset titlebar style', async () => {
    const { BrowserWindow } = await import('electron');
    const { createWindow } = await import('../window');

    createWindow();

    const constructorOptions = (BrowserWindow as any).mock.calls[0][0];

    expect(constructorOptions.titleBarStyle).toBe('hiddenInset');
    expect(constructorOptions.trafficLightPosition).toEqual({ x: 15, y: 10 });
  });

  it('sets window to not show initially', async () => {
    const { BrowserWindow } = await import('electron');
    const { createWindow } = await import('../window');

    createWindow();

    const constructorOptions = (BrowserWindow as any).mock.calls[0][0];

    expect(constructorOptions.show).toBe(false);
  });

  it('sets reasonable window dimensions', async () => {
    const { BrowserWindow } = await import('electron');
    const { createWindow } = await import('../window');

    createWindow();

    const constructorOptions = (BrowserWindow as any).mock.calls[0][0];

    expect(constructorOptions.width).toBe(1200);
    expect(constructorOptions.height).toBe(800);
    expect(constructorOptions.minWidth).toBe(800);
    expect(constructorOptions.minHeight).toBe(600);
  });

  it('registers ready-to-show event handler', async () => {
    const { createWindow } = await import('../window');
    const window = createWindow();

    expect(window.on).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
  });
});

describe('loadContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ELECTRON_RENDERER_URL;
  });

  it('loads from Vite dev server in development', async () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173';

    const { createWindow, loadContent } = await import('../window');
    const window = createWindow();

    loadContent(window);

    expect(window.loadURL).toHaveBeenCalledWith('http://localhost:5173');
  });

  it('loads from bundled files in production', async () => {
    const { createWindow, loadContent } = await import('../window');
    const window = createWindow();

    loadContent(window);

    expect(window.loadFile).toHaveBeenCalled();
    const loadFileArgs = (window.loadFile as any).mock.calls[0][0];
    expect(loadFileArgs).toContain('renderer');
    expect(loadFileArgs).toContain('index.html');
  });
});
