import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  Play,
  Pause,
  Square,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Search,
  Download,
  Trash2,
  Sparkles,
  MapPin,
  ExternalLink,
  FolderOpen,
  ArrowUpDown,
  Building2,
  Star,
  Phone,
  Globe,
  Database,
  CheckCircle2,
  RefreshCw,
  Table as TableIcon
} from 'lucide-react'

import type {
  BusinessRecord,
  DashboardSnapshot,
  RunStatus,
  ScrapeRunRecord,
  SettingsData
} from '../../shared/types'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Progress,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ToastContainer,
  type ToastState
} from './components/ui'

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

const navItems: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="icon-md" /> },
  { key: 'scrape', label: 'Scrape Baru', icon: <Play className="icon-md" /> },
  { key: 'results', label: 'Hasil Data', icon: <TableIcon className="icon-md" /> },
  { key: 'history', label: 'Riwayat', icon: <HistoryIcon className="icon-md" /> },
  { key: 'settings', label: 'Pengaturan', icon: <SettingsIcon className="icon-md" /> }
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
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false)
  const [settings, setSettings] = useState<SettingsData>(defaultSettings)
  const [form, setForm] = useState({ keyword: 'Cafe', location: 'Surabaya', maxResults: 20 })
  const [detail, setDetail] = useState<BusinessRecord | null>(null)
  const [progress, setProgress] = useState<DashboardSnapshot['progress']>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Siap')
  const [toasts, setToasts] = useState<ToastState[]>([])

  const addToast = useCallback(
    (title: string, description?: string, type: ToastState['type'] = 'info') => {
      const id = String(Date.now() + Math.random())
      setToasts((current) => [...current, { id, title, description, type }])
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id))
      }, 4500)
    },
    []
  )

  const applySnapshot = useCallback((snapshot: DashboardSnapshot): void => {
    setRuns(snapshot.runs)
    setSettings(snapshot.settings)
    setActiveRun(snapshot.activeRun)
    setProgress(snapshot.progress)
    setResults(snapshot.results)
    setSelectedRunId((current) => current || snapshot.activeRun?.id || snapshot.runs[0]?.id || '')
    setStatusMessage(snapshot.progress?.message ?? 'Siap')
  }, [])

  useEffect(() => {
    let cancelled = false

    void window.api.getSnapshot().then((snapshot) => {
      if (cancelled) return
      applySnapshot(snapshot)
      setIsLoading(false)
    })

    const offProgress = window.api.onProgress((payload) => {
      setProgress(payload)
      setStatusMessage(payload.message)
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
    if (!selectedRunId) return

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
    const list = results.filter((item) => {
      if (hasPhoneOnly && !item.phone) return false
      if (!text) return true

      return [item.name, item.category, item.address, item.phone, item.website].some((val) =>
        val.toLowerCase().includes(text)
      )
    })

    list.sort((a, b) => {
      let left = a[sortKey]
      let right = b[sortKey]

      if (sortKey === 'rating' || sortKey === 'reviewCount') {
        const numA = left !== null && left !== undefined ? Number(left) : -1
        const numB = right !== null && right !== undefined ? Number(right) : -1
        return sortDirection === 'asc' ? numA - numB : numB - numA
      }

      const strA = String(left ?? '').toLowerCase()
      const strB = String(right ?? '').toLowerCase()
      const comp = strA.localeCompare(strB)
      return sortDirection === 'asc' ? comp : -comp
    })

    return list
  }, [results, search, hasPhoneOnly, sortKey, sortDirection])

  const stats = useMemo(() => {
    const rated = results.filter((r) => r.rating !== null)
    const avgRating =
      rated.reduce((acc, curr) => acc + Number(curr.rating), 0) / Math.max(1, rated.length)

    return {
      totalRuns: runs.length,
      completed: runs.filter((r) => r.status === 'completed').length,
      totalBusinesses: runs.reduce((acc, r) => acc + r.totalResults, 0),
      avgRating
    }
  }, [results, runs])

  const runAction = async (
    task: () => Promise<unknown>,
    successTitle: string,
    successDesc?: string
  ): Promise<void> => {
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
      addToast(successTitle, successDesc, 'success')
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Operasi gagal'
      setStatusMessage(errText)
      addToast('Gagal', errText, 'error')
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
    }, 'Scrape Dimulai', `Mencari '${form.keyword}' di ${form.location}`)
  }

  const handleExport = async (format: 'csv' | 'xlsx'): Promise<void> => {
    if (!selectedRunId) return

    await runAction(async () => {
      const exportedPath = await window.api.exportResults({
        runId: selectedRunId,
        ids: selectedIds.length > 0 ? selectedIds : undefined,
        format
      })
      addToast(
        `Ekspor ${format.toUpperCase()} Berhasil`,
        `File tersimpan di: ${exportedPath}`,
        'success'
      )
    }, `Ekspor ${format.toUpperCase()} Selesai`)
  }

  const toggleSelection = (id: string): void => {
    setSelectedIds((curr) => (curr.includes(id) ? curr.filter((i) => i !== id) : [...curr, id]))
  }

  const toggleSelectAll = (): void => {
    if (selectedIds.length === filteredResults.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredResults.map((r) => r.id))
    }
  }

  const activeStatus: RunStatus = activeRun?.status ?? progress?.status ?? 'idle'
  const progressPercent = progress
    ? Math.min(100, Math.round((progress.current / Math.max(1, progress.total)) * 100))
    : 0

  const getBadgeVariant = (status: RunStatus) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'running':
        return 'info'
      case 'paused':
        return 'warning'
      case 'failed':
      case 'stopped':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Building2 className="icon-lg" />
          </div>
          <div className="brand-info">
            <h1>MapScraper</h1>
            <p>Google Maps Lead Scraper</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-link ${view === item.key ? 'active' : ''}`}
              onClick={() => setView(item.key)}
            >
              <div className="sidebar-link-inner">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.key === 'results' && results.length > 0 && (
                <Badge variant="secondary">{results.length}</Badge>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-status-card">
          <div className={`status-dot-indicator ${activeStatus}`} />
          <div className="status-info">
            <span className="status-label">{activeStatus}</span>
            <p className="status-text">{statusMessage}</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-area">
        {/* HEADER NAVBAR */}
        <header className="top-header">
          <div className="header-title-group">
            <h2 className="header-page-title">
              {navItems.find((i) => i.key === view)?.label}
            </h2>
            {selectedRun && (
              <Badge variant="outline">
                {selectedRun.keyword} • {selectedRun.location}
              </Badge>
            )}
          </div>

          <div className="header-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void window.api.openExportDirectory().then(() => {
                  addToast('Membuka Folder', 'Folder ekspor telah dibuka', 'info')
                })
              }
            >
              <FolderOpen className="icon-sm" />
              Folder Ekspor
            </Button>

            <Button variant="default" size="sm" onClick={() => setView('scrape')}>
              <Play className="icon-sm" />
              Scrape Baru
            </Button>
          </div>
        </header>

        {/* CONTENT BODY */}
        <div className="content-body">
          {isLoading ? (
            <Card>
              <CardContent style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw className="icon-lg ui-spinner" style={{ margin: '0 auto 8px auto' }} />
                <p>Memuat status aplikasi...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* DASHBOARD VIEW */}
              {view === 'dashboard' && (
                <>
                  <div className="metrics-grid">
                    <Card>
                      <CardContent className="metric-card-box">
                        <div className="metric-card-top">
                          <span className="metric-card-title">Total Run</span>
                          <Database className="icon-md" style={{ color: '#60a5fa' }} />
                        </div>
                        <div className="metric-card-value">{stats.totalRuns}</div>
                        <span className="metric-card-sub">Total sesi scraping yang dibuat</span>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="metric-card-box">
                        <div className="metric-card-top">
                          <span className="metric-card-title">Selesai</span>
                          <CheckCircle2 className="icon-md" style={{ color: '#34d399' }} />
                        </div>
                        <div className="metric-card-value">{stats.completed}</div>
                        <span className="metric-card-sub">Sesi scraping sukses</span>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="metric-card-box">
                        <div className="metric-card-top">
                          <span className="metric-card-title">Total Bisnis</span>
                          <Building2 className="icon-md" style={{ color: '#818cf8' }} />
                        </div>
                        <div className="metric-card-value">{stats.totalBusinesses}</div>
                        <span className="metric-card-sub">Data kontak usaha terkumpul</span>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="metric-card-box">
                        <div className="metric-card-top">
                          <span className="metric-card-title">Rata-rata Rating</span>
                          <Star className="icon-md" style={{ color: '#fbbf24' }} />
                        </div>
                        <div className="metric-card-value">
                          {Number.isFinite(stats.avgRating) ? stats.avgRating.toFixed(1) : '0.0'}
                        </div>
                        <span className="metric-card-sub">Bintang ulasan tempat</span>
                      </CardContent>
                    </Card>
                  </div>

                  {/* ACTIVE PROGRESS CARD */}
                  <Card>
                    <CardHeader>
                      <div className="flex-between">
                        <div>
                          <CardTitle>Status Scraping Aktif</CardTitle>
                          <CardDescription>
                            {progress
                              ? `${progress.current} dari ${progress.total} tempat dikumpulkan`
                              : 'Tidak ada proses scraping aktif saat ini'}
                          </CardDescription>
                        </div>
                        <Badge variant={getBadgeVariant(activeStatus)}>{activeStatus.toUpperCase()}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <Progress value={progressPercent} />
                      <div className="flex-between" style={{ fontSize: '12px', color: '#94a3b8' }}>
                        <span>{progress?.message ?? 'Tekan "Scrape Baru" untuk memulai.'}</span>
                        <span style={{ fontWeight: 600, color: '#f8fafc' }}>{progressPercent}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* RECENT HISTORY CARD */}
                  <Card>
                    <CardHeader>
                      <div className="flex-between">
                        <div>
                          <CardTitle>Riwayat Terbaru</CardTitle>
                          <CardDescription>Sesi pencarian yang telah dijalankan sebelumnya</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setView('history')}>
                          Lihat Semua
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {runs.length === 0 ? (
                        <p style={{ fontSize: '13px', color: '#94a3b8' }}>Belum ada riwayat pencarian.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {runs.slice(0, 5).map((run) => (
                            <div
                              key={run.id}
                              className="history-card-item"
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setSelectedRunId(run.id)
                                setView('results')
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div className="flex-gap-2">
                                  <span style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>
                                    {run.keyword}
                                  </span>
                                  <Badge variant="outline">{run.location}</Badge>
                                </div>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  {new Date(run.createdAt).toLocaleString('id-ID')} • {run.totalResults} hasil
                                </span>
                              </div>
                              <Badge variant={getBadgeVariant(run.status)}>{run.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* SCRAPE FORM VIEW */}
              {view === 'scrape' && (
                <div className="grid-2col">
                  <Card>
                    <CardHeader>
                      <CardTitle>Form Scraping Baru</CardTitle>
                      <CardDescription>
                        Masukkan kata kunci dan lokasi target untuk mengambil data tempat dari Google Maps.
                      </CardDescription>
                    </CardHeader>
                    <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-field">
                        <label className="form-label">Kata Kunci / Keyword</label>
                        <Input
                          icon={<Search className="icon-sm" />}
                          placeholder="Contoh: Coffee Shop, Restoran, Bengkel"
                          value={form.keyword}
                          onChange={(e) => setForm((c) => ({ ...c, keyword: e.target.value }))}
                        />
                      </div>

                      <div className="form-field">
                        <label className="form-label">Lokasi / Kota Target</label>
                        <Input
                          icon={<MapPin className="icon-sm" />}
                          placeholder="Contoh: Surabaya, Jakarta Selatan, Bandung"
                          value={form.location}
                          onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
                        />
                      </div>

                      <div className="form-field">
                        <label className="form-label">Maksimal Hasil Data</label>
                        <Input
                          type="number"
                          min={1}
                          max={500}
                          value={form.maxResults}
                          onChange={(e) =>
                            setForm((c) => ({
                              ...c,
                              maxResults: Math.max(1, Math.min(500, Number(e.target.value) || 1))
                            }))
                          }
                        />
                      </div>
                    </CardContent>
                    <CardFooter style={{ justifyContent: 'flex-start' }}>
                      <Button
                        variant="default"
                        disabled={isBusy || activeStatus === 'running'}
                        onClick={() => void startScrape()}
                      >
                        <Play className="icon-sm" />
                        Mulai Scrape
                      </Button>

                      <Button
                        variant="outline"
                        disabled={activeStatus !== 'running'}
                        onClick={() =>
                          void runAction(() => window.api.pauseScrape(), 'Scrape Didepause')
                        }
                      >
                        <Pause className="icon-sm" />
                        Pause
                      </Button>

                      <Button
                        variant="outline"
                        disabled={activeStatus !== 'paused'}
                        onClick={() =>
                          void runAction(() => window.api.resumeScrape(), 'Scrape Dilanjutkan')
                        }
                      >
                        <Play className="icon-sm" />
                        Lanjutkan
                      </Button>

                      <Button
                        variant="destructive"
                        disabled={!['running', 'paused'].includes(activeStatus)}
                        onClick={() =>
                          void runAction(() => window.api.stopScrape(), 'Scrape Dihentikan')
                        }
                      >
                        <Square className="icon-sm" />
                        Stop
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* LIVE SCRAPE PROGRESS SIDEBAR */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Live Monitoring</CardTitle>
                      <CardDescription>Progres saat ini</CardDescription>
                    </CardHeader>
                    <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="flex-between" style={{ fontSize: '13px' }}>
                        <span style={{ color: '#94a3b8' }}>Status</span>
                        <Badge variant={getBadgeVariant(activeStatus)}>{activeStatus.toUpperCase()}</Badge>
                      </div>

                      <div className="flex-between" style={{ fontSize: '13px' }}>
                        <span style={{ color: '#94a3b8' }}>Terkumpul</span>
                        <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                          {progress ? `${progress.current} / ${progress.total}` : '0 / 0'}
                        </span>
                      </div>

                      <Progress value={progressPercent} />

                      <div style={{ textAlign: 'center', paddingTop: '8px' }}>
                        <span style={{ fontSize: '28px', fontWeight: 800, color: '#60a5fa' }}>{progressPercent}%</span>
                      </div>

                      <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', margin: 0 }}>
                        {progress?.message ?? 'Jendela browser Playwright akan terbuka otomatis saat scrape berjalan.'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* RESULTS VIEW */}
              {view === 'results' && (
                <Card>
                  <CardHeader>
                    <div className="toolbar-container">
                      <div>
                        <CardTitle>Data Hasil Scraping</CardTitle>
                        <CardDescription>
                          {selectedRun
                            ? `${selectedRun.keyword} di ${selectedRun.location} (${filteredResults.length} data)`
                            : 'Pilih sesi pencarian'}
                        </CardDescription>
                      </div>

                      {/* TOOLBAR CONTROLS */}
                      <div className="toolbar-group">
                        <div style={{ width: '180px' }}>
                          <Select
                            value={selectedRunId}
                            onChange={(e) => setSelectedRunId(e.target.value)}
                          >
                            {runs.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.keyword} - {r.location}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div style={{ width: '160px' }}>
                          <Input
                            icon={<Search className="icon-sm" />}
                            placeholder="Cari..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>

                        <div style={{ width: '140px' }}>
                          <Select
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value as SortKey)}
                          >
                            <option value="name">Urut: Nama</option>
                            <option value="category">Urut: Kategori</option>
                            <option value="rating">Urut: Rating</option>
                            <option value="reviewCount">Urut: Ulasan</option>
                          </Select>
                        </div>

                        <Button
                          variant="outline"
                          size="icon"
                          title="Ubah Arah Urutan"
                          onClick={() => setSortDirection((c) => (c === 'asc' ? 'desc' : 'asc'))}
                        >
                          <ArrowUpDown className="icon-sm" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* BATCH ACTION TOOLBAR */}
                    <div className="flex-between">
                      <div className="flex-gap-2">
                        <Button variant="secondary" size="sm" onClick={() => void handleExport('csv')}>
                          <Download className="icon-sm" />
                          Export CSV
                        </Button>

                        <Button variant="secondary" size="sm" onClick={() => void handleExport('xlsx')}>
                          <Download className="icon-sm" />
                          Export XLSX
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!selectedRunId}
                          onClick={() =>
                            void runAction(
                              () => window.api.deduplicateRun(selectedRunId),
                              'Deduplikasi Selesai',
                              'Data duplikat telah dibersihkan'
                            )
                          }
                        >
                          <Sparkles className="icon-sm" style={{ color: '#fbbf24' }} />
                          Deduplikasi
                        </Button>

                        {selectedIds.length > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              void runAction(
                                () => window.api.deleteResults(selectedIds),
                                'Penghapusan Berhasil',
                                `${selectedIds.length} baris telah dihapus`
                              )
                            }
                          >
                            <Trash2 className="icon-sm" />
                            Hapus ({selectedIds.length})
                          </Button>
                        )}
                      </div>

                      <Switch
                        label="Hanya yang punya Telepon"
                        checked={hasPhoneOnly}
                        onChange={(e) => setHasPhoneOnly(e.target.checked)}
                      />
                    </div>

                    {/* RESULTS TABLE & DETAIL DRAWER GRID */}
                    <div className="grid-2col">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead style={{ width: '40px' }}>
                              <input
                                type="checkbox"
                                style={{ borderRadius: '4px', cursor: 'pointer' }}
                                checked={
                                  filteredResults.length > 0 &&
                                  selectedIds.length === filteredResults.length
                                }
                                onChange={toggleSelectAll}
                              />
                            </TableHead>
                            <TableHead>Nama Bisnis</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead>Telepon</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredResults.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                                Tidak ada data hasil scraping yang cocok.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredResults.map((item) => (
                              <TableRow
                                key={item.id}
                                className={detail?.id === item.id ? 'selected' : ''}
                              >
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(item.id)}
                                    onChange={() => toggleSelection(item.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <button
                                    className="table-btn-link"
                                    onClick={() => setDetail(item)}
                                    title={item.name}
                                  >
                                    {item.name}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  {item.category ? (
                                    <Badge variant="outline">{item.category}</Badge>
                                  ) : (
                                    '-'
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.rating ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#fbbf24', fontWeight: 600 }}>
                                      <Star className="icon-sm" style={{ fill: '#fbbf24' }} />
                                      {item.rating}
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </TableCell>
                                <TableCell>{item.phone || '-'}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>

                      {/* DETAIL CARD DRAWER */}
                      <Card className="sticky-inspect-card">
                        <CardHeader>
                          <CardTitle style={{ fontSize: '14px' }}>Detail Informasi</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {detail ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                              <div>
                                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                                  {detail.name}
                                </h4>
                                <p style={{ color: '#94a3b8', margin: '2px 0 0 0' }}>{detail.category || 'Tanpa Kategori'}</p>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#cbd5e1' }}>
                                  <MapPin className="icon-sm" style={{ color: '#94a3b8', marginTop: '2px' }} />
                                  <span>{detail.address || 'Alamat tidak tersedia'}</span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1' }}>
                                  <Phone className="icon-sm" style={{ color: '#94a3b8' }} />
                                  <span>{detail.phone || 'Nomor HP tidak ada'}</span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1' }}>
                                  <Globe className="icon-sm" style={{ color: '#94a3b8' }} />
                                  {detail.website ? (
                                    <a
                                      href={detail.website}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: '#60a5fa', wordBreak: 'break-all' }}
                                    >
                                      {detail.website}
                                    </a>
                                  ) : (
                                    <span>Website tidak ada</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex-between" style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <span style={{ color: '#94a3b8' }}>Rating & Ulasan</span>
                                <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                                  ★ {detail.rating ?? '-'} ({detail.reviewCount ?? 0} ulasan)
                                </span>
                              </div>

                              {detail.latitude && detail.longitude && (
                                <div style={{ color: '#94a3b8' }}>
                                  Koordinat: {detail.latitude}, {detail.longitude}
                                </div>
                              )}

                              <div style={{ paddingTop: '10px' }}>
                                <a
                                  href={detail.mapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    backgroundColor: '#2563eb',
                                    color: '#ffffff',
                                    fontWeight: 500,
                                    textDecoration: 'none',
                                    fontSize: '12px'
                                  }}
                                >
                                  <ExternalLink className="icon-sm" />
                                  Buka di Google Maps
                                </a>
                              </div>
                            </div>
                          ) : (
                            <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '24px 0', margin: 0 }}>
                              Pilih salah satu baris di tabel untuk melihat rincian informasi bisnis.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* HISTORY VIEW */}
              {view === 'history' && (
                <Card>
                  <CardHeader>
                    <div className="flex-between">
                      <div>
                        <CardTitle>Riwayat Pencarian</CardTitle>
                        <CardDescription>Daftar semua sesi scraping yang telah tersimpan</CardDescription>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          void runAction(
                            () => window.api.clearHistory(),
                            'Riwayat Dibersihkan',
                            'Semua data riwayat dan hasil telah dihapus'
                          )
                        }
                      >
                        <Trash2 className="icon-sm" />
                        Hapus Semua Riwayat
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {runs.length === 0 ? (
                      <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>
                        Belum ada riwayat scraping.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {runs.map((run) => (
                          <div key={run.id} className="history-card-item">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div className="flex-gap-2">
                                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '14px' }}>{run.keyword}</span>
                                <Badge variant="outline">{run.location}</Badge>
                                <Badge variant={getBadgeVariant(run.status)}>{run.status}</Badge>
                              </div>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                Dibuat: {new Date(run.createdAt).toLocaleString('id-ID')} • Hasil:{' '}
                                {run.totalResults} tempat
                              </span>
                            </div>

                            <div className="flex-gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedRunId(run.id)
                                  setView('results')
                                }}
                              >
                                Lihat Data
                              </Button>

                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  void runAction(
                                    () => window.api.deleteRun(run.id),
                                    'Sesi Dihapus',
                                    `Sesi ${run.keyword} dihapus`
                                  )
                                }
                              >
                                Hapus
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* SETTINGS VIEW */}
              {view === 'settings' && (
                <div className="grid-2col">
                  <Card>
                    <CardHeader>
                      <CardTitle>Pengaturan Scraper</CardTitle>
                      <CardDescription>Atur preferensi browser, jeda waktu, dan penyimpanan.</CardDescription>
                    </CardHeader>
                    <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <Switch
                        label="Mode Headless Browser"
                        description="Jalankan Playwright Chromium di latar belakang tanpa membuka jendela tampilan visual."
                        checked={settings.headless}
                        onChange={(e) =>
                          setSettings((c) => ({ ...c, headless: e.target.checked }))
                        }
                      />

                      <div className="form-field">
                        <label className="form-label">
                          Jeda Antar Halaman / Delay (milidetik)
                        </label>
                        <Input
                          type="number"
                          value={settings.delayMs}
                          onChange={(e) =>
                            setSettings((c) => ({
                              ...c,
                              delayMs: Math.max(0, Number(e.target.value) || 0)
                            }))
                          }
                        />
                        <span className="form-hint">
                          Waktu tunggu sebelum mengambil detail tempat berikutnya (default: 1200ms).
                        </span>
                      </div>

                      <div className="form-field">
                        <label className="form-label">
                          Waktu Batas / Timeout (milidetik)
                        </label>
                        <Input
                          type="number"
                          value={settings.timeoutMs}
                          onChange={(e) =>
                            setSettings((c) => ({
                              ...c,
                              timeoutMs: Math.max(1000, Number(e.target.value) || 30000)
                            }))
                          }
                        />
                      </div>

                      <Switch
                        label="Otomatis Deduplikasi"
                        description="Hapus otomatis data usaha dengan URL Google Maps yang sama setelah scraping selesai."
                        checked={settings.autoDeduplicate}
                        onChange={(e) =>
                          setSettings((c) => ({ ...c, autoDeduplicate: e.target.checked }))
                        }
                      />

                      <Switch
                        label="Simpan Otomatis Ke Database"
                        description="Simpan setiap baris data langsung ke database SQLite lokal."
                        checked={settings.autoSave}
                        onChange={(e) =>
                          setSettings((c) => ({ ...c, autoSave: e.target.checked }))
                        }
                      />

                      <div className="form-field">
                        <label className="form-label">
                          Folder Lokasi Ekspor File
                        </label>
                        <Input
                          value={settings.exportDirectory}
                          onChange={(e) =>
                            setSettings((c) => ({ ...c, exportDirectory: e.target.value }))
                          }
                        />
                      </div>
                    </CardContent>
                    <CardFooter style={{ justifyContent: 'flex-start' }}>
                      <Button
                        variant="default"
                        onClick={() =>
                          void runAction(
                            () => window.api.saveSettings(settings),
                            'Pengaturan Disimpan',
                            'Konfigurasi baru berhasil diterapkan'
                          )
                        }
                      >
                        Simpan Pengaturan
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() =>
                          void runAction(async () => {
                            const reset = await window.api.resetSettings()
                            setSettings(reset)
                          }, 'Pengaturan Direset')
                        }
                      >
                        Reset Default
                      </Button>
                    </CardFooter>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Informasi Sistem</CardTitle>
                    </CardHeader>
                    <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                      <p style={{ margin: 0 }}>
                        <strong style={{ color: '#f8fafc' }}>Penyimpanan Database:</strong> SQLite lokal di folder `userData` Electron.
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong style={{ color: '#f8fafc' }}>Format Ekspor:</strong> CSV (UTF-8) & Spreadsheet Excel (XLSX).
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong style={{ color: '#f8fafc' }}>Engine Scraping:</strong> Playwright Chromium Automation Engine.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* TOAST CONTAINER */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  )
}

export default App
