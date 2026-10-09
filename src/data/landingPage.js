export const organizationCategories = [
  'All',
  'Academic',
  'Technology',
  'Arts & Culture',
  'Sports',
  'Leadership',
  'Community',
]

export const studentLeaders = [
  { name: 'Alyssa Marie Santos', organization: 'WMSU Student Council', position: 'Council President', initials: 'AS', color: 'rose' },
  { name: 'Miguel Dela Cruz', organization: 'Computer Society', position: 'Organization Chairperson', initials: 'MD', color: 'gold' },
  { name: 'Janelle R. Flores', organization: 'Performing Arts Guild', position: 'Creative Director', initials: 'JF', color: 'sage' },
  { name: 'Rafael Lim', organization: 'WMSU Red Dragons', position: 'Team Captain', initials: 'RL', color: 'blue' },
]

export const organizations = [
  { id: 'student-council', acronym: 'SSC', name: 'Supreme Student Council', category: 'Leadership', description: 'Representing WMSU students and championing student voice, leadership, and campus life.', initials: 'SC', color: 'rose' },
  { id: 'computer-society', acronym: 'CS', name: 'WMSU Computer Society', category: 'Technology', description: 'Connecting computing students through hands-on learning, tech talks, and innovation.', initials: 'CS', color: 'blue' },
  { id: 'young-educators', acronym: 'YES', name: 'Young Educators Society', category: 'Academic', description: 'Supporting future educators through peer learning, academic initiatives, and service.', initials: 'YE', color: 'gold' },
  { id: 'performing-arts', acronym: 'PAG', name: 'Performing Arts Guild', category: 'Arts & Culture', description: 'Sharing the stories and traditions of Mindanao through dance, theater, and performance.', initials: 'PA', color: 'sage' },
  { id: 'red-dragons', acronym: 'RD', name: 'WMSU Red Dragons', category: 'Sports', description: 'Bringing student athletes together to represent WMSU with teamwork and school spirit.', initials: 'RD', color: 'red' },
  { id: 'green-advocates', acronym: 'GAC', name: 'Green Advocates Circle', category: 'Community', description: 'Promoting volunteerism, sustainability, and compassionate community service at WMSU.', initials: 'GA', color: 'green' },
  { id: 'junior-marketing-association', acronym: 'JMA', name: 'Junior Marketing Association', category: 'Academic', description: 'A student network for developing creative, practical, and responsible marketing skills.', initials: 'JMA', color: 'blue' },
  { id: 'computer-science-society', acronym: 'CSS', name: 'Computer Science Society', category: 'Technology', description: 'Exploring software, problem-solving, and emerging technology as a campus community.', initials: 'CSS', color: 'sage' },
  { id: 'campus-chorale', acronym: 'WCC', name: 'WMSU Campus Chorale', category: 'Arts & Culture', description: 'Bringing voices together to perform and celebrate music at university events.', initials: 'WCC', color: 'rose' },
  { id: 'university-chess-club', acronym: 'UCC', name: 'University Chess Club', category: 'Sports', description: 'Building focus, sportsmanship, and friendly competition across the WMSU community.', initials: 'UCC', color: 'gold' },
  { id: 'student-leaders-society', acronym: 'SLS', name: 'Student Leaders Society', category: 'Leadership', description: 'Helping student leaders grow through collaboration, service, and leadership development.', initials: 'SLS', color: 'red' },
  { id: 'environmental-volunteers', acronym: 'EVC', name: 'Environmental Volunteers Circle', category: 'Community', description: 'Organizing student-led campus cleanups, sustainability projects, and environmental learning.', initials: 'EVC', color: 'green' },
]

export const upcomingEvents = [
  {
    id: 'wmsu-hackathon-2026',
    title: 'WMSU Hackathon 2026',
    organization: 'WMSU Computer Society',
    category: 'Technology',
    date: 'November 14, 2026',
    time: '8:00 AM – 6:00 PM',
    location: 'College of Computing, WMSU',
    status: 'Registration Open',
    color: 'blue',
    description: 'Team up with fellow innovators for a day of coding, collaboration, and creative solutions to real campus and community challenges.',
  },
  {
    id: 'student-leadership-summit',
    title: 'Student Leadership Summit',
    organization: 'Supreme Student Council',
    category: 'Leadership',
    date: 'November 20, 2026',
    time: '9:00 AM – 4:00 PM',
    location: 'WMSU University Center',
    status: 'Almost Full',
    color: 'rose',
    description: 'Join student leaders from across WMSU for practical workshops, shared ideas, and conversations about serving our campus community.',
  },
  {
    id: 'campus-cultural-festival',
    title: 'Campus Cultural Festival',
    organization: 'WMSU Cultural Dance Ensemble',
    category: 'Arts & Culture',
    date: 'November 27, 2026',
    time: '4:00 PM – 8:30 PM',
    location: 'WMSU Open Grounds',
    status: 'Upcoming',
    color: 'sage',
    description: 'Celebrate the rich cultures of Mindanao with student performances, music, dance, and creative displays from across the university.',
  },
  {
    id: 'wmsu-organization-fair',
    title: 'WMSU Organization Fair',
    organization: 'Student Affairs Office',
    category: 'Campus Life',
    date: 'December 3, 2026',
    time: '9:00 AM – 3:00 PM',
    location: 'WMSU Main Quadrangle',
    status: 'Registration Open',
    color: 'gold',
    description: 'Meet student organizations, discover new interests, and learn how to take part in clubs and activities across WMSU.',
  },
]

export const communityUpdates = [
  { label: 'Organization spotlight', title: 'Meet the student groups welcoming new members this semester.', link: '/student/organizations' },
  { label: 'On campus', title: 'October activities are being added to the university events calendar.', link: '/student/events' },
  { label: 'Get involved', title: 'Find a community that matches your interests and make your mark at WMSU.', link: '/register' },
]

export const campusLeaderboard = [
  { rank: '01', name: 'Supreme Student Council', detail: 'Campus leadership', score: '24 activities' },
  { rank: '02', name: 'WMSU Computer Society', detail: 'Technology & innovation', score: '18 activities' },
  { rank: '03', name: 'Performing Arts Guild', detail: 'Arts & culture', score: '16 activities' },
]
