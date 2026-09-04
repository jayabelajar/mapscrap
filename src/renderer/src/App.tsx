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
  Cpu,
  ShieldCheck,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
  RotateCcw
} from 'lucide-react'

import type {
  BusinessRecord,
  DashboardSnapshot,
  HistoryRestorePayload,
  RunStatus,
  RunBundlePayload,
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
  delayMs: 500,
  timeoutMs: 30000,
  autoDeduplicate: true,
  autoSave: true,
  exportDirectory: ''
}

const navItems: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: 'scrape', label: 'Scrape', icon: <Play className="w-4 h-4" /> },
  { key: 'results', label: 'Hasil Data', icon: <TableIcon className="w-4 h-4" /> },
  { key: 'history', label: 'Riwayat', icon: <HistoryIcon className="w-4 h-4" /> },
  { key: 'settings', label: 'Pengaturan', icon: <SettingsIcon className="w-4 h-4" /> }
]

type ConfirmDialogState = {
  title: string
  description: string
  confirmLabel?: string
  tone?: 'destructive' | 'default'
  onConfirm: () => Promise<void> | void
} | null

type ErrorDialogState = {
  title: string
  message: string
} | null

type ProgressLogItem = {
  id: string
  status: RunStatus
  message: string
  timestamp: string
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '-'
  }

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const parts = [
    days > 0 ? `${days}d` : '',
    hours > 0 ? `${hours}h` : '',
    minutes > 0 ? `${minutes}m` : '',
    seconds > 0 || (days === 0 && hours === 0 && minutes === 0) ? `${seconds}s` : ''
  ].filter(Boolean)

  return parts.join(' ')
}

