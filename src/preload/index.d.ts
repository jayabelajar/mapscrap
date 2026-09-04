import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  BusinessRecord,
  DashboardSnapshot,
  ExportPayload,
  HistoryRestorePayload,
  ResultsQuery,
  RunBundlePayload,
  ScrapeFormData,
  ScrapeProgressPayload,
  SettingsData
} from '../shared/types'

type Listener<T> = (payload: T) => void

interface AppApi {
  getSnapshot: (userEmail?: string) => Promise<DashboardSnapshot>
  startScrape: (form: ScrapeFormData) => Promise<{ id: string }>
  pauseScrape: () => Promise<boolean>
  resumeScrape: () => Promise<boolean>
  stopScrape: () => Promise<boolean>
  saveSettings: (settings: Partial<SettingsData>) => Promise<SettingsData>
  resetSettings: () => Promise<SettingsData>
  openExportDirectory: () => Promise<string>
  selectDirectory: () => Promise<string | null>
  listResults: (query: ResultsQuery) => Promise<BusinessRecord[]>
  deleteResults: (ids: string[], userEmail?: string) => Promise<boolean>
  restoreResults: (records: BusinessRecord[], userEmail?: string) => Promise<boolean>
  deduplicateRun: (runId: string, userEmail?: string) => Promise<number>
  deleteRun: (runId: string, userEmail?: string) => Promise<boolean>
  restoreRun: (payload: RunBundlePayload) => Promise<boolean>
  clearHistory: (userEmail?: string) => Promise<boolean>
  restoreHistorySnapshot: (payload: HistoryRestorePayload) => Promise<boolean>
  exportResults: (payload: ExportPayload) => Promise<string>
  exportResultsSaveAs: (payload: ExportPayload) => Promise<string | null>
  onProgress: (listener: Listener<ScrapeProgressPayload>) => () => void
  onResult: (listener: Listener<BusinessRecord>) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
