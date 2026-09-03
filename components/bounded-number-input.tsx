"use client"

import { useEffect, useState, type ComponentProps } from "react"

import { Input } from "@/components/ui/input"

type BoundedNumberInputProps = Omit<
  ComponentProps<typeof Input>,
  "inputMode" | "max" | "min" | "onChange" | "type" | "value"
> & {
  value: number
  min: number
  max: number
  onValueChange: (value: number) => void
}

function clampInteger(value: number, min: number, max: number) {
  const integer = Number.isFinite(value) ? Math.round(value) : min
  return Math.min(Math.max(integer, min), max)
}

export function BoundedNumberInput({
  value,
  min,
  max,
  onValueChange,
  onBlur,
  onKeyDown,
  ...props
}: BoundedNumberInputProps) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = () => {
    const parsed = draft.trim() === "" ? value : Number(draft)
    const nextValue = clampInteger(parsed, min, max)
    setDraft(String(nextValue))
    if (nextValue !== value) onValueChange(nextValue)
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        commit()
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          commit()
          event.currentTarget.blur()
        }
        onKeyDown?.(event)
      }}
    />
  )
}
