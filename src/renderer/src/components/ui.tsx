import React, { useState } from 'react'
import { LogOut } from 'lucide-react'

// --- BUTTON ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
  size?: 'sm' | 'default' | 'lg' | 'icon'
  isLoading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', isLoading, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 rounded-md font-medium text-xs transition-all duration-150 border disabled:opacity-50 disabled:pointer-events-none outline-none select-none cursor-pointer'
    
    const variants = {
      default: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm',
      secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700',
      outline: 'bg-transparent hover:bg-slate-800 text-slate-200 border-slate-700',
      ghost: 'bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-100 border-transparent',
      destructive: 'bg-red-600 hover:bg-red-700 text-white border-red-600',
      link: 'bg-transparent text-blue-400 hover:underline p-0 border-transparent'
    }

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      default: 'h-9 px-4 text-xs',
      lg: 'h-10 px-5 text-sm',
      icon: 'h-9 w-9 p-0'
    }

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

// --- CARD ---
export function Card({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/90 text-slate-100 shadow-xl flex flex-col min-w-0 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`p-4 sm:p-5 flex flex-col gap-1 border-b border-slate-800/60 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className = '', children, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return (
    <h3 className={`text-sm font-semibold tracking-tight text-slate-100 m-0 ${className}`} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({ className = '', children, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return (
    <p className={`text-xs text-slate-400 m-0 ${className}`} {...props}>
      {children}
    </p>
  )
}

export function CardContent({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`p-4 sm:p-5 flex-1 min-w-0 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`p-4 sm:p-5 flex items-center justify-end gap-2 border-t border-slate-800/60 flex-wrap ${className}`} {...props}>
      {children}
    </div>
  )
}

// --- BADGE ---
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info'
}

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps): React.JSX.Element {
  const variants = {
    default: 'bg-blue-600 text-white border-blue-600',
    secondary: 'bg-slate-800 text-slate-300 border-slate-700',
    outline: 'bg-transparent text-slate-400 border-slate-700',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    destructive: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border whitespace-nowrap ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  )
}

// --- INPUT ---
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', icon, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative flex items-center w-full">
          <span className="absolute left-3 text-slate-400 flex items-center pointer-events-none">{icon}</span>
          <input ref={ref} className={`w-full h-9 pl-9 pr-3 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-xs font-sans outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500 transition-colors ${className}`} {...props} />
        </div>
      )
    }
    return <input ref={ref} className={`w-full h-9 px-3 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-xs font-sans outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500 transition-colors ${className}`} {...props} />
  }
)
Input.displayName = 'Input'

// --- SELECT ---
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select ref={ref} className={`w-full h-9 pl-3 pr-8 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer ${className}`} {...props}>
          {children}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</span>
      </div>
    )
  }
)
Select.displayName = 'Select'

// --- CHECKBOX / SWITCH ---
export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  description?: string
}

export function Switch({ label, description, className = '', checked, onChange, ...props }: SwitchProps): React.JSX.Element {
  return (
    <label className={`flex items-start gap-3 cursor-pointer select-none ${className}`}>
      <div className="relative inline-block w-9 h-5 shrink-0 mt-0.5">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={onChange}
          {...props}
        />
        <span className="absolute inset-0 bg-slate-800 border border-slate-700 rounded-full peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-colors" />
        <span className="absolute left-0.5 bottom-0.5 h-4 w-4 bg-slate-400 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-transform" />
      </div>
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && <span className="text-xs font-medium text-slate-200">{label}</span>}
          {description && <span className="text-[11px] text-slate-400">{description}</span>}
        </div>
      )}
    </label>
  )
}

// --- PROGRESS ---
export interface ProgressProps {
  value: number
  max?: number
  className?: string
}

export function Progress({ value, max = 100, className = '' }: ProgressProps): React.JSX.Element {
  const percent = Math.min(100, Math.max(0, Math.round((value / max) * 100)))
  return (
    <div className={`w-full h-2 bg-slate-800 rounded-full overflow-hidden ${className}`}>
      <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
    </div>
  )
}

// --- TABLE ---
export function Table({ className = '', children, ...props }: React.TableHTMLAttributes<HTMLTableElement>): React.JSX.Element {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/80">
      <table className={`w-full border-collapse text-left text-xs min-w-[600px] ${className}`} {...props}>
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return (
    <thead className={`bg-slate-950/90 border-b border-slate-800 ${className}`} {...props}>
      {children}
    </thead>
  )
}

