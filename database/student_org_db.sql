-- ============================================================
-- Student Organization Management System (SOMS) — PostgreSQL Schema
-- File: database/student_org_db.sql
-- Linked directly to backend/db.js and backend/init-db.js
-- ============================================================

-- ============================================================
-- 1. ENUM TYPES (Roles, Statuses, Scopes, and Categories)
-- ============================================================
CREATE TYPE user_role              AS ENUM ('STUDENT', 'OFFICER', 'ADVISER', 'ADMIN');
CREATE TYPE user_status            AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

CREATE TYPE org_scope              AS ENUM ('UNIVERSITY', 'COLLEGE', 'DEPARTMENT');
CREATE TYPE org_type               AS ENUM ('STUDENT_COUNCIL', 'ACADEMIC', 'TECHNOLOGY', 'LEADERSHIP',
                                            'RELIGIOUS', 'CULTURAL', 'SPORTS_RECREATION', 'SPORTS',
                                            'SOCIO_CIVIC', 'SPECIAL_INTEREST', 'PUBLICATION', 'OTHER');
CREATE TYPE org_status             AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE education_level        AS ENUM ('UNDERGRADUATE', 'GRADUATE');

CREATE TYPE member_position        AS ENUM ('PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER',
                                            'AUDITOR', 'PRO', 'OTHER_OFFICER', 'MEMBER');
CREATE TYPE member_status          AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE application_status     AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE change_request_status  AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TYPE event_status           AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'COMPLETED', 'CANCELLED');
CREATE TYPE registration_status    AS ENUM ('REGISTERED', 'CANCELLED', 'ATTENDED');
CREATE TYPE attendance_method      AS ENUM ('QR_SCAN', 'MANUAL', 'SELF_CHECKIN');
CREATE TYPE document_type          AS ENUM ('CONSTITUTION', 'PROPOSAL', 'FINANCIAL', 'REPORT', 'CERTIFICATE');
CREATE TYPE document_status        AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ============================================================
-- 2. USERS & ACADEMIC HIERARCHY (Colleges, Departments, Programs)
-- ============================================================
CREATE TABLE users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         VARCHAR(255) NOT NULL,
    password_hash TEXT         NOT NULL,
    first_name    VARCHAR(100) NOT NULL,
    middle_name   VARCHAR(100),
    last_name     VARCHAR(100) NOT NULL,
    suffix        VARCHAR(50),
    role          user_role    NOT NULL DEFAULT 'STUDENT',
    status        user_status  NOT NULL DEFAULT 'PENDING',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Case-insensitive unique email constraint
CREATE UNIQUE INDEX uq_users_email ON users (lower(email));

CREATE TABLE colleges (
    id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    VARCHAR(150) NOT NULL UNIQUE,
    acronym VARCHAR(20)  NOT NULL UNIQUE
);

CREATE TABLE departments (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    college_id INTEGER      NOT NULL REFERENCES colleges(id),
    name       VARCHAR(150) NOT NULL,
    acronym    VARCHAR(20),
    UNIQUE (college_id, name),
    UNIQUE (id, college_id)         
);

CREATE TABLE programs (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id INTEGER         NOT NULL REFERENCES departments(id),
    name          VARCHAR(150)    NOT NULL,      
    acronym       VARCHAR(20)     NOT NULL UNIQUE, 
    level         education_level NOT NULL DEFAULT 'UNDERGRADUATE',
    UNIQUE (department_id, name)
);

-- Student profiles linked 1-to-1 with users and enrolled in an academic program
CREATE TABLE students (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        INTEGER     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    student_number VARCHAR(50) NOT NULL UNIQUE,
    program_id     INTEGER     NOT NULL REFERENCES programs(id),
    year_level     INTEGER     NOT NULL CHECK (year_level BETWEEN 1 AND 6)
);

-- Faculty adviser profiles linked 1-to-1 with users and affiliated with a college
CREATE TABLE advisers (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         INTEGER     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_number VARCHAR(50) UNIQUE,
    title           VARCHAR(50),
    college_id      INTEGER REFERENCES colleges(id) ON DELETE SET NULL
);

-- ============================================================
-- 3. STUDENT ORGANIZATIONS & ADVISER ASSIGNMENTS
-- ============================================================
CREATE TABLE organizations (
    id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name              VARCHAR(150)    NOT NULL,
    acronym           VARCHAR(20),
    description       TEXT,
    -- ============================================================
    -- [GOOGLE DRIVE API PLACEHOLDER — ORGANIZATION LOGO IMAGE]
    -- Insert Google Drive API shared image URL / file ID here for organization logos.
    -- ============================================================
    logo              TEXT,
    org_type          org_type        NOT NULL DEFAULT 'OTHER',
    category          VARCHAR(100),
    scope             org_scope       NOT NULL DEFAULT 'COLLEGE',
    college_id        INTEGER REFERENCES colleges(id),
    department_id     INTEGER,
    status            org_status      NOT NULL DEFAULT 'PENDING',
    created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at       TIMESTAMPTZ,
    eligible_level    education_level DEFAULT 'UNDERGRADUATE',
    min_year_level    INTEGER,
    max_year_level    INTEGER,
    eligibility_notes TEXT,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Ensures department_id belongs to the specified college_id
    CONSTRAINT fk_org_department_college
        FOREIGN KEY (department_id, college_id) REFERENCES departments (id, college_id),

    -- Enforces valid college/department ownership combinations per scope
    CONSTRAINT chk_org_scope CHECK (
        (scope = 'UNIVERSITY' AND college_id IS NULL     AND department_id IS NULL) OR
        (scope = 'COLLEGE'    AND college_id IS NOT NULL AND department_id IS NULL) OR
        (scope = 'DEPARTMENT' AND college_id IS NOT NULL AND department_id IS NOT NULL)
    ),

    -- Enforces valid minimum and maximum student year levels
    CONSTRAINT chk_org_year_range CHECK (
        (min_year_level IS NULL OR min_year_level BETWEEN 1 AND 6) AND
        (max_year_level IS NULL OR max_year_level BETWEEN 1 AND 6) AND
        (min_year_level IS NULL OR max_year_level IS NULL OR min_year_level <= max_year_level)
    )
);

-- Unique organization name and acronym within the same college/department scope
CREATE UNIQUE INDEX uq_org_name_per_owner
    ON organizations (lower(name), COALESCE(college_id, 0), COALESCE(department_id, 0));

CREATE UNIQUE INDEX uq_org_acronym_per_owner
    ON organizations (lower(acronym), COALESCE(college_id, 0), COALESCE(department_id, 0))
    WHERE acronym IS NOT NULL;

-- At most one Student Council per college and one University Student Council
CREATE UNIQUE INDEX uq_one_council_per_college
    ON organizations (college_id)
    WHERE org_type = 'STUDENT_COUNCIL' AND scope = 'COLLEGE';

CREATE UNIQUE INDEX uq_one_university_council
    ON organizations (org_type)
    WHERE org_type = 'STUDENT_COUNCIL' AND scope = 'UNIVERSITY';

-- Tracks current and historical adviser assignments per organization
CREATE TABLE organization_advisers (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    adviser_id      INTEGER NOT NULL REFERENCES advisers(id),
    assigned_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,                     -- NULL = current adviser
    CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);

