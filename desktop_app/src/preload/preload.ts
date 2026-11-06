/**
 * Preload Script
 *
 * Runs in an isolated context between the main process and the renderer.
 * Exposes a small, safe surface (window.desktopApp) so the renderer can:
 *   - get the API base URL
 *   - get the user's preferred theme
 *   - receive theme updates from the OS
 */
import { contextBridge, nativeTheme, ipcRenderer } from 'electron';
import * as process from 'process';

// PRODUCTION: fallback must match DEFAULT_API_BASE in main.ts (HTTPS URL).
// Normally the main process always sets GUIDANCE_API_BASE before the renderer loads.
const apiBase = process.env.GUIDANCE_API_BASE || '';

contextBridge.exposeInMainWorld('desktopApp', {
  apiBase,
  platform: process.platform,
  isElectron: true,
  version: process.versions.electron,

  // Theme control
  getTheme: (): 'light' | 'dark' | 'system' => {
    return (process.env.GUIDANCE_THEME as 'light' | 'dark' | 'system') || 'system';
  },
  setTheme: (theme: 'light' | 'dark') => {
    try {
      nativeTheme.themeSource = theme;
    } catch {
      // nativeTheme not available in this context
    }
    process.env.GUIDANCE_THEME = theme;
  },
  onThemeChange: (callback: (theme: 'light' | 'dark') => void) => {
    try {
      nativeTheme.on('updated', () => {
        callback(nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
      });
    } catch {
      // nativeTheme not available in this context
    }
  },

  // App lifecycle
  quit: () => ipcRenderer.send('app-quit'),
});
