import { useEffect, useRef, useState } from 'react'

export default function AnimatedStatistic({ value, suffix = '', label, format }) {
  const elementRef = useRef(null)
  const hasStartedRef = useRef(false)
  const hasCompletedRef = useRef(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return undefined

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frameId
    let observer
    let isMounted = true

    function startCount() {
      if (hasStartedRef.current) return
      hasStartedRef.current = true

      if (motionPreference.matches) {
        hasCompletedRef.current = true
        setCount(value)
        return
      }

      const duration = 1800
      const startTime = performance.now()

      function updateCount(now) {
        const progress = Math.min((now - startTime) / duration, 1)
        const easedProgress = progress * progress * (3 - (2 * progress))
        if (isMounted) {
          setCount(progress === 1 ? value : Math.floor(value * easedProgress))
          if (progress === 1) hasCompletedRef.current = true
        }
        if (progress < 1) frameId = requestAnimationFrame(updateCount)
      }

      frameId = requestAnimationFrame(updateCount)
    }

    if (!('IntersectionObserver' in window)) {
      startCount()
      return () => {
        isMounted = false
        if (!hasCompletedRef.current) hasStartedRef.current = false
        cancelAnimationFrame(frameId)
      }
    }

    observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        startCount()
        observer.unobserve(element)
      }
    }, { threshold: 0.45 })

    observer.observe(element)
    return () => {
      isMounted = false
      if (!hasCompletedRef.current) hasStartedRef.current = false
      observer.disconnect()
      cancelAnimationFrame(frameId)
    }
  }, [value])

  const displayValue = format ? format(count) : count.toLocaleString()

  return (
    <div ref={elementRef}>
      <strong aria-label={`${format ? format(value) : value.toLocaleString()}${suffix}`}>
        {displayValue}<span>{suffix}</span>
      </strong>
      <small>{label}</small>
    </div>
  )
}
