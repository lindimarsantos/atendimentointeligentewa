'use client'

import { cn } from '@/lib/utils'

interface SliderProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  hint?: string
  formatValue?: (v: number) => string
  disabled?: boolean
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  label,
  hint,
  formatValue,
  disabled,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <span className="text-sm font-semibold text-brand-600">
            {formatValue ? formatValue(value) : value}
          </span>
        </div>
      )}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={cn(
            'w-full h-2 appearance-none rounded-full bg-gray-200 cursor-pointer',
            'accent-brand-600 disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          style={{
            background: `linear-gradient(to right, #0284c7 ${pct}%, #e5e7eb ${pct}%)`,
          }}
        />
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
