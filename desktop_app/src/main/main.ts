/**
 * Electron Main Process
 *
 * Creates the BrowserWindow, loads the renderer (the desktop UI),
 * and exposes minimal lifecycle handlers. The renderer talks to the
 * Django backend exclusively via HTTP (see api.ts).
 */
import { app, BrowserWindow, Menu, shell, nativeTheme, session } from 'electron';
import * as path from 'path';
import * as process from 'process';

// ---------------------------------------------------------------------------
// API base URL
// ---------------------------------------------------------------------------
// PRODUCTION: replace with your deployed Django site URL.
//   * It MUST be HTTPS — the session/CSRF cookies are Secure + SameSite=None,
//     so the desktop app can only authenticate against an https:// backend.
const DEFAULT_API_BASE = process.env.GUIDANCE_API_BASE || '';

let mainWindow: BrowserWindow | null = null;

// Configure session to handle cross-origin requests
function configureSession(): void {
  const ses = session.defaultSession;
  
  // Allow cookies to be sent with requests to Django backend
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    // Ensure cookies are included in requests to our backend
    if (details.url.startsWith(DEFAULT_API_BASE)) {
      details.requestHeaders['Origin'] = DEFAULT_API_BASE;
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}

function createWindow(): void {
  // Apply saved theme if any (default to system)
  const savedTheme = (process.env.GUIDANCE_THEME as 'light' | 'dark' | undefined) ?? 'system';
  if (savedTheme === 'dark') nativeTheme.themeSource = 'dark';
  else if (savedTheme === 'light') nativeTheme.themeSource = 'light';

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#ffffff',
    title: 'Guidance Office Records & Inventory',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,  // Allow cross-origin requests to local Django backend
    },
  });

  // Expose the API base URL to renderer via preload binding
  // (renderer reads window.desktopApp.apiBase)
  process.env.GUIDANCE_API_BASE = DEFAULT_API_BASE;

  // Load the renderer entry HTML from dist/renderer
  // Both dev and production use the same bundled output
  const rendererPath = path.join(__dirname, '..', '..', 'renderer', 'index.html');
  mainWindow.loadFile(rendererPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

/*
 * Menu bar disabled for production — the app uses its own sidebar navigation.
 * Uncomment buildMenu() below and swap the setApplicationMenu call if you ever
 * want the menu bar back.
 */
/*
function buildMenu(): Menu {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}
*/

app.whenReady().then(() => {
  configureSession();
  // No menu bar in production (see buildMenu comment above)
  Menu.setApplicationMenu(null);
  // Menu.setApplicationMenu(buildMenu());
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Security: prevent new-window permission for non-allowed origins
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (e) => {
    e.preventDefault();
  });
});