function matchesGlobalSearch(searchText: string, values: Array<string | number | null | undefined>): boolean {
  const text = searchText.trim().toLowerCase()
  if (!text) {
    return true
  }

  return values.some((value) => String(value ?? '').toLowerCase().includes(text))
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null)
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState>(null)
  const [progressLog, setProgressLog] = useState<ProgressLogItem[]>([])
  const [timeTick, setTimeTick] = useState(() => Date.now())

  const addToast = useCallback(
    (
      titleOrToast: string | Omit<ToastState, 'id'>,
      description?: string,
      type: ToastState['type'] = 'info'
    ) => {
      const id = String(Date.now() + Math.random())
      const toast =
        typeof titleOrToast === 'string'
          ? { title: titleOrToast, description, type }
          : titleOrToast
      setToasts((current) => [...current, { id, ...toast }])
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id))
      }, 4500)
    },
    []
  )

  const pushProgressLog = useCallback((status: RunStatus, message: string) => {
    if (!message) return

    setProgressLog((current) => {
      const latest = current[0]
      if (latest && latest.status === status && latest.message === message) {
        return current
      }

      return [
        {
          id: String(Date.now() + Math.random()),
          status,
          message,
          timestamp: new Date().toISOString()
        },
        ...current
      ].slice(0, 5)
    })
  }, [])

  const showException = useCallback(
    (title: string, error: unknown) => {
      const message = error instanceof Error ? error.message : String(error || 'Operasi gagal')
      setErrorDialog({ title, message })
      addToast({ title, description: message, type: 'error' })
    },
    [addToast]
  )

  const applySnapshot = useCallback((snapshot: DashboardSnapshot): void => {
    setRuns(snapshot.runs)
    setSettings(snapshot.settings)
    setActiveRun(snapshot.activeRun)
    setProgress(snapshot.progress)
    setResults(snapshot.results)
    setSelectedRunId((current) => current || snapshot.activeRun?.id || snapshot.runs[0]?.id || '')
    if (snapshot.progress?.message) {
      pushProgressLog(snapshot.progress.status, snapshot.progress.message)
    }
  }, [pushProgressLog])

  useEffect(() => {
    if (progress?.status !== 'running') {
      return
    }

    const timer = window.setInterval(() => setTimeTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [progress?.status])

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
      if (payload.status === 'running') {
        setScrapeStartTime((current) => current ?? Date.now())
      }
      if (payload.status !== 'running') {
        setScrapeStartTime((current) => (payload.status === 'paused' ? current : null))
      }
      pushProgressLog(payload.status, payload.message)
      if (payload.status === 'failed') {
        setErrorDialog({
          title: 'Terjadi error saat scrape',
          message: payload.message || 'Proses scrape gagal.'
        })
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
  }, [isLoggedIn, user.email, applySnapshot, pushProgressLog])

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

  const filteredRuns = useMemo(
    () =>
      runs.filter((run) =>
        matchesGlobalSearch(search, [run.keyword, run.location, run.status, run.totalResults])
      ),
    [runs, search]
  )

  const filteredResults = useMemo(() => {
    const list = results.filter((item) => {
      if (hasPhoneOnly && !item.phone) return false
      return matchesGlobalSearch(search, [
        item.name,
        item.category,
        item.address,
        item.phone,
        item.website,
        item.rating,
        item.reviewCount
      ])
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

  const dashboardPreviewResults = useMemo(() => filteredResults.slice(0, 5), [filteredResults])

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

  const scrapeMetrics = useMemo(() => {
    if (!progress || !scrapeStartTime || progress.total === 0 || progress.current === 0) {
      return {
        totalEstimate: progress?.status === 'completed' ? 'Selesai' : '-',
        remainingEstimate: progress?.status === 'completed' ? '0s' : '-',
        speedText: '-'
      }
    }

    const elapsedSeconds = Math.max(1, (timeTick - scrapeStartTime) / 1000)
    const itemsPerSecond = progress.current / elapsedSeconds
    const totalEstimateSeconds = (progress.total / Math.max(itemsPerSecond, 0.01))
    const remainingSeconds = Math.max(0, totalEstimateSeconds - elapsedSeconds)

    return {
      totalEstimate: formatDuration(Math.ceil(totalEstimateSeconds)),
      remainingEstimate: formatDuration(Math.ceil(remainingSeconds)),
      speedText: `${itemsPerSecond.toFixed(itemsPerSecond >= 1 ? 1 : 2)} data/detik`
    }
  }, [progress, scrapeStartTime, timeTick])

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
      showException('Operasi gagal', err)
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
      setDetail(null)
      pushProgressLog('running', `Menyiapkan scrape ${form.keyword} di ${form.location}`)
    }, 'Scrape dimulai', `Mencari '${form.keyword}' di ${form.location}`)
  }

  const resetScrapeForm = (): void => {
    setForm({ keyword: 'Cafe', location: 'Surabaya, Jawa Timur', maxResults: 20 })
    addToast('Form direset', 'Parameter scrape kembali ke nilai awal', 'info')
  }

  const handleExportSaveAs = async (
    format: 'csv' | 'xlsx',
    runId: string = selectedRunId,
    ids?: string[]
  ): Promise<void> => {
    if (!runId) return

    try {
      const exportedPath = await window.api.exportResultsSaveAs({
        runId,
        ids: ids ?? (runId === selectedRunId && selectedIds.length > 0 ? selectedIds : undefined),
        format
      })
      if (exportedPath) {
        addToast(`Ekspor ${format.toUpperCase()} Berhasil`, `Disimpan ke: ${exportedPath}`, 'success')
      }
    } catch (err) {
      showException('Gagal ekspor', err)
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
      showException('Gagal memilih folder', err)
    }
  }

  const withDeleteConfirmation = useCallback(
    (options: NonNullable<ConfirmDialogState>) => {
      setConfirmDialog(options)
    },
    []
  )

  const deleteSelectedResults = async (): Promise<void> => {
    const backup = results.filter((item) => selectedIds.includes(item.id))
    await runAction(async () => {
      await window.api.deleteResults(selectedIds)
      setSelectedIds([])
      setDetail((current) => (current && selectedIds.includes(current.id) ? null : current))
      addToast({
        title: 'Data dihapus',
        description: `${backup.length} baris dihapus.`,
        type: 'warning',
        actionLabel: 'Undo',
        onAction: () =>
          void runAction(
            () => window.api.restoreResults(backup),
            'Penghapusan dibatalkan',
            `${backup.length} baris dipulihkan`
          )
      })
    }, 'Penghapusan berhasil')
  }

  const deleteRunWithUndo = async (run: ScrapeRunRecord): Promise<void> => {
    const backup: RunBundlePayload = {
      run,
      results: await window.api.listResults({ runId: run.id, userEmail: user.email })
    }

    await runAction(async () => {
      await window.api.deleteRun(run.id)
      if (selectedRunId === run.id) {
        setSelectedRunId('')
        setDetail(null)
      }
      addToast({
        title: 'Sesi dihapus',
        description: `${run.keyword} di ${run.location} dihapus.`,
        type: 'warning',
        actionLabel: 'Undo',
        onAction: () =>
          void runAction(
            () => window.api.restoreRun(backup),
            'Penghapusan dibatalkan',
            `Sesi ${run.keyword} dipulihkan`
          )
      })
    }, 'Sesi dihapus')
  }

  const clearHistoryWithUndo = async (): Promise<void> => {
    const backupRuns = runs
    const backupResults = (
      await Promise.all(backupRuns.map((run) => window.api.listResults({ runId: run.id, userEmail: user.email })))
    ).flat()
    const backup: HistoryRestorePayload = { runs: backupRuns, results: backupResults }

    await runAction(async () => {
      await window.api.clearHistory(user.email)
      setSelectedRunId('')
      setDetail(null)
      setSelectedIds([])
      addToast({
        title: 'Riwayat dibersihkan',
        description: 'Semua sesi dan hasil dihapus.',
        type: 'warning',
        actionLabel: 'Undo',
        onAction: () =>
          void runAction(
            () => window.api.restoreHistorySnapshot(backup),
            'Riwayat dipulihkan',
            `${backup.runs.length} sesi berhasil dikembalikan`
          )
      })
    }, 'Riwayat dibersihkan')
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
              <Bot className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white m-0">GmapScraper</h1>
            <p className="text-xs text-slate-400 m-0">Bot pengumpul data Google Maps yang cepat dan rapi</p>
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
        className={`fixed md:relative inset-y-0 left-0 z-50 h-full flex flex-col bg-[#060911] border-r border-slate-800/80 p-3.5 shrink-0 transition-all duration-200 ease-in-out ${
          sidebarCollapsed ? 'md:w-[84px] md:min-w-[84px]' : 'md:w-60 md:min-w-60'
        } ${mobileMenuOpen ? 'translate-x-0 w-60 min-w-60' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 px-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <h1 className="text-sm font-bold tracking-tight text-white m-0 leading-tight">GmapScraper</h1>
                <p className="text-[11px] text-slate-400 m-0">Scrape cepat, hasil tertata</p>
              </div>
            )}
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
                {!sidebarCollapsed && <span>{item.label}</span>}
              </div>
              {!sidebarCollapsed && item.key === 'results' && results.length > 0 && (
                <Badge variant="secondary">{results.length}</Badge>
              )}
            </button>
          ))}
        </nav>

        {sidebarCollapsed ? (
          <div className="mt-auto flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-xs font-bold text-white">
              {user.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              title="Keluar"
              className="rounded-md border-0 bg-transparent p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <ProfileCard
            name={user.name}
            username={user.username}
            onLogout={handleLogout}
          />
        )}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* HEADER NAVBAR */}
        <header className="min-h-13 flex items-center justify-between px-4 sm:px-6 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md gap-3 flex-wrap py-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              className="text-slate-400 hover:text-white p-1 bg-transparent border-0 cursor-pointer"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileMenuOpen((current) => !current)
                  return
                }
                setSidebarCollapsed((current) => !current)
              }}
              title="Show / hide sidebar"
            >
              <span className="md:hidden">
                <Menu className="w-5 h-5" />
              </span>
              <span className="hidden md:inline">
                {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </span>
            </button>
            <div className="w-full max-w-xl">
              <Input
                icon={<Search className="w-3.5 h-3.5" />}
                placeholder="Pencarian global: nama, kategori, lokasi, status"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
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
              <span>Scrape</span>
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
                              <BarChart3 className="w-4 h-4 text-indigo-400" /> Distribusi Kategori Tempat
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
                            <Layers className="w-4 h-4 text-emerald-400" /> Cuplikan Data Terbaru
                          </CardTitle>
                          <CardDescription>Preview 5 data terbaru yang baru saja dikumpulkan</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setView('results')}>
                          Buka Tabel Hasil &rarr;
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {dashboardPreviewResults.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">
                          {search ? 'Tidak ada data yang cocok dengan pencarian global.' : 'Belum ada data hasil scraping pada akun ini.'}
                        </p>
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
                            {dashboardPreviewResults.map((item) => (
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
                      <CardTitle>Form Scraping</CardTitle>
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

                      <Button variant="ghost" onClick={resetScrapeForm}>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* LIVE MONITORING WITH INTERACTIVE STATUS */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Live Monitoring</CardTitle>
                      <CardDescription>Progres, kecepatan, dan status perubahan scrape</CardDescription>
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
                        <span className="text-slate-400">Estimasi total</span>
                        <span className="font-bold text-blue-400">{scrapeMetrics.totalEstimate}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Sisa waktu</span>
                        <span className="font-semibold text-slate-200">{scrapeMetrics.remainingEstimate}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Kecepatan</span>
                        <span className="font-semibold text-emerald-400">{scrapeMetrics.speedText}</span>
                      </div>

                      <Progress value={progressPercent} />

                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-300">Progress interaktif</span>
                          <span className="text-xl font-extrabold text-blue-400">{progressPercent}%</span>
                        </div>
                        <div className="space-y-2">
                          {progressLog.length === 0 ? (
                            <p className="m-0 text-[11px] text-slate-400">
                              Status scrape akan tampil di sini setiap ada perubahan.
                            </p>
                          ) : (
                            progressLog.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-900/70 px-3 py-2"
                              >
                                <div className="space-y-0.5">
                                  <div className="text-[11px] font-medium text-slate-200">{item.message}</div>
                                  <div className="text-[10px] text-slate-500">
                                    {new Date(item.timestamp).toLocaleTimeString('id-ID')}
                                  </div>
                                </div>
                                <Badge variant={getBadgeVariant(item.status)}>{item.status}</Badge>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 text-center m-0 leading-normal">
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
                              withDeleteConfirmation({
                                title: 'Hapus data terpilih?',
                                description: `${selectedIds.length} baris akan dihapus. Anda masih bisa undo sesaat setelah dihapus.`,
                                confirmLabel: 'Hapus',
                                tone: 'destructive',
                                onConfirm: () => void deleteSelectedResults()
                              })
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
                          withDeleteConfirmation({
                            title: 'Hapus semua riwayat?',
                            description: 'Semua sesi dan hasil akun ini akan dihapus. Undo tetap tersedia setelah aksi dilakukan.',
                            confirmLabel: 'Hapus semua',
                            tone: 'destructive',
                            onConfirm: () => void clearHistoryWithUndo()
                          })
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus Semua Riwayat
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredRuns.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">
                        {search ? 'Tidak ada riwayat yang cocok dengan pencarian global.' : 'Belum ada riwayat scraping untuk akun ini.'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredRuns.map((run) => (
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
                                  onClick={() => void handleExportSaveAs('csv', run.id)}
                                >
                                  CSV
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void handleExportSaveAs('xlsx', run.id)}
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
                                    withDeleteConfirmation({
                                      title: 'Hapus sesi ini?',
                                      description: `Sesi ${run.keyword} di ${run.location} akan dihapus beserta hasilnya.`,
                                      confirmLabel: 'Hapus sesi',
                                      tone: 'destructive',
                                      onConfirm: () => void deleteRunWithUndo(run)
                                    })
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
                          Waktu tunggu sebelum mengambil detail tempat berikutnya (default: 500ms).
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
                        description="Hapus otomatis data duplikat dengan URL Google Maps yang sama setelah scraping selesai."
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
                          <Button variant="secondary" size="icon" onClick={() => void handleSelectDirectory()} title="Pilih folder">
                            <FolderOpen className="w-3.5 h-3.5" />
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

      {confirmDialog && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md border-slate-700 bg-slate-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                {confirmDialog.title}
              </CardTitle>
              <CardDescription>{confirmDialog.description}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-end">
              <Button variant="ghost" onClick={() => setConfirmDialog(null)}>
                Batal
              </Button>
              <Button
                variant={confirmDialog.tone === 'destructive' ? 'destructive' : 'default'}
                onClick={() => {
                  const action = confirmDialog.onConfirm
                  setConfirmDialog(null)
                  void action()
                }}
              >
                {confirmDialog.confirmLabel ?? 'Lanjutkan'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {errorDialog && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg border-red-500/20 bg-slate-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-4 w-4" />
                {errorDialog.title}
              </CardTitle>
              <CardDescription>Detail error ditampilkan supaya lebih mudah dicek.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs leading-6 text-slate-200">
                {errorDialog.message}
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button variant="default" onClick={() => setErrorDialog(null)}>
                Tutup
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* TOAST CONTAINER */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  )
}

export default App
