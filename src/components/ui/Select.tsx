import { cn } from '@/lib/utils'

interface OptionItem  { value: string; label: string }
interface OptionGroup { group: string; options: OptionItem[] }

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options?: OptionItem[]
  groups?: OptionGroup[]
}

export function Select({ label, error, hint, options, groups, className, id, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={cn(
          'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm',
          'bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
          'disabled:bg-gray-50 disabled:text-gray-500',
          error && 'border-red-400',
          className,
        )}
        {...props}
      >
        {groups
          ? groups.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            ))
          : options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))
        }
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
