import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { SettingsData } from '../shared/types'

const defaultSettings = (): SettingsData => ({
  headless: true,
  delayMs: 500,
  timeoutMs: 30000,
  autoDeduplicate: true,
  autoSave: true,
  exportDirectory: join(app.getPath('documents'), 'GmapScraper Exports')
})

export class SettingsStore {
  private readonly filePath = join(app.getPath('userData'), 'settings.json')
  private cache: SettingsData | null = null

  get(): SettingsData {
    if (this.cache) {
      return this.cache
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<SettingsData>
      this.cache = { ...defaultSettings(), ...parsed }
    } catch {
      this.cache = defaultSettings()
      this.save(this.cache)
    }

    mkdirSync(this.cache.exportDirectory, { recursive: true })
    return this.cache
  }

  save(next: Partial<SettingsData>): SettingsData {
    const merged = { ...this.get(), ...next }
    mkdirSync(dirname(this.filePath), { recursive: true })
    mkdirSync(merged.exportDirectory, { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(merged, null, 2), 'utf8')
    this.cache = merged
    return merged
  }

  reset(): SettingsData {
    this.cache = defaultSettings()
    return this.save(this.cache)
  }
}
