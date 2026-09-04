import { app, dialog, ipcMain, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { basename, dirname } from 'path'
import { DatabaseService } from './database'
import { ExportService } from './exporter'
import { GoogleMapsScraper } from './scraper'
import { SettingsStore } from './settings'
import type {
  DashboardSnapshot,
  ExportPayload,
  HistoryRestorePayload,
  ResultsQuery,
  RunBundlePayload,
  ScrapeFormData,
  ScrapeProgressPayload,
  ScrapeRunRecord,
  SettingsData
} from '../shared/types'

type ActiveJob = {
  run: ScrapeRunRecord
  form: ScrapeFormData
  control: {
    paused: boolean
    stopped: boolean
  }
}

export class IpcController {
  private readonly settings = new SettingsStore()
  private readonly database = new DatabaseService()
  private readonly exporter = new ExportService()
  private readonly scraper = new GoogleMapsScraper()
  private activeJob: ActiveJob | null = null
  private progress: ScrapeProgressPayload | null = null

  constructor(private readonly mainWindow: BrowserWindow) {}

  register(): void {
    ipcMain.handle('app:getSnapshot', (_, userEmail?: string) => this.getSnapshot(userEmail))
    ipcMain.handle('settings:save', (_, next: Partial<SettingsData>) => this.settings.save(next))
    ipcMain.handle('settings:reset', () => this.settings.reset())
    ipcMain.handle('settings:openExportDirectory', async () => {
      const settings = this.settings.get()
      await shell.openPath(settings.exportDirectory)
      return settings.exportDirectory
    })
    ipcMain.handle('dialog:selectDirectory', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Pilih Folder Lokasi Ekspor'
      })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      return result.filePaths[0]
    })
    ipcMain.handle('results:list', (_, query: ResultsQuery) => this.database.listBusinesses(query))
    ipcMain.handle('results:delete', (_, payload: { ids: string[]; userEmail?: string }) => {
      this.database.deleteBusinesses(payload.ids, payload.userEmail)
      return true
    })
    ipcMain.handle(
      'results:restore',
      (_, payload: { records: HistoryRestorePayload['results']; userEmail?: string }) => {
        this.database.restoreBusinesses(payload.records, payload.userEmail)
        return true
      }
    )
    ipcMain.handle('results:deduplicate', (_, payload: { runId: string; userEmail?: string }) => {
      return this.database.deduplicateRun(payload.runId, payload.userEmail)
    })
    ipcMain.handle('history:delete', (_, payload: { runId: string; userEmail?: string }) => {
      this.database.deleteRun(payload.runId, payload.userEmail)
      return true
    })
    ipcMain.handle('history:restoreRun', (_, payload: RunBundlePayload) => {
      this.database.restoreRun(payload.run, payload.userEmail)
      this.database.restoreBusinesses(payload.results, payload.userEmail)
      if (this.database.getRunForUser(payload.run.id, payload.userEmail)) {
        this.database.updateRunStatus(payload.run.id, payload.run.status, payload.results.length)
      }
      return true
    })
    ipcMain.handle('history:clear', (_, userEmail?: string) => {
      this.database.clearHistory(userEmail)
      return true
    })
    ipcMain.handle('history:restoreSnapshot', (_, payload: HistoryRestorePayload) => {
      for (const run of payload.runs) {
        this.database.restoreRun(run, payload.userEmail)
      }
      this.database.restoreBusinesses(payload.results, payload.userEmail)
      for (const run of payload.runs) {
        if (this.database.getRunForUser(run.id, payload.userEmail)) {
          const count = payload.results.filter((item) => item.runId === run.id).length
          this.database.updateRunStatus(run.id, run.status, count)
        }
      }
      return true
    })
    ipcMain.handle('scrape:start', (_, form: ScrapeFormData) => this.startScrape(form))
    ipcMain.handle('scrape:pause', () => this.pauseScrape())
    ipcMain.handle('scrape:resume', () => this.resumeScrape())
    ipcMain.handle('scrape:stop', () => this.stopScrape())
    ipcMain.handle('export:run', (_, payload: ExportPayload) => this.exportResults(payload))
    ipcMain.handle('export:saveAs', (_, payload: ExportPayload) => this.exportResultsSaveAs(payload))
  }

  private getSnapshot(userEmail?: string): DashboardSnapshot {
    const runs = this.database.listRuns(userEmail)
    const latestRun = runs[0] ?? null
    const scopedActiveRun =
      this.activeJob && (!userEmail || this.activeJob.run.userEmail === userEmail) ? this.activeJob.run : null
    const selectedRunId = scopedActiveRun?.id ?? latestRun?.id

    return {
      settings: this.settings.get(),
      activeRun: scopedActiveRun,
      runs,
      results: selectedRunId ? this.database.listBusinesses({ runId: selectedRunId, userEmail }) : [],
      progress: scopedActiveRun ? this.progress : null
    }
  }

  private emitProgress(payload: ScrapeProgressPayload): void {
    this.progress = payload
    this.mainWindow.webContents.send('scrape:progress', payload)
  }

  private async startScrape(form: ScrapeFormData): Promise<ScrapeRunRecord> {
    if (this.activeJob && ['running', 'paused'].includes(this.activeJob.run.status)) {
      throw new Error('Masih ada proses scraping yang berjalan. Selesaikan atau hentikan dulu sebelum mulai yang baru.')
    }

    const keyword = form.keyword.trim()
    const location = form.location.trim()
    const maxResults = Math.max(1, Math.min(500, Math.floor(form.maxResults || 0)))

    if (!keyword) {
      throw new Error('Kata kunci belum diisi. Masukkan kata kunci pencarian terlebih dahulu.')
    }

    if (!location) {
      throw new Error('Lokasi target belum diisi. Pilih lokasi yang ingin discrape.')
    }

    const run = this.database.createRun(keyword, location, maxResults, form.userEmail || '')
    const control = { paused: false, stopped: false }
    const normalizedForm = { keyword, location, maxResults, userEmail: form.userEmail }
    this.activeJob = { run, form: normalizedForm, control }

    this.emitProgress({
      runId: run.id,
      status: 'running',
      current: 0,
      total: maxResults,
      message: 'Menyiapkan proses scraping...'
    })

    const settings = this.settings.get()

    void this.scraper
      .run(this.mainWindow, run.id, normalizedForm, settings, control, {
        onProgress: (payload) => this.emitProgress(payload),
        onBatch: (records) => {
          const inserted = this.database.insertBusinesses(records)
          if (inserted.length === 0) {
            return
          }
          const total = this.database.countBusinesses(run.id)
          this.activeJob = this.activeJob
            ? {
                ...this.activeJob,
                run: {
                  ...this.activeJob.run,
                  totalResults: total,
                  updatedAt: new Date().toISOString()
                }
              }
            : this.activeJob
        }
      })
      .then(() => {
        if (settings.autoDeduplicate) {
          this.database.deduplicateRun(run.id)
        }
        const status = control.stopped ? 'stopped' : 'completed'
        const total = this.database.countBusinesses(run.id)
        this.database.updateRunStatus(run.id, status, total)
        this.emitProgress({
          runId: run.id,
          status,
          current: total,
          total: maxResults,
          message: status === 'completed' ? 'Scraping selesai.' : 'Proses scraping dihentikan.'
        })
      })
      .catch((error: Error) => {
        const failedStatus =
          control.stopped && error.message === 'Proses scraping dihentikan.' ? 'stopped' : 'failed'
        const total = this.database.countBusinesses(run.id)
        this.database.updateRunStatus(run.id, failedStatus, total)
        this.emitProgress({
          runId: run.id,
          status: failedStatus,
          current: total,
          total: maxResults,
          message: failedStatus === 'stopped' ? 'Proses scraping dihentikan.' : error.message
        })
      })
      .finally(() => {
        this.activeJob = null
      })

    return run
  }

  private pauseScrape(): boolean {
    if (!this.activeJob) {
      return false
    }

    this.activeJob.control.paused = true
    this.activeJob.run = this.database.updateRunStatus(
      this.activeJob.run.id,
      'paused',
      this.database.countBusinesses(this.activeJob.run.id)
    )
    this.emitProgress({
      runId: this.activeJob.run.id,
      status: 'paused',
      current: this.activeJob.run.totalResults,
      total: this.activeJob.form.maxResults,
      message: 'Scraping dijeda.'
    })
    return true
  }

  private resumeScrape(): boolean {
    if (!this.activeJob) {
      return false
    }

    this.activeJob.control.paused = false
    this.activeJob.run = this.database.updateRunStatus(
      this.activeJob.run.id,
      'running',
      this.database.countBusinesses(this.activeJob.run.id)
    )
    this.emitProgress({
      runId: this.activeJob.run.id,
      status: 'running',
      current: this.activeJob.run.totalResults,
      total: this.activeJob.form.maxResults,
      message: 'Scraping dilanjutkan.'
    })
    return true
  }

  private async stopScrape(): Promise<boolean> {
    if (!this.activeJob) {
      return false
    }

    this.activeJob.control.stopped = true
    this.activeJob.control.paused = false
    await this.scraper.close()
    return true
  }

  private exportResults(payload: ExportPayload): string {
    if (!this.database.getRunForUser(payload.runId, payload.userEmail)) {
      throw new Error('Data sesi ini tidak tersedia untuk akun yang sedang aktif.')
    }

    const all = this.database.listBusinesses({ runId: payload.runId, userEmail: payload.userEmail })
    const records = payload.ids?.length ? all.filter((item) => payload.ids?.includes(item.id)) : all
    if (records.length === 0) {
      throw new Error('Tidak ada data untuk diekspor')
    }
    const run = this.database.getRun(payload.runId)
    const label = run
      ? `${run.keyword}-${run.location}-${new Date(run.createdAt).toISOString().slice(0, 10)}`
      : `mapscraper-${app.getName().toLowerCase()}`
    return this.exporter.exportBusinesses(payload.format, records, label, this.settings.get())
  }

  private async exportResultsSaveAs(payload: ExportPayload): Promise<string | null> {
    if (!this.database.getRunForUser(payload.runId, payload.userEmail)) {
      throw new Error('Data sesi ini tidak tersedia untuk akun yang sedang aktif.')
    }

    const all = this.database.listBusinesses({ runId: payload.runId, userEmail: payload.userEmail })
    const records = payload.ids?.length ? all.filter((item) => payload.ids?.includes(item.id)) : all
    if (records.length === 0) {
      throw new Error('Tidak ada data untuk diekspor')
    }
    const run = this.database.getRun(payload.runId)
    const defaultName = run
      ? `${run.keyword}-${run.location}-${new Date(run.createdAt).toISOString().slice(0, 10)}.${payload.format}`
      : `mapscraper-export.${payload.format}`

    const result = await dialog.showSaveDialog(this.mainWindow, {
      title: `Simpan File Hasil Scrape (${payload.format.toUpperCase()})`,
      defaultPath: defaultName,
      filters:
        payload.format === 'csv'
          ? [{ name: 'CSV Document (*.csv)', extensions: ['csv'] }]
          : [{ name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] }]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    const targetDir = dirname(result.filePath)
    const fileLabel = basename(result.filePath, `.${payload.format}`)
    const tempSettings = { ...this.settings.get(), exportDirectory: targetDir }
    return this.exporter.exportBusinesses(payload.format, records, fileLabel, tempSettings)
  }
}
