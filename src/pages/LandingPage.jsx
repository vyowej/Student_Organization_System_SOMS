import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon.jsx'
import WmsuLogo from '../components/ui/WmsuLogo.jsx'
import { AnimatedStatistic, EventCard, LeaderCard, OrganizationCard, Reveal } from '../components/public/LandingCards.jsx'
import { usePortalData } from '../context/usePortalData.js'
import { organizationCategories as defaultCategories } from '../data/studentEvents.js'

const defaultNotifications = [
  { type: 'Organizations', icon: 'organization', title: 'Organizations Directory', message: 'Browse accredited organizations across WMSU colleges.', time: 'live' },
  { type: 'Events', icon: 'calendar', title: 'Campus Events', message: 'Check upcoming activities and slot availability.', time: 'live' },
]

const defaultLandingEvents = [
  {
    id: 'wmsu-orientation-2026',
    title: 'University Organization Fair & General Assembly',
    organizationName: 'University Student Council',
    category: 'Student Council',
    date: 'December 15, 2026',
    endDatetime: '2027-12-15T17:00:00',
    time: '8:00 AM – 5:00 PM',
    location: 'WMSU Gymnasium',
    capacity: 250,
    registeredCount: 42,
    status: 'PUBLISHED',
    color: 'crimson',
  },
  {
    id: 'wmsu-hackathon-2026',
    title: 'WMSU Innovators & Builders Hackathon',
    organizationName: 'Computer Science Society',
    category: 'Technology',
    date: 'December 20, 2026',
    endDatetime: '2027-12-20T18:00:00',
    time: '9:00 AM – 6:00 PM',
    location: 'College of Computing Studies',
    capacity: 120,
    registeredCount: 38,
    status: 'PUBLISHED',
    color: 'blue',
  },
  {
    id: 'leadership-summit-2026',
    title: 'Campus Officers & Advisers Governance Summit',
    organizationName: 'Student Affairs & Services Division',
    category: 'Leadership',
    date: 'January 12, 2027',
    endDatetime: '2027-12-22T17:00:00',
    time: '1:00 PM – 5:00 PM',
    location: 'University Social Hall',
    capacity: 180,
    registeredCount: 64,
    status: 'PUBLISHED',
    color: 'gold',
  },
  {
    id: 'cultural-fest-2026',
    title: 'Grand Cultural & Arts Showcase',
    organizationName: 'WMSU Cultural Ensemble',
    category: 'Cultural',
    date: 'January 24, 2027',
    endDatetime: '2027-12-28T20:30:00',
    time: '4:00 PM – 8:30 PM',
    location: 'Open Grounds & Amphitheater',
    capacity: 300,
    registeredCount: 95,
    status: 'PUBLISHED',
    color: 'emerald',
  },
]

const defaultCommunityUpdates = [
  {
    label: 'Campus Directory',
    title: 'Accredited organizations across all WMSU colleges are active in the UNIDOS directory.',
    link: '/organizations',
  },
  {
    label: 'Governance & Compliance',
    title: 'Faculty advisers and officers coordinate proposals, compliance files, and reports in one workspace.',
    link: '/organizations',
  },
  {
    label: 'Upcoming Activities',
    title: 'Explore university-wide, college, and departmental events with live participant capacity tracking.',
    link: '/events',
  },
  {
    label: 'Leadership Hierarchy',
    title: 'Structured executive and committee roles empower accountable student leadership.',
    link: '/organizations',
  },
]

function SectionTitle({ eyebrow, title, description, action, id }) {
  const titleWords = title.split(' ')
  const accent = titleWords.pop()

  return (
    <div className="landing-section-title">
      <div>
        <span className="landing-eyebrow">{eyebrow}</span>
        <h2 id={id}>{titleWords.join(' ')} <em>{accent}</em></h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

function HeroSearch() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const inputRef = useRef(null)

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      navigate(`/organizations?q=${encodeURIComponent(trimmed)}`)
    } else {
      navigate('/organizations')
    }
  }

  return (
    <form
      aria-label="Search organizations"
      className="hero-search"
      onSubmit={handleSubmit}
      role="search"
    >
      <span className="hero-search-inner">
        <span aria-hidden="true" className="hero-search-icon">
          <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" x2="16.65" y1="21" y2="16.65" />
          </svg>
        </span>
        <input
          ref={inputRef}
          aria-label="Search organizations"
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search organizations by name, acronym, or college..."
          type="search"
          value={query}
        />
      </span>
      <button className="button button-primary" type="submit">
        Search
      </button>
    </form>
  )
}

