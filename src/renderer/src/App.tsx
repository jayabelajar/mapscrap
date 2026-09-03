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
  Table as TableIcon,
  User,
  Lock,
  Mail,
  TrendingUp,
  BarChart3,
  Layers,
  Sparkle,
  Menu,
  X,
  Clock,
  Cpu,
  ShieldCheck
} from 'lucide-react'

import type {
  BusinessRecord,
  DashboardSnapshot,
  RunStatus,
  ScrapeRunRecord,
  SettingsData
} from '../../shared/types'

import {
  AreaChart,
  Badge,
  BarChart,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  LocationAutocomplete,
  ProfileCard,
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
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: 'scrape', label: 'Scrape Baru', icon: <Play className="w-4 h-4" /> },
  { key: 'results', label: 'Hasil Data', icon: <TableIcon className="w-4 h-4" /> },
  { key: 'history', label: 'Riwayat', icon: <HistoryIcon className="w-4 h-4" /> },
  { key: 'settings', label: 'Pengaturan', icon: <SettingsIcon className="w-4 h-4" /> }
]

function App(): React.JSX.Element {
  // Auth State & Persistence
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('mapscraper_user'))
  })
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login')
  const [user, setUser] = useState<{ name: string; username: string; email: string }>(() => {
    const saved = localStorage.getItem('mapscraper_user')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return {
      name: 'Alex Scraper',
      username: '@alex.scraper',
      email: 'alex@mapscraper.com'
    }
  })
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' })

  // Layout & Navigation State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [view, setView] = useState<ViewKey>('dashboard')

  // Scrape & Data State
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
  const [form, setForm] = useState({ keyword: 'Cafe', location: 'Surabaya, Jawa Timur', maxResults: 20 })
  const [detail, setDetail] = useState<BusinessRecord | null>(null)
  const [progress, setProgress] = useState<DashboardSnapshot['progress']>(null)
  const [scrapeStartTime, setScrapeStartTime] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)
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
  }, [])

  // Load snapshot scoped to logged in user email
  useEffect(() => {
    if (!isLoggedIn || !user.email) return

    let cancelled = false
    setIsLoading(true)

    void window.api.getSnapshot(user.email).then((snapshot) => {
      if (cancelled) return
      applySnapshot(snapshot)
      setIsLoading(false)
    })

    const offProgress = window.api.onProgress((payload) => {
      setProgress(payload)
      if (payload.status === 'running' && !scrapeStartTime) {
        setScrapeStartTime(Date.now())
      }
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
  }, [isLoggedIn, user.email, applySnapshot])

  useEffect(() => {
    if (!selectedRunId || !user.email) return

    let cancelled = false
    void window.api.listResults({ runId: selectedRunId, userEmail: user.email }).then((items) => {
      if (!cancelled) {
        setResults(items)
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedRunId, user.email])

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

  // Estimated Time Remaining calculation
  const estimatedTimeText = useMemo(() => {
    if (!progress || progress.status !== 'running' || progress.current === 0 || progress.total === 0) {
      if (progress?.status === 'completed') return 'Selesai'
      return '-'
    }
    const startTime = scrapeStartTime || Date.now()
    const elapsedSeconds = Math.max(1, (Date.now() - startTime) / 1000)
    const itemsPerSec = progress.current / elapsedSeconds
    const remainingItems = Math.max(0, progress.total - progress.current)
    const remainingSecs = Math.ceil(remainingItems / Math.max(0.01, itemsPerSec))

    if (remainingSecs < 60) {
      return `~${remainingSecs}d`
    }
    const mins = Math.floor(remainingSecs / 60)
    const secs = remainingSecs % 60
    return `~${mins}m ${secs}d`
  }, [progress, scrapeStartTime])

  // Chart Data Calculations
  const areaChartData = useMemo(() => {
    if (runs.length === 0) {
      return [
        { label: 'Sesi 1', value: 0 },
        { label: 'Sesi 2', value: 0 },
        { label: 'Sesi 3', value: 0 }
      ]
    }
    return runs.slice(0, 6).reverse().map((r) => ({
      label: r.keyword.slice(0, 8),
      value: r.totalResults
    }))
  }, [runs])

  const barChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    results.forEach((r) => {
      const cat = r.category || 'Tanpa Kategori'
      counts[cat] = (counts[cat] || 0) + 1
    })

    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [results])

  const runAction = async (
    task: () => Promise<unknown>,
    successTitle: string,
    successDesc?: string
  ): Promise<void> => {
    setIsBusy(true)
    try {
      await task()
      const snapshot = await window.api.getSnapshot(user.email)
      applySnapshot(snapshot)
      const nextRunId = selectedRunId || snapshot.activeRun?.id || snapshot.runs[0]?.id
      if (nextRunId) {
        const items = await window.api.listResults({ runId: nextRunId, userEmail: user.email })
        setResults(items)
      }
      addToast(successTitle, successDesc, 'success')
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Operasi gagal'
      addToast('Gagal', errText, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  const startScrape = async (): Promise<void> => {
    setScrapeStartTime(Date.now())
    await runAction(async () => {
      const run = await window.api.startScrape({ ...form, userEmail: user.email })
      setSelectedRunId(run.id)
      setSelectedIds([])
      setView('results')
    }, 'Scrape Dimulai', `Mencari '${form.keyword}' di ${form.location}`)
  }

  const handleExportSaveAs = async (format: 'csv' | 'xlsx'): Promise<void> => {
    if (!selectedRunId) return

    try {
      const exportedPath = await window.api.exportResultsSaveAs({
        runId: selectedRunId,
        ids: selectedIds.length > 0 ? selectedIds : undefined,
        format
      })
      if (exportedPath) {
        addToast(`Ekspor ${format.toUpperCase()} Berhasil`, `Disimpan ke: ${exportedPath}`, 'success')
      }
    } catch (err) {
      addToast('Gagal Ekspor', err instanceof Error ? err.message : 'Batal menyimpan', 'error')
    }
  }

  const handleSelectDirectory = async (): Promise<void> => {
    try {
      const folderPath = await window.api.selectDirectory()
      if (folderPath) {
        setSettings((c) => ({ ...c, exportDirectory: folderPath }))
        addToast('Folder Dipilih', folderPath, 'info')
      }
    } catch (err) {
      addToast('Gagal Memilih Folder', 'Pilihan dibatalkan', 'error')
    }
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

  // Handle Login & Registration Submit
  const handleAuthLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!authForm.email) {
      addToast('Email Wajib Diisi', 'Silakan masukkan email Anda', 'warning')
      return
    }
    const name = authForm.name || authForm.email.split('@')[0]
    const userData = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      username: `@${name.toLowerCase().replace(/\s+/g, '')}`,
      email: authForm.email.toLowerCase()
    }
    localStorage.setItem('mapscraper_user', JSON.stringify(userData))
    setUser(userData)
    setIsLoggedIn(true)
    addToast('Selamat Datang!', `Berhasil masuk sebagai ${userData.name}`, 'success')
  }

  const handleAuthRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!authForm.email) {
      addToast('Email Wajib Diisi', 'Silakan masukkan email Anda', 'warning')
      return
    }
    const name = authForm.name || authForm.email.split('@')[0]
    const userData = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      username: `@${name.toLowerCase().replace(/\s+/g, '')}`,
      email: authForm.email.toLowerCase()
    }
    localStorage.setItem('mapscraper_user', JSON.stringify(userData))
    setUser(userData)
    setIsLoggedIn(true)
    addToast('Pendaftaran Sukses', `Akun ${userData.name} berhasil dibuat!`, 'success')
  }

  const handleLogout = () => {
    localStorage.removeItem('mapscraper_user')
    setIsLoggedIn(false)
    setAuthScreen('login')
    setRuns([])
    setResults([])
    addToast('Sampai Jumpa', 'Anda telah keluar akun', 'info')
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

  // --- SEPARATE AUTH SCREENS (LOGIN vs REGISTER) ---
  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#090d16] text-slate-100 flex items-center justify-center p-4 select-none overflow-y-auto">
        <div className="w-full max-w-md space-y-6 my-auto">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/20">
              <Building2 className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white m-0">MapScraper Pro</h1>
            <p className="text-xs text-slate-400 m-0">Google Maps Lead Extractor & Data Collector</p>
          </div>

          {authScreen === 'login' ? (
            /* DEDICATED LOGIN SCREEN */
            <Card className="border-slate-800 bg-slate-900/90 shadow-2xl">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-base font-bold">Masuk Ke Akun Anda</CardTitle>
                <CardDescription className="text-xs">
                  Silakan masukkan email dan kata sandi Anda untuk melanjutkan
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <form onSubmit={handleAuthLoginSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Email Pengguna</label>
                    <Input
                      type="email"
                      icon={<Mail className="w-3.5 h-3.5" />}
                      placeholder="alex@mapscraper.com"
                      value={authForm.email}
                      onChange={(e) => setAuthForm((c) => ({ ...c, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Kata Sandi</label>
                    <Input
                      type="password"
                      icon={<Lock className="w-3.5 h-3.5" />}
                      placeholder="••••••••"
                      value={authForm.password}
                      onChange={(e) => setAuthForm((c) => ({ ...c, password: e.target.value }))}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full mt-3">
                    Masuk Ke Aplikasi &rarr;
                  </Button>
                </form>

                <div className="mt-5 text-center text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                  Belum memiliki akun?{' '}
                  <button
                    type="button"
                    className="text-blue-400 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                    onClick={() => setAuthScreen('register')}
                  >
                    Daftar Akun Baru
                  </button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* DEDICATED REGISTER SCREEN */
            <Card className="border-slate-800 bg-slate-900/90 shadow-2xl">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-base font-bold">Pendaftaran Akun Baru</CardTitle>
                <CardDescription className="text-xs">
                  Buat akun baru untuk mulai melakukan ekstraksi data
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <form onSubmit={handleAuthRegisterSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Nama Lengkap</label>
                    <Input
                      type="text"
                      icon={<User className="w-3.5 h-3.5" />}
                      placeholder="Contoh: Alex Pratama"
                      value={authForm.name}
                      onChange={(e) => setAuthForm((c) => ({ ...c, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Email Pengguna</label>
                    <Input
                      type="email"
                      icon={<Mail className="w-3.5 h-3.5" />}
                      placeholder="alex@mapscraper.com"
                      value={authForm.email}
                      onChange={(e) => setAuthForm((c) => ({ ...c, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Kata Sandi</label>
                    <Input
                      type="password"
                      icon={<Lock className="w-3.5 h-3.5" />}
                      placeholder="••••••••"
                      value={authForm.password}
                      onChange={(e) => setAuthForm((c) => ({ ...c, password: e.target.value }))}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full mt-3">
                    Buat Akun Sekarang &rarr;
                  </Button>
                </form>

                <div className="mt-5 text-center text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                  Sudah memiliki akun?{' '}
                  <button
                    type="button"
                    className="text-blue-400 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                    onClick={() => setAuthScreen('login')}
                  >
                    Masuk di Sini
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100 font-sans select-none relative">
      {/* MOBILE OVERLAY BACKDROP */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 w-60 min-w-60 h-full flex flex-col bg-[#060911] border-r border-slate-800/80 p-3.5 shrink-0 transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 px-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-bold tracking-tight text-white m-0 leading-tight">MapScraper</h1>
              <p className="text-[11px] text-slate-400 m-0">Pro Lead Scraper</p>
            </div>
          </div>
          <button
            className="md:hidden text-slate-400 hover:text-white p-1 bg-transparent border-0 cursor-pointer"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 mt-3 flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-transparent cursor-pointer ${
                view === item.key
                  ? 'bg-slate-800/90 text-white border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
              }`}
              onClick={() => {
                setView(item.key)
                setMobileMenuOpen(false)
              }}
            >
              <div className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.key === 'results' && results.length > 0 && (
                <Badge variant="secondary">{results.length}</Badge>
              )}
            </button>
          ))}
        </nav>

        {/* PROFILE FOOTER (STATUS CARD ABOVE REMOVED AS REQUESTED) */}
        <ProfileCard
          name={user.name}
          username={user.username}
          onLogout={handleLogout}
        />
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* HEADER NAVBAR */}
        <header className="h-13 min-h-13 flex items-center justify-between px-4 sm:px-6 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden text-slate-400 hover:text-white p-1 bg-transparent border-0 cursor-pointer"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-semibold text-white m-0 whitespace-nowrap">
              {navItems.find((i) => i.key === view)?.label}
            </h2>
            {selectedRun && (
              <Badge variant="outline" className="hidden sm:inline-flex">
                {selectedRun.keyword} • {selectedRun.location}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void window.api.openExportDirectory().then(() => {
                  addToast('Membuka Folder', 'Folder ekspor telah dibuka', 'info')
                })
              }
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Folder Ekspor</span>
            </Button>

            <Button variant="default" size="sm" onClick={() => setView('scrape')}>
              <Play className="w-3.5 h-3.5" />
              <span>Scrape Baru</span>
            </Button>
          </div>
        </header>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 min-w-0">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                <p className="text-xs">Memuat data aplikasi...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* DASHBOARD VIEW */}
              {view === 'dashboard' && (
                <>
                  {/* METRICS CARDS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="hover:border-slate-700 transition-colors">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="text-xs font-medium">Total Run</span>
                          <Database className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-bold text-white tracking-tight">{stats.totalRuns}</span>
                          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-0.5">
                            <TrendingUp className="w-3 h-3" /> Akun Aktif
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block">Total sesi scraping dibuat</span>
                      </CardContent>
                    </Card>

                    <Card className="hover:border-slate-700 transition-colors">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="text-xs font-medium">Sesi Selesai</span>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-bold text-white tracking-tight">{stats.completed}</span>
                          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-0.5">
                            <TrendingUp className="w-3 h-3" /> Sukses
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block">Sesi scraping sukses</span>
                      </CardContent>
                    </Card>

                    <Card className="hover:border-slate-700 transition-colors">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="text-xs font-medium">Total Bisnis</span>
                          <Building2 className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-bold text-white tracking-tight">{stats.totalBusinesses}</span>
                          <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-0.5">
                            <Sparkle className="w-3 h-3" /> Data Terisolasi
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block">Kontak tempat terkumpul</span>
                      </CardContent>
                    </Card>

                    <Card className="hover:border-slate-700 transition-colors">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="text-xs font-medium">Rata-rata Rating</span>
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-bold text-white tracking-tight">
                            {Number.isFinite(stats.avgRating) ? stats.avgRating.toFixed(1) : '0.0'}
                          </span>
                          <span className="text-[11px] font-semibold text-amber-400">★ High Score</span>
                        </div>
                        <span className="text-[11px] text-slate-400 block">Bintang ulasan tempat</span>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 2 CHARTS ROW */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-blue-400" /> Tren Data Terkumpul
                            </CardTitle>
                            <CardDescription>Grafik progres hasil per sesi scraping</CardDescription>
                          </div>
                          <Badge variant="outline">Sesi Terakhir</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <AreaChart data={areaChartData} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-indigo-400" /> Distribusi Kategori Usaha
                            </CardTitle>
                            <CardDescription>Kategori tempat paling banyak terkumpul</CardDescription>
                          </div>
                          <Badge variant="outline">Top Kategori</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <BarChart data={barChartData} />
                      </CardContent>
                    </Card>
                  </div>

                  {/* PREVIEW TABLE */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-emerald-400" /> Cuplikan Data Usaha Terbaru
                          </CardTitle>
                          <CardDescription>Preview 5 kontak tempat yang baru saja dikumpulkan</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setView('results')}>
                          Buka Tabel Hasil &rarr;
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {results.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">Belum ada data hasil scraping pada akun ini.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nama Tempat</TableHead>
                              <TableHead>Kategori</TableHead>
                              <TableHead>Telepon</TableHead>
                              <TableHead>Rating</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.slice(0, 5).map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-semibold text-blue-400">{item.name}</TableCell>
                                <TableCell>{item.category ? <Badge variant="outline">{item.category}</Badge> : '-'}</TableCell>
                                <TableCell>{item.phone || '-'}</TableCell>
                                <TableCell>{item.rating ? <span className="text-amber-400 font-semibold">★ {item.rating}</span> : '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* SCRAPE FORM VIEW */}
              {view === 'scrape' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Form Scraping Baru</CardTitle>
                      <CardDescription>
                        Masukkan kata kunci dan lokasi target untuk mengambil data tempat dari Google Maps.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Kata Kunci / Keyword</label>
                        <Input
                          icon={<Search className="w-3.5 h-3.5" />}
                          placeholder="Contoh: Coffee Shop, Restoran, Bengkel, Apotek"
                          value={form.keyword}
                          onChange={(e) => setForm((c) => ({ ...c, keyword: e.target.value }))}
                        />
                      </div>

                      {/* TEXT (Autocomplete) REMOVED FROM LABEL AS REQUESTED */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Lokasi / Kota Target</label>
                        <LocationAutocomplete
                          icon={<MapPin className="w-3.5 h-3.5" />}
                          value={form.location}
                          onChange={(val) => setForm((c) => ({ ...c, location: val }))}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Maksimal Hasil Data</label>
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
                    <CardFooter className="flex gap-2 justify-start flex-wrap">
                      <Button
                        variant="default"
                        disabled={isBusy || activeStatus === 'running'}
                        onClick={() => void startScrape()}
                      >
                        <Play className="w-3.5 h-3.5" />
                        Mulai Scrape
                      </Button>

                      <Button
                        variant="outline"
                        disabled={activeStatus !== 'running'}
                        onClick={() =>
                          void runAction(() => window.api.pauseScrape(), 'Scrape Didepause')
                        }
                      >
                        <Pause className="w-3.5 h-3.5" />
                        Pause
                      </Button>

                      <Button
                        variant="outline"
                        disabled={activeStatus !== 'paused'}
                        onClick={() =>
                          void runAction(() => window.api.resumeScrape(), 'Scrape Dilanjutkan')
                        }
                      >
                        <Play className="w-3.5 h-3.5" />
                        Lanjutkan
                      </Button>

                      <Button
                        variant="destructive"
                        disabled={!['running', 'paused'].includes(activeStatus)}
                        onClick={() =>
                          void runAction(() => window.api.stopScrape(), 'Scrape Dihentikan')
                        }
                      >
                        <Square className="w-3.5 h-3.5" />
                        Stop
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* LIVE MONITORING WITH ESTIMATED TIME AND NAV BUTTON */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Live Monitoring</CardTitle>
                      <CardDescription>Progres dan estimasi waktu scraping</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Status</span>
                        <Badge variant={getBadgeVariant(activeStatus)}>{activeStatus.toUpperCase()}</Badge>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Terkumpul</span>
                        <span className="font-bold text-slate-200">
                          {progress ? `${progress.current} / ${progress.total}` : '0 / 0'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          Estimasi Waktu
                        </span>
                        <span className="font-bold text-blue-400">{estimatedTimeText}</span>
                      </div>

                      <Progress value={progressPercent} />

                      <div className="text-center pt-1">
                        <span className="text-3xl font-extrabold text-blue-400">{progressPercent}%</span>
                      </div>

                      <p className="text-xs text-slate-400 text-center m-0 leading-normal">
                        {progress?.message ?? 'Jendela browser Playwright akan terbuka otomatis saat scrape berjalan.'}
                      </p>

                      <Button
                        variant="default"
                        className="w-full mt-2"
                        onClick={() => setView('results')}
                      >
                        <TableIcon className="w-3.5 h-3.5" />
                        Lihat Hasil Data
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* RESULTS VIEW */}
              {view === 'results' && (
                <Card>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <CardTitle>Data Hasil Scraping</CardTitle>
                        <CardDescription>
                          {selectedRun
                            ? `${selectedRun.keyword} di ${selectedRun.location} (${filteredResults.length} data)`
                            : 'Pilih sesi pencarian'}
                        </CardDescription>
                      </div>

                      {/* TOOLBAR CONTROLS */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-48">
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

                        <div className="w-40">
                          <Input
                            icon={<Search className="w-3.5 h-3.5" />}
                            placeholder="Cari..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>

                        <div className="w-36">
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
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* EXPORT BUTTONS TEXT "(Pilih Folder)" REMOVED AS REQUESTED */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="secondary" size="sm" onClick={() => void handleExportSaveAs('csv')}>
                          <Download className="w-3.5 h-3.5" />
                          Simpan CSV
                        </Button>

                        <Button variant="secondary" size="sm" onClick={() => void handleExportSaveAs('xlsx')}>
                          <Download className="w-3.5 h-3.5" />
                          Simpan XLSX
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
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
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
                            <Trash2 className="w-3.5 h-3.5" />
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
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      <div className="lg:col-span-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-700 bg-slate-950 cursor-pointer"
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
                                <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                                  Tidak ada data hasil scraping yang cocok.
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredResults.map((item) => (
                                <TableRow
                                  key={item.id}
                                  className={detail?.id === item.id ? 'bg-blue-500/10' : ''}
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
                                      className="text-blue-400 hover:underline font-medium text-left cursor-pointer bg-transparent border-0 p-0 truncate max-w-[180px]"
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
                                      <span className="flex items-center gap-1 text-amber-400 font-semibold">
                                        <Star className="w-3.5 h-3.5 fill-amber-400" />
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
                      </div>

                      {/* DETAIL CARD DRAWER */}
                      <Card className="sticky top-0 h-fit">
                        <CardHeader>
                          <CardTitle className="text-xs">Detail Informasi Tempat</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {detail ? (
                            <div className="space-y-3 text-xs">
                              <div>
                                <h4 className="font-bold text-sm text-white m-0">{detail.name}</h4>
                                <p className="text-slate-400 m-0 mt-0.5">{detail.category || 'Tanpa Kategori'}</p>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-slate-800">
                                <div className="flex items-start gap-2 text-slate-300">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <span>{detail.address || 'Alamat tidak tersedia'}</span>
                                </div>

                                <div className="flex items-center gap-2 text-slate-300">
                                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{detail.phone || 'Nomor HP tidak ada'}</span>
                                </div>

                                <div className="flex items-center gap-2 text-slate-300">
                                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  {detail.website ? (
                                    <a
                                      href={detail.website}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-400 hover:underline break-all"
                                    >
                                      {detail.website}
                                    </a>
                                  ) : (
                                    <span>Website tidak ada</span>
                                  )}
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                                <span className="text-slate-400">Rating & Ulasan</span>
                                <span className="font-semibold text-slate-100">
                                  ★ {detail.rating ?? '-'} ({detail.reviewCount ?? 0} ulasan)
                                </span>
                              </div>

                              {detail.latitude && detail.longitude && (
                                <div className="text-slate-400 text-[11px]">
                                  Koordinat: {detail.latitude}, {detail.longitude}
                                </div>
                              )}

                              <div className="pt-2">
                                <a
                                  href={detail.mapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors no-underline"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Buka di Google Maps
                                </a>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 text-center py-6 m-0">
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
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle>Riwayat Pencarian Scrape</CardTitle>
                        <CardDescription>Daftar semua sesi scraping milik akun {user.email}</CardDescription>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          void runAction(
                            () => window.api.clearHistory(user.email),
                            'Riwayat Dibersihkan',
                            'Semua data riwayat dan hasil akun Anda telah dihapus'
                          )
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus Semua Riwayat
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {runs.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">Belum ada riwayat scraping untuk akun ini.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {runs.map((run) => (
                          <div
                            key={run.id}
                            className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-100 text-sm">{run.keyword}</span>
                                <Badge variant={getBadgeVariant(run.status)}>{run.status}</Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{run.location}</span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {new Date(run.createdAt).toLocaleString('id-ID')} • {run.totalResults} tempat terkumpul
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2 flex-wrap">
                              <div className="flex gap-1.5">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void handleExportSaveAs('csv')}
                                >
                                  CSV
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void handleExportSaveAs('xlsx')}
                                >
                                  XLSX
                                </Button>
                              </div>

                              <div className="flex gap-1.5">
                                <Button
                                  variant="default"
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
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* SETTINGS VIEW WITH ENHANCED INFORMASI SISTEM CARD */}
              {view === 'settings' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Pengaturan Scraper</CardTitle>
                      <CardDescription>Atur preferensi browser, jeda waktu, dan lokasi penyimpanan.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <Switch
                        label="Mode Headless Browser"
                        description="Jalankan Playwright Chromium di latar belakang tanpa membuka jendela tampilan visual."
                        checked={settings.headless}
                        onChange={(e) =>
                          setSettings((c) => ({ ...c, headless: e.target.checked }))
                        }
                      />

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">
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
                        <span className="text-[11px] text-slate-400">
                          Waktu tunggu sebelum mengambil detail tempat berikutnya (default: 1200ms).
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">
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

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          Folder Lokasi Ekspor File
                        </label>
                        <div className="flex gap-2">
                          <Input
                            value={settings.exportDirectory}
                            onChange={(e) =>
                              setSettings((c) => ({ ...c, exportDirectory: e.target.value }))
                            }
                          />
                          <Button variant="secondary" onClick={() => void handleSelectDirectory()}>
                            Pilih Folder...
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex gap-2 justify-start">
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

                  {/* INFORMASI SISTEM CARD REDESIGNED FOR HIGH VISUAL QUALITY */}
                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-blue-400" /> Informasi System
                      </CardTitle>
                      <CardDescription>Spesifikasi engine & status penyimpanan</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                            <Database className="w-3.5 h-3.5 text-blue-400" /> Database
                          </span>
                          <Badge variant="success">WAL Mode</Badge>
                        </div>
                        <p className="text-[11px] text-slate-300 font-semibold m-0">SQLite Internal (userData)</p>
                      </div>

                      <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                            <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Engine
                          </span>
                          <Badge variant="info">Automated</Badge>
                        </div>
                        <p className="text-[11px] text-slate-300 font-semibold m-0">Playwright Chromium</p>
                      </div>

                      <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Keamanan Data
                          </span>
                          <Badge variant="outline">Isolated</Badge>
                        </div>
                        <p className="text-[11px] text-slate-300 font-semibold m-0">Multi-User Encapsulated</p>
                      </div>

                      <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                            <Download className="w-3.5 h-3.5 text-amber-400" /> Format Ekspor
                          </span>
                          <Badge variant="secondary">CSV / XLSX</Badge>
                        </div>
                        <p className="text-[11px] text-slate-300 font-semibold m-0">UTF-8 Encoded Spreadsheets</p>
                      </div>
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
