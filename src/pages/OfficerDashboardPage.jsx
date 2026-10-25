/**
 * Organization Officer Dashboard Page (`/officer/dashboard`)
 *
 * Displays organization workspace metrics, pending membership applications,
 * event proposal statuses, and quick actions for the active officer organization.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import Modal from '../components/ui/Modal.jsx'
import ProfileCover from '../components/layout/ProfileCover.jsx'
import Icon from '../components/ui/Icon.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import { officerEventStatuses } from '../data/officerPortal.js'
import { formatDisplayName, formatGreetingName, getTimeGreeting } from '../data/displayName.js'

const metricItems = [
  { key: 'members', label: 'Total Members', tone: 'crimson' },
  { key: 'requests', label: 'Pending Membership Requests', tone: 'blue' },
  { key: 'events', label: 'Upcoming Events', tone: 'gold' },
  { key: 'submissions', label: 'Pending Submissions', tone: 'green' },
]

function useCountUp(values) {
  const hasAnimated = useRef(false)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [counts, setCounts] = useState(() => (
    reducedMotion
      ? values
      : values.map(() => 0)
  ))

  useEffect(() => {
    if (reducedMotion) {
      hasAnimated.current = true
      return undefined
    }

    if (hasAnimated.current) {
      setCounts(values)
      return undefined
    }

    let frameId
    const start = performance.now()
    const duration = 850
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - ((1 - progress) ** 3)
      setCounts(values.map((value) => Math.round(value * eased)))
      if (progress < 1) frameId = requestAnimationFrame(tick)
      else hasAnimated.current = true
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [reducedMotion, values])

  return reducedMotion ? values : counts
}

export default function OfficerDashboardPage() {
  const {
    adminOrganizations = [],
    adviserDocuments = [],
    approveOfficerMembershipRequest = async () => false,
    captureUndo = () => () => {},
    officerEvents = [],
    officerMemberCount = 0,
    officerMembershipRequests = [],
    officerNotifications = [],
    rejectOfficerMembershipRequest = async () => false,
    currentUser,
  } = useOutletContext() || {}
  const organization = adminOrganizations.find(
    (item) => String(item.id) === String(currentUser?.organizationId)
  ) || adminOrganizations[0]
  const { showToast } = useToast()
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [requestToApprove, setRequestToApprove] = useState(null)
  const [requestToReject, setRequestToReject] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const orgEvents = useMemo(
    () => officerEvents.filter((e) => !organization || String(e.organizationId) === String(organization.id)),
    [officerEvents, organization]
  )
  const orgRequests = useMemo(
    () => officerMembershipRequests.filter((r) => !organization || String(r.organizationId) === String(organization.id)),
    [officerMembershipRequests, organization]
  )
  const orgDocuments = useMemo(
    () => adviserDocuments.filter((d) => !organization || String(d.organizationId) === String(organization.id)),
    [adviserDocuments, organization]
  )

  const pendingRequests = orgRequests.filter((request) => request.status === 'PENDING')
  const upcomingEventsCount = orgEvents.filter((e) => ['APPROVED', 'PUBLISHED', 'ONGOING'].includes(e.status)).length
  const pendingSubmissionsCount =
    orgEvents.filter((e) => ['SUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(e.status)).length +
    orgDocuments.filter((d) => d.status === 'PENDING').length

  const metricValues = useMemo(
    () => [officerMemberCount, pendingRequests.length, upcomingEventsCount, pendingSubmissionsCount],
    [officerMemberCount, pendingRequests.length, upcomingEventsCount, pendingSubmissionsCount]
  )
  const counts = useCountUp(metricValues)
  const recentActivity = officerNotifications.slice(0, 5).map((notification) => ({
    id: notification.id,
    message: notification.message,
    time: notification.createdAt,
  }))

  async function approve() {
    if (!requestToApprove) return
    const request = requestToApprove
    const undo = captureUndo()
    const ok = await approveOfficerMembershipRequest(request.id)
    if (!ok) return
    showToast(`${formatDisplayName(request)} is now an active member.`, 'success', undoAction(undo))
    setRequestToApprove(null)
  }

  async function reject() {
    if (!requestToReject) return
    const undo = captureUndo()
    const rejected = await rejectOfficerMembershipRequest(requestToReject.id, rejectionReason)
    if (rejected) showToast(`${formatDisplayName(requestToReject)}'s application was rejected.`, 'success', undoAction(undo))
    setRequestToReject(null)
    setRejectionReason('')
  }

  return (
    <div className="officer-dashboard fb-page">
      <ProfileCover
        actions={(
          <>
            <Link className="button button-primary" to="/officer/organization">Manage organization</Link>
            <Link className="button button-secondary" to="/officer/events/create">＋ Create Event</Link>
          </>
        )}
        avatarText={organization?.acronym ?? 'ORG'}
        badges={<Badge tone="crimson">Organization Officer</Badge>}
        eyebrow={`${getTimeGreeting()}, ${formatGreetingName(currentUser)}!`}
        label="Your organization"
        logo={organization?.logo}
        showCover={false}
        subtitle="Manage your organization, members, activities, and submissions."
        title={organization?.name ?? 'Your Organization'}
      />

      <div className="fb-body">
        <aside aria-label="Organization overview" className="fb-side">
          <Card className="fb-card">
            <div className="fb-card-heading"><h2>Overview</h2></div>
            <section aria-label="Organization overview metrics" className="fb-metrics">
              {metricItems.map((metric, index) => (
                <div className={`fb-metric fb-metric-${metric.tone}`} key={metric.key}>
                  <span aria-hidden="true" className="fb-metric-icon">
                    <Icon name={metric.key} size={18} />
                  </span>
                  <div>
                    <strong className="stat-value">{counts[index]}</strong>
                    <span className="stat-label">{metric.label}</span>
                  </div>
                </div>
              ))}
            </section>
          </Card>
        </aside>

        <div className="fb-feed">
          <Card className="fb-card fb-composer">
            <div className="fb-composer-row">
              <span aria-hidden="true" className="fb-mini-avatar">{(organization?.acronym ?? 'ORG').slice(0, 3)}</span>
              <Link className="fb-composer-input" to="/officer/announcements">What would you like to do today?</Link>
            </div>
            <div aria-label="Quick actions" className="fb-composer-actions fb-composer-actions-4">
              <Link to="/officer/announcements"><Icon name="announcement" size={16} /> Post Announcement</Link>
              <Link to="/officer/events/create"><Icon name="event" size={16} /> Create Event</Link>
              <Link to="/officer/members"><Icon name="members" size={16} /> Manage Members</Link>
              <Link to="/officer/documents"><Icon name="document" size={16} /> Upload Document</Link>
            </div>
          </Card>

          <Card className="fb-card officer-requests-panel">
            <div className="fb-card-heading">
              <div>
                <span className="officer-panel-eyebrow">MEMBERSHIP</span>
                <h2>Recent Membership Requests</h2>
              </div>
              <div className="officer-panel-heading-actions">
                <Badge tone={pendingRequests.length ? 'warning' : 'success'}>
                  {pendingRequests.length} awaiting review
                </Badge>
                <Link to="/officer/membership-requests">View all <Icon name="arrow-right" size={13} /></Link>
              </div>
            </div>
            <div className="officer-request-list">
              {pendingRequests.slice(0, 4).map((request) => (
                <article className="officer-request-row" key={request.id}>
                  <div className="officer-request-main">
                    <div className="officer-person-avatar" aria-hidden="true">
                      {formatDisplayName(request).split(/[ ,]+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('')}
                    </div>
                    <div className="officer-person-copy">
                      <strong>{formatDisplayName(request)}</strong>
                      <span>{request.program} <i aria-hidden="true">·</i> Applied: {request.applicationDate}</span>
                    </div>
                  </div>
                  <div className="officer-request-actions-wrap">
                    <Badge tone="warning">Pending</Badge>
                    <div className="officer-request-actions">
                      <Button onClick={() => setRequestToApprove(request)} variant="primary">Approve</Button>
                      <Button onClick={() => { setRequestToReject(request); setRejectionReason('') }} variant="secondary">Reject</Button>
                      <Button aria-label={`View ${formatDisplayName(request)}'s application`} onClick={() => setSelectedRequest(request)} variant="ghost">View</Button>
                    </div>
                  </div>
                </article>
              ))}
              {pendingRequests.length === 0 && (
                <p className="officer-inline-empty">All membership applications have been reviewed.</p>
              )}
            </div>
          </Card>

          <Card className="fb-card officer-events-panel">
            <div className="fb-card-heading">
              <div>
                <span className="officer-panel-eyebrow">ACTIVITIES</span>
                <h2>Recent Events</h2>
              </div>
              <Link className="officer-org-text-link" to="/officer/events">View events <Icon name="arrow-right" size={13} /></Link>
            </div>
            <div className="officer-event-list">
              {orgEvents.slice(0, 3).map((event) => (
                <article className="officer-event-row" key={event.id}>
                  <span aria-hidden="true" className="officer-event-icon">
                    <Icon name="event" size={18} />
                  </span>
                  <div className="officer-event-copy">
                    <strong>{event.title}</strong>
                    <span>{event.date} <i aria-hidden="true">·</i> {event.registrations} registrations</span>
                  </div>
                  <Badge tone={officerEventStatuses[event.status]?.tone ?? 'neutral'}>
                    {officerEventStatuses[event.status]?.label ?? event.status}
                  </Badge>
                </article>
              ))}
              {orgEvents.length === 0 && (
                <p className="officer-inline-empty">No events have been created yet.</p>
              )}
            </div>
            <div className="officer-panel-actions">
              <Link className="button button-primary" to="/officer/events/create">Create Event</Link>
              <Link className="button button-secondary" to="/officer/events">View Events</Link>
            </div>
          </Card>

          <Card className="fb-card">
            <div className="fb-card-heading">
              <div>
                <span className="officer-panel-eyebrow">ORGANIZATION LOG</span>
                <h2>Recent Activity</h2>
              </div>
              <Link className="officer-org-text-link" to="/officer/reports">View reports <Icon name="arrow-right" size={13} /></Link>
            </div>
            {recentActivity.length ? (
              <ol className="officer-activity-list">
                {recentActivity.map((activity) => (
                  <li key={activity.id}>
                    <span aria-hidden="true" />
                    <div><p>{activity.message}</p><time>{activity.time}</time></div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="officer-inline-empty">No activity logs recorded yet.</p>
            )}
          </Card>
        </div>
      </div>

      <Modal onClose={() => setSelectedRequest(null)} open={Boolean(selectedRequest)} size="md" title="Membership Application">
        {selectedRequest && (
          <div className="officer-request-detail">
            <p><strong>{formatDisplayName(selectedRequest)}</strong></p>
            <p>Student ID: {selectedRequest.studentId}</p>
            <p>Program: {selectedRequest.program}</p>
            <p>Applied: {selectedRequest.applicationDate}</p>
            <p>{selectedRequest.message}</p>
            <Badge tone="warning">Pending review</Badge>
          </div>
        )}
        <div className="officer-modal-actions"><Button onClick={() => setSelectedRequest(null)} variant="secondary">Close</Button></div>
      </Modal>

      <Modal onClose={() => setRequestToApprove(null)} open={Boolean(requestToApprove)} size="sm" title="Approve Membership?">
        <p>{requestToApprove && formatDisplayName(requestToApprove)} will become an active member of {organization?.name ?? 'this organization'}.</p>
        <div className="officer-modal-actions">
          <Button onClick={() => setRequestToApprove(null)} variant="secondary">Cancel</Button>
          <Button onClick={approve} variant="primary">Approve</Button>
        </div>
      </Modal>

      <Modal onClose={() => { setRequestToReject(null); setRejectionReason('') }} open={Boolean(requestToReject)} size="sm" title="Reject Membership Application?">
        <p>Reject {requestToReject && formatDisplayName(requestToReject)}&apos;s application to {organization?.name ?? 'this organization'}?</p>
        <label className="officer-modal-field">
          <span>Optional reason</span>
          <textarea className="input" onChange={(event) => setRejectionReason(event.target.value)} placeholder="Please provide a reason for rejection." rows="3" value={rejectionReason} />
        </label>
        <div className="officer-modal-actions">
          <Button onClick={() => { setRequestToReject(null); setRejectionReason('') }} variant="secondary">Cancel</Button>
          <Button onClick={reject} variant="primary">Reject Application</Button>
        </div>
      </Modal>
    </div>
  )
}
