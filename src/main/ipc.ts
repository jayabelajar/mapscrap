import { app, ipcMain, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { DatabaseService } from './database'
import { ExportService } from './exporter'
import { GoogleMapsScraper } from './scraper'
import { SettingsStore } from './settings'
import type {
  DashboardSnapshot,
  ExportPayload,
  ResultsQuery,
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
    ipcMain.handle('app:getSnapshot', () => this.getSnapshot())
    ipcMain.handle('settings:save', (_, next: Partial<SettingsData>) => this.settings.save(next))
    ipcMain.handle('settings:reset', () => this.settings.reset())
    ipcMain.handle('settings:openExportDirectory', async () => {
      const settings = this.settings.get()
      await shell.openPath(settings.exportDirectory)
      return settings.exportDirectory
    })
    ipcMain.handle('results:list', (_, query: ResultsQuery) => this.database.listBusinesses(query))
    ipcMain.handle('results:delete', (_, ids: string[]) => {
      this.database.deleteBusinesses(ids)
      return true
    })
    ipcMain.handle('results:deduplicate', (_, runId: string) => this.database.deduplicateRun(runId))
    ipcMain.handle('history:delete', (_, runId: string) => {
      this.database.deleteRun(runId)
      return true
    })
    ipcMain.handle('history:clear', () => {
      this.database.clearHistory()
      return true
    })
    ipcMain.handle('scrape:start', (_, form: ScrapeFormData) => this.startScrape(form))
    ipcMain.handle('scrape:pause', () => this.pauseScrape())
    ipcMain.handle('scrape:resume', () => this.resumeScrape())
    ipcMain.handle('scrape:stop', () => this.stopScrape())
    ipcMain.handle('export:run', (_, payload: ExportPayload) => this.exportResults(payload))
  }

  private getSnapshot(): DashboardSnapshot {
    const latestRun = this.database.listRuns()[0] ?? null
    const selectedRunId = this.activeJob?.run.id ?? latestRun?.id

    return {
      settings: this.settings.get(),
      activeRun: this.activeJob?.run ?? null,
      runs: this.database.listRuns(),
      results: selectedRunId ? this.database.listBusinesses({ runId: selectedRunId }) : [],
      progress: this.progress
    }
  }

  private emitProgress(payload: ScrapeProgressPayload): void {
    this.progress = payload
    this.mainWindow.webContents.send('scrape:progress', payload)
  }

  private async startScrape(form: ScrapeFormData): Promise<ScrapeRunRecord> {
    if (this.activeJob && ['running', 'paused'].includes(this.activeJob.run.status)) {
      throw new Error('A scrape job is already active')
    }

    const keyword = form.keyword.trim()
    const location = form.location.trim()
    const maxResults = Math.max(1, Math.min(500, Math.floor(form.maxResults || 0)))

    if (!keyword) {
      throw new Error('Keyword wajib diisi')
    }

    if (!location) {
      throw new Error('Location wajib diisi')
    }

    const run = this.database.createRun(keyword, location, maxResults)
    const control = { paused: false, stopped: false }
    const normalizedForm = { keyword, location, maxResults }
    this.activeJob = { run, form: normalizedForm, control }

    this.emitProgress({
      runId: run.id,
      status: 'running',
      current: 0,
      total: maxResults,
      message: 'Initializing scraper'
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
          message: status === 'completed' ? 'Scrape completed' : 'Scrape stopped'
        })
      })
      .catch((error: Error) => {
        const failedStatus =
          control.stopped && error.message === 'Scrape stopped' ? 'stopped' : 'failed'
        const total = this.database.countBusinesses(run.id)
        this.database.updateRunStatus(run.id, failedStatus, total)
        this.emitProgress({
          runId: run.id,
          status: failedStatus,
          current: total,
          total: maxResults,
          message: failedStatus === 'stopped' ? 'Scrape stopped' : error.message
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
      message: 'Scrape paused'
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
      message: 'Scrape resumed'
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
    const all = this.database.listBusinesses({ runId: payload.runId })
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
}
