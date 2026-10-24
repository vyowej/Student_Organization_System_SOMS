-- ============================================================
-- SOMS — Seed data (WMSU colleges, departments, programs, organizations)
-- Source: Google Sheet (Colleges, Departments, Copy of Organizations)
-- Run AFTER student_org_db.sql and 02_schema_changes.sql
-- Advisers are kept as comments only (advisers need user accounts first).
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- 1. COLLEGES  (C18 "UNIVERSITY" is not a college -> handled by scope = 'UNIVERSITY')
-- ------------------------------------------------------------
INSERT INTO colleges (name, acronym) VALUES
    ('College of Agriculture',                                    'CA'),
    ('College of Architecture',                                   'CArch'),
    ('College of Asian and Islamic Studies',                      'CAIS'),
    ('College of Computing Studies',                              'CCS'),
    ('College of Criminal Justice Education',                     'CCJE'),
    ('College of Engineering',                                    'COE'),
    ('College of Forestry and Environmental Studies',             'CFES'),
    ('College of Home Economics',                                 'CHE'),
    ('College of Law',                                            'CLAW'),
    ('College of Liberal Arts',                                   'CLA'),
    ('College of Medicine',                                       'COM'),
    ('College of Nursing',                                        'CON'),
    ('College of Public Administration and Development Studies',  'CPADS'),
    ('College of Science and Mathematics',                        'CSM'),
    ('College of Social Work and Community Development',          'CSWCD'),
    ('College of Sports Science and Physical Education',          'CSSPE'),
    ('College of Teacher Education',                              'CTE');

-- ------------------------------------------------------------
-- 2. UNDERGRADUATE DEPARTMENTS + one program each
--    dept_acr = acronym from the sheet's parentheses (NULL if none)
--    prog_acr = same as dept_acr, or a generated code where the sheet had none
--    departments.acronym falls back to prog_acr, so no department has a NULL acronym
-- ------------------------------------------------------------
CREATE TEMP TABLE _undergrad (college_acr TEXT, name TEXT, dept_acr TEXT, prog_acr TEXT) ON COMMIT DROP;