function LiveStatCards({ activeOrgs, publishedEvents, loading }) {
  const orgValue = `${activeOrgs}`
  const orgLabel = activeOrgs === 1 ? 'Active Organization' : 'Active Organizations'
  const evtValue = `${publishedEvents}`
  const evtLabel = `Published Event${publishedEvents !== 1 ? 's' : ''}`

  return (
    <>
      <div className={`hero-float-card float-organizations${loading ? ' is-loading' : ''}`}>
        <span className="float-icon">
          <Icon name="organization" size={16} />
        </span>
        <span>
          <span className="float-stat-skeleton">
            <span className="skeleton-line float-skeleton-value skeleton" />
            <span className="skeleton-line float-skeleton-label skeleton" />
          </span>
          {!loading && <strong className="float-stat-value">{orgValue}</strong>}
          {!loading && <small className="float-stat-label">{orgLabel}</small>}
        </span>
      </div>

      <div className={`hero-float-card float-events${loading ? ' is-loading' : ''}`}>
        <span className="float-icon">
          <Icon name="calendar" size={16} />
        </span>
        <span>
          <span className="float-stat-skeleton">
            <span className="skeleton-line float-skeleton-value skeleton" />
            <span className="skeleton-line float-skeleton-label skeleton" />
          </span>
          {!loading && <strong className="float-stat-value">{evtValue}</strong>}
          {!loading && <small className="float-stat-label">{evtLabel}</small>}
        </span>
      </div>
    </>
  )
}

function MobileHeroStats({ activeOrganizations, publishedEvents }) {
  return (
    <div aria-label="Campus community at a glance" className="hero-mobile-stats">
      <div>
        <strong>{activeOrganizations}</strong>
        <span>{activeOrganizations === 1 ? 'Active Organization' : 'Active Organizations'}</span>
      </div>
      <div>
        <strong>{publishedEvents}</strong>
        <span>{publishedEvents === 1 ? 'Published Event' : 'Published Events'}</span>
      </div>
    </div>
  )
}

