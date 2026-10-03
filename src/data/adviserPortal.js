import { officerOrganization } from './officerPortal.js'

export const adviserProfile = {
  name: 'Reyes, Ana',
  id: 'adviser-ana-reyes',
}

export const adviserAssignedOrganizations = [
  {
    id: officerOrganization.id,
    name: officerOrganization.name,
    acronym: officerOrganization.acronym,
    category: officerOrganization.category,
    status: 'ACTIVE',
    adviser: adviserProfile.name,
    mission: 'To develop capable, ethical, and collaborative computing students through learning, innovation, and service.',
    vision: 'A connected community of technology leaders creating meaningful solutions for WMSU and beyond.',
    announcements: [
      { title: 'Membership orientation scheduled for new applicants', date: 'October 8, 2026' },
      { title: 'Volunteer sign-up is open for WMSU Hackathon 2026', date: 'October 2, 2026' },
    ],
    documents: ['Constitution and By-Laws', 'Organization Profile 2026'],
  },
]

export const initialAdviserDocuments = [
  {
    id: 'wcs-document-constitution',
    organizationId: officerOrganization.id,
    organizationName: officerOrganization.name,
    title: 'Constitution & By-Laws',
    type: 'DOCUMENT',
    submittedBy: 'Santos, Maria',
    submittedDate: 'October 1, 2026',
    status: 'PENDING',
    description: 'Updated constitution and bylaws for the current academic year.',
    supportingDocuments: ['WCS-Constitution-2026.pdf'],
  },
  {
    id: 'wcs-document-safety-plan',
    organizationId: officerOrganization.id,
    organizationName: officerOrganization.name,
    title: 'WMSU Hackathon Safety Plan',
    type: 'DOCUMENT',
    submittedBy: 'Santos, Maria',
    submittedDate: 'October 2, 2026',
    status: 'PENDING',
    description: 'Safety and venue plan for WMSU Hackathon 2026.',
    supportingDocuments: ['Hackathon-Safety-Plan.pdf'],
  },
  {
    id: 'wcs-document-officer-roster',
    organizationId: officerOrganization.id,
    organizationName: officerOrganization.name,
    title: 'Current Officer Roster',
    type: 'OFFICER_ROSTER',
    submittedBy: 'Santos, Maria',
    submittedDate: 'September 29, 2026',
    status: 'APPROVED',
    description: 'Current organization officers and their assigned positions.',
    supportingDocuments: ['WCS-Officer-Roster-2026.pdf'],
    decisionDate: 'October 1, 2026',
    processedBy: 'Reyes, Ana',
    adminReviewRequired: true,
  },
]

export const initialAdviserReports = [
  {
    id: 'wcs-report-workshop-2026',
    organizationId: officerOrganization.id,
    organizationName: officerOrganization.name,
    eventId: 'wcs-technology-workshop',
    eventTitle: 'Technology Innovation Workshop',
    eventDate: 'September 24, 2026',
    attendance: 76,
    submittedDate: 'September 28, 2026',
    submittedBy: 'Santos, Maria',
    status: 'PENDING_VERIFICATION',
    description: 'The workshop introduced design thinking and rapid prototyping to WMSU students.',
    revisionNote: '',
  },
  {
    id: 'wcs-report-programming-day-2026',
    organizationId: officerOrganization.id,
    organizationName: officerOrganization.name,
    eventId: 'wcs-programming-competition',
    eventTitle: 'Programming Competition',
    eventDate: 'September 18, 2026',
    attendance: 43,
    submittedDate: 'September 22, 2026',
    submittedBy: 'Santos, Maria',
    status: 'PENDING_VERIFICATION',
    description: 'The competition brought WMSU students together for a collaborative programming challenge.',
    revisionNote: '',
  },
]

export const initialAdviserActivity = [
  { id: 'adviser-activity-1', message: 'Technology Innovation Workshop proposal is awaiting review.', time: 'Today · 9:10 AM' },
  { id: 'adviser-activity-2', message: 'WMSU Computer Society submitted updated governing documents.', time: 'Yesterday · 3:25 PM' },
  { id: 'adviser-activity-3', message: 'An accomplishment report is ready for verification.', time: 'September 28 · 11:40 AM' },
]