INSERT INTO _undergrad VALUES
    -- College of Agriculture
    ('CA',    'Bachelor of Science in Agriculture',                         'BSA',   'BSA'),
    ('CA',    'Bachelor of Science in Food Technology',                     'BSFT',  'BSFT'),
    ('CA',    'Bachelor of Science in Agribusiness',                        'BSAB',  'BSAB'),
    ('CA',    'Bachelor of Agricultural Technology',                        'BAT',   'BAT'),
    -- College of Liberal Arts
    ('CLA',   'Bachelor of Arts in History',                                NULL,    'BAH'),      -- generated
    ('CLA',   'Bachelor of Arts in Filipino',                               NULL,    'BAFIL'),    -- generated
    ('CLA',   'Bachelor of Arts in English',                                NULL,    'BAE'),      -- generated
    ('CLA',   'Bachelor of Arts in Political Science',                      NULL,    'BAPS'),     -- generated
    ('CLA',   'Bachelor of Arts in Mass Communication – Journalism',        NULL,    'BAMC-J'),   -- generated
    ('CLA',   'Bachelor of Arts in Mass Communication – Broadcasting',      NULL,    'BAMC-B'),   -- generated
    ('CLA',   'Bachelor of Science in Economics',                           NULL,    'BSECON'),   -- generated
    ('CLA',   'Bachelor of Science in Psychology',                          NULL,    'BSPSY'),    -- generated
    -- College of Architecture
    ('CArch', 'Bachelor of Science in Architecture',                        NULL,    'BSARCH'),   -- generated
    -- College of Nursing
    ('CON',   'Bachelor of Science in Nursing',                             NULL,    'BSN'),      -- generated
    -- College of Computing Studies
    ('CCS',   'Bachelor of Science in Computer Science',                    'BSCS',  'BSCS'),
    ('CCS',   'Bachelor of Science in Information Technology',              'BSIT',  'BSIT'),
    ('CCS',   'Associate in Computer Technology',                           'ACT',   'ACT'),
    -- College of Forestry and Environmental Studies
    ('CFES',  'Bachelor of Science in Forestry',                            NULL,    'BSF'),      -- generated
    ('CFES',  'Bachelor of Science in Agroforestry',                        NULL,    'BSAF'),     -- generated
    ('CFES',  'Bachelor of Science in Environmental Science',               NULL,    'BSES'),     -- generated
    -- College of Engineering
    ('COE',   'BS Agricultural and Biosystems Engineering',                 'BSABE', 'BSABE'),
    ('COE',   'BS Civil Engineering',                                       'BSCE',  'BSCE'),
    ('COE',   'BS Computer Engineering',                                    'BSCpE', 'BSCpE'),
    ('COE',   'BS Electrical Engineering',                                  'BSEE',  'BSEE'),
    ('COE',   'BS Electronics Engineering',                                 'BSECE', 'BSECE'),
    ('COE',   'BS Environmental Engineering',                               'BSEnE', 'BSEnE'),
    ('COE',   'BS Geodetic Engineering',                                    'BSGE',  'BSGE'),
    ('COE',   'BS Industrial Engineering',                                  'BSIE',  'BSIE'),
    ('COE',   'BS Mechanical Engineering',                                  'BSME',  'BSME'),
    ('COE',   'BS Sanitary Engineering',                                    'BSSE',  'BSSE'),
    -- College of Public Administration and Development Studies
    ('CPADS', 'Bachelor of Public Administration',                          'BPA',   'BPA'),
    ('CPADS', 'Bachelor of Science in Accountancy',                         NULL,    'BSACCT'),   -- generated; sheet listed this under CLA, orgs sheet says CPADS
    -- College of Sports Science and Physical Education
    ('CSSPE', 'Bachelor of Physical Education',                             'BPED',  'BPED'),
    ('CSSPE', 'Bachelor of Science in Exercise and Sports Sciences',        'BSESS', 'BSESS'),
    -- College of Science and Mathematics
    ('CSM',   'BS Biology',                                                 NULL,    'BSBIO'),    -- generated
    ('CSM',   'BS Chemistry',                                               NULL,    'BSCHEM'),   -- generated
    ('CSM',   'BS Mathematics',                                             NULL,    'BSMATH'),   -- generated
    ('CSM',   'BS Physics',                                                 NULL,    'BSPHY'),    -- generated
    ('CSM',   'BS Statistics',                                              NULL,    'BSSTAT'),   -- generated
    -- College of Social Work and Community Development
    ('CSWCD', 'BS Social Work',                                             'BSSW',  'BSSW'),
    ('CSWCD', 'Bachelor of Science in Community Development',               'BSCD',  'BSCD'),
    -- College of Teacher Education
    ('CTE',   'Bachelor of Culture and Arts Education',                     'BCAED', 'BCAED'),
    ('CTE',   'Bachelor of Early Childhood Education',                      'BECED', 'BECED'),
    ('CTE',   'Bachelor of Elementary Education',                           'BEED',  'BEED'),
    ('CTE',   'Bachelor of Secondary Education',                            'BSED',  'BSED'),
    ('CTE',   'Bachelor of Special Needs Education',                        'BSNED', 'BSNED'),
    -- College of Home Economics
    ('CHE',   'BS Hospitality Management',                                  NULL,    'BSHM'),     -- generated
    ('CHE',   'BS Nutrition and Dietetics',                                 NULL,    'BSND'),     -- generated
    ('CHE',   'Bachelor of Science in Home Economics',                      NULL,    'BSHE'),     -- generated
    -- College of Criminal Justice Education
    ('CCJE',  'Bachelor of Science in Criminology',                         NULL,    'BSCRIM'),   -- generated
    -- College of Asian and Islamic Studies
    ('CAIS',  'BS Islamic Studies',                                         NULL,    'BSIS'),     -- generated
    ('CAIS',  'AB Asian Studies',                                           NULL,    'ABAS');     -- generated

INSERT INTO departments (college_id, name, acronym)
SELECT c.id, u.name, COALESCE(u.dept_acr, u.prog_acr)
  FROM _undergrad u
  JOIN colleges c ON c.acronym = u.college_acr;

