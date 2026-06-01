import { app, BrowserWindow, shell } from 'electron';

const APP_URL = process.env.ACGN_APP_URL || 'http://127.0.0.1:5188';

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    title: 'acgn_journey',
    backgroundColor: '#f7f8fc',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  window.loadURL(APP_URL);
}

app.whenReady().then(() => {
  app.setName('acgn_journey');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
