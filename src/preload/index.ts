import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  BusinessRecord,
  ExportPayload,
  ResultsQuery,
  ScrapeFormData,
  ScrapeProgressPayload,
  SettingsData
} from '../shared/types'

// Custom APIs for renderer
const api = {
  getSnapshot: () => ipcRenderer.invoke('app:getSnapshot'),
  startScrape: (form: ScrapeFormData) => ipcRenderer.invoke('scrape:start', form),
  pauseScrape: () => ipcRenderer.invoke('scrape:pause'),
  resumeScrape: () => ipcRenderer.invoke('scrape:resume'),
  stopScrape: () => ipcRenderer.invoke('scrape:stop'),
  saveSettings: (settings: Partial<SettingsData>) => ipcRenderer.invoke('settings:save', settings),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  openExportDirectory: () => ipcRenderer.invoke('settings:openExportDirectory'),
  listResults: (query: ResultsQuery) => ipcRenderer.invoke('results:list', query),
  deleteResults: (ids: string[]) => ipcRenderer.invoke('results:delete', ids),
  deduplicateRun: (runId: string) => ipcRenderer.invoke('results:deduplicate', runId),
  deleteRun: (runId: string) => ipcRenderer.invoke('history:delete', runId),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  exportResults: (payload: ExportPayload) => ipcRenderer.invoke('export:run', payload),
  onProgress: (listener: (payload: ScrapeProgressPayload) => void) => {
    const handler = (_event: unknown, payload: ScrapeProgressPayload): void => listener(payload)
    ipcRenderer.on('scrape:progress', handler)
    return () => ipcRenderer.removeListener('scrape:progress', handler)
  },
  onResult: (listener: (payload: BusinessRecord) => void) => {
    const handler = (_event: unknown, payload: BusinessRecord): void => listener(payload)
    ipcRenderer.on('scrape:result', handler)
    return () => ipcRenderer.removeListener('scrape:result', handler)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
