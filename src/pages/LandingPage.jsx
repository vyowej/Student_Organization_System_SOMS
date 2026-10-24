import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon.jsx'
import WmsuLogo from '../components/ui/WmsuLogo.jsx'
import { EventCard, LeaderCard, OrganizationCard } from '../components/public/LandingCards.jsx'
import AnimatedStatistic from '../components/public/AnimatedStatistic.jsx'
import Reveal from '../components/public/Reveal.jsx'
import { usePortalData } from '../context/usePortalData.js'
import { organizationCategories } from '../data/landingPage.js'

const defaultNotifications = [
  { type: 'Organizations', icon: 'organization', title: 'Organizations Directory', message: 'Browse recognized student organizations on campus.', time: 'live' },
  { type: 'Events', icon: 'calendar', title: 'Campus Events', message: 'Check published events and register online.', time: 'live' },
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
      navigate(`/student/organizations?q=${encodeURIComponent(trimmed)}`)
    } else {
      navigate('/student/organizations')
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
          placeholder="Search organizations..."
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
  const orgLabel = 'Active Organizations'
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
      <div><strong>{activeOrganizations}</strong><span>Active Organizations</span></div>
      <div><strong>{publishedEvents}</strong><span>Published Events</span></div>
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
    adminUsers = [],
  } = usePortalData()

  const [activeCategory, setActiveCategory] = useState('All')
  const [notificationIndex, setNotificationIndex] = useState(0)
  const heroArtRef = useRef(null)

  const publishedEvents = useMemo(
    () => officerEvents.filter((event) => ['PUBLISHED', 'APPROVED'].includes(event.status)),
    [officerEvents],
  )

  const studentLeaders = useMemo(
    () =>
      officerMembers
        .filter((m) => m.position && m.position !== 'MEMBER' && m.status === 'ACTIVE')
        .slice(0, 6)
        .map((m, idx) => ({
          name: m.name,
          position: m.officerPosition || m.role,
          organization: m.organizationName,
          color: ['crimson', 'gold', 'emerald', 'blue'][idx % 4],
        })),
    [officerMembers],
  )

  const communityUpdates = useMemo(
    () =>
      officerAnnouncements.slice(0, 4).map((ann) => ({
        label: ann.organizationName || 'Announcement',
        title: ann.title,
        link: '/student/notifications',
      })),
    [officerAnnouncements],
  )

  const campusLeaderboard = useMemo(
    () =>
      [...studentOrganizations]
        .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
        .slice(0, 5)
        .map((org, idx) => ({
          rank: idx + 1,
          name: org.name,
          detail: `${org.category} · ${org.college}`,
          score: `${org.memberCount || 0} members`,
        })),
    [studentOrganizations],
  )

  const heroNotifications = useMemo(() => {
    const items = []
    if (studentOrganizations[0]) {
      items.push({
        type: 'Organizations',
        icon: 'organization',
        title: studentOrganizations[0].acronym || 'Organization',
        message: `${studentOrganizations[0].name} is active on UNIDOS.`,
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
    : studentOrganizations.filter((organization) => organization.category === activeCategory)

  const studentCount = adminUsers.filter((u) => u.dbRole === 'STUDENT' || u.role === 'Student').length

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
            <span className="hero-title-accent">Campus Community</span>
            <span className="hero-title-ending">with UNIDOS.</span>
          </h1>
          <p className="hero-tagline">Join. Lead. Make an Impact.</p>
          <p className="hero-description">
            UNIDOS brings WMSU students and organizations together as one campus community to
            discover, participate, and stay connected to everything happening on campus.
          </p>

          <HeroSearch />

          <div className="hero-actions">
            <Link className="button button-primary" to="/student/organizations">
              Explore Organizations <Icon name="arrow-right" size={14} />
            </Link>
            <Link className="button button-secondary" to="/student/events" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="event" size={16} /> View Upcoming Events
            </Link>
          </div>
          <div className="hero-social-proof">
            <div className="mini-avatars" aria-hidden="true"><span>UN</span><span>ID</span><span>OS</span><span>+</span></div>
            <span><strong>Find your people.</strong> Get involved at WMSU.</span>
          </div>
          <MobileHeroStats
            activeOrganizations={studentOrganizations.length}
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
                <div className="mock-welcome"><small>STUDENT DASHBOARD</small><strong>Welcome back!</strong></div>
                <div className="mock-metrics">
                  <span><b>{studentOrganizations.length}</b><small>Organizations</small></span>
                  <span><b>{publishedEvents.length}</b><small>Events</small></span>
                  <span><b>{officerMembers.length}</b><small>Members</small></span>
                </div>
                <div className="mock-dashboard-content">
                  <div className="mock-org-list"><b>My organizations</b><i /><i /><i /></div>
                  <div className="mock-event-card">
                    <span>UPCOMING EVENT</span>
                    <b>{publishedEvents[0]?.title || 'Campus Activity'}</b>
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
              <b className="mock-phone-title">{studentOrganizations[0]?.name || 'WMSU Student Organizations'}</b>
              <span className="mock-phone-caption">LEARN · BUILD · CONNECT</span>
              <div className="mock-phone-button">View organization</div>
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
            activeOrgs={studentOrganizations.length}
            loading={loading}
            publishedEvents={publishedEvents.length}
          />
        </div>
      </section>

      {studentLeaders.length > 0 && (
        <Reveal as="section" aria-labelledby="leaders-title" className="landing-section leaders-section reveal-group">
          <SectionTitle
            description="Meet the students who bring ideas to life and make our campus community stronger."
            eyebrow="Student voices"
            id="leaders-title"
            title="Campus leaders"
          />
          <div className="leader-grid">
            {studentLeaders.map((leader) => <LeaderCard key={`${leader.name}-${leader.organization}`} leader={leader} />)}
          </div>
        </Reveal>
      )}

      <Reveal as="section" aria-label="WMSU community statistics" className="statistics-strip reveal-group">
        <AnimatedStatistic label="Organizations" suffix="" value={studentOrganizations.length} />
        <AnimatedStatistic label="Students" suffix="" value={studentCount} />
        <AnimatedStatistic label="Events" suffix="" value={publishedEvents.length} />
        <AnimatedStatistic label="Memberships" suffix="" value={officerMembers.length} />
        <AnimatedStatistic label="Campus connection" suffix="/7" value={24} />
      </Reveal>

      <Reveal as="section" aria-labelledby="organizations-title" className="landing-section organizations-section reveal-group" id="organizations">
        <SectionTitle
          action={<Link className="text-link" to="/student/organizations">Explore all organizations <Icon name="arrow-right" size={13} /></Link>}
          description="Whatever you are passionate about, there is a place for you here."
          eyebrow="Find your people"
          id="organizations-title"
          title="Student organizations"
        />
        <div aria-label="Filter organizations by category" className="category-filters" role="group">
          {organizationCategories.map((category) => (
            <button
              aria-pressed={activeCategory === category}
              className={`category-filter${activeCategory === category ? ' selected' : ''}`}
              key={category}
              onClick={() => setActiveCategory(category)}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>
        <div className="organization-grid" id="organization-results">
          {filteredOrganizations.map((organization) => (
            <OrganizationCard key={organization.id} organization={organization} />
          ))}
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="events-title" className="landing-section events-section reveal-group" id="events">
        <SectionTitle
          action={<Link className="text-link" to="/student/events">Explore all events <Icon name="arrow-right" size={13} /></Link>}
          description="Make plans, meet new people, and be part of what is happening at WMSU."
          eyebrow="Mark your calendar"
          id="events-title"
          title="Upcoming events"
        />
        <div className="event-grid">
          {publishedEvents.map((event) => <EventCard event={event} key={event.id} />)}
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="community-title" className="community-section reveal-group" id="community-feed">
        <div className="community-copy">
          <span className="landing-eyebrow">Around WMSU</span>
          <h2 id="community-title">The community is always moving.</h2>
          <p>Keep up with what student organizations are sharing and discover a new way to get involved.</p>
          <Link className="text-link" to="/student/notifications">Visit your community feed <Icon name="arrow-right" size={13} /></Link>
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
          description="Getting involved is simple. Start with what interests you and see where it takes you."
          eyebrow="Your next chapter"
          id="how-title"
          title="How UNIDOS works"
        />
        <div className="how-grid">
          <article className="how-step">
            <span aria-label="Step 1" className="step-number">01</span>
            <span aria-hidden="true" className="step-icon">⌕</span>
            <h3>Discover</h3>
            <p>Find organizations and campus activities that match your interests.</p>
          </article>
          <article className="how-step">
            <span aria-label="Step 2" className="step-number">02</span>
            <span aria-hidden="true" className="step-icon">＋</span>
            <h3>Join</h3>
            <p>Apply to organizations and become part of your campus community.</p>
          </article>
          <article className="how-step">
            <span aria-label="Step 3" className="step-number">03</span>
            <span aria-hidden="true" className="step-icon">✦</span>
            <h3>Participate</h3>
            <p>Attend events, connect with students, and make an impact.</p>
          </article>
        </div>
      </Reveal>

      {campusLeaderboard.length > 0 && (
        <Reveal as="section" aria-labelledby="leaderboard-title" className="leaderboard-section reveal-group" id="leaderboard">
          <div className="leaderboard-intro">
            <span className="landing-eyebrow">Campus in action</span>
            <h2 id="leaderboard-title">Celebrating student initiative.</h2>
            <p>Organizations are making a difference through the activities and communities they build.</p>
          </div>
          <div className="leaderboard-list">
            {campusLeaderboard.map((item) => (
              <div className="leaderboard-row" key={item.rank}>
                <span className="leaderboard-rank">{item.rank}</span>
                <span className="leaderboard-mark">{item.name.slice(0, 2).toUpperCase()}</span>
                <span className="leaderboard-name"><strong>{item.name}</strong><small>{item.detail}</small></span>
                <span className="leaderboard-score">{item.score}</span>
              </div>
            ))}
          </div>
        </Reveal>
      )}

      <Reveal as="section" aria-labelledby="cta-title" className="landing-cta">
        <div aria-hidden="true" className="cta-orbit cta-orbit-outer" />
        <div aria-hidden="true" className="cta-orbit cta-orbit-inner" />
        <span className="landing-eyebrow">Your campus is calling</span>
        <h2 id="cta-title">Create Your WMSU Community Experience</h2>
        <p>Discover organizations, join campus communities, and participate in activities that make an impact.</p>
        <div className="cta-actions">
          <Link className="button button-primary" to="/register">Get Started <Icon name="arrow-right" size={13} /></Link>
          <Link className="button button-secondary" to="/student/organizations">Explore Organizations</Link>
        </div>
      </Reveal>

      <footer className="landing-footer">
        <div className="footer-main">
          <div className="footer-school">
            <Link aria-label="UNIDOS home" className="public-brand footer-brand" to="/">
              <WmsuLogo className="brand-seal" />
              <span className="public-brand-copy"><strong>UNIDOS</strong><span>Student Organization Management System</span></span>
            </Link>
            <p className="footer-university">Western Mindanao State University</p>
            <p>Connecting WMSU students with organizations, activities, and campus communities.</p>
          </div>
          <details className="footer-column" open>
            <summary>Quick Links</summary>
            <nav aria-label="Quick links">
              <Link to="/">Home</Link>
              <Link to="/student/organizations">Organizations</Link>
              <Link to="/student/events">Events</Link>
              <Link to="/#about">About</Link>
              <Link to="/#community-feed">Community Feed</Link>
              <Link to="/#leaderboard">Leaderboard</Link>
            </nav>
          </details>
          <details className="footer-column" open>
            <summary>Student</summary>
            <nav aria-label="Student links">
              <Link to="/student/my-organizations">My Organizations</Link>
              <Link to="/student/registrations">My Registrations</Link>
              <Link to="/student/attendance">Attendance</Link>
              <Link to="/student/notifications">Notifications</Link>
            </nav>
          </details>
          <details className="footer-column" open>
            <summary>Account</summary>
            <nav aria-label="Account links">
              <Link to="/login">Sign In</Link>
              <Link to="/register">Create Account</Link>
            </nav>
          </details>
          <details className="footer-column footer-contact" open>
            <summary>Contact</summary>
            <span><Icon name="location" size={14} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '6px' }} /> Western Mindanao State University</span>
            <span><Icon name="mail" size={14} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '6px' }} /> Student Affairs</span>
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
