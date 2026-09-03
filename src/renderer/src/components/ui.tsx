import React from 'react'

// --- BUTTON ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
  size?: 'sm' | 'default' | 'lg' | 'icon'
  isLoading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', isLoading, children, disabled, ...props }, ref) => {
    const base = 'ui-button'
    const classes = [base, `ui-button--${variant}`, `ui-button--${size}`, className].filter(Boolean).join(' ')

    return (
      <button ref={ref} className={classes} disabled={disabled || isLoading} {...props}>
        {isLoading ? <span className="ui-spinner" /> : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

// --- CARD ---
export function Card({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`ui-card ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`ui-card-header ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className = '', children, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return (
    <h3 className={`ui-card-title ${className}`} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({ className = '', children, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return (
    <p className={`ui-card-description ${className}`} {...props}>
      {children}
    </p>
  )
}

export function CardContent({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`ui-card-content ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`ui-card-footer ${className}`} {...props}>
      {children}
    </div>
  )
}

// --- BADGE ---
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info'
}

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps): React.JSX.Element {
  return (
    <span className={`ui-badge ui-badge--${variant} ${className}`} {...props}>
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
        <div className="ui-input-wrapper">
          <span className="ui-input-icon">{icon}</span>
          <input ref={ref} className={`ui-input ui-input--has-icon ${className}`} {...props} />
        </div>
      )
    }
    return <input ref={ref} className={`ui-input ${className}`} {...props} />
  }
)
Input.displayName = 'Input'

// --- SELECT ---
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div className="ui-select-wrapper">
        <select ref={ref} className={`ui-select ${className}`} {...props}>
          {children}
        </select>
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
    <label className={`ui-switch-container ${className}`}>
      <div className="ui-switch-track-wrapper">
        <input
          type="checkbox"
          className="ui-switch-input"
          checked={checked}
          onChange={onChange}
          {...props}
        />
        <span className="ui-switch-track">
          <span className="ui-switch-thumb" />
        </span>
      </div>
      {(label || description) && (
        <div className="ui-switch-label-group">
          {label && <span className="ui-switch-label">{label}</span>}
          {description && <span className="ui-switch-description">{description}</span>}
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
  color?: string
}

export function Progress({ value, max = 100, className = '' }: ProgressProps): React.JSX.Element {
  const percent = Math.min(100, Math.max(0, Math.round((value / max) * 100)))
  return (
    <div className={`ui-progress ${className}`}>
      <div className="ui-progress-bar" style={{ width: `${percent}%` }} />
    </div>
  )
}

// --- TABLE ---
export function Table({ className = '', children, ...props }: React.TableHTMLAttributes<HTMLTableElement>): React.JSX.Element {
  return (
    <div className="ui-table-container">
      <table className={`ui-table ${className}`} {...props}>
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return (
    <thead className={`ui-table-header ${className}`} {...props}>
      {children}
    </thead>
  )
}

export function TableBody({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return (
    <tbody className={`ui-table-body ${className}`} {...props}>
      {children}
    </tbody>
  )
}

export function TableRow({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableRowElement>): React.JSX.Element {
  return (
    <tr className={`ui-table-row ${className}`} {...props}>
      {children}
    </tr>
  )
}

export function TableHead({ className = '', children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <th className={`ui-table-head ${className}`} {...props}>
      {children}
    </th>
  )
}

export function TableCell({ className = '', children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <td className={`ui-table-cell ${className}`} {...props}>
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
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastState[]; onDismiss: (id: string) => void }): React.JSX.Element {
  return (
    <div className="ui-toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`ui-toast ui-toast--${toast.type || 'info'}`}>
          <div className="ui-toast-content">
            <h4 className="ui-toast-title">{toast.title}</h4>
            {toast.description && <p className="ui-toast-desc">{toast.description}</p>}
          </div>
          <button className="ui-toast-close" onClick={() => onDismiss(toast.id)}>
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