function LandingPage() {
  const {
    loading,
    studentOrganizations = [],
    officerEvents = [],
    officerMembers = [],
    officerAnnouncements = [],
    academicColleges = [],
    advisers = [],
    adminSettings,
  } = usePortalData()

  const [activeCategory, setActiveCategory] = useState('All')
  const [showAllOrgs, setShowAllOrgs] = useState(false)
  const [notificationIndex, setNotificationIndex] = useState(0)
  const [apiCategories, setApiCategories] = useState([])
  const heroArtRef = useRef(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/settings/categories')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data && Array.isArray(data.categories)) {
          setApiCategories(data.categories)
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const organizationCategories = useMemo(() => {
    const fromApi = apiCategories.filter((c) => c !== 'All')
    const fromSettings = (adminSettings?.organizationCategories || []).filter((c) => c !== 'All')
    const preferred = fromApi.length > 0 ? fromApi : fromSettings
    const sourceList = preferred.length > 0 ? preferred : defaultCategories.filter((c) => c !== 'All')
    const fromOrgs = studentOrganizations.map((o) => o.category).filter(Boolean)
    const combined = ['All', ...sourceList, ...fromOrgs]
    return [...new Set(combined)]
  }, [apiCategories, adminSettings?.organizationCategories, studentOrganizations])

  const publishedEvents = useMemo(
    () => officerEvents.filter((event) => ['PUBLISHED', 'APPROVED'].includes(event.status)),
    [officerEvents],
  )

  const displayEvents = useMemo(
    () => (publishedEvents.length > 0 ? publishedEvents.slice(0, 6) : defaultLandingEvents),
    [publishedEvents],
  )

  const activeOfficersList = useMemo(
    () => officerMembers.filter((m) => m.status === 'ACTIVE'),
    [officerMembers],
  )

  const studentLeaders = useMemo(
    () =>
      activeOfficersList
        .filter((m) => m.position && m.rawPosition !== 'MEMBER')
        .slice(0, 6)
        .map((m, idx) => ({
          name: m.name,
          position: `${m.position}${m.committee ? ` · ${m.committee}` : ''}`,
          organization: m.organizationName,
          color: ['crimson', 'gold', 'emerald', 'blue'][idx % 4],
        })),
    [activeOfficersList],
  )

  const communityUpdates = useMemo(() => {
    if (officerAnnouncements.length > 0) {
      return officerAnnouncements.slice(0, 4).map((ann) => ({
        label: ann.organizationName || 'Announcement',
        title: ann.title,
        link: ann.organizationId ? `/organizations/${ann.organizationId}` : '/organizations',
      }))
    }
    return defaultCommunityUpdates
  }, [officerAnnouncements])

  const campusLeaderboard = useMemo(
    () =>
      [...studentOrganizations]
        .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
        .slice(0, 5)
        .map((org, idx) => ({
          id: org.id,
          rank: idx + 1,
          name: org.name,
          detail: `${org.category} · ${org.college}`,
          score: `${org.memberCount || 0} active officers`,
        })),
    [studentOrganizations],
  )

  const heroNotifications = useMemo(() => {
    const items = []
    if (studentOrganizations[0]) {
      items.push({
        type: 'Organizations',
        icon: 'organization',
        title: `${studentOrganizations.length} Active Organizations`,
        message: `${studentOrganizations[0].name} and ${Math.max(studentOrganizations.length - 1, 0)} more on UNIDOS.`,
        time: 'live',
      })
    }
    if (publishedEvents[0]) {
      items.push({
        type: 'Events',
        icon: 'calendar',
        title: publishedEvents[0].title,
        message: `${publishedEvents[0].organizationName} · ${publishedEvents[0].date}`,
        time: 'upcoming',
      })
    }
    if (officerAnnouncements[0]) {
      items.push({
        type: 'Announcements',
        icon: 'announcement',
        title: officerAnnouncements[0].title,
        message: officerAnnouncements[0].organizationName || 'Campus update',
        time: 'recent',
      })
    }
    return items.length >= 2 ? items : defaultNotifications
  }, [studentOrganizations, publishedEvents, officerAnnouncements])

  const filteredOrganizations = activeCategory === 'All'
    ? studentOrganizations
    : studentOrganizations.filter(
      (organization) => String(organization.category || '').trim().toLowerCase() === activeCategory.trim().toLowerCase(),
    )

  const displayedOrganizations = useMemo(() => {
    if (activeCategory === 'All' && !showAllOrgs && filteredOrganizations.length > 12) {
      return filteredOrganizations.slice(0, 12)
    }
    return filteredOrganizations
  }, [activeCategory, showAllOrgs, filteredOrganizations])

  const activeOrgCount = studentOrganizations.length
  const collegeCount = academicColleges.length || 17
  const adviserCount = advisers.length || activeOrgCount

  useEffect(() => {
    const stage = heroArtRef.current
    if (!stage) return undefined
    let frameId = 0
    let visible = true
    let active = true
    let targetX = 0
    let targetY = 0

    const updateActiveState = () => {
      const running = visible && !document.hidden
      stage.classList.toggle('is-running', running)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      updateActiveState()
    })
    observer.observe(stage)
    const onVisibilityChange = () => updateActiveState()
    document.addEventListener('visibilitychange', onVisibilityChange)
    const welcomeText = stage.querySelector('.mock-welcome strong')
    const markWelcomeTyped = () => stage.classList.add('has-typed')
    welcomeText?.addEventListener('animationend', markWelcomeTyped)

    const onPointerMove = (event) => {
      if (window.matchMedia('(hover: none), (prefers-reduced-motion: reduce)').matches) return
      const bounds = stage.getBoundingClientRect()
      targetX = ((event.clientX - bounds.left) / bounds.width - .5) * 12
      targetY = ((event.clientY - bounds.top) / bounds.height - .5) * -12
      if (frameId) return
      const animateTilt = () => {
        const currentX = Number(stage.dataset.tiltX || 0)
        const currentY = Number(stage.dataset.tiltY || 0)
        const nextX = currentX + (targetX - currentX) * .12
        const nextY = currentY + (targetY - currentY) * .12
        stage.dataset.tiltX = String(nextX)
        stage.dataset.tiltY = String(nextY)
        stage.style.setProperty('--tilt-x', `${nextX}deg`)
        stage.style.setProperty('--tilt-y', `${nextY}deg`)
        if (Math.abs(targetX - nextX) + Math.abs(targetY - nextY) > .05) {
          frameId = requestAnimationFrame(animateTilt)
        } else {
          frameId = 0
        }
      }
      frameId = requestAnimationFrame(animateTilt)
    }
    const onPointerLeave = () => {
      targetX = 0
      targetY = 0
      onPointerMove({ clientX: stage.getBoundingClientRect().left + stage.offsetWidth / 2, clientY: stage.getBoundingClientRect().top + stage.offsetHeight / 2 })
    }
    stage.addEventListener('pointermove', onPointerMove)
    stage.addEventListener('pointerleave', onPointerLeave)
    const interval = window.setInterval(() => {
      if (active && visible && !document.hidden) setNotificationIndex((index) => (index + 1) % heroNotifications.length)
    }, 4200)

    updateActiveState()
    return () => {
      active = false
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      welcomeText?.removeEventListener('animationend', markWelcomeTyped)
      stage.removeEventListener('pointermove', onPointerMove)
      stage.removeEventListener('pointerleave', onPointerLeave)
      window.clearInterval(interval)
      cancelAnimationFrame(frameId)
    }
  }, [heroNotifications.length])

  const primaryNotif = heroNotifications[notificationIndex % heroNotifications.length]
  const secondaryNotif = heroNotifications[(notificationIndex + 1) % heroNotifications.length]

  return (
    <div className="landing-page">
      <section aria-labelledby="hero-title" className="landing-hero">
        <div className="hero-copy">
          <span className="hero-kicker"><i /> YOUR CAMPUS, YOUR COMMUNITY</span>
          <h1 id="hero-title">
            Discover Your
            <span className="hero-title-accent">Campus Organizations</span>
            <span className="hero-title-ending">with UNIDOS.</span>
          </h1>
          <p className="hero-tagline">Lead. Collaborate. Make an Impact.</p>
          <p className="hero-description">
            UNIDOS connects accredited WMSU organizations, officers, and faculty advisers in one
            unified hub for campus events, compliance governance, and leadership collaboration.
          </p>

          <HeroSearch />

          <div className="hero-actions">
            <Link className="button button-primary" to="/organizations">
              Explore Organization <Icon name="arrow-right" size={14} />
            </Link>
            <Link className="button button-secondary" to="/events" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="event" size={16} /> Upcoming Events
            </Link>
          </div>
          <div className="hero-social-proof">
            <div className="mini-avatars" aria-hidden="true"><span>UN</span><span>ID</span><span>OS</span><span>+</span></div>
            <span>
              <strong>{activeOrgCount} active {activeOrgCount === 1 ? 'organization' : 'organizations'}</strong> across {collegeCount} WMSU colleges.
            </span>
          </div>
          <MobileHeroStats
            activeOrganizations={activeOrgCount}
            publishedEvents={publishedEvents.length}
          />
        </div>

        <div aria-hidden="true" className="hero-art" ref={heroArtRef}>
          <div aria-hidden="true" className="hero-dot-grid" />
          <div aria-hidden="true" className="hero-gold-arc" />
          <div aria-hidden="true" className="hero-device-circle" />
          <div aria-hidden="true" className="hero-laptop">
            <div className="hero-laptop-screen">
              <div className="mock-dashboard">
                <div className="mock-dashboard-top"><WmsuLogo className="mock-logo" /><span>UNIDOS</span><i /></div>
                <div className="mock-welcome"><small>CAMPUS GOVERNANCE HUB</small><strong>Welcome back!</strong></div>
                <div className="mock-metrics">
                  <span><b>{activeOrgCount}</b><small>Active Orgs</small></span>
                  <span><b>{publishedEvents.length}</b><small>Events</small></span>
                  <span><b>{adviserCount}</b><small>Advisers</small></span>
                </div>
                <div className="mock-dashboard-content">
                  <div className="mock-org-list"><b>Accredited Orgs</b><i /><i /><i /></div>
                  <div className="mock-event-card">
                    <span>UPCOMING EVENT</span>
                    <b>{publishedEvents[0]?.title || displayEvents[0]?.title || 'Campus Activity'}</b>
                    <i /><i />
                  </div>
                </div>
              </div>
            </div>
            <div className="hero-laptop-base" />
          </div>
          <div aria-hidden="true" className="hero-phone">
            <div className="hero-phone-screen">
              <div className="mock-phone-status"><span>9:41</span><i /></div>
              <div className="mock-phone-header"><WmsuLogo className="mock-logo" /><b>UNIDOS</b><i>•••</i></div>
              <div className="mock-org-cover">
                <span>{(studentOrganizations[0]?.acronym || 'UNIDOS').toUpperCase()}</span>
              </div>
              <b className="mock-phone-title">{studentOrganizations[0]?.name || 'WMSU Organizations'}</b>
              <span className="mock-phone-caption">LEAD · BUILD · CONNECT</span>
              <div className="mock-phone-button">Explore Directory</div>
              <div className="mock-phone-line" /><div className="mock-phone-line short" />
            </div>
          </div>
          <div className="hero-notification hero-notification-primary">
            <span className="hero-notification-icon"><Icon name={primaryNotif.icon} size={17} /></span>
            <span className="hero-notification-copy">
              <strong>{primaryNotif.title}</strong>
              <span>{primaryNotif.message}</span>
            </span>
            <small>{primaryNotif.time}</small>
          </div>
          <div className="hero-notification hero-notification-secondary">
            <span className="hero-notification-icon"><Icon name={secondaryNotif.icon} size={17} /></span>
            <span className="hero-notification-copy">
              <strong>{secondaryNotif.title}</strong>
              <span>{secondaryNotif.message}</span>
            </span>
            <small>{secondaryNotif.time}</small>
          </div>
          <LiveStatCards
            activeOrgs={activeOrgCount}
            loading={loading}
            publishedEvents={publishedEvents.length}
          />
        </div>
      </section>

      {/* Upcoming Events moved near the top of the Landing Page */}
      <Reveal as="section" aria-labelledby="events-title" className="landing-section events-section events-section--featured reveal-group" id="events">
        <SectionTitle
          action={<Link className="text-link" to="/events">Explore all events <Icon name="arrow-right" size={13} /></Link>}
          description="Stay ahead of scheduled activities, assemblies, and campus-wide programs at WMSU."
          eyebrow="Happening Next on Campus"
          id="events-title"
          title="Upcoming events"
        />
        <div className="event-grid">
          {displayEvents.map((event) => <EventCard event={event} key={event.id} />)}
        </div>
      </Reveal>

      <Reveal as="section" aria-label="WMSU community statistics" className="statistics-strip reveal-group">
        <AnimatedStatistic label="Active Organizations" suffix="" value={activeOrgCount} />
        <AnimatedStatistic label="Faculty Advisers" suffix="" value={adviserCount} />
        <AnimatedStatistic label="Published Events" suffix="" value={publishedEvents.length} />
        <AnimatedStatistic label="Active Officers" suffix="" value={activeOfficersList.length} />
      </Reveal>

      <Reveal as="section" aria-labelledby="organizations-title" className="landing-section organizations-section reveal-group" id="organizations">
        <SectionTitle
          action={<Link className="text-link" to="/organizations">Open full directory ({activeOrgCount}) <Icon name="arrow-right" size={13} /></Link>}
          description="Browse university-wide, college, and departmental organizations accredited under WMSU."
          eyebrow="Accredited Directory"
          id="organizations-title"
          title="Campus organizations"
        />
        <div className="landing-org-toolbar">
          <div aria-label="Filter organizations by category" className="category-filters" role="group">
            {organizationCategories.map((category) => (
              <button
                aria-pressed={activeCategory === category}
                className={`category-filter${activeCategory === category ? ' selected' : ''}`}
                key={category}
                onClick={() => { setActiveCategory(category); setShowAllOrgs(false); }}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
          <p aria-live="polite" className="landing-org-counter-pill">
            Showing <strong>{displayedOrganizations.length}</strong> of <strong>{filteredOrganizations.length}</strong>{' '}
            {filteredOrganizations.length === 1 ? 'organization' : 'organizations'}
            {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
          </p>
        </div>

        {displayedOrganizations.length > 0 ? (
          <div className="organization-grid" id="organization-results">
            {displayedOrganizations.map((organization) => (
              <OrganizationCard key={organization.id} organization={organization} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#76717a' }}>
            <p style={{ fontSize: '16px', fontWeight: 600 }}>No organizations under &ldquo;{activeCategory}&rdquo; yet.</p>
            <p style={{ fontSize: '14px', marginTop: '6px' }}>New accredited organizations under this category will appear here automatically.</p>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '14px', marginTop: '32px' }}>
          {activeCategory === 'All' && !showAllOrgs && filteredOrganizations.length > 12 && (
            <button
              className="button button-secondary"
              onClick={() => setShowAllOrgs(true)}
              type="button"
            >
              Show all {filteredOrganizations.length} organizations
            </button>
          )}
          <Link className="button button-primary" to="/organizations">
            Explore Organization Directory <Icon name="arrow-right" size={13} />
          </Link>
        </div>
      </Reveal>

      {studentLeaders.length > 0 && (
        <Reveal as="section" aria-labelledby="leaders-title" className="landing-section leaders-section reveal-group">
          <SectionTitle
            description="Meet the executive officers and committee leads driving campus initiatives."
            eyebrow="Organization Leadership"
            id="leaders-title"
            title="Campus officers"
          />
          <div className="leader-grid">
            {studentLeaders.map((leader) => <LeaderCard key={`${leader.name}-${leader.organization}`} leader={leader} />)}
          </div>
        </Reveal>
      )}

      <Reveal as="section" aria-labelledby="community-title" className="community-section reveal-group" id="community-feed">
        <div className="community-copy">
          <span className="landing-eyebrow">Around WMSU</span>
          <h2 id="community-title">The community is always moving.</h2>
          <p>Keep up with official updates shared by accredited organizations and campus leaders.</p>
          <Link className="text-link community-feed-link" to="/organizations">Visit organizations directory <Icon name="arrow-right" size={13} /></Link>
        </div>
        <div className="community-updates">
          {communityUpdates.map((update, index) => (
            <Link className="community-update" key={`${update.title}-${index}`} to={update.link}>
              <span className="update-number">0{index + 1}</span>
              <span className="update-copy"><small>{update.label}</small><strong>{update.title}</strong></span>
              <span aria-hidden="true" className="update-arrow"><Icon name="arrow-up-right" size={13} /></span>
            </Link>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="how-title" className="landing-section how-section reveal-group" id="about">
        <SectionTitle
          description="Structured digital workflows keep officers, faculty advisers, and administrators aligned."
          eyebrow="Unified Governance"
          id="how-title"
          title="How UNIDOS works"
        />
        <div className="how-grid">
          <article className="how-step">
            <span aria-label="Step 1" className="step-number">01</span>
            <span aria-hidden="true" className="step-icon">
              <Icon name="search" size={20} />
            </span>
            <h3>Explore Directory</h3>
            <p>Browse all {activeOrgCount} accredited university, college, and departmental organizations.</p>
          </article>
          <article className="how-step">
            <span aria-label="Step 2" className="step-number">02</span>
            <span aria-hidden="true" className="step-icon">
              <Icon name="plus" size={20} />
            </span>
            <h3>Lead & Propose</h3>
            <p>Officers manage committee hierarchies, upload compliance documents, and propose events.</p>
          </article>
          <article className="how-step">
            <span aria-label="Step 3" className="step-number">03</span>
            <span aria-hidden="true" className="step-icon">
              <Icon name="star" size={20} />
            </span>
            <h3>Review & Participate</h3>
            <p>Advisers and admins endorse activities while live capacity controls manage registrations.</p>
          </article>
        </div>
      </Reveal>

      {campusLeaderboard.length > 0 && (
        <Reveal as="section" aria-labelledby="leaderboard-title" className="leaderboard-section reveal-group" id="leaderboard">
          <div className="leaderboard-intro">
            <span className="landing-eyebrow">Campus in action</span>
            <h2 id="leaderboard-title">Celebrating organization initiative.</h2>
            <p>Organizations making a measurable impact through active committees and campus programs.</p>
          </div>
          <div className="leaderboard-list">
            {campusLeaderboard.map((item) => (
              <Link className="leaderboard-row" key={item.rank} style={{ textDecoration: 'none', color: 'inherit' }} to={`/organizations/${item.id}`}>
                <span className="leaderboard-rank">{item.rank}</span>
                <span className="leaderboard-mark">{item.name.slice(0, 2).toUpperCase()}</span>
                <span className="leaderboard-name"><strong>{item.name}</strong><small>{item.detail}</small></span>
                <span className="leaderboard-score">{item.score}</span>
              </Link>
            ))}
          </div>
        </Reveal>
      )}

      <Reveal as="section" aria-labelledby="cta-title" className="landing-cta">
        <div aria-hidden="true" className="cta-orbit cta-orbit-outer" />
        <div aria-hidden="true" className="cta-orbit cta-orbit-inner" />
        <span className="landing-eyebrow">Your campus is calling</span>
        <h2 id="cta-title">Lead Your WMSU Organization Experience</h2>
        <p>Explore accredited organizations, register as an organization officer, and collaborate across WMSU.</p>
        <div className="cta-actions">
          <Link className="button button-primary" to="/organizations">Explore Organization <Icon name="arrow-right" size={13} /></Link>
          <Link className="button button-secondary" to="/register">Register Officer Account</Link>
        </div>
      </Reveal>

      <footer className="landing-footer">
        <div className="footer-main">
          <div className="footer-school">
            <Link aria-label="UNIDOS home" className="public-brand footer-brand" to="/">
              <WmsuLogo className="brand-seal" />
              <span className="public-brand-copy"><strong>UNIDOS</strong><span>STUDENT ORGANIZATION MANAGEMENT SYSTEM</span></span>
            </Link>
            <p className="footer-university">Western Mindanao State University</p>
            <p>Unified governance platform for WMSU accredited organizations, officers, and faculty advisers.</p>
          </div>
          <details className="footer-column" open>
            <summary>Quick Links</summary>
            <nav aria-label="Quick links">
              <Link to="/">Home</Link>
              <Link to="/events">Upcoming Events</Link>
              <Link to="/organizations">Organizations Directory</Link>
              <Link to="/#about">How UNIDOS Works</Link>
              <Link to="/#leaderboard">Leaderboard</Link>
            </nav>
          </details>
          <details className="footer-column" open>
            <summary>Portals</summary>
            <nav aria-label="Portal links">
              <Link to="/login">Officer Workspace</Link>
              <Link to="/login">Faculty Adviser Portal</Link>
              <Link to="/login">Admin Portal</Link>
              <Link to="/register">Officer Onboarding</Link>
            </nav>
          </details>
          <details className="footer-column" open>
            <summary>Account</summary>
            <nav aria-label="Account links">
              <Link to="/login">Sign In</Link>
              <Link to="/register">Register Officer</Link>
            </nav>
          </details>
          <details className="footer-column footer-contact" open>
            <summary>Contact</summary>
            <span><Icon name="location" size={14} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '6px' }} /> Western Mindanao State University</span>
            <span><Icon name="mail" size={14} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '6px' }} /> Student Affairs & Services Division</span>
          </details>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Western Mindanao State University</span>
          <span>Student Organization Management System</span>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