INSERT INTO programs (department_id, name, acronym, level)
SELECT d.id, d.name, u.prog_acr, 'UNDERGRADUATE'
  FROM _undergrad u
  JOIN colleges c    ON c.acronym = u.college_acr
  JOIN departments d ON d.college_id = c.id AND d.name = u.name;

-- ------------------------------------------------------------
-- 3. GRADUATE PROGRAMS  (each college gets one "Graduate Programs" department)
-- ------------------------------------------------------------
CREATE TEMP TABLE _grad (college_acr TEXT, name TEXT, acr TEXT) ON COMMIT DROP;

INSERT INTO _grad VALUES
    ('CLA',   'Doctor of Philosophy in Education',                            'PhD-Ed'),
    ('CLA',   'Master of Arts in Education',                                  'MA-Ed'),
    ('CON',   'Master of Arts in Nursing',                                    'MAN'),
    ('CCS',   'Master in Information Technology',                             'MIT'),
    ('CPADS', 'Master of Public Administration',                              'MPA'),
    ('CSSPE', 'Master in Physical Education',                                 'MPED'),
    ('CSSPE', 'Diploma in Physical Education',                                'DiPED'),
    ('CSWCD', 'Master of Science in Social Work',                             'MSSW'),
    ('CLAW',  'Juris Doctor',                                                 'JD'),
    ('CHE',   'Master of Arts in Education Major in Nutrition and Health',    'MAEd-NH'),
    ('CHE',   'Master of Arts in Education Major in Home Economics',          'MAEd-HE'),
    ('COM',   'Doctor of Medicine',                                           'MD');

INSERT INTO departments (college_id, name, acronym)
SELECT DISTINCT c.id, 'Graduate Programs', 'GRAD'
  FROM _grad g
  JOIN colleges c ON c.acronym = g.college_acr;

INSERT INTO programs (department_id, name, acronym, level)
SELECT d.id, g.name, g.acr, 'GRADUATE'
  FROM _grad g
  JOIN colleges c    ON c.acronym = g.college_acr
  JOIN departments d ON d.college_id = c.id AND d.name = 'Graduate Programs';

-- ------------------------------------------------------------
-- 4. ORGANIZATIONS
--    college_acr NULL            -> scope UNIVERSITY
--    dept_name   NULL            -> scope COLLEGE
--    both set                    -> scope DEPARTMENT
--    level: 'UNDERGRADUATE' | 'GRADUATE' | NULL (open to both)
-- ------------------------------------------------------------
CREATE TEMP TABLE _orgs (
    college_acr TEXT, dept_name TEXT, name TEXT, acronym TEXT, org_type TEXT,
    level TEXT, min_year INTEGER, max_year INTEGER, notes TEXT
) ON COMMIT DROP;

