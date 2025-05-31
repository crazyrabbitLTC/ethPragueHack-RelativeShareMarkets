"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  value: number[]
  onValueChange: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  className?: string
  disabled?: boolean
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, value = [1], onValueChange, min = 0, max = 100, step = 1, disabled = false, ...props }, ref) => {
    const [isDragging, setIsDragging] = React.useState(false)
    const trackRef = React.useRef<HTMLDivElement>(null)
    
    const currentValue = value[0] || 0
    const percentage = ((currentValue - min) / (max - min)) * 100

    const handleMove = React.useCallback((clientX: number) => {
      if (!trackRef.current || disabled) return
      
      const rect = trackRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
      const newValue = min + (percentage / 100) * (max - min)
      
      // Round to step
      const steppedValue = Math.round(newValue / step) * step
      const clampedValue = Math.max(min, Math.min(max, steppedValue))
      
      onValueChange([clampedValue])
    }, [min, max, step, onValueChange, disabled])

    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
      if (disabled) return
      setIsDragging(true)
      handleMove(e.clientX)
    }, [disabled, handleMove])

    React.useEffect(() => {
      if (!isDragging) return

      const handleMouseMove = (e: MouseEvent) => {
        handleMove(e.clientX)
      }

      const handleMouseUp = () => {
        setIsDragging(false)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }, [isDragging, handleMove])

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className
        )}
        {...props}
      >
        <div
          ref={trackRef}
          className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary cursor-pointer"
          onMouseDown={handleMouseDown}
        >
          <div 
            className="absolute h-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div
          className="absolute h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          style={{ 
            left: `${percentage}%`,
            transform: 'translateX(-50%)'
          }}
          onMouseDown={handleMouseDown}
        />
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