CREATE UNIQUE INDEX uq_one_current_adviser
    ON organization_advisers (organization_id)
    WHERE ended_at IS NULL;

-- Requests to transition an organization to a new faculty adviser
CREATE TABLE adviser_change_requests (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id     INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    current_adviser_id  INTEGER REFERENCES advisers(id),
    proposed_adviser_id INTEGER REFERENCES advisers(id),
    requested_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason              TEXT NOT NULL,
    status              change_request_status NOT NULL DEFAULT 'PENDING',
    reviewed_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    review_remarks      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at         TIMESTAMPTZ,
    CHECK (current_adviser_id IS DISTINCT FROM proposed_adviser_id)
);

CREATE UNIQUE INDEX uq_one_pending_change_request
    ON adviser_change_requests (organization_id)
    WHERE status = 'PENDING';

-- ============================================================
-- 4. ORGANIZATION MEMBERSHIPS & APPLICATIONS
-- ============================================================
CREATE TABLE organization_members (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES students(id)      ON DELETE CASCADE,
    position        member_position NOT NULL DEFAULT 'MEMBER',
    custom_title    VARCHAR(100),                   
    status          member_status   NOT NULL DEFAULT 'ACTIVE',
    joined_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    left_at         TIMESTAMPTZ,                    
    UNIQUE (organization_id, student_id),
    CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE TABLE organization_applications (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    applicant_id    INTEGER NOT NULL REFERENCES students(id)      ON DELETE CASCADE,
    message         TEXT,
    status          application_status NOT NULL DEFAULT 'PENDING',
    reviewed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_one_pending_application
    ON organization_applications (organization_id, applicant_id)
    WHERE status = 'PENDING';

-- ============================================================
-- 5. EVENTS & ATTENDANCE MANAGEMENT
-- ============================================================
CREATE TABLE events (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    location        VARCHAR(200),
    start_date      TIMESTAMPTZ  NOT NULL,
    end_date        TIMESTAMPTZ  NOT NULL,
    -- ============================================================
    -- [GOOGLE DRIVE API PLACEHOLDER — EVENT ATTACHMENTS & MATERIALS]
    -- Insert Google Drive API shared folder URL / file ID here for event documents.
    -- ============================================================
    drive_folder_id TEXT,                              -- Google Drive Folder ID
    status          event_status NOT NULL DEFAULT 'DRAFT',
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);

CREATE TABLE event_registrations (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
    student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    qr_code       TEXT    NOT NULL UNIQUE,            
    status        registration_status NOT NULL DEFAULT 'REGISTERED',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, student_id)
);

CREATE TABLE attendance (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    scanned_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
    method          attendance_method NOT NULL DEFAULT 'QR_SCAN',
    verified_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (event_id, student_id)
);

-- ============================================================
-- 6. DOCUMENT COMPLIANCE & ANNOUNCEMENTS
-- ============================================================
CREATE TABLE documents (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(200)    NOT NULL,
    doc_type        document_type   NOT NULL,
    -- ============================================================
    -- [GOOGLE DRIVE API PLACEHOLDER — DOCUMENT STORAGE & VERSIONING]
    -- Insert Google Drive API file webViewLink or Drive File ID here.
    -- ============================================================
    drive_file_id   TEXT            NOT NULL,          -- Google Drive File ID
    drive_view_link TEXT,                              -- Web view link in Drive
    status          document_status NOT NULL DEFAULT 'PENDING',
    reviewed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    review_remarks  TEXT,
    version         INTEGER         NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE TABLE announcements (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    author_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    content         TEXT         NOT NULL,
    published_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. NOTIFICATIONS & AUDIT LOGS
-- ============================================================
CREATE TABLE notifications (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50)  NOT NULL,                  -- e.g. 'APPLICATION_STATUS', 'DOCUMENT_REVIEW'
    title      VARCHAR(200) NOT NULL,
    message    TEXT         NOT NULL,
    read_at    TIMESTAMPTZ,                            -- NULL = unread
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(100) NOT NULL,                  -- e.g. 'ORGANIZATION_APPROVED'
    entity     VARCHAR(50)  NOT NULL,                  -- e.g. 'organizations'
    entity_id  INTEGER,
    metadata   JSONB,                                  -- Detailed change payload
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. BUSINESS RULES, TRIGGERS & PROCEDURES
-- ============================================================

-- Automatically update updated_at on record change
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orgs_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enforce at most ONE active president per organization
CREATE OR REPLACE FUNCTION trg_enforce_single_active_president()
RETURNS trigger AS $$
DECLARE
    v_active_presidents INTEGER;
BEGIN
    IF NEW.position = 'PRESIDENT' AND NEW.status = 'ACTIVE' AND NEW.left_at IS NULL THEN
        SELECT COUNT(*)
          INTO v_active_presidents
          FROM organization_members
         WHERE organization_id = NEW.organization_id
           AND position = 'PRESIDENT'
           AND status = 'ACTIVE'
           AND left_at IS NULL
           AND id IS DISTINCT FROM NEW.id;

        IF v_active_presidents > 0 THEN
            RAISE EXCEPTION 'This organization already has an active President. Reassign the current president before setting a new one.'
                USING ERRCODE = '23505';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_single_active_president
    BEFORE INSERT OR UPDATE OF position, status, left_at ON organization_members
    FOR EACH ROW EXECUTE FUNCTION trg_enforce_single_active_president();

-- Eligibility check function (checks scope, college, department, academic level, and year level)
CREATE OR REPLACE FUNCTION student_can_join(p_org_id INTEGER, p_student_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    o         organizations%ROWTYPE;
    s_college INTEGER;
    s_dept    INTEGER;
    s_level   education_level;
    s_year    INTEGER;
BEGIN
    SELECT * INTO o FROM organizations WHERE id = p_org_id;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    SELECT d.college_id, d.id, p.level, st.year_level
      INTO s_college, s_dept, s_level, s_year
      FROM students st
      JOIN programs p    ON p.id = st.program_id
      JOIN departments d ON d.id = p.department_id
     WHERE st.id = p_student_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Undergraduate / graduate restriction
    IF o.eligible_level IS NOT NULL AND o.eligible_level <> s_level THEN
        RETURN FALSE;
    END IF;

    -- Year-level restriction
    IF o.min_year_level IS NOT NULL AND s_year < o.min_year_level THEN
        RETURN FALSE;
    END IF;
    IF o.max_year_level IS NOT NULL AND s_year > o.max_year_level THEN
        RETURN FALSE;
    END IF;

    -- College / department restriction
    IF o.scope = 'UNIVERSITY' THEN
        RETURN TRUE;
    END IF;

    IF o.scope = 'COLLEGE' THEN
        RETURN s_college = o.college_id;
    END IF;

    RETURN s_dept = o.department_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION trg_member_eligibility() RETURNS trigger AS $$
BEGIN
    IF NOT student_can_join(NEW.organization_id, NEW.student_id) THEN
        RAISE EXCEPTION 'Student is not eligible to join this organization (eligibility restrictions apply).';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_member_eligibility
    BEFORE INSERT OR UPDATE OF organization_id, student_id ON organization_members
    FOR EACH ROW EXECUTE FUNCTION trg_member_eligibility();

CREATE OR REPLACE FUNCTION trg_application_eligibility() RETURNS trigger AS $$
BEGIN
    IF NOT student_can_join(NEW.organization_id, NEW.applicant_id) THEN
        RAISE EXCEPTION 'Student is not eligible to apply to this organization (eligibility restrictions apply).';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_application_eligibility
    BEFORE INSERT OR UPDATE OF organization_id, applicant_id ON organization_applications
    FOR EACH ROW EXECUTE FUNCTION trg_application_eligibility();

-- Close previous current adviser when a new assignment is inserted
CREATE OR REPLACE FUNCTION trg_close_previous_adviser() RETURNS trigger AS $$
BEGIN
    IF NEW.ended_at IS NULL THEN
        UPDATE organization_advisers
           SET ended_at = NEW.assigned_at
         WHERE organization_id = NEW.organization_id
           AND id <> NEW.id
           AND ended_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_end_previous_adviser
    AFTER INSERT ON organization_advisers
    FOR EACH ROW EXECUTE FUNCTION trg_close_previous_adviser();

-- ============================================================
-- 9. PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX idx_students_program            ON students (program_id);
CREATE INDEX idx_orgs_college                ON organizations (college_id);
CREATE INDEX idx_orgs_department             ON organizations (department_id);
CREATE INDEX idx_orgs_status                 ON organizations (status);
CREATE INDEX idx_org_members_student         ON organization_members (student_id);
CREATE INDEX idx_org_members_status          ON organization_members (organization_id, status);
CREATE INDEX idx_org_applications_applicant ON organization_applications (applicant_id);
CREATE INDEX idx_events_org_start           ON events (organization_id, start_date);
CREATE INDEX idx_event_regs_student         ON event_registrations (student_id);
CREATE INDEX idx_attendance_student         ON attendance (student_id);
CREATE INDEX idx_documents_org              ON documents (organization_id, status);
CREATE INDEX idx_announcements_org          ON announcements (organization_id, published_at DESC);
CREATE INDEX idx_notifications_user_unread  ON notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX idx_audit_logs_user_time       ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity          ON audit_logs (entity, entity_id);

-- ============================================================
-- 10. CANONICAL WMSU SEED DATA (Colleges, Departments, Programs, Organizations)
-- Source: Official WMSU College & Organization Registry
-- ============================================================

-- ------------------------------------------------------------
-- 10.1 COLLEGES (17 Official WMSU Colleges)
-- ------------------------------------------------------------
UPDATE colleges SET acronym = 'CArch' WHERE name = 'College of Architecture' AND acronym <> 'CArch';
UPDATE colleges SET acronym = 'CA'    WHERE name = 'College of Agriculture' AND acronym <> 'CA';
UPDATE colleges SET acronym = 'CON'   WHERE name = 'College of Nursing' AND acronym <> 'CON';
UPDATE colleges SET acronym = 'CLAW'  WHERE name = 'College of Law' AND acronym <> 'CLAW';
UPDATE colleges SET acronym = 'COM'   WHERE name = 'College of Medicine' AND acronym <> 'COM';

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
    ('College of Teacher Education',                              'CTE')
ON CONFLICT (name) DO UPDATE SET acronym = EXCLUDED.acronym;

-- ------------------------------------------------------------
-- 10.2 UNDERGRADUATE DEPARTMENTS & PROGRAMS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS _undergrad;
CREATE TEMP TABLE _undergrad (college_acr TEXT, name TEXT, dept_acr TEXT, prog_acr TEXT);

INSERT INTO _undergrad VALUES
    -- College of Agriculture
    ('CA',    'Bachelor of Science in Agriculture',                         'BSA',   'BSA'),
    ('CA',    'Bachelor of Science in Food Technology',                     'BSFT',  'BSFT'),
    ('CA',    'Bachelor of Science in Agribusiness',                        'BSAB',  'BSAB'),
    ('CA',    'Bachelor of Agricultural Technology',                        'BAT',   'BAT'),
    -- College of Liberal Arts
    ('CLA',   'Bachelor of Arts in History',                                NULL,    'BAH'),
    ('CLA',   'Bachelor of Arts in Filipino',                               NULL,    'BAFIL'),
    ('CLA',   'Bachelor of Arts in English',                                NULL,    'BAE'),
    ('CLA',   'Bachelor of Arts in Political Science',                      NULL,    'BAPS'),
    ('CLA',   'Bachelor of Arts in Mass Communication – Journalism',        NULL,    'BAMC-J'),
    ('CLA',   'Bachelor of Arts in Mass Communication – Broadcasting',      NULL,    'BAMC-B'),
    ('CLA',   'Bachelor of Science in Economics',                           NULL,    'BSECON'),
    ('CLA',   'Bachelor of Science in Psychology',                          NULL,    'BSPSY'),
    -- College of Architecture
    ('CArch', 'Bachelor of Science in Architecture',                        NULL,    'BSARCH'),
    -- College of Nursing
    ('CON',   'Bachelor of Science in Nursing',                             NULL,    'BSN'),
    -- College of Computing Studies
    ('CCS',   'Bachelor of Science in Computer Science',                    'BSCS',  'BSCS'),
    ('CCS',   'Bachelor of Science in Information Technology',              'BSIT',  'BSIT'),
    ('CCS',   'Associate in Computer Technology',                           'ACT',   'ACT'),
    -- College of Forestry and Environmental Studies
    ('CFES',  'Bachelor of Science in Forestry',                            NULL,    'BSF'),
    ('CFES',  'Bachelor of Science in Agroforestry',                        NULL,    'BSAF'),
    ('CFES',  'Bachelor of Science in Environmental Science',               NULL,    'BSES'),
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
    ('CPADS', 'Bachelor of Science in Accountancy',                         NULL,    'BSACCT'),
    -- College of Sports Science and Physical Education
    ('CSSPE', 'Bachelor of Physical Education',                             'BPED',  'BPED'),
    ('CSSPE', 'Bachelor of Science in Exercise and Sports Sciences',        'BSESS', 'BSESS'),
    -- College of Science and Mathematics
    ('CSM',   'BS Biology',                                                 NULL,    'BSBIO'),
    ('CSM',   'BS Chemistry',                                               NULL,    'BSCHEM'),
    ('CSM',   'BS Mathematics',                                             NULL,    'BSMATH'),
    ('CSM',   'BS Physics',                                                 NULL,    'BSPHY'),
    ('CSM',   'BS Statistics',                                              NULL,    'BSSTAT'),
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
    ('CHE',   'BS Hospitality Management',                                  NULL,    'BSHM'),
    ('CHE',   'BS Nutrition and Dietetics',                                 NULL,    'BSND'),
    ('CHE',   'Bachelor of Science in Home Economics',                      NULL,    'BSHE'),
    -- College of Criminal Justice Education
    ('CCJE',  'Bachelor of Science in Criminology',                         NULL,    'BSCRIM'),
    -- College of Asian and Islamic Studies
    ('CAIS',  'BS Islamic Studies',                                         NULL,    'BSIS'),
    ('CAIS',  'AB Asian Studies',                                           NULL,    'ABAS');

INSERT INTO departments (college_id, name, acronym)
SELECT c.id, u.name, COALESCE(u.dept_acr, u.prog_acr)
  FROM _undergrad u
  JOIN colleges c ON c.acronym = u.college_acr
ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;

INSERT INTO programs (department_id, name, acronym, level)
SELECT d.id, d.name, u.prog_acr, 'UNDERGRADUATE'::education_level
  FROM _undergrad u
  JOIN colleges c    ON c.acronym = u.college_acr
  JOIN departments d ON d.college_id = c.id AND d.name = u.name
ON CONFLICT (acronym) DO UPDATE
   SET name = EXCLUDED.name,
       department_id = EXCLUDED.department_id,
       level = EXCLUDED.level;

DROP TABLE IF EXISTS _undergrad;

-- ------------------------------------------------------------
-- 10.3 GRADUATE DEPARTMENTS & PROGRAMS
-- ------------------------------------------------------------
DROP TABLE IF EXISTS _grad;
CREATE TEMP TABLE _grad (college_acr TEXT, name TEXT, acr TEXT);

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
  JOIN colleges c ON c.acronym = g.college_acr
ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;

INSERT INTO programs (department_id, name, acronym, level)
SELECT d.id, g.name, g.acr, 'GRADUATE'::education_level
  FROM _grad g
  JOIN colleges c    ON c.acronym = g.college_acr
  JOIN departments d ON d.college_id = c.id AND d.name = 'Graduate Programs'
ON CONFLICT (acronym) DO UPDATE
   SET name = EXCLUDED.name,
       department_id = EXCLUDED.department_id,
       level = EXCLUDED.level;

DROP TABLE IF EXISTS _grad;

-- ------------------------------------------------------------
-- 10.4 STUDENT ORGANIZATIONS (64 Official WMSU Organizations)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS _orgs;
CREATE TEMP TABLE _orgs (
    college_acr TEXT, dept_name TEXT, name TEXT, acronym TEXT, org_type TEXT,
    level TEXT, min_year INTEGER, max_year INTEGER, notes TEXT, adviser_raw TEXT
);

INSERT INTO _orgs VALUES
    ('COE', 'BS Civil Engineering', 'Academic Community of Civil Engineering Students', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CFES', 'Bachelor of Science in Forestry', 'Agroforestry Student Organization', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Mr. Guiller Ellomer'),
    ('CTE', 'Bachelor of Culture and Arts Education', 'Bachelor of Culture and Arts Education Club', NULL, 'CULTURAL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Asso. Prof. Eric-Roland R. Natividad'),
    ('CCJE', 'Bachelor of Science in Criminology', 'CCJE Practicum Student Organization', NULL, 'ACADEMIC', 'UNDERGRADUATE', 3, 3, '3rd year only', 'Mr. Reinier N. Rosaldo'),
    ('CLA', 'Bachelor of Arts in English', 'English Language Teaching Society', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Ms. Ma. Reginne Nazario'),
    ('CFES', 'Bachelor of Science in Forestry', 'Forestry Student Association', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Juprelan Labanacruz'),
    ('COE', 'BS Geodetic Engineering', 'Geodetic Engineering Student’s Association', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Regina O. Acosta'),
    ('COE', 'BS Computer Engineering', 'Institute of Computer Engineers of the Philippines Student Edition – WMSU Chapter', NULL, 'TECHNOLOGY', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Gajil J. Santos'),
    ('COE', 'BS Electrical Engineering', 'Institute of Integrated Electrical Engineers – Student Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Alvin P. Miguel'),
    ('CCJE', 'Bachelor of Science in Criminology', 'Junior Criminology Organization', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Mr. Reinier N. Rosaldo'),
    ('CFES', 'Bachelor of Science in Forestry', 'Junior Foresters Association of the Philippines', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Juprelan Labanacruz'),
    ('COE', 'BS Electronics Engineering', 'Junior Institute of Electronic Engineers of the Philippines – WMSU Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Kevin Marc A. Bejerano'),
    ('CPADS', 'Bachelor of Science in Accountancy', 'Junior Philippine Institute of Accountants – WMSU Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Ms. Satina S. Muammil, CPA'),
    ('CLA', 'Bachelor of Arts in Mass Communication – Broadcasting', 'Masscomm Society', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Asst. Prof. Edralin B. Villanueva'),
    ('COE', 'BS Mechanical Engineering', 'Pambansang Samahan ng Inhenyero Mekanikal – WMSU Student Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('COE', 'BS Industrial Engineering', 'Philippine Institute of Industrial Engineers – WMSU Student Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Aylene Ingkoh'),
    ('CCS', 'Bachelor of Science in Information Technology', 'Philippine Society for Information Technology Students', NULL, 'TECHNOLOGY', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Marvic Lines'),
    ('COE', 'BS Agricultural and Biosystems Engineering', 'Philippine Society of Agricultural and Biosystems Engineers Pre-Professional Group', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Michelle U. Baltazar'),
    ('COE', 'BS Sanitary Engineering', 'Philippine Society of Sanitary Engineering – WMSU Student Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Sara Jamila J. Tan'),
    ('CLA', 'Bachelor of Arts in Political Science', 'Political Science Society', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Prof. Judy B. Gonzales'),
    ('CLA', 'Bachelor of Science in Psychology', 'Psychology Society', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Ms. Daniella C. Aporador'),
    ('COE', 'BS Environmental Engineering', 'Society of Environmental Engineers WMSU Student Chapter', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CSSPE', 'Bachelor of Physical Education', 'Association in Physical Education Majors', 'APEM', 'SPORTS', 'UNDERGRADUATE', NULL, NULL, NULL, 'Asst. Prof. Keith Alvin S. Solamillo'),
    ('CLA', 'Bachelor of Arts in Filipino', 'Samahang Batsilyer ng Sining sa Filipino', 'SABFIL', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Ms. Rhea Lopez-Mendoza'),
    ('CSM', 'BS Biology', 'WMSU Life Science Society', 'LSS', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Princess Shaira Bonifacio'),
    ('CSM', 'BS Chemistry', 'WMSU Chemistry Society', 'ChemSoc', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Jayson Francisco'),
    ('CSM', 'BS Statistics', 'Mathematical and Statistical Society', 'MSS', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Aubrey Labastilla and Eman Ahmad'),
    ('CSM', 'BS Physics', 'WMSU Physics Society', 'PhySoc', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Jhonathan G. Saracho'),
    ('CPADS', 'Bachelor of Public Administration', 'Junior Public Administration Association Inc.', 'jpaai', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CHE', 'Bachelor of Science in Home Economics', 'Home Economics Club', NULL, 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CHE', 'BS Nutrition and Dietetics', 'Nutrition and Dietetics Students’ Association', 'NDSA', 'ACADEMIC', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CA', NULL, 'College Student Council – College of Agriculture', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Ms. Queeneevi T. Quijano'),
    ('CArch', NULL, 'College Student Council – College of Architecture', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Prof. Noel D.S. Querijero'),
    ('CCS', NULL, 'College Student Council – College of Computing Studies', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Marjorie A. Rojas'),
    ('CCJE', NULL, 'College Student Council – College of Criminal Justice Education', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Mr. Jiemar A. Arabani'),
    ('COE', NULL, 'College Student Council – College of Engineering', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Nurjimar Ujaji'),
    ('CFES', NULL, 'College Student Council – College of Forestry and Environmental Studies', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Mr. Guiller Ellomer'),
    ('CHE', NULL, 'College Student Council – College of Home Economics', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Prof. Sylvia D.S Hachero'),
    ('CAIS', NULL, 'College Student Council – College of Asian and Islamic Studies', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Abdel-Azeem Moh. Siddique'),
    ('CLA', NULL, 'College Student Council – College of Liberal Arts', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Dr. Rochard Tarroza'),
    ('CON', NULL, 'College Student Council – College of Nursing', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Prof. Jocelyn D. Orquia'),
    ('CSM', NULL, 'College Student Council – College of Science and Mathematics', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Prof. Noricel U. Garcia'),
    ('CSWCD', NULL, 'College Student Council – College of Social Work and Community Development', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Prof. Esa H. Jumlail Jr'),
    ('CSSPE', NULL, 'College Student Council – College of Sports Science and Physical Education', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Prof. Salih T. Allian'),
    ('CTE', NULL, 'College Student Council – College of Teacher Education', NULL, 'STUDENT_COUNCIL', 'UNDERGRADUATE', NULL, NULL, NULL, 'Prof. Kharylle Schyneid T. Kenoh'),
    ('CA', NULL, 'Gender Club – College of Agriculture', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CArch', NULL, 'Gender Club – College of Architecture', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CAIS', NULL, 'Gender Club – College of Asian and Islamic Studies', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CCS', NULL, 'Gender Club – College of Computing Studies', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Marjorie Rojas'),
    ('CCJE', NULL, 'Gender Club – College of Criminal Justice Education', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, 'Ms. Melodina Francisco'),
    ('COE', NULL, 'Gender Club – College of Engineering', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Catherine Falcasantos'),
    ('CFES', NULL, 'Gender Club – College of Forestry and Environmental Studies', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CHE', NULL, 'Gender Club – College of Home Economics', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CLA', NULL, 'Gender Club – College of Liberal Arts', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CON', NULL, 'Gender Club – College of Nursing', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CPADS', NULL, 'Gender Club – College of Public Administration and Development Studies', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CSM', NULL, 'Gender Club – College of Science and Mathematics', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CSWCD', NULL, 'Gender Club – College of Social Work and Community Development', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, 'Asst. Prof. Mary Ann T. Enriquez'),
    ('CSSPE', NULL, 'Gender Club – College of Sports Science and Physical Education', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, 'Asst. Prof. Keith Alvin S. Solamillo'),
    ('CTE', NULL, 'Gender Club – College of Teacher Education', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, 'Mr. Robert O. Parcon'),
    ('CTE', NULL, 'CTE Pre-Service Teachers Organization', NULL, 'OTHER', 'UNDERGRADUATE', 4, 4, '4th year students only', 'Prof. Bernardita G. Bacang'),
    ('CTE', NULL, 'CTE The Current Society', NULL, 'OTHER', 'UNDERGRADUATE', NULL, NULL, NULL, 'Dr. Ryan B. Cabangcala'),
    ('CTE', NULL, 'The Horizon', NULL, 'PUBLICATION', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CCJE', NULL, 'Eclectic Defense System', NULL, 'SPORTS_RECREATION', 'UNDERGRADUATE', NULL, NULL, NULL, 'Mr. Reinier N. Rosaldo'),
    ('CFES', NULL, 'Environmental Science Society', NULL, 'OTHER', 'UNDERGRADUATE', NULL, NULL, NULL, 'Minsarib Kahasa'),
    ('COE', NULL, 'Hawk’s Eye Publication', NULL, 'PUBLICATION', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Ivy Francisco'),
    ('COE', NULL, 'Hawkwards', NULL, 'PUBLICATION', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('COE', NULL, 'Crimson Hawks', NULL, 'SPORTS_RECREATION', 'UNDERGRADUATE', NULL, NULL, NULL, 'Mr. Salimar Tahil'),
    ('CCS', NULL, 'Venom', NULL, 'PUBLICATION', 'UNDERGRADUATE', NULL, NULL, NULL, 'Engr. Marvic Lines'),
    ('CCS', NULL, 'Philippine Computing Students Society', 'PhiCSS', 'TECHNOLOGY', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CON', NULL, 'The Prime Mover', NULL, 'OTHER', 'UNDERGRADUATE', NULL, NULL, NULL, 'Asso. Prof. Divine Grace M. Marumas'),
    ('CON', NULL, 'Synapse Chorale', NULL, 'CULTURAL', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CHE', NULL, 'Hospitality Management League of Leaders', 'HMLL', 'LEADERSHIP', 'UNDERGRADUATE', NULL, NULL, NULL, NULL),
    ('CSSPE', NULL, 'Kinematics Emergency Response Team', 'KERT', 'SOCIO_CIVIC', 'UNDERGRADUATE', NULL, NULL, NULL, 'Mr. John Wilmer F. Laureano'),
    ('CSSPE', NULL, 'Kinematography', NULL, 'SPECIAL_INTEREST', 'UNDERGRADUATE', NULL, NULL, NULL, 'Mr. Brian Rino H. Traigo'),
    ('COM', NULL, 'Crimson Muslim Medical Doctors', NULL, 'SPECIAL_INTEREST', 'GRADUATE', NULL, NULL, NULL, 'Dr. Al-Radja Jamiri, M.D'),
    ('CLAW', NULL, 'Law Student Association', NULL, 'OTHER', 'GRADUATE', NULL, NULL, NULL, 'Atty. Jules Christian D. Marcos'),
    ('CTE', NULL, 'CTE Graduate Student Association', NULL, 'OTHER', 'GRADUATE', NULL, NULL, NULL, 'Prof. Arnel Madrazo'),
    ('CSM', NULL, 'CSM Graduate School Association', NULL, 'OTHER', 'GRADUATE', NULL, NULL, NULL, 'Dr. Anabel E. Gamorez'),
    ('CLA', NULL, 'CLA Graduate School Students Association', NULL, 'OTHER', 'GRADUATE', NULL, NULL, NULL, 'Dr. Rodita C. Silva'),
    (NULL, NULL, 'University Student Council', 'USC', 'STUDENT_COUNCIL', NULL, NULL, NULL, NULL, 'Ms. Eleanor Comeros'),
    (NULL, NULL, 'WMSU Gender Association', NULL, 'SPECIAL_INTEREST', NULL, NULL, NULL, NULL, 'Dr. Elmer M. Labad'),
    (NULL, NULL, 'Council of the Greeks', NULL, 'LEADERSHIP', NULL, NULL, NULL, NULL, 'Prof. Al-Ghani D. Mohammad'),
    (NULL, NULL, 'The Legal Network for Truthful Elections – WMSU Chapter', 'LENTE', 'OTHER', NULL, NULL, NULL, NULL, 'Ms. Dezza Mohammad, CPA, RN'),
    (NULL, NULL, 'Muslim Student Association', NULL, 'RELIGIOUS', NULL, NULL, NULL, NULL, 'Engr. Marlon Grande'),
    (NULL, NULL, 'NSync Music Organization', NULL, 'CULTURAL', NULL, NULL, NULL, NULL, 'Dezza Mohammad, CPA, RN'),
    (NULL, NULL, 'Philippine Students Alliance Lay Movement, Inc.', 'PSALM', 'OTHER', NULL, NULL, NULL, NULL, 'Mr. Floramie M. Ramiro'),
    (NULL, NULL, 'Rotaract Club', NULL, 'SOCIO_CIVIC', NULL, NULL, NULL, NULL, 'Engr. Marlon C. Grande'),
    (NULL, NULL, 'The New Blazer', NULL, 'PUBLICATION', NULL, NULL, NULL, NULL, 'Dr. Carl Richard C. Dagalea'),
    (NULL, NULL, 'UNESCO Club', NULL, 'SOCIO_CIVIC', NULL, NULL, NULL, NULL, 'Engr. Marlon C. Grande'),
    (NULL, NULL, 'University Digest', NULL, 'PUBLICATION', NULL, NULL, NULL, NULL, 'Dr. Lea Usman'),
    (NULL, NULL, 'WMSU Graduating Student Association', NULL, 'SPECIAL_INTEREST', NULL, 4, NULL, 'Open to graduating students (4th year and up)', 'Dr. Vicenta T. Escobar'),
    (NULL, NULL, 'WMSU Grand Chorale', NULL, 'CULTURAL', NULL, NULL, NULL, NULL, NULL),
    (NULL, NULL, 'WMSU League of Debaters', NULL, 'SPECIAL_INTEREST', NULL, NULL, NULL, NULL, 'Prof. Joyce Mangubat'),
    (NULL, NULL, 'WMSU Peace Mediators Club', NULL, 'SOCIO_CIVIC', NULL, NULL, NULL, NULL, 'Engr. Marlon C. Grande'),
    (NULL, NULL, 'DOST-SEI CBPSME Scholars’ Association', NULL, 'SPECIAL_INTEREST', NULL, NULL, NULL, 'DOST scholars only (verify through application review)', 'Dr. Mohammad Nur S. Paspasan'),
    (NULL, NULL, 'Jambangan', NULL, 'OTHER', NULL, NULL, NULL, NULL, NULL),
    (NULL, NULL, 'WMSU Youth Entrepreneurs', NULL, 'OTHER', NULL, NULL, NULL, NULL, NULL),
    (NULL, NULL, 'WMSU Lakandiwa', NULL, 'OTHER', NULL, NULL, NULL, NULL, NULL);

INSERT INTO organizations
    (name, acronym, org_type, category, scope, college_id, department_id, status, approved_at,
     eligible_level, min_year_level, max_year_level, eligibility_notes)
SELECT o.name,
       o.acronym,
       o.org_type::org_type,
       CASE o.org_type
           WHEN 'STUDENT_COUNCIL' THEN 'Student Council'
           WHEN 'ACADEMIC' THEN 'Academic'
           WHEN 'TECHNOLOGY' THEN 'Technology'
           WHEN 'LEADERSHIP' THEN 'Leadership'
           WHEN 'SPECIAL_INTEREST' THEN 'Special Interest'
           WHEN 'PUBLICATION' THEN 'Publication'
           WHEN 'SOCIO_CIVIC' THEN 'Socio-Civic'
           WHEN 'CULTURAL' THEN 'Cultural'
           WHEN 'SPORTS_RECREATION' THEN 'Sports & Recreation'
           WHEN 'SPORTS' THEN 'Sports'
           WHEN 'RELIGIOUS' THEN 'Religious'
           ELSE 'Other'
       END,
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
  LEFT JOIN departments d ON d.college_id = c.id AND d.name = o.dept_name
ON CONFLICT (lower(name), COALESCE(college_id, 0), COALESCE(department_id, 0)) DO UPDATE
   SET acronym = EXCLUDED.acronym,
       org_type = EXCLUDED.org_type,
       category = EXCLUDED.category,
       eligible_level = EXCLUDED.eligible_level,
       min_year_level = EXCLUDED.min_year_level,
       max_year_level = EXCLUDED.max_year_level,
       eligibility_notes = EXCLUDED.eligibility_notes,
       status = 'ACTIVE';

-- ============================================================
-- 10.4.1 FACULTY ADVISERS SEED REGISTRY (64 Verified Advisers)
-- ============================================================
DROP TABLE IF EXISTS _advisers;
CREATE TEMP TABLE _advisers (
    full_name TEXT, title TEXT, first_name TEXT, middle_name TEXT, last_name TEXT,
    suffix TEXT, email TEXT, employee_number TEXT, college_acr TEXT
);

INSERT INTO _advisers VALUES
    ('Mr. Guiller Ellomer', 'Mr.', 'Guiller', NULL, 'Ellomer', NULL, 'guiller.ellomer@wmsu.edu.ph', 'EMP-ADV-101', 'CFES'),
    ('Asso. Prof. Eric-Roland R. Natividad', 'Asso. Prof.', 'Eric-Roland', 'R.', 'Natividad', NULL, 'ericroland.natividad@wmsu.edu.ph', 'EMP-ADV-102', 'CTE'),
    ('Mr. Reinier N. Rosaldo', 'Mr.', 'Reinier', 'N.', 'Rosaldo', NULL, 'reinier.rosaldo@wmsu.edu.ph', 'EMP-ADV-103', 'CCJE'),
    ('Ms. Ma. Reginne Nazario', 'Ms.', 'Ma. Reginne', NULL, 'Nazario', NULL, 'mareginne.nazario@wmsu.edu.ph', 'EMP-ADV-104', 'CLA'),
    ('Juprelan Labanacruz', NULL, 'Juprelan', NULL, 'Labanacruz', NULL, 'juprelan.labanacruz@wmsu.edu.ph', 'EMP-ADV-105', 'CFES'),
    ('Engr. Regina O. Acosta', 'Engr.', 'Regina', 'O.', 'Acosta', NULL, 'regina.acosta@wmsu.edu.ph', 'EMP-ADV-106', 'COE'),
    ('Engr. Gajil J. Santos', 'Engr.', 'Gajil', 'J.', 'Santos', NULL, 'gajil.santos@wmsu.edu.ph', 'EMP-ADV-107', 'COE'),
    ('Engr. Alvin P. Miguel', 'Engr.', 'Alvin', 'P.', 'Miguel', NULL, 'alvin.miguel@wmsu.edu.ph', 'EMP-ADV-108', 'COE'),
    ('Engr. Kevin Marc A. Bejerano', 'Engr.', 'Kevin Marc', 'A.', 'Bejerano', NULL, 'kevinmarc.bejerano@wmsu.edu.ph', 'EMP-ADV-109', 'COE'),
    ('Ms. Satina S. Muammil, CPA', 'Ms.', 'Satina', 'S.', 'Muammil', 'CPA', 'satina.muammil@wmsu.edu.ph', 'EMP-ADV-110', 'CPADS'),
    ('Asst. Prof. Edralin B. Villanueva', 'Asst. Prof.', 'Edralin', 'B.', 'Villanueva', NULL, 'edralin.villanueva@wmsu.edu.ph', 'EMP-ADV-111', 'CLA'),
    ('Engr. Aylene Ingkoh', 'Engr.', 'Aylene', NULL, 'Ingkoh', NULL, 'aylene.ingkoh@wmsu.edu.ph', 'EMP-ADV-112', 'COE'),
    ('Engr. Marvic Lines', 'Engr.', 'Marvic', NULL, 'Lines', NULL, 'marvic.lines@wmsu.edu.ph', 'EMP-ADV-113', 'CCS'),
    ('Engr. Michelle U. Baltazar', 'Engr.', 'Michelle', 'U.', 'Baltazar', NULL, 'michelle.baltazar@wmsu.edu.ph', 'EMP-ADV-114', 'COE'),
    ('Engr. Sara Jamila J. Tan', 'Engr.', 'Sara Jamila', 'J.', 'Tan', NULL, 'sarajamila.tan@wmsu.edu.ph', 'EMP-ADV-115', 'COE'),
    ('Prof. Judy B. Gonzales', 'Prof.', 'Judy', 'B.', 'Gonzales', NULL, 'judy.gonzales@wmsu.edu.ph', 'EMP-ADV-116', 'CLA'),
    ('Ms. Daniella C. Aporador', 'Ms.', 'Daniella', 'C.', 'Aporador', NULL, 'daniella.aporador@wmsu.edu.ph', 'EMP-ADV-117', 'CLA'),
    ('Asst. Prof. Keith Alvin S. Solamillo', 'Asst. Prof.', 'Keith Alvin', 'S.', 'Solamillo', NULL, 'keithalvin.solamillo@wmsu.edu.ph', 'EMP-ADV-118', 'CSSPE'),
    ('Ms. Rhea Lopez-Mendoza', 'Ms.', 'Rhea', NULL, 'Lopez-Mendoza', NULL, 'rhea.lopezmendoza@wmsu.edu.ph', 'EMP-ADV-119', 'CLA'),
    ('Princess Shaira Bonifacio', NULL, 'Princess Shaira', NULL, 'Bonifacio', NULL, 'princessshaira.bonifacio@wmsu.edu.ph', 'EMP-ADV-120', 'CSM'),
    ('Jayson Francisco', NULL, 'Jayson', NULL, 'Francisco', NULL, 'jayson.francisco@wmsu.edu.ph', 'EMP-ADV-121', 'CSM'),
    ('Aubrey Labastilla and Eman Ahmad', NULL, 'Aubrey', NULL, 'Labastilla', NULL, 'aubrey.labastilla@wmsu.edu.ph', 'EMP-ADV-122', 'CSM'),
    ('Jhonathan G. Saracho', NULL, 'Jhonathan', 'G.', 'Saracho', NULL, 'jhonathan.saracho@wmsu.edu.ph', 'EMP-ADV-123', 'CSM'),
    ('Ms. Queeneevi T. Quijano', 'Ms.', 'Queeneevi', 'T.', 'Quijano', NULL, 'queeneevi.quijano@wmsu.edu.ph', 'EMP-ADV-124', 'CA'),
    ('Prof. Noel D.S. Querijero', 'Prof.', 'Noel', 'D.S.', 'Querijero', NULL, 'noel.querijero@wmsu.edu.ph', 'EMP-ADV-125', 'CArch'),
    ('Engr. Marjorie A. Rojas', 'Engr.', 'Marjorie', 'A.', 'Rojas', NULL, 'marjorie.rojas@wmsu.edu.ph', 'EMP-ADV-126', 'CCS'),
    ('Mr. Jiemar A. Arabani', 'Mr.', 'Jiemar', 'A.', 'Arabani', NULL, 'jiemar.arabani@wmsu.edu.ph', 'EMP-ADV-127', 'CCJE'),
    ('Engr. Nurjimar Ujaji', 'Engr.', 'Nurjimar', NULL, 'Ujaji', NULL, 'nurjimar.ujaji@wmsu.edu.ph', 'EMP-ADV-128', 'COE'),
    ('Prof. Sylvia D.S Hachero', 'Prof.', 'Sylvia D.S', NULL, 'Hachero', NULL, 'sylviads.hachero@wmsu.edu.ph', 'EMP-ADV-129', 'CHE'),
    ('Abdel-Azeem Moh. Siddique', NULL, 'Abdel-Azeem', 'Moh.', 'Siddique', NULL, 'abdelazeem.siddique@wmsu.edu.ph', 'EMP-ADV-130', 'CAIS'),
    ('Dr. Rochard Tarroza', 'Dr.', 'Rochard', NULL, 'Tarroza', NULL, 'rochard.tarroza@wmsu.edu.ph', 'EMP-ADV-131', 'CLA'),
    ('Prof. Jocelyn D. Orquia', 'Prof.', 'Jocelyn', 'D.', 'Orquia', NULL, 'jocelyn.orquia@wmsu.edu.ph', 'EMP-ADV-132', 'CON'),
    ('Prof. Noricel U. Garcia', 'Prof.', 'Noricel', 'U.', 'Garcia', NULL, 'noricel.garcia@wmsu.edu.ph', 'EMP-ADV-133', 'CSM'),
    ('Prof. Esa H. Jumlail Jr', 'Prof.', 'Esa', 'H.', 'Jumlail', 'Jr', 'esa.jumlail@wmsu.edu.ph', 'EMP-ADV-134', 'CSWCD'),
    ('Prof. Salih T. Allian', 'Prof.', 'Salih', 'T.', 'Allian', NULL, 'salih.allian@wmsu.edu.ph', 'EMP-ADV-135', 'CSSPE'),
    ('Prof. Kharylle Schyneid T. Kenoh', 'Prof.', 'Kharylle Schyneid', 'T.', 'Kenoh', NULL, 'kharylleschyneid.kenoh@wmsu.edu.ph', 'EMP-ADV-136', 'CTE'),
    ('Ms. Melodina Francisco', 'Ms.', 'Melodina', NULL, 'Francisco', NULL, 'melodina.francisco@wmsu.edu.ph', 'EMP-ADV-137', 'CCJE'),
    ('Engr. Catherine Falcasantos', 'Engr.', 'Catherine', NULL, 'Falcasantos', NULL, 'catherine.falcasantos@wmsu.edu.ph', 'EMP-ADV-138', 'COE'),
    ('Asst. Prof. Mary Ann T. Enriquez', 'Asst. Prof.', 'Mary Ann', 'T.', 'Enriquez', NULL, 'maryann.enriquez@wmsu.edu.ph', 'EMP-ADV-139', 'CSWCD'),
    ('Mr. Robert O. Parcon', 'Mr.', 'Robert', 'O.', 'Parcon', NULL, 'robert.parcon@wmsu.edu.ph', 'EMP-ADV-140', 'CTE'),
    ('Prof. Bernardita G. Bacang', 'Prof.', 'Bernardita', 'G.', 'Bacang', NULL, 'bernardita.bacang@wmsu.edu.ph', 'EMP-ADV-141', 'CTE'),
    ('Dr. Ryan B. Cabangcala', 'Dr.', 'Ryan', 'B.', 'Cabangcala', NULL, 'ryan.cabangcala@wmsu.edu.ph', 'EMP-ADV-142', 'CTE'),
    ('Minsarib Kahasa', NULL, 'Minsarib', NULL, 'Kahasa', NULL, 'minsarib.kahasa@wmsu.edu.ph', 'EMP-ADV-143', 'CFES'),
    ('Engr. Ivy Francisco', 'Engr.', 'Ivy', NULL, 'Francisco', NULL, 'ivy.francisco@wmsu.edu.ph', 'EMP-ADV-144', 'COE'),
    ('Mr. Salimar Tahil', 'Mr.', 'Salimar', NULL, 'Tahil', NULL, 'salimar.tahil@wmsu.edu.ph', 'EMP-ADV-145', 'COE'),
    ('Asso. Prof. Divine Grace M. Marumas', 'Asso. Prof.', 'Divine Grace', 'M.', 'Marumas', NULL, 'divinegrace.marumas@wmsu.edu.ph', 'EMP-ADV-146', 'CON'),
    ('Mr. John Wilmer F. Laureano', 'Mr.', 'John Wilmer', 'F.', 'Laureano', NULL, 'johnwilmer.laureano@wmsu.edu.ph', 'EMP-ADV-147', 'CSSPE'),
    ('Mr. Brian Rino H. Traigo', 'Mr.', 'Brian Rino', 'H.', 'Traigo', NULL, 'brianrino.traigo@wmsu.edu.ph', 'EMP-ADV-148', 'CSSPE'),
    ('Dr. Al-Radja Jamiri, M.D', 'Dr.', 'Al-Radja', NULL, 'Jamiri', 'M.D', 'alradja.jamiri@wmsu.edu.ph', 'EMP-ADV-149', 'COM'),
    ('Atty. Jules Christian D. Marcos', 'Atty.', 'Jules Christian', 'D.', 'Marcos', NULL, 'juleschristian.marcos@wmsu.edu.ph', 'EMP-ADV-150', 'CLAW'),
    ('Prof. Arnel Madrazo', 'Prof.', 'Arnel', NULL, 'Madrazo', NULL, 'arnel.madrazo@wmsu.edu.ph', 'EMP-ADV-151', 'CTE'),
    ('Dr. Anabel E. Gamorez', 'Dr.', 'Anabel', 'E.', 'Gamorez', NULL, 'anabel.gamorez@wmsu.edu.ph', 'EMP-ADV-152', 'CSM'),
    ('Dr. Rodita C. Silva', 'Dr.', 'Rodita', 'C.', 'Silva', NULL, 'rodita.silva@wmsu.edu.ph', 'EMP-ADV-153', 'CLA'),
    ('Ms. Eleanor Comeros', 'Ms.', 'Eleanor', NULL, 'Comeros', NULL, 'eleanor.comeros@wmsu.edu.ph', 'EMP-ADV-154', NULL),
    ('Dr. Elmer M. Labad', 'Dr.', 'Elmer', 'M.', 'Labad', NULL, 'elmer.labad@wmsu.edu.ph', 'EMP-ADV-155', NULL),
    ('Prof. Al-Ghani D. Mohammad', 'Prof.', 'Al-Ghani', 'D.', 'Mohammad', NULL, 'alghani.mohammad@wmsu.edu.ph', 'EMP-ADV-156', NULL),
    ('Ms. Dezza Mohammad, CPA, RN', 'Ms.', 'Dezza', NULL, 'Mohammad', 'CPA, RN', 'dezza.mohammad@wmsu.edu.ph', 'EMP-ADV-157', NULL),
    ('Engr. Marlon C. Grande', 'Engr.', 'Marlon', 'C.', 'Grande', NULL, 'marlon.grande@wmsu.edu.ph', 'EMP-ADV-158', NULL),
    ('Mr. Floramie M. Ramiro', 'Mr.', 'Floramie', 'M.', 'Ramiro', NULL, 'floramie.ramiro@wmsu.edu.ph', 'EMP-ADV-159', NULL),
    ('Dr. Carl Richard C. Dagalea', 'Dr.', 'Carl Richard', 'C.', 'Dagalea', NULL, 'carlrichard.dagalea@wmsu.edu.ph', 'EMP-ADV-160', NULL),
    ('Dr. Lea Usman', 'Dr.', 'Lea', NULL, 'Usman', NULL, 'lea.usman@wmsu.edu.ph', 'EMP-ADV-161', NULL),
    ('Dr. Vicenta T. Escobar', 'Dr.', 'Vicenta', 'T.', 'Escobar', NULL, 'vicenta.escobar@wmsu.edu.ph', 'EMP-ADV-162', NULL),
    ('Prof. Joyce Mangubat', 'Prof.', 'Joyce', NULL, 'Mangubat', NULL, 'joyce.mangubat@wmsu.edu.ph', 'EMP-ADV-163', NULL),
    ('Dr. Mohammad Nur S. Paspasan', 'Dr.', 'Mohammad Nur', 'S.', 'Paspasan', NULL, 'mohammadnur.paspasan@wmsu.edu.ph', 'EMP-ADV-164', NULL);

-- Seed adviser user accounts
INSERT INTO users (email, password_hash, first_name, middle_name, last_name, suffix, role, status)
SELECT a.email,
       '$2b$10$hu8FeUvMfCSAQb1aRCDpteW1GOHsaGZjX38s33vgzlhQBpcXt0eoe',
       a.first_name,
       a.middle_name,
       a.last_name,
       a.suffix,
       'ADVISER'::user_role,
       'ACTIVE'::user_status
  FROM _advisers a
ON CONFLICT (lower(email)) DO UPDATE
   SET first_name  = EXCLUDED.first_name,
       middle_name = EXCLUDED.middle_name,
       last_name   = EXCLUDED.last_name,
       suffix      = EXCLUDED.suffix,
       role        = 'ADVISER',
       status      = 'ACTIVE';

-- Seed adviser profiles
INSERT INTO advisers (user_id, employee_number, title, college_id)
SELECT u.id,
       a.employee_number,
       a.title,
       c.id
  FROM _advisers a
  JOIN users u ON lower(u.email) = lower(a.email)
  LEFT JOIN colleges c ON c.acronym = a.college_acr
ON CONFLICT (user_id) DO UPDATE
   SET employee_number = EXCLUDED.employee_number,
       title           = EXCLUDED.title,
       college_id      = EXCLUDED.college_id;

-- Assign active faculty advisers to student organizations
INSERT INTO organization_advisers (organization_id, adviser_id, assigned_at)
SELECT o.id,
       adv.id,
       now()
  FROM _orgs og
  JOIN organizations o ON lower(o.name) = lower(og.name)
  JOIN _advisers a ON a.full_name = CASE
       WHEN og.adviser_raw = 'Engr. Marjorie Rojas' THEN 'Engr. Marjorie A. Rojas'
       WHEN og.adviser_raw = 'Engr. Marlon Grande' THEN 'Engr. Marlon C. Grande'
       WHEN og.adviser_raw = 'Dezza Mohammad, CPA, RN' THEN 'Ms. Dezza Mohammad, CPA, RN'
       ELSE og.adviser_raw
  END
  JOIN users u ON lower(u.email) = lower(a.email)
  JOIN advisers adv ON adv.user_id = u.id
 WHERE og.adviser_raw IS NOT NULL
ON CONFLICT (organization_id) WHERE ended_at IS NULL DO UPDATE
   SET adviser_id  = EXCLUDED.adviser_id,
       assigned_at = EXCLUDED.assigned_at;

DROP TABLE IF EXISTS _advisers;
DROP TABLE IF EXISTS _orgs;