export function TableBody({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return (
    <tbody className={`divide-y divide-slate-800/60 ${className}`} {...props}>
      {children}
    </tbody>
  )
}

export function TableRow({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableRowElement>): React.JSX.Element {
  return (
    <tr className={`hover:bg-slate-800/50 transition-colors ${className}`} {...props}>
      {children}
    </tr>
  )
}

export function TableHead({ className = '', children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <th className={`px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wider text-slate-400 sticky top-0 bg-slate-950 ${className}`} {...props}>
      {children}
    </th>
  )
}

export function TableCell({ className = '', children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <td className={`px-3 py-2.5 text-slate-300 align-middle max-w-[220px] truncate ${className}`} {...props}>
      {children}
    </td>
  )
}

// --- TOAST ALERTS ---
export interface ToastState {
  id: string
  title: string
  description?: string
  type?: 'success' | 'error' | 'info' | 'warning'
  actionLabel?: string
  onAction?: () => void
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastState[]; onDismiss: (id: string) => void }): React.JSX.Element {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div key={toast.id} className={`flex items-start justify-between gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl animate-in slide-in-from-bottom-2 ${toast.type === 'success' ? 'border-l-4 border-l-emerald-500' : toast.type === 'error' ? 'border-l-4 border-l-red-500' : toast.type === 'warning' ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-blue-500'}`}>
          <div className="flex flex-col gap-0.5">
            <h4 className="text-xs font-semibold text-slate-100 m-0">{toast.title}</h4>
            {toast.description && <p className="text-[11px] text-slate-400 m-0 leading-normal">{toast.description}</p>}
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="mt-1 self-start rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-700"
                onClick={toast.onAction}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
          <button className="bg-transparent border-0 text-slate-400 hover:text-white cursor-pointer p-0 text-sm" onClick={() => onDismiss(toast.id)}>
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}

// --- SVG AREA CHART ---
export function AreaChart({ data }: { data: Array<{ label: string; value: number }> }): React.JSX.Element {
  if (!data || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-slate-500">
        Belum ada data grafik
      </div>
    )
  }

  const maxVal = Math.max(...data.map((d) => d.value), 10)
  const width = 500
  const height = 150
  const padding = 20

  const points = data.map((d, index) => {
    const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2)
    const y = height - padding - (d.value / maxVal) * (height - padding * 2)
    return { x, y }
  })

  const pathD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1e293b" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#1e293b" strokeDasharray="3 3" />

        {/* Area & Line */}
        <path d={areaD} fill="url(#areaGrad)" />
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />

        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 px-2 mt-1">
        {data.map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

// --- SVG BAR CHART ---
export function BarChart({ data }: { data: Array<{ label: string; value: number }> }): React.JSX.Element {
  if (!data || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-slate-500">
        Belum ada data kategori
      </div>
    )
  }

  const maxVal = Math.max(...data.map((d) => d.value), 5)

  return (
    <div className="space-y-2 py-1">
      {data.slice(0, 5).map((item, index) => {
        const percent = Math.min(100, Math.round((item.value / maxVal) * 100))
        return (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-xs text-slate-300">
              <span className="truncate max-w-[180px]">{item.label || 'Lainnya'}</span>
              <span className="font-semibold text-slate-400">{item.value}</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LocationAutocomplete({
  value,
  onChange,
  icon,
  options = []
}: {
  value: string
  onChange: (val: string) => void
  icon?: React.ReactNode
  options?: string[]
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)

  const query = (value || '').toLowerCase()
  const filtered = options.filter((loc) => loc.toLowerCase().includes(query)).slice(0, 12)

  return (
    <div className="relative w-full">
      <Input
        icon={icon}
        placeholder="Contoh: Surabaya, Jakarta Selatan, Bandung"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 top-11 z-50 max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-1 shadow-2xl list-none m-0">
          {filtered.map((loc, i) => (
            <li
              key={i}
              className="px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded cursor-pointer transition-colors"
              onMouseDown={() => {
                onChange(loc)
                setIsOpen(false)
              }}
            >
              {loc}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// --- PROFILE CARD & AVATAR ---
export function ProfileCard({
  name,
  username,
  avatarUrl,
  onLogout,
  onOpenProfile
}: {
  name: string
  username: string
  avatarUrl?: string
  onLogout: () => void
  onOpenProfile?: () => void
}): React.JSX.Element {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2.5 mt-auto">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2.5 border-0 bg-transparent p-0 text-left cursor-pointer"
        onClick={onOpenProfile}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden shadow-md">
          {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : initials}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-slate-100 truncate">{name}</span>
          <span className="text-[11px] text-slate-400 truncate">{username}</span>
        </div>
      </button>
      <button
        onClick={onLogout}
        title="Keluar / Logout"
        className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 bg-transparent border-0 cursor-pointer transition-colors shrink-0 flex items-center justify-center"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  )
}
