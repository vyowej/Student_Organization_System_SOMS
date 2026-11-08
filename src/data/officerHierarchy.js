export const YEAR_LEVEL_OPTIONS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
]

export const ORGANIZATION_COMMITTEES = [
  'Executive Committee',
  'Internal & External Affairs Committee',
  'Documentation & Secretariat Committee',
  'Finance & Budget Committee',
  'Audit & Compliance Committee',
  'Publicity & Media Committee',
  'Programs & Events Committee',
  'Logistics & Technical Committee',
  'Membership & Grievance Committee',
  'Community Extension Committee',
  'General Operations Committee',
]

export const OFFICER_HIERARCHY = [
  {
    rank: 1,
    code: 'PRESIDENT',
    title: 'President',
    tierLabel: 'Tier 1 · Chief Executive',
    defaultCommittee: 'Executive Committee',
  },
  {
    rank: 2,
    code: 'VICE_PRESIDENT',
    title: 'Vice President',
    tierLabel: 'Tier 2 · Deputy Executive',
    defaultCommittee: 'Internal & External Affairs Committee',
  },
  {
    rank: 3,
    code: 'SECRETARY',
    title: 'Secretary',
    tierLabel: 'Tier 3 · Secretariat',
    defaultCommittee: 'Documentation & Secretariat Committee',
  },
  {
    rank: 4,
    code: 'TREASURER',
    title: 'Treasurer',
    tierLabel: 'Tier 4 · Finance',
    defaultCommittee: 'Finance & Budget Committee',
  },
  {
    rank: 5,
    code: 'AUDITOR',
    title: 'Auditor',
    tierLabel: 'Tier 5 · Audit & Compliance',
    defaultCommittee: 'Audit & Compliance Committee',
  },
  {
    rank: 6,
    code: 'PRO',
    title: 'Public Information Officer (PIO)',
    tierLabel: 'Tier 6 · Communications',
    defaultCommittee: 'Publicity & Media Committee',
  },
  {
    rank: 7,
    code: 'OTHER_OFFICER',
    title: 'Committee Chairperson',
    tierLabel: 'Tier 7 · Committee Lead',
    defaultCommittee: 'Programs & Events Committee',
  },
  {
    rank: 8,
    code: 'MEMBER',
    title: 'Committee Member',
    tierLabel: 'Tier 8 · Committee Staff',
    defaultCommittee: 'General Operations Committee',
  },
]