INSERT INTO _orgs VALUES
    -- ===== DEPARTMENT-LEVEL =====
    ('COE',  'BS Civil Engineering', 'Academic Community of Civil Engineering Students', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),
    ('CFES', 'Bachelor of Science in Forestry', 'Agroforestry Student Organization', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                         -- adviser: Mr. Guiller Ellomer
    ('CTE',  'Bachelor of Culture and Arts Education', 'Bachelor of Culture and Arts Education Club', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),         -- adviser: Asso. Prof. Eric-Roland R. Natividad
    ('CCJE', 'Bachelor of Science in Criminology', 'CCJE Practicum Student Organization', NULL, 'ACADEMIC', 'UNDERGRADUATE', 3, 3, '3rd year only'),               -- adviser: Mr. Reinier N. Rosaldo
    ('CLA',  'Bachelor of Arts in English', 'English Language Teaching Society', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                              -- adviser: Ms. Ma. Reginne Nazario
    ('CFES', 'Bachelor of Science in Forestry', 'Forestry Student Association', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                               -- adviser: Juprelan Labanacruz
    ('COE',  'BS Geodetic Engineering', 'Geodetic Engineering Student’s Association', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                        -- adviser: Engr. Regina O. Acosta
    ('COE',  'BS Computer Engineering', 'Institute of Computer Engineers of the Philippines Student Edition – WMSU Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL), -- adviser: Engr. Gajil J. Santos
    ('COE',  'BS Electrical Engineering', 'Institute of Integrated Electrical Engineers – Student Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL), -- adviser: Engr. Alvin P. Miguel
    ('CCJE', 'Bachelor of Science in Criminology', 'Junior Criminology Organization', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                        -- adviser: Mr. Reinier N. Rosaldo
    ('CFES', 'Bachelor of Science in Forestry', 'Junior Foresters Association of the Philippines', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),            -- adviser: Juprelan Labanacruz
    ('COE',  'BS Electronics Engineering', 'Junior Institute of Electronic Engineers of the Philippines – WMSU Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL), -- adviser: Engr. Kevin Marc A. Bejerano
    ('CPADS','Bachelor of Science in Accountancy', 'Junior Philippine Institute of Accountants – WMSU Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL), -- adviser: Ms. Satina S. Muammil, CPA
    ('CLA',  'Bachelor of Arts in Mass Communication – Broadcasting', 'Masscomm Society', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                    -- adviser: Asst. Prof. Edralin B. Villanueva
    ('COE',  'BS Mechanical Engineering', 'Pambansang Samahan ng Inhenyero Mekanikal – WMSU Student Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL), -- adviser: (none)
    ('COE',  'BS Industrial Engineering', 'Philippine Institute of Industrial Engineers – WMSU Student Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL), -- adviser: Engr. Aylene Ingkoh
    ('CCS',  'Bachelor of Science in Information Technology', 'Philippine Society for Information Technology Students', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL), -- adviser: Engr. Marvic Lines
    ('COE',  'BS Agricultural and Biosystems Engineering', 'Philippine Society of Agricultural and Biosystems Engineers Pre-Professional Group', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL), -- adviser: Engr. Michelle U. Baltazar
    ('COE',  'BS Sanitary Engineering', 'Philippine Society of Sanitary Engineering – WMSU Student Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL), -- adviser: Engr. Sara Jamila J. Tan
    ('CLA',  'Bachelor of Arts in Political Science', 'Political Science Society', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                            -- adviser: Prof. Judy B. Gonzales
    ('CLA',  'Bachelor of Science in Psychology', 'Psychology Society', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                                       -- adviser: Ms. Daniella C. Aporador
    ('COE',  'BS Environmental Engineering', 'Society of Environmental Engineers WMSU Student Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),       -- adviser: (none)
    ('CSSPE','Bachelor of Physical Education', 'Association in Physical Education Majors', 'APEM', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                  -- adviser: Asst. Prof. Keith Alvin S. Solamillo
    ('CLA',  'Bachelor of Arts in Filipino', 'Samahang Batsilyer ng Sining sa Filipino', 'SABFIL', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                 -- adviser: Ms. Rhea Lopez-Mendoza
    ('CSM',  'BS Biology', 'WMSU Life Science Society', 'LSS', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                                                     -- adviser: Princess Shaira Bonifacio
    ('CSM',  'BS Chemistry', 'WMSU Chemistry Society', 'ChemSoc', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                                                  -- adviser: Jayson Francisco
    ('CSM',  'BS Statistics', 'Mathematical and Statistical Society', 'MSS', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                                       -- adviser: Aubrey Labastilla and Eman Ahmad
    ('CSM',  'BS Physics', 'WMSU Physics Society', 'PhySoc', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                                                       -- adviser: Jhonathan G. Saracho
    ('CPADS','Bachelor of Public Administration', 'Junior Public Administration Association Inc.', 'jpaai', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),         -- adviser: (none)
    ('CHE',  'Bachelor of Science in Home Economics', 'Home Economics Club', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                                 -- adviser: (none)
    ('CHE',  'BS Nutrition and Dietetics', 'Nutrition and Dietetics Students’ Association', 'NDSA', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),               -- adviser: (none)

    -- ===== COLLEGE STUDENT COUNCILS =====
    ('CA',    NULL, 'College Student Council – College of Agriculture', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),                                 -- adviser: Ms. Queeneevi T. Quijano
    ('CArch', NULL, 'College Student Council – College of Architecture', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),                                -- adviser: Prof. Noel D.S. Querijero
    ('CCS',   NULL, 'College Student Council – College of Computing Studies', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),                          -- adviser: Engr. Marjorie A. Rojas
    ('CCJE',  NULL, 'College Student Council – College of Criminal Justice Education', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),                 -- adviser: Mr. Jiemar A. Arabani
    ('COE',   NULL, 'College Student Council – College of Engineering', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),                                 -- adviser: Engr. Nurjimar Ujaji
    ('CFES',  NULL, 'College Student Council – College of Forestry and Environmental Studies', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),         -- adviser: Mr. Guiller Ellomer
    ('CHE',   NULL, 'College Student Council – College of Home Economics', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),                             -- adviser: Prof. Sylvia D.S Hachero
    ('CAIS',  NULL, 'College Student Council – College of Asian and Islamic Studies', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),                   -- adviser: Abdel-Azeem Moh. Siddique
    ('CLA',   NULL, 'College Student Council – College of Liberal Arts', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),                               -- adviser: Dr. Rochard Tarroza
    ('CON',   NULL, 'College Student Council – College of Nursing', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),                                     -- adviser: Prof. Jocelyn D. Orquia
    ('CSM',   NULL, 'College Student Council – College of Science and Mathematics', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),                    -- adviser: Prof. Noricel U. Garcia
    ('CSWCD', NULL, 'College Student Council – College of Social Work and Community Development', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),    -- adviser: Prof. Esa H. Jumlail Jr
    ('CSSPE', NULL, 'College Student Council – College of Sports Science and Physical Education', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),     -- adviser: Prof. Salih T. Allian
    ('CTE',   NULL, 'College Student Council – College of Teacher Education', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL),                          -- adviser: Prof. Kharylle Schyneid T. Kenoh
    -- ('CSSPE', NULL, 'CSSPE CSC', ...)  -- SKIPPED: looks like a duplicate of the CSSPE council above (adviser: Asst.Prof. Reynaldo R. Macaso Jr.)

    -- ===== GENDER CLUBS (one per college with undergrad programs; none for College of Law / Medicine) =====
    ('CA',    NULL, 'Gender Club – College of Agriculture', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                                            -- added
    ('CArch', NULL, 'Gender Club – College of Architecture', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                                           -- added
    ('CAIS',  NULL, 'Gender Club – College of Asian and Islamic Studies', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                              -- added
    ('CCS',   NULL, 'Gender Club – College of Computing Studies', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                                      -- adviser: Engr. Marjorie Rojas
    ('CCJE',  NULL, 'Gender Club – College of Criminal Justice Education', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                             -- adviser: Ms. Melodina Francisco
    ('COE',   NULL, 'Gender Club – College of Engineering', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                                           -- adviser: Engr. Catherine Falcasantos
    ('CFES',  NULL, 'Gender Club – College of Forestry and Environmental Studies', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                    -- added
    ('CHE',   NULL, 'Gender Club – College of Home Economics', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                                         -- added
    ('CLA',   NULL, 'Gender Club – College of Liberal Arts', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                                           -- added
    ('CON',   NULL, 'Gender Club – College of Nursing', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),
    ('CPADS', NULL, 'Gender Club – College of Public Administration and Development Studies', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),
    ('CSM',   NULL, 'Gender Club – College of Science and Mathematics', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                               -- added
    ('CSWCD', NULL, 'Gender Club – College of Social Work and Community Development', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),               -- adviser: Asst. Prof. Mary Ann T. Enriquez
    ('CSSPE', NULL, 'Gender Club – College of Sports Science and Physical Education', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                -- adviser: Asst. Prof. Keith Alvin S. Solamillo
    ('CTE',   NULL, 'Gender Club – College of Teacher Education', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                                     -- adviser: Mr. Robert O. Parcon

    -- ===== OTHER COLLEGE-LEVEL ORGS =====
    ('CTE',  NULL, 'CTE Pre-Service Teachers Organization', NULL, 'ACADEMIC', 'UNDERGRADUATE', 4, 4, '4th year students only'),                                       -- adviser: Prof. Bernardita G. Bacang
    ('CTE',  NULL, 'CTE The Current Society', NULL, 'OTHER', 'UNDERGRADUATE', NULL, NULL, NULL),                                                                    -- adviser: Dr. Ryan B. Cabangcala
    ('CTE',  NULL, 'The Horizon', NULL, 'PUBLICATION', 'UNDERGRADUATE', NULL, NULL, NULL),
    ('CCJE', NULL, 'Eclectic Defense System', NULL, 'OTHER', 'UNDERGRADUATE', NULL, NULL, NULL),                                                                   -- adviser: Mr. Reinier N. Rosaldo
    ('CFES', NULL, 'Environmental Science Society', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),                                                          -- adviser: Minsarib Kahasa
    ('COE',  NULL, 'Hawk’s Eye Publication', NULL, 'PUBLICATION', 'UNDERGRADUATE', NULL, NULL, NULL),                                                               -- adviser: Engr. Ivy Francisco
    ('COE',  NULL, 'Hawkwards', NULL, 'PUBLICATION', 'UNDERGRADUATE', NULL, NULL, NULL),
    ('COE',  NULL, 'Crimson Hawks', NULL, 'OTHER', 'UNDERGRADUATE', NULL, NULL, NULL),                                                                              -- adviser: Mr. Salimar Tahil
    ('CCS',  NULL, 'Venom', NULL, 'PUBLICATION', 'UNDERGRADUATE', NULL, NULL, NULL),                                                                                -- adviser: Engr. Marvic Lines
    ('CCS',  NULL, 'Philippine Computing Students Society', 'PhiCSS', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),
    ('CON',  NULL, 'The Prime Mover', NULL, 'OTHER', 'UNDERGRADUATE', NULL, NULL, NULL),                                                                            -- adviser: Asso. Prof. Divine Grace M. Marumas (sheet type: Student Government)
    ('CON',  NULL, 'Synapse Chorale', NULL, 'CULTURAL', 'UNDERGRADUATE', NULL, NULL, NULL),
    ('CHE',  NULL, 'Hospitality Management League of Leaders', 'HMLL', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL),
    ('CSSPE',NULL, 'Kinematics Emergency Response Team', 'KERT', 'SOCIO_CIVIC', 'UNDERGRADUATE', NULL, NULL, NULL),                                                 -- adviser: Mr. John Wilmer F. Laureano
    ('CSSPE',NULL, 'Kinematography', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL),                                                                  -- adviser: Mr. Brian Rino H. Traigo

    -- ===== GRADUATE-ONLY COLLEGE-LEVEL ORGS =====
    ('COM',  NULL, 'Crimson Muslim Medical Doctors', NULL, 'SPECIAL_INTEREST', 'GRADUATE', NULL, NULL, NULL),                                                       -- adviser: Dr. Al-Radja Jamiri, M.D
    ('CLAW', NULL, 'Law Student Association', NULL, 'ACADEMIC', 'GRADUATE', NULL, NULL, NULL),                                                                     -- adviser: Atty. Jules Christian D. Marcos
    ('CTE',  NULL, 'CTE Graduate Student Association', NULL, 'ACADEMIC', 'GRADUATE', NULL, NULL, NULL),                                                            -- adviser: Prof. Arnel Madrazo
    ('CSM',  NULL, 'CSM Graduate School Association', NULL, 'ACADEMIC', 'GRADUATE', NULL, NULL, NULL),                                                             -- adviser: Dr. Anabel E. Gamorez
    ('CLA',  NULL, 'CLA Graduate School Students Association', NULL, 'ACADEMIC', 'GRADUATE', NULL, NULL, NULL),                                                    -- adviser: Dr. Rodita C. Silva

    -- ===== UNIVERSITY-WIDE (open to all, undergrad and graduate) =====
    (NULL, NULL, 'University Student Council', 'USC', 'STUDENT_COUNCIL', NULL, NULL, NULL, NULL),                                                                  -- adviser: Ms. Eleanor Comeros
    (NULL, NULL, 'WMSU Gender Association', NULL, 'SPECIAL_INTEREST', NULL, NULL, NULL, NULL),                                                                     -- adviser: Dr. Elmer M. Labad
    (NULL, NULL, 'Council of the Greeks', NULL, 'OTHER', NULL, NULL, NULL, NULL),                                                                                  -- adviser: Prof. Al-Ghani D. Mohammad
    (NULL, NULL, 'The Legal Network for Truthful Elections – WMSU Chapter', 'LENTE', 'SOCIO_CIVIC', NULL, NULL, NULL, NULL),                                       -- adviser: Ms. Dezza Mohammad, CPA, RN
    (NULL, NULL, 'Muslim Student Association', NULL, 'RELIGIOUS', NULL, NULL, NULL, NULL),                                                                         -- adviser: Engr. Marlon Grande
    (NULL, NULL, 'NSync Music Organization', NULL, 'CULTURAL', NULL, NULL, NULL, NULL),                                                                            -- adviser: Dezza Mohammad, CPA, RN
    (NULL, NULL, 'Philippine Students Alliance Lay Movement, Inc.', 'PSALM', 'RELIGIOUS', NULL, NULL, NULL, NULL),                                                 -- adviser: Mr. Floramie M. Ramiro
    (NULL, NULL, 'Rotaract Club', NULL, 'SOCIO_CIVIC', NULL, NULL, NULL, NULL),                                                                                    -- adviser: Engr. Marlon C. Grande
    (NULL, NULL, 'The New Blazer', NULL, 'PUBLICATION', NULL, NULL, NULL, NULL),                                                                                   -- adviser: Dr. Carl Richard C. Dagalea
    (NULL, NULL, 'UNESCO Club', NULL, 'SOCIO_CIVIC', NULL, NULL, NULL, NULL),                                                                                      -- adviser: Engr. Marlon C. Grande
    (NULL, NULL, 'University Digest', NULL, 'PUBLICATION', NULL, NULL, NULL, NULL),                                                                                -- adviser: Dr. Lea Usman
    (NULL, NULL, 'WMSU Graduating Student Association', NULL, 'SPECIAL_INTEREST', NULL, 4, NULL, 'Open to graduating students (4th year and up)'),                  -- adviser: Dr. Vicenta T. Escobar
    (NULL, NULL, 'WMSU Grand Chorale', NULL, 'CULTURAL', NULL, NULL, NULL, NULL),
    (NULL, NULL, 'WMSU League of Debaters', NULL, 'SPECIAL_INTEREST', NULL, NULL, NULL, NULL),                                                                      -- adviser: Prof. Joyce Mangubat
    (NULL, NULL, 'WMSU Peace Mediators Club', NULL, 'SOCIO_CIVIC', NULL, NULL, NULL, NULL),                                                                        -- adviser: Engr. Marlon C. Grande
    (NULL, NULL, 'DOST-SEI CBPSME Scholars’ Association', NULL, 'SPECIAL_INTEREST', NULL, NULL, NULL, 'DOST scholars only (verify through application review)'),   -- adviser: Dr. Mohammad Nur S. Paspasan
    (NULL, NULL, 'Jambangan', NULL, 'OTHER', NULL, NULL, NULL, NULL),
    (NULL, NULL, 'WMSU Youth Entrepreneurs', NULL, 'SPECIAL_INTEREST', NULL, NULL, NULL, NULL),
    (NULL, NULL, 'WMSU Lakandiwa', NULL, 'OTHER', NULL, NULL, NULL, NULL);

INSERT INTO organizations
    (name, acronym, org_type, scope, college_id, department_id, status, approved_at,
     eligible_level, min_year_level, max_year_level, eligibility_notes)
SELECT o.name,
       o.acronym,
       o.org_type::org_type,
       CASE WHEN o.college_acr IS NULL THEN 'UNIVERSITY'::org_scope
            WHEN o.dept_name   IS NULL THEN 'COLLEGE'::org_scope
            ELSE 'DEPARTMENT'::org_scope END,
       c.id,
       d.id,
       'ACTIVE',
       now(),
       o.level::education_level,
       o.min_year,
       o.max_year,
       o.notes
  FROM _orgs o
  LEFT JOIN colleges c    ON c.acronym = o.college_acr
  LEFT JOIN departments d ON d.college_id = c.id AND d.name = o.dept_name;

COMMIT;

-- Quick check
-- SELECT scope, count(*) FROM organizations GROUP BY scope;
