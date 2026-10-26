import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../ui/Badge.jsx'
import Icon from '../ui/Icon.jsx'

export function AnimatedStatistic({ value, suffix = '', label, format }) {
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
        const easedProgress = progress * progress * (3 - 2 * progress)
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

export function Reveal({ as: Element = 'div', className = '', children, ...props }) {
  const elementRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return undefined

    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800
    if (rect.top <= viewportHeight + 150) {
      setVisible(true)
    }

    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return undefined
    }

    const timer = setTimeout(() => {
      setVisible(true)
    }, 600)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          clearTimeout(timer)
          observer.unobserve(element)
        }
      },
      { threshold: 0, rootMargin: '100px 0px 100px 0px' },
    )

    observer.observe(element)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  return (
    <Element
      className={`reveal${visible ? ' is-visible' : ''} ${className}`.trim()}
      ref={elementRef}
      {...props}
    >
      {children}
    </Element>
  )
}

export function LeaderCard({ leader }) {
  const initials =
    leader.initials ||
    String(leader.name || 'SL')
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('')

  return (
    <article className="leader-card">
      <div aria-hidden="true" className={`portrait-placeholder portrait-${leader.color || 'crimson'}`}>
        <span>{initials}</span>
        <i />
      </div>
      <div className="leader-copy">
        <h3>{leader.name}</h3>
        <p>{leader.position}</p>
        <span>{leader.organization}</span>
      </div>
    </article>
  )
}

export function OrganizationCard({ organization }) {
  const initials =
    organization.initials ||
    (organization.acronym || organization.name || 'ORG').slice(0, 3).toUpperCase()

  return (
    <article className="organization-card">
      <div aria-label={`${organization.acronym || organization.name} logo`} className={`organization-emblem emblem-${organization.color || 'crimson'}`} role="img">
        {organization.logo ? (
          <img
            alt={`${organization.acronym || organization.name} logo`}
            src={organization.logo}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
          />
        ) : (
          initials
        )}
      </div>
      <div className="organization-card-copy">
        <div className="organization-meta">
          <Badge tone="crimson">{organization.category}</Badge>
          <span className="organization-acronym">{organization.acronym}</span>
        </div>
        <h3>{organization.name}</h3>
        <p>{organization.description}</p>
      </div>
      <Link className="button button-secondary organization-view" to={`/student/organizations/${organization.id}`}>
        View Organization <Icon name="arrow-right" size={13} />
      </Link>
    </article>
  )
}

export function EventCard({ event }) {
  const badgeTone = event.status === 'Registration Open' || event.status === 'PUBLISHED'
    ? 'success'
    : event.status === 'Almost Full'
      ? 'warning'
      : 'neutral'

  const parsedDate = event.date ? new Date(event.date.includes('T') ? event.date : `${event.date}T00:00:00`) : null
  const isValidDate = parsedDate && !Number.isNaN(parsedDate.getTime())
  const month = isValidDate
    ? parsedDate.toLocaleDateString('en-US', { month: 'short' })
    : String(event.date || 'TBA').split(' ')[0]?.slice(0, 3) || 'TBA'
  const day = isValidDate
    ? String(parsedDate.getDate())
    : String(event.date || '').replace(',', '').split(' ')[1] || '—'

  return (
    <article className="event-card">
      <div aria-hidden="true" className={`event-date-art event-${event.color || 'crimson'}`}>
        <span>{month}</span>
        <strong>{day}</strong>
        <i aria-hidden="true" />
      </div>
      <div className="event-card-content">
        <div className="event-card-topline">
          <Badge tone={badgeTone}>{event.status === 'PUBLISHED' ? 'Registration Open' : event.status}</Badge>
        </div>
        <h3>{event.title}</h3>
        <p className="event-organization">{event.organization || event.organizationName}</p>
        <Badge className="event-category">{event.category}</Badge>
        <div className="event-details">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Icon name="clock" size={13} />
            {event.time || event.startTime || 'TBA'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Icon name="location" size={13} />
            {event.location}
          </span>
        </div>
        <Link className="event-view-link" to={`/student/events/${event.id}`}>
          View Event <Icon name="arrow-right" size={13} />
        </Link>
      </div>
    </article>
  )
}
