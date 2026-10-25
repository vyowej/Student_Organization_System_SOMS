/**
 * Seed Western Mindanao State University (WMSU) Academic Structure
 * (Colleges, Departments, and Programs)
 */
const db = require('../db');

const WMSU_ACADEMIC_DATA = [
  {
    name: 'College of Computing Studies',
    acronym: 'CCS',
    departments: [
      {
        name: 'Department of Computer Science',
        acronym: 'DCS',
        programs: [
          { name: 'Bachelor of Science in Computer Science', acronym: 'BSCS' },
        ],
      },
      {
        name: 'Department of Information Technology',
        acronym: 'DIT',
        programs: [
          { name: 'Bachelor of Science in Information Technology', acronym: 'BSIT' },
        ],
      },
      {
        name: 'Department of Information Systems',
        acronym: 'DIS',
        programs: [
          { name: 'Bachelor of Science in Information Systems', acronym: 'BSIS' },
        ],
      },
    ],
  },
  {
    name: 'College of Engineering',
    acronym: 'COE',
    departments: [
      {
        name: 'Department of Civil Engineering',
        acronym: 'DCE',
        programs: [
          { name: 'Bachelor of Science in Civil Engineering', acronym: 'BSCE' },
        ],
      },
      {
        name: 'Department of Electrical Engineering',
        acronym: 'DEE',
        programs: [
          { name: 'Bachelor of Science in Electrical Engineering', acronym: 'BSEE' },
        ],
      },
      {
        name: 'Department of Mechanical Engineering',
        acronym: 'DME',
        programs: [
          { name: 'Bachelor of Science in Mechanical Engineering', acronym: 'BSME' },
        ],
      },
      {
        name: 'Department of Electronics Engineering',
        acronym: 'DECE',
        programs: [
          { name: 'Bachelor of Science in Electronics Engineering', acronym: 'BSECE' },
        ],
      },
      {
        name: 'Department of Computer Engineering',
        acronym: 'DCpE',
        programs: [
          { name: 'Bachelor of Science in Computer Engineering', acronym: 'BSCpE' },
        ],
      },
      {
        name: 'Department of Sanitary Engineering',
        acronym: 'DSE',
        programs: [
          { name: 'Bachelor of Science in Sanitary Engineering', acronym: 'BSSE' },
        ],
      },
      {
        name: 'Department of Industrial Engineering',
        acronym: 'DIE',
        programs: [
          { name: 'Bachelor of Science in Industrial Engineering', acronym: 'BSIE' },
        ],
      },
      {
        name: 'Department of Agricultural and Biosystems Engineering',
        acronym: 'DABE',
        programs: [
          { name: 'Bachelor of Science in Agricultural and Biosystems Engineering', acronym: 'BSABE' },
        ],
      },
    ],
  },
  {
    name: 'College of Teacher Education',
    acronym: 'CTE',
    departments: [
      {
        name: 'Department of Secondary Education',
        acronym: 'DSEd',
        programs: [
          { name: 'Bachelor of Secondary Education', acronym: 'BSED' },
        ],
      },
      {
        name: 'Department of Elementary Education',
        acronym: 'DEEd',
        programs: [
          { name: 'Bachelor of Elementary Education', acronym: 'BEED' },
        ],
      },
      {
        name: 'Department of Early Childhood and Special Needs Education',
        acronym: 'DECSNE',
        programs: [
          { name: 'Bachelor of Early Childhood Education', acronym: 'BECEd' },
          { name: 'Bachelor of Special Needs Education', acronym: 'BSNEd' },
        ],
      },
      {
        name: 'Department of Physical Education',
        acronym: 'DPE',
        programs: [
          { name: 'Bachelor of Physical Education', acronym: 'BPEd' },
          { name: 'Bachelor of Culture and Arts Education', acronym: 'BCAEd' },
        ],
      },
    ],
  },
  {
    name: 'College of Nursing',
    acronym: 'CN',
    departments: [
      {
        name: 'Department of Nursing',
        acronym: 'DN',
        programs: [
          { name: 'Bachelor of Science in Nursing', acronym: 'BSN' },
        ],
      },
    ],
  },
  {
    name: 'College of Science and Mathematics',
    acronym: 'CSM',
    departments: [
      {
        name: 'Department of Biology',
        acronym: 'DBio',
        programs: [
          { name: 'Bachelor of Science in Biology', acronym: 'BSBio' },
        ],
      },
      {
        name: 'Department of Chemistry',
        acronym: 'DChem',
        programs: [
          { name: 'Bachelor of Science in Chemistry', acronym: 'BSChem' },
        ],
      },
      {
        name: 'Department of Mathematics and Statistics',
        acronym: 'DMS',
        programs: [
          { name: 'Bachelor of Science in Mathematics', acronym: 'BSMath' },
          { name: 'Bachelor of Science in Statistics', acronym: 'BSStat' },
        ],
      },
      {
        name: 'Department of Physics',
        acronym: 'DPhys',
        programs: [
          { name: 'Bachelor of Science in Physics', acronym: 'BSPhys' },
        ],
      },
    ],
  },
  {
    name: 'College of Liberal Arts',
    acronym: 'CLA',
    departments: [
      {
        name: 'Department of Languages and Literature',
        acronym: 'DLL',
        programs: [
          { name: 'Bachelor of Arts in English Language Studies', acronym: 'ABELS' },
          { name: 'Bachelor of Arts in Filipino', acronym: 'ABFil' },
        ],
      },
      {
        name: 'Department of Mass Communication',
        acronym: 'DMC',
        programs: [
          { name: 'Bachelor of Arts in Broadcasting', acronym: 'BAB' },
          { name: 'Bachelor of Arts in Journalism', acronym: 'BAJ' },
        ],
      },
      {
        name: 'Department of Social Sciences',
        acronym: 'DSS',
        programs: [
          { name: 'Bachelor of Arts in Political Science', acronym: 'ABPolSci' },
          { name: 'Bachelor of Arts in History', acronym: 'ABHist' },
        ],
      },
      {
        name: 'Department of Psychology',
        acronym: 'DPsych',
        programs: [
          { name: 'Bachelor of Science in Psychology', acronym: 'BSPsych' },
        ],
      },
      {
        name: 'Department of Philosophy',
        acronym: 'DPhil',
        programs: [
          { name: 'Bachelor of Arts in Philosophy', acronym: 'ABPhil' },
        ],
      },
    ],
  },
  {
    name: 'College of Criminal Justice Education',
    acronym: 'CCJE',
    departments: [
      {
        name: 'Department of Criminology',
        acronym: 'DCrim',
        programs: [
          { name: 'Bachelor of Science in Criminology', acronym: 'BSCrim' },
        ],
      },
      {
        name: 'Department of Law Enforcement Administration',
        acronym: 'DLEA',
        programs: [
          { name: 'Bachelor of Science in Industrial Security Management', acronym: 'BSISM' },
        ],
      },
    ],
  },
  {
    name: 'College of Architecture',
    acronym: 'CA',
    departments: [
      {
        name: 'Department of Architecture',
        acronym: 'DArch',
        programs: [
          { name: 'Bachelor of Science in Architecture', acronym: 'BSArch' },
        ],
      },
    ],
  },
  {
    name: 'College of Agriculture',
    acronym: 'CAg',
    departments: [
      {
        name: 'Department of Agronomy and Crop Science',
        acronym: 'DACS',
        programs: [
          { name: 'Bachelor of Science in Agriculture', acronym: 'BSAgri' },
        ],
      },
      {
        name: 'Department of Agribusiness Management',
        acronym: 'DAM',
        programs: [
          { name: 'Bachelor of Science in Agribusiness', acronym: 'BSAgribiz' },
        ],
      },
      {
        name: 'Department of Agricultural Technology',
        acronym: 'DAT',
        programs: [
          { name: 'Bachelor of Agricultural Technology', acronym: 'BAT' },
        ],
      },
    ],
  },
  {
    name: 'College of Forestry and Environmental Studies',
    acronym: 'CFES',
    departments: [
      {
        name: 'Department of Forestry',
        acronym: 'DForest',
        programs: [
          { name: 'Bachelor of Science in Forestry', acronym: 'BSF' },
          { name: 'Bachelor of Science in Agroforestry', acronym: 'BSAF' },
        ],
      },
      {
        name: 'Department of Environmental Science',
        acronym: 'DES',
        programs: [
          { name: 'Bachelor of Science in Environmental Science', acronym: 'BSES' },
        ],
      },
    ],
  },
  {
    name: 'College of Home Economics',
    acronym: 'CHE',
    departments: [
      {
        name: 'Department of Nutrition and Dietetics',
        acronym: 'DND',
        programs: [
          { name: 'Bachelor of Science in Nutrition and Dietetics', acronym: 'BSND' },
        ],
      },
      {
        name: 'Department of Hospitality and Tourism Management',
        acronym: 'DHTM',
        programs: [
          { name: 'Bachelor of Science in Hospitality Management', acronym: 'BSHM' },
          { name: 'Bachelor of Science in Tourism Management', acronym: 'BSTM' },
        ],
      },
      {
        name: 'Department of Food Technology',
        acronym: 'DFT',
        programs: [
          { name: 'Bachelor of Science in Food Technology', acronym: 'BSFT' },
        ],
      },
    ],
  },
  {
    name: 'College of Social Work and Community Development',
    acronym: 'CSWCD',
    departments: [
      {
        name: 'Department of Social Work',
        acronym: 'DSW',
        programs: [
          { name: 'Bachelor of Science in Social Work', acronym: 'BSSW' },
        ],
      },
      {
        name: 'Department of Community Development',
        acronym: 'DCD',
        programs: [
          { name: 'Bachelor of Science in Community Development', acronym: 'BSCD' },
        ],
      },
    ],
  },
  {
    name: 'College of Public Administration and Development Studies',
    acronym: 'CPADS',
    departments: [
      {
        name: 'Department of Public Administration',
        acronym: 'DPA',
        programs: [
          { name: 'Bachelor of Public Administration', acronym: 'BPA' },
        ],
      },
    ],
  },
  {
    name: 'College of Asian and Islamic Studies',
    acronym: 'CAIS',
    departments: [
      {
        name: 'Department of Islamic Studies',
        acronym: 'DIS',
        programs: [
          { name: 'Bachelor of Arts in Islamic Studies', acronym: 'BAIS' },
        ],
      },
      {
        name: 'Department of Asian Studies',
        acronym: 'DAS',
        programs: [
          { name: 'Bachelor of Arts in Asian Studies', acronym: 'BAAS' },
        ],
      },
    ],
  },
  {
    name: 'College of Sports Science and Physical Education',
    acronym: 'CSSPE',
    departments: [
      {
        name: 'Department of Sports Science',
        acronym: 'DSSci',
        programs: [
          { name: 'Bachelor of Science in Exercise and Sports Sciences', acronym: 'BSESS' },
        ],
      },
    ],
  },
  {
    name: 'College of Law',
    acronym: 'CL',
    departments: [
      {
        name: 'Department of Law',
        acronym: 'DLaw',
        programs: [
          { name: 'Juris Doctor', acronym: 'JD' },
        ],
      },
    ],
  },
  {
    name: 'College of Medicine',
    acronym: 'CM',
    departments: [
      {
        name: 'Department of Medicine',
        acronym: 'DMed',
        programs: [
          { name: 'Doctor of Medicine', acronym: 'MD' },
        ],
      },
    ],
  },
];

