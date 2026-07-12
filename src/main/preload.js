/**
 * e-Takip — Preload Script
 *
 * The preload script runs in a privileged context with access to Node.js APIs
 * but is isolated from the renderer. It exposes a narrow API to the
 * renderer process via contextBridge — this is the ONLY way the renderer can
 * talk to the main process or native APIs.
 *
 * Security Model:
 * - contextIsolation: true  → renderer can't access Node.js globals
 * - nodeIntegration: false  → renderer has no direct Node.js access
 * - Only explicitly allowlisted IPC channels are exposed
 */

import { contextBridge, ipcRenderer } from 'electron'

let sessionToken = null

const invokeWithSession = (channel, ...args) =>
  ipcRenderer.invoke(channel, sessionToken, ...args)

// ─── Exposed API Surface ───────────────────────────────────────────────────
contextBridge.exposeInMainWorld('eTakip', {
  /**
   * Window control API
   */
  window: {
    minimize:     ()  => ipcRenderer.send('window:minimize'),
    maximize:     ()  => ipcRenderer.send('window:maximize'),
    close:        ()  => ipcRenderer.send('window:close'),
    isMaximized:  ()  => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChange: (callback) => {
      ipcRenderer.on('window:maximized-change', (_, isMaximized) =>
        callback(isMaximized)
      )
      // Return cleanup function
      return () => ipcRenderer.removeAllListeners('window:maximized-change')
    },
  },

  /**
   * Database API — only methods used by the current interface are exposed.
   */
  db: {
    // Prescriptions
    prescriptions: {
      getAll:    (params) => invokeWithSession('db:prescriptions:getAll', params),
      getById:   (id)     => invokeWithSession('db:prescriptions:getById', id),
      create:    (data)   => invokeWithSession('db:prescriptions:create', data),
      update:    (id, d)  => invokeWithSession('db:prescriptions:update', id, d),
    },
    // Patients
    patients: {
      getAll:  (params)   => invokeWithSession('db:patients:getAll', params),
      getById: (id)       => invokeWithSession('db:patients:getById', id),
      create:  (data)     => invokeWithSession('db:patients:create', data),
      update:  (id, data) => invokeWithSession('db:patients:update', id, data),
    },
    // Audit log
    audit: {
      getAll: (params) => invokeWithSession('db:audit:getAll', params),
    },
    // Analytics
    analytics: {
      getDailySummary: ()      => invokeWithSession('db:analytics:getDailySummary'),
      getTopCategories:()      => invokeWithSession('db:analytics:getTopCategories'),
    },
    // Reports
    reports: {
      generateDaily: (date) => invokeWithSession('db:reports:generateDaily', date),
      generateRange: (args) => invokeWithSession('db:reports:generateRange', args),
    },
  },

  /**
   * Authentication
   */
  auth: {
    login: async (username, password) => {
      const response = await ipcRenderer.invoke('auth:login', username, password)
      sessionToken = response.success ? response.data.token : null
      if (!response.success) return response
      return { success: true, data: { user: response.data.user } }
    },
    logout: async () => {
      if (!sessionToken) return { success: true, data: { loggedOut: true } }
      const response = await ipcRenderer.invoke('auth:logout', sessionToken)
      sessionToken = null
      return response
    },
  },
})
