import type { ReactNode } from 'react'

export function Card({
  title,
  sub,
  headRight,
  children,
  pad,
  className = '',
}: {
  title: ReactNode
  sub?: ReactNode
  headRight?: ReactNode
  children?: ReactNode
  pad?: boolean
  className?: string
}) {
  return (
    <div className={`card ${className}`}>
      <div className="card-head">
        <div>
          <div className="card-title">{title}</div>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        {headRight}
      </div>
      <div className={`card-body${pad ? ' pad' : ''}`}>{children}</div>
    </div>
  )
}

export function Row({
  label,
  hint,
  ctl,
  last,
}: {
  label: ReactNode
  hint?: ReactNode
  ctl: ReactNode
  last?: boolean
}) {
  return (
    <div className={`row${last ? ' last' : ''}`}>
      <div className="row-text">
        <div className="row-label">{label}</div>
        {hint && <div className="row-hint">{hint}</div>}
      </div>
      <div className="row-ctl">{ctl}</div>
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      className="switch"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  )
}

export function Segmented({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ val: string; label: ReactNode; disabled?: boolean }>
  label?: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.val}
          type="button"
          className={String(value).toLowerCase() === o.val ? 'on' : ''}
          data-val={o.val}
          disabled={o.disabled}
          onClick={() => !o.disabled && onChange(o.val)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Swatches({
  value,
  onChange,
  colors,
  label,
}: {
  value: string
  onChange: (v: string) => void
  colors: Array<{ color: string; label: string }>
  label?: string
}) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button
          key={c.color}
          className={`swatch${value.toLowerCase() === c.color.toLowerCase() ? ' on' : ''}`}
          type="button"
          style={{ background: c.color }}
          aria-label={c.label}
          onClick={() => onChange(c.color)}
        />
      ))}
    </div>
  )
}

export function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return <input className="color-input" type="color" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
}

export function SliderRow({
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  unit: string
}) {
  return (
    <>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
      <span className="range-val">
        {value}
        {unit}
      </span>
    </>
  )
}

export function Btn({
  children,
  onClick,
  variant,
  className = '',
  disabled,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary'
  className?: string
  disabled?: boolean
  title?: string
}) {
  return (
    <button className={`btn${variant === 'primary' ? ' primary' : ''} ${className}`} type="button" onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}

