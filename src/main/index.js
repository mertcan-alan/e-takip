/**
 * e-Takip — Electron Main Process
 *
 * Responsibilities:
 * - Creates the main BrowserWindow with the application's custom title bar
 * - Enforces strict Content Security Policy
 * - Wires up the preload script for safe IPC communication
 * - Loads Vite dev server in development or production build in prod
 */

import { app, BrowserWindow, shell, ipcMain, Menu, session } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { initDatabase } from './db/database.js'
import { registerHandlers } from './db/handlers.js'

const APP_ROOT = app.getAppPath()

// ─── Environment ─────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const RENDERER_URL = isDev
  ? (process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173')
  : null

// ─── Window Reference ─────────────────────────────────────────────────────────
let mainWindow = null
const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
}

/**
 * Creates the primary application window.
 * Uses a frameless window so the same official application header is shown on each platform.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    // ── Frameless window for custom titlebar ──
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    // ── Visual ──────────────────────────────
    backgroundColor: '#f3f5f6',
    // ── Security & Preload ───────────────────
    webPreferences: {
      preload: join(APP_ROOT, 'dist-electron/preload/preload.cjs'),
      nodeIntegration: false,      // Critical security: never enable
      contextIsolation: true,      // Isolate renderer from main process
      sandbox: true,
      webSecurity: true,
    },
    // ── Center on screen ─────────────────────
    center: true,
    show: false, // Prevent white flash on load
  })

  // ── Show window only when renderer is ready ─
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    // Smooth entrance animation
    mainWindow.setOpacity(0)
    let opacity = 0
    const fadeIn = setInterval(() => {
      opacity += 0.08
      if (opacity >= 1) {
        mainWindow.setOpacity(1)
        clearInterval(fadeIn)
      } else {
        mainWindow.setOpacity(opacity)
      }
    }, 16) // ~60fps
  })

  // ── Open external links in browser, not Electron ─
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url)
      if (target.protocol === 'https:' || target.protocol === 'http:') {
        shell.openExternal(target.toString())
      }
    } catch {
      // Invalid URLs are ignored.
    }
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Forward maximize/unmaximize events to renderer
  mainWindow.on('maximize', () =>
    mainWindow.webContents.send('window:maximized-change', true)
  )
  mainWindow.on('unmaximize', () =>
    mainWindow.webContents.send('window:maximized-change', false)
  )

  // ── Remove default menu bar ──
  Menu.setApplicationMenu(null)

  // ── Load the app ──────────────────────────────────────────────
  if (isDev) {
    mainWindow.loadURL(RENDERER_URL)
  } else {
    mainWindow.loadFile(join(APP_ROOT, 'dist/index.html'))
  }
}

function registerWindowHandlers() {
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
if (hasSingleInstanceLock) app.whenReady().then(async () => {
  registerWindowHandlers()
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  // Initialize SQLite database before window creation
  try {
    await initDatabase()
    registerHandlers()
    console.log('[e-Takip] Veritabanı hazır')
  } catch (err) {
    console.error('[e-Takip] Veritabanı başlatılamadı:', err)
  }

  createWindow()

  // macOS: Re-create window on dock click if none are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Security: Restrict navigation to prevent open redirect attacks
app.on('web-contents-created', (_, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.on('will-navigate', (event, url) => {
    const target = new URL(url)
    const isLocalDevelopment = isDev && [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ].includes(target.origin)
    const applicationFile = pathToFileURL(join(APP_ROOT, 'dist/index.html'))
    target.hash = ''
    const isPackagedFile = !isDev && target.href === applicationFile.href
    if (!isLocalDevelopment && !isPackagedFile) {
      event.preventDefault()
    }
  })
})
