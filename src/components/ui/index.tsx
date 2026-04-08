'use client'
import React from 'react'

import { clsx } from 'clsx'
import { forwardRef, useEffect, useState } from 'react'

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({
  children,
  className,
  padding = true,
}: {
  children: React.ReactNode
  className?: string
  padding?: boolean
}) {
  return (
    <div
      className={clsx(
        'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl',
        padding && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
      <div>
        <h3 className="text-sm font-medium text-[var(--color-text)]">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--color-text-2)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

export function MetricCard({
  label,
  value,
  sub,
  subVariant = 'neutral',
}: {
  label: string
  value: string | number
  sub?: string
  subVariant?: 'neutral' | 'up' | 'down'
}) {
  const subColor = {
    neutral: 'text-[var(--color-text-2)]',
    up:      'text-[var(--color-success-fg)]',
    down:    'text-[var(--color-danger-fg)]',
  }[subVariant]

  return (
    <div className="bg-[var(--color-surface-2)] rounded-lg p-3.5">
      <p className="text-[11px] font-medium text-[var(--color-text-2)] mb-1">{label}</p>
      <p className="text-2xl font-medium leading-none text-[var(--color-text)]">{value}</p>
      {sub && <p className={clsx('text-[10px] mt-1', subColor)}>{sub}</p>}
    </div>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'

const btnStyles: Record<BtnVariant, string> = {
  primary:   'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] border-transparent',
  secondary: 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border-md)] hover:bg-[var(--color-surface-2)]',
  danger:    'bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] border-transparent hover:opacity-90',
  success:   'bg-[var(--color-success-bg)] text-[var(--color-success-fg)] border-transparent hover:opacity-90',
  ghost:     'bg-transparent text-[var(--color-text-2)] border-transparent hover:bg-[var(--color-surface-2)]',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: 'sm' | 'md'
  loading?: boolean
  children: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium border rounded-lg cursor-pointer transition-all duration-100',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        size === 'sm' ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3 py-1.5',
        btnStyles[variant],
        className,
      )}
      {...props}
    >
      {loading && <span className="spin w-3 h-3 border-2 border-current border-t-transparent rounded-full flex-shrink-0" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

// ─── Avatar ───────────────────────────────────────────────────────────────────

export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const ini = name === 'Desconhecido' ? '??'
    : name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const sz = { sm: 'w-6 h-6 text-[9px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm' }[size]
  return (
    <div className={clsx('rounded-full bg-[var(--color-brand)] flex items-center justify-center font-medium text-white flex-shrink-0', sz)}>
      {ini}
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={clsx('spin inline-block w-4 h-4 border-2 border-[var(--color-border-md)] border-t-[var(--color-brand)] rounded-full', className)} />
  )
}

// ─── Loading row ──────────────────────────────────────────────────────────────

export function LoadingRow({ text = 'Carregando...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 p-4 text-xs text-[var(--color-text-2)]">
      <Spinner className="w-3 h-3" /> {text}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-8 text-xs text-[var(--color-text-2)]">{text}</div>
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export type ToastMsg = { text: string; type: 'ok' | 'err' } | null

export function Toast({ msg }: { msg: ToastMsg }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!msg) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(t)
  }, [msg])

  if (!msg || !visible) return null

  return (
    <div
      className={clsx(
        'fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg text-xs font-medium text-white shadow-lg animate-in',
        msg.type === 'ok' ? 'bg-[#27500A]' : 'bg-[#791F1F]',
      )}
    >
      {msg.text}
    </div>
  )
}

// ─── Input / Textarea / Select ────────────────────────────────────────────────

const inputBase =
  'w-full px-2.5 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-border-md)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[var(--color-brand)] transition-colors'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={clsx(inputBase, className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={clsx(inputBase, 'resize-y min-h-[72px]', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={clsx(inputBase, 'cursor-pointer', className)} {...props} />
  ),
)
Select.displayName = 'Select'

// ─── Table ────────────────────────────────────────────────────────────────────

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  )
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[11px] font-medium text-[var(--color-text-2)] px-2 pb-2 border-b border-[var(--color-border)] whitespace-nowrap">
      {children}
    </th>
  )
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={clsx('px-2 py-2 border-b border-[var(--color-border)] align-middle', className)}>
      {children}
    </td>
  )
}

export function Tr({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={clsx(
        'last:[&>td]:border-0',
        onClick && 'cursor-pointer hover:[&>td]:bg-[var(--color-surface-2)]',
      )}
    >
      {children}
    </tr>
  )
}

// ─── Collapsible panel ────────────────────────────────────────────────────────

export function ActionPanel({
  open,
  title,
  children,
}: {
  open: boolean
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="bg-[var(--color-surface-2)] rounded-lg p-3.5 mb-3 animate-in">
      <p className="text-xs font-medium mb-3 text-[var(--color-text)]">{title}</p>
      {children}
    </div>
  )
}
