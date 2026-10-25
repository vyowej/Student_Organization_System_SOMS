/**
 * Public Marketing & Landing Layout
 *
 * Wraps the public landing page with a sticky navigation bar, smooth hash
 * scrolling, and IntersectionObserver-based active section highlighting.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import WmsuLogo from '../ui/WmsuLogo.jsx'
import { useAuth } from '../../context/useAuth.js'
import { dashboardByRole } from '../../data/mockAuthUsers.js'

const publicLinks = [
  { label: 'Home', to: '/' },
  { label: 'Organizations', to: '/#organizations' },
  { label: 'Events', to: '/#events' },
  { label: 'About', to: '/#about' },
]

function getStableDocumentTop(element) {
  const reveal = element.closest('.reveal')
  const transform = reveal ? getComputedStyle(reveal).transform : 'none'
  const translateY = transform !== 'none' && window.DOMMatrixReadOnly
    ? new window.DOMMatrixReadOnly(transform).m42
    : 0
  return element.getBoundingClientRect().top + window.scrollY - translateY
}

export default function PublicLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [openMenuLocation, setOpenMenuLocation] = useState(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const navbarRef = useRef(null)

  const hasOfficerWorkspace = Boolean(
    currentUser?.organizationWorkspaceId ||
    currentUser?.organizationId ||
    currentUser?.activeMemberships?.length ||
    currentUser?.organizationRoles?.length
  )
  const userDashboard = currentUser?.role === 'OFFICER' && !hasOfficerWorkspace
    ? '/student/dashboard'
    : (dashboardByRole[currentUser?.role] || '/student/dashboard')
  const pendingAnchorRef = useRef('')
  const locationKey = `${location.pathname}${location.hash}`
  const menuOpen = openMenuLocation === locationKey

  useEffect(() => {
    if (!menuOpen) return undefined

    function handlePointerDown(event) {
      if (!navbarRef.current?.contains(event.target)) setOpenMenuLocation(null)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpenMenuLocation(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  useEffect(() => {
    const navbar = navbarRef.current
    if (!navbar) return undefined
    const updateNavbarHeight = () => {
      document.documentElement.style.setProperty('--nav-h', `${navbar.getBoundingClientRect().height}px`)
    }
    updateNavbarHeight()
    const observer = new ResizeObserver(updateNavbarHeight)
    observer.observe(navbar)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (location.pathname !== '/') return undefined
    let cancelled = false
    let frameOne = 0
    let frameTwo = 0
    pendingAnchorRef.current = location.hash.slice(1)
    const scrollToTarget = async () => {
      if (document.fonts?.ready) await document.fonts.ready
      if (cancelled) return
      frameOne = window.requestAnimationFrame(() => {
        frameTwo = window.requestAnimationFrame(() => {
          if (cancelled) return
          if (!location.hash) {
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return
          }
          const targetId = decodeURIComponent(location.hash.slice(1))
          const target = document.getElementById(targetId)
          if (!target) return
          const heading = target.matches('h1, h2, h3')
            ? target
            : target.querySelector('.landing-section-title h2, h1, h2')
          const top = getStableDocumentTop(heading ?? target)
          const navHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72
          window.scrollTo({ top: Math.max(0, top - navHeight - 20), behavior: 'smooth' })
        })
      })
    }
    void scrollToTarget()
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frameOne)
      window.cancelAnimationFrame(frameTwo)
    }
  }, [location.hash, location.pathname, location.search])

  function handlePublicLink(event, item, sectionId) {
    event.preventDefault()
    setOpenMenuLocation(null)
    if (item.to === '/') {
      pendingAnchorRef.current = ''
      if (location.pathname !== '/' || location.hash) navigate('/')
      else window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    pendingAnchorRef.current = sectionId
    if (location.pathname === '/' && location.hash === `#${sectionId}`) {
      const target = document.getElementById(sectionId)
      const heading = target?.querySelector('.landing-section-title h2, h1, h2')
      const navHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72
      if (heading) {
        const top = getStableDocumentTop(heading)
        window.scrollTo({ top: Math.max(0, top - navHeight - 20), behavior: 'smooth' })
      }
      return
    }
    navigate(item.to)
  }

  useEffect(() => {
    function updateScrollState() {
      setIsScrolled(window.scrollY > 8)
      const navHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72
      const sections = [...document.querySelectorAll('#organizations, #events, #about')]
      const activeSectionElement = sections
        .filter((section) => {
          const heading = section.querySelector('.landing-section-title h2, h1, h2')
          return heading && heading.getBoundingClientRect().top <= navHeight + 28
        })
        .at(-1)
      const activeId = activeSectionElement?.id ?? ''
      setActiveSection(activeId)
      const nextHash = activeId ? `#${activeId}` : ''
      if (!activeId && window.scrollY < 100 && pendingAnchorRef.current === window.location.hash.slice(1)) return
      if (activeId) pendingAnchorRef.current = ''
      if (window.location.hash !== nextHash) {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${nextHash}`)
      }
    }

    updateScrollState()
    window.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    const sections = document.querySelectorAll('#organizations, #events, #about')
    if (!('IntersectionObserver' in window) || sections.length === 0) {
      return () => {
        window.removeEventListener('scroll', updateScrollState)
        window.removeEventListener('resize', updateScrollState)
      }
    }

    const observer = new IntersectionObserver(
      () => updateScrollState(),
      { rootMargin: '-18% 0px -68% 0px', threshold: [0, 0.15, 0.35, 0.6] },
    )
    sections.forEach((section) => observer.observe(section))

    return () => {
      window.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
      observer.disconnect()
    }
  }, [location.hash, location.pathname])

  return (
    <div className="app-shell public-page">
      <header className={`public-navbar${isScrolled ? ' is-scrolled' : ''}`} ref={navbarRef}>
        <Link aria-label="UNIDOS home" className="public-brand" to="/">
          <WmsuLogo className="brand-seal" />
          <span className="public-brand-copy">
            <strong>UNIDOS</strong>
            <span>STUDENT ORGANIZATION MANAGEMENT SYSTEM</span>
          </span>
        </Link>
        <button
          aria-expanded={menuOpen}
          aria-controls="public-navigation"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="public-menu-toggle"
          onClick={() => setOpenMenuLocation(menuOpen ? null : locationKey)}
          type="button"
        >
          <svg aria-hidden="true" className="menu-toggle-icon" viewBox="0 0 24 24">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <nav aria-label="Main navigation" className={`public-links${menuOpen ? ' public-links-open' : ''}`} id="public-navigation">
          {publicLinks.map((item, index) => {
            const sectionId = item.to.split('#')[1]
            const isHome = !sectionId && index === 0 && location.pathname === '/' && !location.hash && !activeSection
            const isActive = sectionId ? activeSection === sectionId : isHome

            return (
              <Link
                aria-current={isActive ? 'location' : undefined}
                className={isActive ? 'active' : ''}
                key={item.label}
                onClick={(event) => handlePublicLink(event, item, sectionId)}
                to={item.to}
              >
                {item.label}
              </Link>
            )
          })}
          {currentUser ? (
            <Link
              className="button button-primary public-get-started"
              onClick={() => setOpenMenuLocation(null)}
              to={userDashboard}
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link className="public-sign-in" onClick={() => setOpenMenuLocation(null)} to="/login">Sign in</Link>
              <Link className="button button-primary public-get-started" onClick={() => setOpenMenuLocation(null)} to="/register">Get Started</Link>
            </>
          )}
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
    </div>
  )
}
