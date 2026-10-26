import { BrowserWindow, type BrowserWindowConstructorOptions, session } from 'electron';
import { join } from 'path';

export interface WindowFactoryOptions {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  x?: number;
  y?: number;
  backgroundColor?: string;
  query?: Record<string, string>;
  htmlPath: string;
}

let sessionSecurityConfigured = false;

/**
 * Configures global session-level security policies (CSP headers, permission denial, device access).
 */
export function configureSessionSecurity(): void {
  if (sessionSecurityConfigured) return;
  sessionSecurityConfigured = true;

  const defaultSession = session.defaultSession;

  // 1. Deny every permission request (camera, microphone, geolocation, notifications, etc.)
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  defaultSession.setPermissionCheckHandler(() => false);
  defaultSession.setDevicePermissionHandler(() => false);

  // 2. Strict Content Security Policy header on all HTTP/file responses
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: wrriter-vault:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';"
        ]
      }
    });
  });
}

/**
 * Creates an Electron window adhering strictly to the security baseline defined in ARCHITECTURE.md:
 * - Context isolation on
 * - Node integration off
 * - Sandbox on
 * - Strict CSP
 * - Navigation and new windows denied
 * - Every permission request denied
 * - Frameless window shell with zero white flash on show
 */
export function createSecureWindow(options: WindowFactoryOptions): BrowserWindow {
  configureSessionSecurity();

  const windowOptions: BrowserWindowConstructorOptions = {
    width: options.width ?? 1200,
    height: options.height ?? 800,
    minWidth: options.minWidth ?? 800,
    minHeight: options.minHeight ?? 600,
    ...(options.x !== undefined ? { x: options.x } : {}),
    ...(options.y !== undefined ? { y: options.y } : {}),
    frame: false,
    backgroundColor: options.backgroundColor ?? '#18181A',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  };

  const window = new BrowserWindow(windowOptions);

  // Deny new windows and navigation
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  window.webContents.on('will-redirect', (event) => {
    event.preventDefault();
  });

  // Load target file or dev URL
  if (process.env['ELECTRON_RENDERER_URL']) {
    const devUrl = new URL(process.env['ELECTRON_RENDERER_URL']);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        devUrl.searchParams.set(k, v);
      }
    }
    window.loadURL(devUrl.toString());
  } else {
    window.loadFile(options.htmlPath, options.query ? { query: options.query } : undefined);
  }

  // Prevent white flash: show only when first frame is ready
  window.once('ready-to-show', () => {
    window.show();
  });

  return window;
}

