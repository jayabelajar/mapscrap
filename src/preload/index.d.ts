import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  BusinessRecord,
  DashboardSnapshot,
  ExportPayload,
  ResultsQuery,
  ScrapeFormData,
  ScrapeProgressPayload,
  SettingsData
} from '../shared/types'

type Listener<T> = (payload: T) => void

interface AppApi {
  getSnapshot: () => Promise<DashboardSnapshot>
  startScrape: (form: ScrapeFormData) => Promise<{ id: string }>
  pauseScrape: () => Promise<boolean>
  resumeScrape: () => Promise<boolean>
  stopScrape: () => Promise<boolean>
  saveSettings: (settings: Partial<SettingsData>) => Promise<SettingsData>
  resetSettings: () => Promise<SettingsData>
  openExportDirectory: () => Promise<string>
  listResults: (query: ResultsQuery) => Promise<BusinessRecord[]>
  deleteResults: (ids: string[]) => Promise<boolean>
  deduplicateRun: (runId: string) => Promise<number>
  deleteRun: (runId: string) => Promise<boolean>
  clearHistory: () => Promise<boolean>
  exportResults: (payload: ExportPayload) => Promise<string>
  onProgress: (listener: Listener<ScrapeProgressPayload>) => () => void
  onResult: (listener: Listener<BusinessRecord>) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
