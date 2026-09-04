export type RunStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed'

export interface ScrapeFormData {
  keyword: string
  location: string
  maxResults: number
  userEmail?: string
}

export interface SettingsData {
  headless: boolean
  delayMs: number
  timeoutMs: number
  autoDeduplicate: boolean
  autoSave: boolean
  exportDirectory: string
}

export interface BusinessRecord {
  id: string
  runId: string
  name: string
  category: string
  address: string
  phone: string
  website: string
  rating: number | null
  reviewCount: number | null
  mapsUrl: string
  latitude: number | null
  longitude: number | null
  scrapedAt: string
}

export interface ScrapeRunRecord {
  id: string
  userEmail?: string
  keyword: string
  location: string
  status: RunStatus
  totalResults: number
  maxResults: number
  createdAt: string
  updatedAt: string
}

export interface ScrapeProgressPayload {
  runId: string
  status: RunStatus
  current: number
  total: number
  message: string
}

export interface DashboardSnapshot {
  settings: SettingsData
  activeRun: ScrapeRunRecord | null
  runs: ScrapeRunRecord[]
  results: BusinessRecord[]
  progress: ScrapeProgressPayload | null
}

export interface ExportPayload {
  runId: string
  ids?: string[]
  format: 'csv' | 'xlsx'
  userEmail?: string
}

export interface RunBundlePayload {
  run: ScrapeRunRecord
  results: BusinessRecord[]
  userEmail?: string
}

export interface HistoryRestorePayload {
  runs: ScrapeRunRecord[]
  results: BusinessRecord[]
  userEmail?: string
}

export interface ResultsQuery {
  runId?: string
  search?: string
  userEmail?: string
}
