import { clsx } from 'clsx'

type Variant = 'bot' | 'open' | 'human' | 'success' | 'muted' | 'purple'

interface BadgeProps {
  label: string
  variant?: Variant
  className?: string
}

const styles: Record<Variant, string> = {
  bot:     'bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]',
  open:    'bg-[var(--color-info-bg)]    text-[var(--color-info-fg)]',
  human:   'bg-[var(--color-danger-bg)]  text-[var(--color-danger-fg)]',
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success-fg)]',
  muted:   'bg-[var(--color-surface-2)]  text-[var(--color-text-2)]',
  purple:  'bg-[var(--color-purple-bg)]  text-[var(--color-purple-fg)]',
}

export function Badge({ label, variant = 'muted', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
        styles[variant],
        className,
      )}
    >
      {label}
    </span>
  )
}