async function seedAcademicHierarchy(client = db) {
  console.log('--- Seeding WMSU Academic Hierarchy ---');

  // Fix program id: 1 if it exists and was named BSED under DCS
  await client.query(`
    UPDATE programs
       SET name = 'Bachelor of Science in Computer Science', acronym = 'BSCS'
     WHERE id = 1 AND acronym = 'BSED'
  `);

  let collegeCount = 0;
  let departmentCount = 0;
  let programCount = 0;

  for (const col of WMSU_ACADEMIC_DATA) {
    const colRes = await client.query(
      `INSERT INTO colleges (name, acronym)
       VALUES ($1, $2)
       ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, acronym`,
      [col.name, col.acronym]
    );
    const collegeId = colRes.rows[0].id;
    collegeCount++;

    for (const dept of col.departments) {
      const deptRes = await client.query(
        `INSERT INTO departments (college_id, name, acronym)
         VALUES ($1, $2, $3)
         ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym
         RETURNING id, name, acronym`,
        [collegeId, dept.name, dept.acronym]
      );
      const departmentId = deptRes.rows[0].id;
      departmentCount++;

      for (const prog of dept.programs) {
        await client.query(
          `INSERT INTO programs (department_id, name, acronym)
           VALUES ($1, $2, $3)
           ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id
           RETURNING id, name, acronym`,
          [departmentId, prog.name, prog.acronym]
        );
        programCount++;
      }
    }
  }

  console.log(`Successfully synced WMSU Academic Structure:`);
  console.log(`- Colleges:    ${collegeCount}`);
  console.log(`- Departments: ${departmentCount}`);
  console.log(`- Programs:    ${programCount}`);
  return { collegeCount, departmentCount, programCount };
}

if (require.main === module) {
  seedAcademicHierarchy()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SEED ERROR]', err);
      process.exit(1);
    });
}

module.exports = {
  seedAcademicHierarchy,
  WMSU_ACADEMIC_DATA,
};
