import { randomUUID } from 'crypto'

export function nowIso(): string {
  return new Date().toISOString()
}

export function createId(): string {
  return randomUUID()
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function sanitizeFileName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) {
    return ''
  }

  const text = String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}