export const CANONICAL_PROGRAMS = [
  { id: 'BSCS', name: 'BS in Computer Science', acronym: 'BSCS', college: 'College of Computing Studies' },
  { id: 'BSIT', name: 'BS in Information Technology', acronym: 'BSIT', college: 'College of Computing Studies' },
  { id: 'ACT', name: 'Associate in Computer Technology', acronym: 'ACT', college: 'College of Computing Studies' },
  { id: 'BSCE', name: 'BS in Civil Engineering', acronym: 'BSCE', college: 'College of Engineering' },
  { id: 'BSCpE', name: 'BS in Computer Engineering', acronym: 'BSCpE', college: 'College of Engineering' },
  { id: 'BSEE', name: 'BS in Electrical Engineering', acronym: 'BSEE', college: 'College of Engineering' },
  { id: 'BSECE', name: 'BS in Electronics Engineering', acronym: 'BSECE', college: 'College of Engineering' },
  { id: 'BSME', name: 'BS in Mechanical Engineering', acronym: 'BSME', college: 'College of Engineering' },
  { id: 'BSGE', name: 'BS in Geodetic Engineering', acronym: 'BSGE', college: 'College of Engineering' },
  { id: 'BSABE', name: 'BS in Agricultural and Biosystems Engineering', acronym: 'BSABE', college: 'College of Engineering' },
  { id: 'BSArch', name: 'BS in Architecture', acronym: 'BSArch', college: 'College of Architecture' },
  { id: 'BSN', name: 'BS in Nursing', acronym: 'BSN', college: 'College of Nursing' },
  { id: 'BSA', name: 'BS in Accountancy', acronym: 'BSA', college: 'College of Liberal Arts / Business' },
  { id: 'BSBA', name: 'BS in Business Administration', acronym: 'BSBA', college: 'College of Liberal Arts / Business' },
  { id: 'BSEcon', name: 'BS in Economics', acronym: 'BSEcon', college: 'College of Liberal Arts' },
  { id: 'BAComm', name: 'BA in Communication', acronym: 'BAComm', college: 'College of Liberal Arts' },
  { id: 'BAPolSci', name: 'BA in Political Science', acronym: 'BAPolSci', college: 'College of Liberal Arts' },
  { id: 'BSPsych', name: 'BS in Psychology', acronym: 'BSPsych', college: 'College of Science and Mathematics' },
  { id: 'BSBio', name: 'BS in Biology', acronym: 'BSBio', college: 'College of Science and Mathematics' },
  { id: 'BSChem', name: 'BS in Chemistry', acronym: 'BSChem', college: 'College of Science and Mathematics' },
  { id: 'BSMath', name: 'BS in Mathematics', acronym: 'BSMath', college: 'College of Science and Mathematics' },
  { id: 'BSStat', name: 'BS in Statistics', acronym: 'BSStat', college: 'College of Science and Mathematics' },
  { id: 'BEEd', name: 'Bachelor of Elementary Education', acronym: 'BEEd', college: 'College of Teacher Education' },
  { id: 'BSEd', name: 'Bachelor of Secondary Education', acronym: 'BSEd', college: 'College of Teacher Education' },
  { id: 'BSCrim', name: 'BS in Criminology', acronym: 'BSCrim', college: 'College of Criminal Justice Education' },
  { id: 'BSSW', name: 'BS in Social Work', acronym: 'BSSW', college: 'College of Social Work and Community Development' },
  { id: 'BPA', name: 'Bachelor of Public Administration', acronym: 'BPA', college: 'College of Public Administration and Development Studies' },
  { id: 'BSAgri', name: 'BS in Agriculture', acronym: 'BSAgri', college: 'College of Agriculture' },
  { id: 'BSF', name: 'BS in Forestry', acronym: 'BSF', college: 'College of Forestry and Environmental Studies' },
  { id: 'BSND', name: 'BS in Nutrition and Dietetics', acronym: 'BSND', college: 'College of Home Economics' },
  { id: 'BSHM', name: 'BS in Hospitality Management', acronym: 'BSHM', college: 'College of Home Economics' },
]

export function sanitizeNumericStudentId(value) {
  return String(value ?? '').replace(/\D+/g, '')
}

export function normalizeYearLevelOption(value) {
  if (!value) return '1st Year'
  const str = String(value).trim()
  if (YEAR_LEVEL_OPTIONS.includes(str)) return str
  const digit = parseInt(str.replace(/\D+/g, ''), 10)
  if (digit >= 1 && digit <= 5) {
    return YEAR_LEVEL_OPTIONS[digit - 1]
  }
  return '1st Year'
}

export function getHierarchyEntry(roleOrCode) {
  const norm = String(roleOrCode ?? '').trim().toUpperCase().replace(/\s+/g, '_')
  if (!norm) return OFFICER_HIERARCHY[OFFICER_HIERARCHY.length - 1]

  const exact = OFFICER_HIERARCHY.find(
    (item) =>
      item.code === norm ||
      item.title.toUpperCase() === String(roleOrCode).trim().toUpperCase()
  )
  if (exact) return exact

  if (norm.includes('VICE') && norm.includes('PRESIDENT')) return OFFICER_HIERARCHY[1]
  if (norm.includes('PRESIDENT')) return OFFICER_HIERARCHY[0]
  if (norm.includes('SECRETARY')) return OFFICER_HIERARCHY[2]
  if (norm.includes('TREASURER')) return OFFICER_HIERARCHY[3]
  if (norm.includes('AUDITOR')) return OFFICER_HIERARCHY[4]
  if (norm === 'PIO' || norm.includes('PUBLIC_INFORMATION') || norm === 'PRO') return OFFICER_HIERARCHY[5]
  if (norm.includes('MEMBER') && !norm.includes('CHAIR')) return OFFICER_HIERARCHY[7]
  return OFFICER_HIERARCHY[6]
}

export function getDemotionOptions(roleOrCode) {
  const current = getHierarchyEntry(roleOrCode)
  const lower = OFFICER_HIERARCHY.filter((entry) => entry.rank > current.rank)
  return lower.length > 0 ? lower : [OFFICER_HIERARCHY[OFFICER_HIERARCHY.length - 1]]
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => reject(new Error('Unable to read selected file.'))
    reader.readAsDataURL(file)
  })
}
