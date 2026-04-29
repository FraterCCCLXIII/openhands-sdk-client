const { app, BrowserWindow, shell } = require('electron');

const DEFAULT_APP_URL = 'http://localhost:12002';
const DEFAULT_LOCAL_OPENHANDS_URL = 'http://localhost:3000';

async function detectLocalOpenHands() {
  const localUrl = process.env.OPENHANDS_LOCAL_URL || DEFAULT_LOCAL_OPENHANDS_URL;
  try {
    const response = await fetch(`${localUrl}/alive`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      return payload?.status === 'ok' ? localUrl : null;
    }

    const text = (await response.text()).trim();
    return text === 'OK' ? localUrl : null;
  } catch {
    return null;
  }
}

function withBackendHint(appUrl, localOpenHandsUrl) {
  const url = new URL(appUrl);

  if (localOpenHandsUrl) {
    url.searchParams.set('backendMode', 'local');
    url.searchParams.set('backendBaseUrl', localOpenHandsUrl);
  } else {
    url.searchParams.set('backendMode', 'prototype');
    url.searchParams.delete('backendBaseUrl');
  }

  url.searchParams.set('backendOverride', '1');
  return url.toString();
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 700,
    title: 'OpenHands Client',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const appUrl = process.env.OPENHANDS_CLIENT_URL || DEFAULT_APP_URL;
  const localOpenHandsUrl = await detectLocalOpenHands();
  mainWindow.loadURL(withBackendHint(appUrl, localOpenHandsUrl));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
