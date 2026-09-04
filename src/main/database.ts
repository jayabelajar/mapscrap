import { app } from 'electron'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'
import type {
  BusinessRecord,
  ResultsQuery,
  RunStatus,
  ScrapeRunRecord
} from '../shared/types'
import { createId, nowIso } from './utils'

type RunRow = {
  id: string
  user_email: string
  keyword: string
  location: string
  status: RunStatus
  total_results: number
  max_results: number
  created_at: string
  updated_at: string
}

type BusinessRow = {
  id: string
  run_id: string
  name: string
  category: string
  address: string
  phone: string
  website: string
  rating: number | null
  review_count: number | null
  maps_url: string
  latitude: number | null
  longitude: number | null
  scraped_at: string
}

function mapRun(row: RunRow): ScrapeRunRecord {
  return {
    id: row.id,
    userEmail: row.user_email || undefined,
    keyword: row.keyword,
    location: row.location,
    status: row.status,
    totalResults: row.total_results,
    maxResults: row.max_results,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapBusiness(row: BusinessRow): BusinessRecord {
  return {
    id: row.id,
    runId: row.run_id,
    name: row.name,
    category: row.category,
    address: row.address,
    phone: row.phone,
    website: row.website,
    rating: row.rating,
    reviewCount: row.review_count,
    mapsUrl: row.maps_url,
    latitude: row.latitude,
    longitude: row.longitude,
    scrapedAt: row.scraped_at
  }
}

export class DatabaseService {
  private readonly dbPath = join(app.getPath('userData'), 'mapscraper.sqlite')
  private readonly db: DatabaseSync

  constructor() {
    mkdirSync(app.getPath('userData'), { recursive: true })
    this.db = new DatabaseSync(this.dbPath)
    this.db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL DEFAULT '',
        keyword TEXT NOT NULL,
        location TEXT NOT NULL,
        status TEXT NOT NULL,
        total_results INTEGER NOT NULL DEFAULT 0,
        max_results INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        website TEXT NOT NULL DEFAULT '',
        rating REAL,
        review_count INTEGER,
        maps_url TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        scraped_at TEXT NOT NULL,
        UNIQUE(run_id, maps_url),
        FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
      );
    `)

    try {
      this.db.exec(`ALTER TABLE runs ADD COLUMN user_email TEXT NOT NULL DEFAULT ''`)
    } catch {
      // Column already exists
    }
  }

  createRun(keyword: string, location: string, maxResults: number, userEmail = ''): ScrapeRunRecord {
    const now = nowIso()
    const run: ScrapeRunRecord = {
      id: createId(),
      userEmail,
      keyword,
      location,
      status: 'running',
      totalResults: 0,
      maxResults,
      createdAt: now,
      updatedAt: now
    }

    this.db
      .prepare(
        `
          INSERT INTO runs (id, user_email, keyword, location, status, total_results, max_results, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        run.id,
        run.userEmail ?? '',
        run.keyword,
        run.location,
        run.status,
        run.totalResults,
        run.maxResults,
        run.createdAt,
        run.updatedAt
      )

    return run
  }

  updateRunStatus(runId: string, status: RunStatus, totalResults?: number): ScrapeRunRecord {
    const current = this.getRun(runId)
    if (!current) {
      throw new Error(`Run ${runId} not found`)
    }

    const updatedAt = nowIso()
    const nextTotal = totalResults ?? current.totalResults
    this.db
      .prepare(
        `
          UPDATE runs
          SET status = ?, total_results = ?, updated_at = ?
          WHERE id = ?
        `
      )
      .run(status, nextTotal, updatedAt, runId)

    return {
      ...current,
      status,
      totalResults: nextTotal,
      updatedAt
    }
  }

  getRun(runId: string): ScrapeRunRecord | null {
    const row = this.db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId) as RunRow | undefined
    return row ? mapRun(row) : null
  }

  getRunForUser(runId: string, userEmail?: string): ScrapeRunRecord | null {
    const run = this.getRun(runId)
    if (!run) {
      return null
    }

    if (userEmail && run.userEmail !== userEmail) {
      return null
    }

    return run
  }

  listRuns(userEmail?: string): ScrapeRunRecord[] {
    let rows: RunRow[]
    if (userEmail) {
      rows = this.db
        .prepare(`SELECT * FROM runs WHERE user_email = ? ORDER BY created_at DESC`)
        .all(userEmail) as RunRow[]
    } else {
      rows = this.db.prepare(`SELECT * FROM runs ORDER BY created_at DESC`).all() as RunRow[]
    }
    return rows.map(mapRun)
  }

  insertBusinesses(records: Omit<BusinessRecord, 'id' | 'scrapedAt'>[]): BusinessRecord[] {
    const inserted: BusinessRecord[] = []
    const stmt = this.db.prepare(
      `
        INSERT OR IGNORE INTO businesses
          (id, run_id, name, category, address, phone, website, rating, review_count, maps_url, latitude, longitude, scraped_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )

    for (const record of records) {
      const next: BusinessRecord = {
        ...record,
        id: createId(),
        scrapedAt: nowIso()
      }
      const result = stmt.run(
        next.id,
        next.runId,
        next.name,
        next.category,
        next.address,
        next.phone,
        next.website,
        next.rating,
        next.reviewCount,
        next.mapsUrl,
        next.latitude,
        next.longitude,
        next.scrapedAt
      )
      if (result.changes > 0) {
        inserted.push(next)
      }
    }

    if (inserted.length > 0) {
      const runId = inserted[0].runId
      const count = this.countBusinesses(runId)
      this.updateRunStatus(runId, this.getRun(runId)?.status ?? 'running', count)
    }

    return inserted
  }

  listBusinesses(query: ResultsQuery = {}): BusinessRecord[] {
    const conditions: string[] = []
    const values: string[] = []

    if (query.runId) {
      conditions.push('b.run_id = ?')
      values.push(query.runId)
    }

    if (query.userEmail) {
      conditions.push('r.user_email = ?')
      values.push(query.userEmail)
    }

    if (query.search) {
      conditions.push('(LOWER(b.name) LIKE ? OR LOWER(b.category) LIKE ? OR LOWER(b.address) LIKE ?)')
      const value = `%${query.search.toLowerCase()}%`
      values.push(value, value, value)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = this.db
      .prepare(
        `SELECT b.* FROM businesses b
         JOIN runs r ON b.run_id = r.id
         ${where}
         ORDER BY b.scraped_at DESC`
      )
      .all(...values) as BusinessRow[]
    return rows.map(mapBusiness)
  }

  deleteBusinesses(ids: string[], userEmail?: string): void {
    const affectedRunIds = new Set<string>()
    const selectStmt = userEmail
      ? this.db.prepare(
          `SELECT b.run_id FROM businesses b
           JOIN runs r ON b.run_id = r.id
           WHERE b.id = ? AND r.user_email = ?`
        )
      : this.db.prepare(`SELECT run_id FROM businesses WHERE id = ?`)
    const stmt = this.db.prepare(`DELETE FROM businesses WHERE id = ?`)
    for (const id of ids) {
      const row = (userEmail
        ? selectStmt.get(id, userEmail)
        : selectStmt.get(id)) as { run_id: string } | undefined
      if (row?.run_id) {
        affectedRunIds.add(row.run_id)
        stmt.run(id)
      }
    }

    for (const runId of affectedRunIds) {
      const run = this.getRun(runId)
      if (run) {
        this.updateRunStatus(runId, run.status, this.countBusinesses(runId))
      }
    }
  }

  restoreBusinesses(records: BusinessRecord[], userEmail?: string): void {
    const affectedRunIds = new Set<string>()
    const stmt = this.db.prepare(
      `
        INSERT OR REPLACE INTO businesses
          (id, run_id, name, category, address, phone, website, rating, review_count, maps_url, latitude, longitude, scraped_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )

    for (const record of records) {
      const run = this.getRunForUser(record.runId, userEmail)
      if (!run) {
        continue
      }
      affectedRunIds.add(record.runId)
      stmt.run(
        record.id,
        record.runId,
        record.name,
        record.category,
        record.address,
        record.phone,
        record.website,
        record.rating,
        record.reviewCount,
        record.mapsUrl,
        record.latitude,
        record.longitude,
        record.scrapedAt
      )
    }

    for (const runId of affectedRunIds) {
      const run = this.getRun(runId)
      if (run) {
        this.updateRunStatus(runId, run.status, this.countBusinesses(runId))
      }
    }
  }

  deleteRun(runId: string, userEmail?: string): void {
    if (!this.getRunForUser(runId, userEmail)) {
      return
    }
    this.db.prepare(`DELETE FROM businesses WHERE run_id = ?`).run(runId)
    this.db.prepare(`DELETE FROM runs WHERE id = ?`).run(runId)
  }

  restoreRun(run: ScrapeRunRecord, userEmail?: string): void {
    if (userEmail && run.userEmail !== userEmail) {
      return
    }
    this.db
      .prepare(
        `
          INSERT OR REPLACE INTO runs
            (id, user_email, keyword, location, status, total_results, max_results, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        run.id,
        run.userEmail ?? '',
        run.keyword,
        run.location,
        run.status,
        run.totalResults,
        run.maxResults,
        run.createdAt,
        run.updatedAt
      )
  }

  deduplicateRun(runId: string, userEmail?: string): number {
    if (!this.getRunForUser(runId, userEmail)) {
      return 0
    }

    const duplicates = this.db
      .prepare(
        `
          SELECT id
          FROM businesses
          WHERE run_id = ?
          AND id NOT IN (
            SELECT MIN(id)
            FROM businesses
            WHERE run_id = ?
            GROUP BY maps_url
          )
        `
      )
      .all(runId, runId) as Array<{ id: string }>

    this.deleteBusinesses(duplicates.map((item) => item.id))
    const count = this.countBusinesses(runId)
    this.updateRunStatus(runId, this.getRun(runId)?.status ?? 'completed', count)
    return duplicates.length
  }

  countBusinesses(runId: string): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM businesses WHERE run_id = ?`)
      .get(runId) as { count: number }
    return row.count
  }

  clearHistory(userEmail?: string): void {
    if (userEmail) {
      const runs = this.listRuns(userEmail)
      for (const run of runs) {
        this.deleteRun(run.id)
      }
    } else {
      this.db.exec(`DELETE FROM businesses; DELETE FROM runs; VACUUM;`)
    }
  }

  deleteDatabaseFile(): void {
    this.db.close()
    rmSync(this.dbPath, { force: true })
  }
}
