import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  BusinessRecord,
  DashboardSnapshot,
  RunStatus,
  ScrapeRunRecord,
  SettingsData
} from '../../shared/types'

type ViewKey = 'dashboard' | 'scrape' | 'results' | 'history' | 'settings'
type SortKey = 'name' | 'category' | 'rating' | 'reviewCount'

const defaultSettings: SettingsData = {
  headless: true,
  delayMs: 1200,
  timeoutMs: 30000,
  autoDeduplicate: true,
  autoSave: true,
  exportDirectory: ''
}

const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'scrape', label: 'New Scrape' },
  { key: 'results', label: 'Results' },
  { key: 'history', label: 'History' },
  { key: 'settings', label: 'Settings' }
]

function App(): React.JSX.Element {
  const [view, setView] = useState<ViewKey>('dashboard')
  const [runs, setRuns] = useState<ScrapeRunRecord[]>([])
  const [results, setResults] = useState<BusinessRecord[]>([])
  const [activeRun, setActiveRun] = useState<ScrapeRunRecord | null>(null)
  const [selectedRunId, setSelectedRunId] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [settings, setSettings] = useState<SettingsData>(defaultSettings)
  const [form, setForm] = useState({ keyword: 'Coffee Shop', location: 'Surabaya', maxResults: 50 })
  const [detail, setDetail] = useState<BusinessRecord | null>(null)
  const [progress, setProgress] = useState<DashboardSnapshot['progress']>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState('Ready')

  const applySnapshot = useCallback((snapshot: DashboardSnapshot): void => {
    setRuns(snapshot.runs)
    setSettings(snapshot.settings)
    setActiveRun(snapshot.activeRun)
    setProgress(snapshot.progress)
    setResults(snapshot.results)
    setSelectedRunId((current) => current || snapshot.activeRun?.id || snapshot.runs[0]?.id || '')
    setMessage(snapshot.progress?.message ?? 'Ready')
  }, [])

  useEffect(() => {
    let cancelled = false

    void window.api.getSnapshot().then((snapshot) => {
      if (cancelled) {
        return
      }
      applySnapshot(snapshot)
      setIsLoading(false)
    })

    const offProgress = window.api.onProgress((payload) => {
      setProgress(payload)
      setMessage(payload.message)
      setRuns((current) =>
        current.map((run) =>
          run.id === payload.runId
            ? {
                ...run,
                status: payload.status,
                totalResults: payload.current,
                updatedAt: new Date().toISOString()
              }
            : run
        )
      )
      setActiveRun((current) =>
        current && current.id === payload.runId
          ? {
              ...current,
              status: payload.status,
              totalResults: payload.current,
              updatedAt: new Date().toISOString()
            }
          : current
      )
    })

    const offResult = window.api.onResult((record) => {
      setSelectedRunId(record.runId)
      setResults((current) => [record, ...current])
      setRuns((current) =>
        current.map((run) =>
          run.id === record.runId
            ? { ...run, totalResults: run.totalResults + 1, updatedAt: new Date().toISOString() }
            : run
        )
      )
    })

    return () => {
      cancelled = true
      offProgress()
      offResult()
    }
  }, [applySnapshot])

  useEffect(() => {
    if (!selectedRunId) {
      return
    }

    let cancelled = false
    void window.api.listResults({ runId: selectedRunId }).then((items) => {
      if (!cancelled) {
        setResults(items)
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedRunId])

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? activeRun ?? null,
    [activeRun, runs, selectedRunId]
  )

  const filteredResults = useMemo(() => {
    const text = search.trim().toLowerCase()
    const next = results.filter((item) => {
      if (!text) {
        return true
      }

      return [item.name, item.category, item.address, item.phone, item.website].some((value) =>
        value.toLowerCase().includes(text)
      )
    })

    next.sort((left, right) => {
      const leftValue = left[sortKey] ?? ''
      const rightValue = right[sortKey] ?? ''
      const comparison =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue))

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return next
  }, [results, search, sortDirection, sortKey])

  const stats = useMemo(() => {
    const rated = results.filter((item) => item.rating !== null)
    const averageRating =
      rated.reduce((sum, item) => sum + Number(item.rating), 0) / Math.max(1, rated.length)

    return {
      completed: runs.filter((item) => item.status === 'completed').length,
      totalBusinesses: runs.reduce((sum, item) => sum + item.totalResults, 0),
      averageRating
    }
  }, [results, runs])

  const runAction = async (task: () => Promise<unknown>, successMessage: string): Promise<void> => {
    setIsBusy(true)
    try {
      await task()
      const snapshot = await window.api.getSnapshot()
      applySnapshot(snapshot)
      const nextRunId = selectedRunId || snapshot.activeRun?.id || snapshot.runs[0]?.id
      if (nextRunId) {
        const items = await window.api.listResults({ runId: nextRunId })
        setResults(items)
      }
      setMessage(successMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Operation failed')
    } finally {
      setIsBusy(false)
    }
  }

  const startScrape = async (): Promise<void> => {
    await runAction(async () => {
      const run = await window.api.startScrape(form)
      setSelectedRunId(run.id)
      setSelectedIds([])
      setView('results')
    }, 'Scrape started')
  }

  const handleExport = async (format: 'csv' | 'xlsx'): Promise<void> => {
    if (!selectedRunId) {
      return
    }

    await runAction(async () => {
      await window.api.exportResults({
        runId: selectedRunId,
        ids: selectedIds.length > 0 ? selectedIds : undefined,
        format
      })
    }, `Export ${format.toUpperCase()} completed`)
  }

  const toggleSelection = (id: string): void => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  const activeStatus: RunStatus = activeRun?.status ?? progress?.status ?? 'idle'
  const progressPercent = progress
    ? Math.min(100, Math.round((progress.current / Math.max(1, progress.total)) * 100))
    : 0

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">MS</span>
          <div>
            <h1>MapScraper</h1>
            <p>Google Maps lead extractor</p>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={view === item.key ? 'nav-item active' : 'nav-item'}
              onClick={() => setView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="status-card">
          <div className={`status-dot ${activeStatus}`}></div>
          <div>
            <strong>{activeStatus.toUpperCase()}</strong>
            <p>{message}</p>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="hero">
          <div>
            <span className="eyebrow">MVP v1</span>
            <h2>Google Maps Business Scraper</h2>
            <p>
              Scrape single keyword by location, store history in SQLite, and export clean business
              data.
            </p>
          </div>
          <div className="hero-actions">
            <button className="ghost-button" onClick={() => void window.api.openExportDirectory()}>
              Open Export Folder
            </button>
            <button className="primary-button" onClick={() => setView('scrape')}>
              New Scrape
            </button>
          </div>
        </header>

        {isLoading ? (
          <section className="panel">
            <p>Loading application state...</p>
          </section>
        ) : (
          <>
            {view === 'dashboard' && (
              <section className="panel-grid">
                <article className="metric-card">
                  <span>Total Runs</span>
                  <strong>{runs.length}</strong>
                </article>
                <article className="metric-card">
                  <span>Completed Runs</span>
                  <strong>{stats.completed}</strong>
                </article>
                <article className="metric-card">
                  <span>Total Businesses</span>
                  <strong>{stats.totalBusinesses}</strong>
                </article>
                <article className="metric-card">
                  <span>Avg Rating</span>
                  <strong>
                    {Number.isFinite(stats.averageRating) ? stats.averageRating.toFixed(1) : '0.0'}
                  </strong>
                </article>

                <article className="panel wide">
                  <div className="panel-head">
                    <h3>Active Progress</h3>
                    <span>
                      {progress ? `${progress.current}/${progress.total}` : 'No active scrape'}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-bar" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                  <p className="muted">
                    {progress?.message ?? 'Start a new scrape to begin collecting data.'}
                  </p>
                </article>

                <article className="panel wide">
                  <div className="panel-head">
                    <h3>Recent History</h3>
                    <button className="text-button" onClick={() => setView('history')}>
                      View all
                    </button>
                  </div>
                  <div className="history-stack">
                    {runs.slice(0, 5).map((run) => (
                      <button
                        key={run.id}
                        className="history-item"
                        onClick={() => {
                          setSelectedRunId(run.id)
                          setView('results')
                        }}
                      >
                        <div>
                          <strong>{run.keyword}</strong>
                          <p>
                            {run.location} | {run.totalResults} results
                          </p>
                        </div>
                        <span className={`badge ${run.status}`}>{run.status}</span>
                      </button>
                    ))}
                  </div>
                </article>
              </section>
            )}

            {view === 'scrape' && (
              <section className="panel split">
                <div>
                  <div className="panel-head">
                    <h3>New Scrape</h3>
                    <span>Single keyword, single location</span>
                  </div>
                  <label className="field">
                    <span>Keyword</span>
                    <input
                      value={form.keyword}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, keyword: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Location</span>
                    <input
                      value={form.location}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, location: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Max Results</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={form.maxResults}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maxResults: Number(event.target.value) || 1
                        }))
                      }
                    />
                  </label>
                  <div className="button-row">
                    <button
                      className="primary-button"
                      disabled={isBusy}
                      onClick={() => void startScrape()}
                    >
                      Start Scraping
                    </button>
                    <button
                      className="ghost-button"
                      disabled={activeStatus !== 'running'}
                      onClick={() =>
                        void runAction(() => window.api.pauseScrape(), 'Scrape paused')
                      }
                    >
                      Pause
                    </button>
                    <button
                      className="ghost-button"
                      disabled={activeStatus !== 'paused'}
                      onClick={() =>
                        void runAction(() => window.api.resumeScrape(), 'Scrape resumed')
                      }
                    >
                      Resume
                    </button>
                    <button
                      className="danger-button"
                      disabled={!['running', 'paused'].includes(activeStatus)}
                      onClick={() =>
                        void runAction(() => window.api.stopScrape(), 'Scrape stopped')
                      }
                    >
                      Stop
                    </button>
                  </div>
                </div>

                <div className="panel accent-panel">
                  <div className="panel-head">
                    <h3>Progress</h3>
                    <span>{progress ? `${progress.current}/${progress.total}` : '0/0'}</span>
                  </div>
                  <div className="progress-track large">
                    <div className="progress-bar" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                  <strong className="progress-value">{progressPercent}%</strong>
                  <p className="muted">
                    {progress?.message ?? 'Chromium will open when scraping starts.'}
                  </p>
                </div>
              </section>
            )}

            {view === 'results' && (
              <section className="panel">
                <div className="panel-head wrap">
                  <div>
                    <h3>Results</h3>
                    <span>
                      {selectedRun
                        ? `${selectedRun.keyword} | ${selectedRun.location}`
                        : 'Choose a run'}
                    </span>
                  </div>
                  <div className="toolbar">
                    <select
                      value={selectedRunId}
                      onChange={(event) => setSelectedRunId(event.target.value)}
                    >
                      {runs.map((run) => (
                        <option key={run.id} value={run.id}>
                          {run.keyword} - {run.location}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Search results"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <select
                      value={sortKey}
                      onChange={(event) => setSortKey(event.target.value as SortKey)}
                    >
                      <option value="name">Sort: Name</option>
                      <option value="category">Sort: Category</option>
                      <option value="rating">Sort: Rating</option>
                      <option value="reviewCount">Sort: Reviews</option>
                    </select>
                    <button
                      className="ghost-button"
                      onClick={() =>
                        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
                      }
                    >
                      {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                    </button>
                  </div>
                </div>

                <div className="button-row compact">
                  <button className="ghost-button" onClick={() => void handleExport('csv')}>
                    Export CSV
                  </button>
                  <button className="ghost-button" onClick={() => void handleExport('xlsx')}>
                    Export XLSX
                  </button>
                  <button
                    className="ghost-button"
                    disabled={!selectedRunId}
                    onClick={() =>
                      void runAction(
                        () => window.api.deduplicateRun(selectedRunId),
                        'Deduplication completed'
                      )
                    }
                  >
                    Deduplicate
                  </button>
                  <button
                    className="danger-button"
                    disabled={selectedIds.length === 0}
                    onClick={() =>
                      void runAction(
                        () => window.api.deleteResults(selectedIds),
                        'Selected rows deleted'
                      )
                    }
                  >
                    Delete Selected
                  </button>
                </div>

                <div className="results-layout">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th></th>
                          <th>Business</th>
                          <th>Category</th>
                          <th>Rating</th>
                          <th>Phone</th>
                          <th>Website</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((item) => (
                          <tr key={item.id} className={detail?.id === item.id ? 'active-row' : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(item.id)}
                                onChange={() => toggleSelection(item.id)}
                              />
                            </td>
                            <td>
                              <button className="table-link" onClick={() => setDetail(item)}>
                                {item.name}
                              </button>
                            </td>
                            <td>{item.category || '-'}</td>
                            <td>{item.rating ?? '-'}</td>
                            <td>{item.phone || '-'}</td>
                            <td>{item.website ? 'Available' : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <aside className="detail-card">
                    <div className="panel-head">
                      <h3>Business Detail</h3>
                    </div>
                    {detail ? (
                      <div className="detail-stack">
                        <strong>{detail.name}</strong>
                        <p>{detail.category || 'No category'}</p>
                        <p>{detail.address || 'No address'}</p>
                        <p>{detail.phone || 'No phone'}</p>
                        <p>{detail.website || 'No website'}</p>
                        <p>
                          Rating: {detail.rating ?? '-'} | Reviews: {detail.reviewCount ?? '-'}
                        </p>
                        <p>
                          Lat/Lng: {detail.latitude ?? '-'}, {detail.longitude ?? '-'}
                        </p>
                        <a href={detail.mapsUrl} target="_blank" rel="noreferrer">
                          Open Google Maps
                        </a>
                      </div>
                    ) : (
                      <p className="muted">Choose one row to inspect the business details.</p>
                    )}
                  </aside>
                </div>
              </section>
            )}

            {view === 'history' && (
              <section className="panel">
                <div className="panel-head">
                  <h3>History</h3>
                  <div className="button-row compact">
                    <button
                      className="danger-button"
                      onClick={() =>
                        void runAction(() => window.api.clearHistory(), 'History cleared')
                      }
                    >
                      Clear History
                    </button>
                  </div>
                </div>
                <div className="history-stack">
                  {runs.map((run) => (
                    <div key={run.id} className="history-item static">
                      <div>
                        <strong>{run.keyword}</strong>
                        <p>
                          {run.location} | {new Date(run.createdAt).toLocaleString()} |{' '}
                          {run.totalResults} results
                        </p>
                      </div>
                      <div className="button-row compact">
                        <span className={`badge ${run.status}`}>{run.status}</span>
                        <button
                          className="ghost-button"
                          onClick={() => {
                            setSelectedRunId(run.id)
                            setView('results')
                          }}
                        >
                          Open
                        </button>
                        <button
                          className="danger-button"
                          onClick={() =>
                            void runAction(() => window.api.deleteRun(run.id), 'Run deleted')
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {view === 'settings' && (
              <section className="panel split">
                <div>
                  <div className="panel-head">
                    <h3>Settings</h3>
                    <span>Browser, data, and application behavior</span>
                  </div>
                  <label className="toggle-field">
                    <input
                      type="checkbox"
                      checked={settings.headless}
                      onChange={(event) =>
                        setSettings((current) => ({ ...current, headless: event.target.checked }))
                      }
                    />
                    <span>Headless browser</span>
                  </label>
                  <label className="field">
                    <span>Scraping delay (ms)</span>
                    <input
                      type="number"
                      value={settings.delayMs}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          delayMs: Number(event.target.value) || 0
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Timeout (ms)</span>
                    <input
                      type="number"
                      value={settings.timeoutMs}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          timeoutMs: Number(event.target.value) || 0
                        }))
                      }
                    />
                  </label>
                  <label className="toggle-field">
                    <input
                      type="checkbox"
                      checked={settings.autoDeduplicate}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          autoDeduplicate: event.target.checked
                        }))
                      }
                    />
                    <span>Auto deduplicate</span>
                  </label>
                  <label className="toggle-field">
                    <input
                      type="checkbox"
                      checked={settings.autoSave}
                      onChange={(event) =>
                        setSettings((current) => ({ ...current, autoSave: event.target.checked }))
                      }
                    />
                    <span>Auto save</span>
                  </label>
                  <label className="field">
                    <span>Export directory</span>
                    <input
                      value={settings.exportDirectory}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          exportDirectory: event.target.value
                        }))
                      }
                    />
                  </label>
                  <div className="button-row">
                    <button
                      className="primary-button"
                      onClick={() =>
                        void runAction(() => window.api.saveSettings(settings), 'Settings saved')
                      }
                    >
                      Save Settings
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() =>
                        void runAction(async () => {
                          const next = await window.api.resetSettings()
                          setSettings(next)
                        }, 'Settings reset')
                      }
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="panel accent-panel">
                  <h3>Storage Notes</h3>
                  <p className="muted">
                    History and results are stored locally in SQLite under the Electron user data
                    directory.
                  </p>
                  <p className="muted">
                    Exports are generated as CSV or XLSX into the configured export folder.
                  </p>
                  <p className="muted">
                    Google Maps selectors may change over time, so the scraper logic may need
                    refresh if Google updates the UI.
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
