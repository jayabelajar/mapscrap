import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import type { BusinessRecord, SettingsData } from '../shared/types'
import { csvEscape, sanitizeFileName } from './utils'

const exportColumns = [
  ['Business Name', 'name'],
  ['Category', 'category'],
  ['Address', 'address'],
  ['Phone', 'phone'],
  ['Website', 'website'],
  ['Rating', 'rating'],
  ['Review Count', 'reviewCount'],
  ['Google Maps URL', 'mapsUrl'],
  ['Latitude', 'latitude'],
  ['Longitude', 'longitude'],
  ['Scraped At', 'scrapedAt']
] as const

export class ExportService {
  exportBusinesses(
    format: 'csv' | 'xlsx',
    records: BusinessRecord[],
    fileLabel: string,
    settings: SettingsData
  ): string {
    mkdirSync(settings.exportDirectory, { recursive: true })
    const safeName = sanitizeFileName(fileLabel)
    const filePath = join(settings.exportDirectory, `${safeName}.${format}`)

    if (format === 'csv') {
      const header = exportColumns.map(([label]) => csvEscape(label)).join(',')
      const rows = records.map((record) =>
        exportColumns
          .map(([, key]) =>
            csvEscape(record[key as keyof BusinessRecord] as string | number | null)
          )
          .join(',')
      )
      writeFileSync(filePath, [header, ...rows].join('\n'), 'utf8')
      return filePath
    }

    const json = records.map((record) =>
      Object.fromEntries(
        exportColumns.map(([label, key]) => [label, record[key as keyof BusinessRecord]])
      )
    )
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet(json)
    XLSX.utils.book_append_sheet(workbook, sheet, 'Results')
    XLSX.writeFile(workbook, filePath)
    return filePath
  }
}
