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
CREATE TYPE org_type               AS ENUM ('STUDENT_COUNCIL', 'ACADEMIC', 'RELIGIOUS', 'CULTURAL',
                                            'SPORTS_RECREATION', 'SOCIO_CIVIC', 'SPECIAL_INTEREST', 'OTHER');
CREATE TYPE org_status             AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

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
    last_name     VARCHAR(100) NOT NULL,
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
    department_id INTEGER      NOT NULL REFERENCES departments(id),
    name          VARCHAR(150) NOT NULL,      
    acronym       VARCHAR(20)  NOT NULL UNIQUE, 
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
    college_id      INTEGER REFERENCES colleges(id) ON DELETE SET NULL
);

-- ============================================================
-- 3. STUDENT ORGANIZATIONS & ADVISER ASSIGNMENTS
-- ============================================================
CREATE TABLE organizations (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    acronym       VARCHAR(20),
    description   TEXT,
    -- ============================================================
    -- [GOOGLE DRIVE API PLACEHOLDER — ORGANIZATION LOGO IMAGE]
    -- Insert Google Drive API shared image URL / file ID here for organization logos.
    -- ============================================================
    logo          TEXT,                              -- URL of the logo image
    org_type      org_type   NOT NULL DEFAULT 'OTHER',
    category      VARCHAR(100),
    scope         org_scope  NOT NULL DEFAULT 'COLLEGE',
    college_id    INTEGER REFERENCES colleges(id),
    department_id INTEGER,
    status        org_status NOT NULL DEFAULT 'PENDING',
    created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensures department_id belongs to the specified college_id
    CONSTRAINT fk_org_department_college
        FOREIGN KEY (department_id, college_id) REFERENCES departments (id, college_id),

    -- Enforces valid college/department ownership combinations per scope
    CONSTRAINT chk_org_scope CHECK (
        (scope = 'UNIVERSITY' AND college_id IS NULL     AND department_id IS NULL) OR
        (scope = 'COLLEGE'    AND college_id IS NOT NULL AND department_id IS NULL) OR
        (scope = 'DEPARTMENT' AND college_id IS NOT NULL AND department_id IS NOT NULL)
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
    review_remarks  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_one_pending_application
    ON organization_applications (organization_id, applicant_id)
    WHERE status = 'PENDING';

-- ============================================================
-- 5. EVENTS, REGISTRATIONS & ATTENDANCE
-- ============================================================
CREATE TABLE events (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id  INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title            VARCHAR(200) NOT NULL,
    description      TEXT,
    location         VARCHAR(200),
    start_date       TIMESTAMPTZ  NOT NULL,
    end_date         TIMESTAMPTZ  NOT NULL,
    max_participants INTEGER CHECK (max_participants IS NULL OR max_participants > 0),
    status           event_status NOT NULL DEFAULT 'DRAFT',
    created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);

CREATE TABLE event_registrations (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
    student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ         NOT NULL DEFAULT now(),
    status        registration_status NOT NULL DEFAULT 'REGISTERED',
    UNIQUE (event_id, student_id)
);

CREATE TABLE attendance (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
    student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ       NOT NULL DEFAULT now(),
    method        attendance_method NOT NULL,
    recorded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- who scanned/encoded it
    UNIQUE (event_id, student_id)
);

-- ============================================================
-- 6. DOCUMENTS, ANNOUNCEMENTS, NOTIFICATIONS & AUDIT LOGS
-- ============================================================
CREATE TABLE documents (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type            document_type   NOT NULL,
    title           VARCHAR(200)    NOT NULL,
    -- ============================================================
    -- [GOOGLE DRIVE API PLACEHOLDER — DOCUMENT / IMAGE STORAGE URL]
    -- Insert Google Drive API file URL / attachment link here.
    -- ============================================================
    file_url        TEXT            NOT NULL,
    status          document_status NOT NULL DEFAULT 'PENDING',
    uploaded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    review_remarks  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at     TIMESTAMPTZ
);

CREATE TABLE announcements (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    content         TEXT         NOT NULL,
    published_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE notifications (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50)  NOT NULL,
    title      VARCHAR(200) NOT NULL,
    message    TEXT         NOT NULL,
    read_at    TIMESTAMPTZ,                         -- NULL = unread
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(100) NOT NULL,               -- e.g. 'APPROVE_ADVISER_CHANGE'
    entity     VARCHAR(100) NOT NULL,               -- e.g. 'organizations'
    entity_id  VARCHAR(50),
    metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. TRIGGER 1: AUTOMATIC updated_at TIMESTAMP MAINTENANCE
-- ============================================================
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 8. TRIGGER 2: STUDENT ELIGIBILITY RULE
-- UNIVERSITY org -> any student
-- COLLEGE org    -> only students of that college
-- DEPARTMENT org -> only students of that department
-- (student -> program -> department -> college)
-- ============================================================
CREATE FUNCTION student_can_join(p_org_id INTEGER, p_student_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    o         organizations%ROWTYPE;
    s_college INTEGER;
    s_dept    INTEGER;
BEGIN
    SELECT * INTO o FROM organizations WHERE id = p_org_id;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF o.scope = 'UNIVERSITY' THEN
        RETURN TRUE;
    END IF;

    SELECT d.college_id, d.id
      INTO s_college, s_dept
      FROM students st
      JOIN programs p    ON p.id = st.program_id
      JOIN departments d ON d.id = p.department_id
     WHERE st.id = p_student_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF o.scope = 'COLLEGE' THEN
        RETURN s_college = o.college_id;
    END IF;

    RETURN s_dept = o.department_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION trg_member_eligibility() RETURNS trigger AS $$
BEGIN
    IF NOT student_can_join(NEW.organization_id, NEW.student_id) THEN
        RAISE EXCEPTION 'Student is not eligible to join this organization (college/department restriction).';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION trg_application_eligibility() RETURNS trigger AS $$
BEGIN
    IF NOT student_can_join(NEW.organization_id, NEW.applicant_id) THEN
        RAISE EXCEPTION 'Student is not eligible to apply to this organization (college/department restriction).';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_members_eligibility
    BEFORE INSERT ON organization_members
    FOR EACH ROW EXECUTE FUNCTION trg_member_eligibility();

CREATE TRIGGER trg_applications_eligibility
    BEFORE INSERT ON organization_applications
    FOR EACH ROW EXECUTE FUNCTION trg_application_eligibility();

-- ============================================================
-- 9. PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX idx_departments_college        ON departments (college_id);
CREATE INDEX idx_programs_department        ON programs (department_id);
CREATE INDEX idx_students_program           ON students (program_id);
CREATE INDEX idx_advisers_college           ON advisers (college_id);
CREATE INDEX idx_organizations_college      ON organizations (college_id);
CREATE INDEX idx_organizations_department   ON organizations (department_id);
CREATE INDEX idx_organizations_scope_status ON organizations (scope, status);
CREATE INDEX idx_org_advisers_adviser       ON organization_advisers (adviser_id);
CREATE INDEX idx_adviser_requests_status    ON adviser_change_requests (status);
CREATE INDEX idx_org_members_student        ON organization_members (student_id);
CREATE INDEX idx_org_applications_org       ON organization_applications (organization_id, status);
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
-- 10. WMSU ACADEMIC STRUCTURE SEED DATA (Colleges, Departments, Programs)
-- ============================================================
INSERT INTO colleges (name, acronym) VALUES ('College of Computing Studies', 'CCS') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CCS'), 'Department of Computer Science', 'DCS') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CCS' AND d.acronym = 'DCS'), 'Bachelor of Science in Computer Science', 'BSCS') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CCS'), 'Department of Information Technology', 'DIT') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CCS' AND d.acronym = 'DIT'), 'Bachelor of Science in Information Technology', 'BSIT') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CCS'), 'Department of Information Systems', 'DIS') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CCS' AND d.acronym = 'DIS'), 'Bachelor of Science in Information Systems', 'BSIS') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Engineering', 'COE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'COE'), 'Department of Civil Engineering', 'DCE') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'COE' AND d.acronym = 'DCE'), 'Bachelor of Science in Civil Engineering', 'BSCE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'COE'), 'Department of Electrical Engineering', 'DEE') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'COE' AND d.acronym = 'DEE'), 'Bachelor of Science in Electrical Engineering', 'BSEE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'COE'), 'Department of Mechanical Engineering', 'DME') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'COE' AND d.acronym = 'DME'), 'Bachelor of Science in Mechanical Engineering', 'BSME') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'COE'), 'Department of Electronics Engineering', 'DECE') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'COE' AND d.acronym = 'DECE'), 'Bachelor of Science in Electronics Engineering', 'BSECE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'COE'), 'Department of Computer Engineering', 'DCpE') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'COE' AND d.acronym = 'DCpE'), 'Bachelor of Science in Computer Engineering', 'BSCpE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'COE'), 'Department of Sanitary Engineering', 'DSE') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'COE' AND d.acronym = 'DSE'), 'Bachelor of Science in Sanitary Engineering', 'BSSE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'COE'), 'Department of Industrial Engineering', 'DIE') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'COE' AND d.acronym = 'DIE'), 'Bachelor of Science in Industrial Engineering', 'BSIE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'COE'), 'Department of Agricultural and Biosystems Engineering', 'DABE') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'COE' AND d.acronym = 'DABE'), 'Bachelor of Science in Agricultural and Biosystems Engineering', 'BSABE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Teacher Education', 'CTE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CTE'), 'Department of Secondary Education', 'DSEd') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CTE' AND d.acronym = 'DSEd'), 'Bachelor of Secondary Education', 'BSED') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CTE'), 'Department of Elementary Education', 'DEEd') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CTE' AND d.acronym = 'DEEd'), 'Bachelor of Elementary Education', 'BEED') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CTE'), 'Department of Early Childhood and Special Needs Education', 'DECSNE') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CTE' AND d.acronym = 'DECSNE'), 'Bachelor of Early Childhood Education', 'BECEd') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CTE' AND d.acronym = 'DECSNE'), 'Bachelor of Special Needs Education', 'BSNEd') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CTE'), 'Department of Physical Education', 'DPE') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CTE' AND d.acronym = 'DPE'), 'Bachelor of Physical Education', 'BPEd') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CTE' AND d.acronym = 'DPE'), 'Bachelor of Culture and Arts Education', 'BCAEd') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Nursing', 'CN') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CN'), 'Department of Nursing', 'DN') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CN' AND d.acronym = 'DN'), 'Bachelor of Science in Nursing', 'BSN') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Science and Mathematics', 'CSM') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CSM'), 'Department of Biology', 'DBio') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CSM' AND d.acronym = 'DBio'), 'Bachelor of Science in Biology', 'BSBio') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CSM'), 'Department of Chemistry', 'DChem') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CSM' AND d.acronym = 'DChem'), 'Bachelor of Science in Chemistry', 'BSChem') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CSM'), 'Department of Mathematics and Statistics', 'DMS') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CSM' AND d.acronym = 'DMS'), 'Bachelor of Science in Mathematics', 'BSMath') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CSM' AND d.acronym = 'DMS'), 'Bachelor of Science in Statistics', 'BSStat') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CSM'), 'Department of Physics', 'DPhys') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CSM' AND d.acronym = 'DPhys'), 'Bachelor of Science in Physics', 'BSPhys') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Liberal Arts', 'CLA') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CLA'), 'Department of Languages and Literature', 'DLL') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CLA' AND d.acronym = 'DLL'), 'Bachelor of Arts in English Language Studies', 'ABELS') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CLA' AND d.acronym = 'DLL'), 'Bachelor of Arts in Filipino', 'ABFil') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CLA'), 'Department of Mass Communication', 'DMC') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CLA' AND d.acronym = 'DMC'), 'Bachelor of Arts in Broadcasting', 'BAB') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CLA' AND d.acronym = 'DMC'), 'Bachelor of Arts in Journalism', 'BAJ') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CLA'), 'Department of Social Sciences', 'DSS') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CLA' AND d.acronym = 'DSS'), 'Bachelor of Arts in Political Science', 'ABPolSci') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CLA' AND d.acronym = 'DSS'), 'Bachelor of Arts in History', 'ABHist') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CLA'), 'Department of Psychology', 'DPsych') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CLA' AND d.acronym = 'DPsych'), 'Bachelor of Science in Psychology', 'BSPsych') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CLA'), 'Department of Philosophy', 'DPhil') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CLA' AND d.acronym = 'DPhil'), 'Bachelor of Arts in Philosophy', 'ABPhil') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Criminal Justice Education', 'CCJE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CCJE'), 'Department of Criminology', 'DCrim') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CCJE' AND d.acronym = 'DCrim'), 'Bachelor of Science in Criminology', 'BSCrim') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CCJE'), 'Department of Law Enforcement Administration', 'DLEA') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CCJE' AND d.acronym = 'DLEA'), 'Bachelor of Science in Industrial Security Management', 'BSISM') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Architecture', 'CA') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CA'), 'Department of Architecture', 'DArch') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CA' AND d.acronym = 'DArch'), 'Bachelor of Science in Architecture', 'BSArch') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Agriculture', 'CAg') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CAg'), 'Department of Agronomy and Crop Science', 'DACS') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CAg' AND d.acronym = 'DACS'), 'Bachelor of Science in Agriculture', 'BSAgri') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CAg'), 'Department of Agribusiness Management', 'DAM') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CAg' AND d.acronym = 'DAM'), 'Bachelor of Science in Agribusiness', 'BSAgribiz') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CAg'), 'Department of Agricultural Technology', 'DAT') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CAg' AND d.acronym = 'DAT'), 'Bachelor of Agricultural Technology', 'BAT') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Forestry and Environmental Studies', 'CFES') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CFES'), 'Department of Forestry', 'DForest') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CFES' AND d.acronym = 'DForest'), 'Bachelor of Science in Forestry', 'BSF') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CFES' AND d.acronym = 'DForest'), 'Bachelor of Science in Agroforestry', 'BSAF') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CFES'), 'Department of Environmental Science', 'DES') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CFES' AND d.acronym = 'DES'), 'Bachelor of Science in Environmental Science', 'BSES') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Home Economics', 'CHE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CHE'), 'Department of Nutrition and Dietetics', 'DND') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CHE' AND d.acronym = 'DND'), 'Bachelor of Science in Nutrition and Dietetics', 'BSND') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CHE'), 'Department of Hospitality and Tourism Management', 'DHTM') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CHE' AND d.acronym = 'DHTM'), 'Bachelor of Science in Hospitality Management', 'BSHM') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CHE' AND d.acronym = 'DHTM'), 'Bachelor of Science in Tourism Management', 'BSTM') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CHE'), 'Department of Food Technology', 'DFT') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CHE' AND d.acronym = 'DFT'), 'Bachelor of Science in Food Technology', 'BSFT') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Social Work and Community Development', 'CSWCD') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CSWCD'), 'Department of Social Work', 'DSW') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CSWCD' AND d.acronym = 'DSW'), 'Bachelor of Science in Social Work', 'BSSW') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CSWCD'), 'Department of Community Development', 'DCD') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CSWCD' AND d.acronym = 'DCD'), 'Bachelor of Science in Community Development', 'BSCD') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Public Administration and Development Studies', 'CPADS') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CPADS'), 'Department of Public Administration', 'DPA') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CPADS' AND d.acronym = 'DPA'), 'Bachelor of Public Administration', 'BPA') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Asian and Islamic Studies', 'CAIS') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CAIS'), 'Department of Islamic Studies', 'DIS') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CAIS' AND d.acronym = 'DIS'), 'Bachelor of Arts in Islamic Studies', 'BAIS') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CAIS'), 'Department of Asian Studies', 'DAS') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CAIS' AND d.acronym = 'DAS'), 'Bachelor of Arts in Asian Studies', 'BAAS') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Sports Science and Physical Education', 'CSSPE') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CSSPE'), 'Department of Sports Science', 'DSSci') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CSSPE' AND d.acronym = 'DSSci'), 'Bachelor of Science in Exercise and Sports Sciences', 'BSESS') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Law', 'CL') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CL'), 'Department of Law', 'DLaw') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CL' AND d.acronym = 'DLaw'), 'Juris Doctor', 'JD') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
INSERT INTO colleges (name, acronym) VALUES ('College of Medicine', 'CM') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO departments (college_id, name, acronym) VALUES ((SELECT id FROM colleges WHERE acronym = 'CM'), 'Department of Medicine', 'DMed') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym;
INSERT INTO programs (department_id, name, acronym) VALUES ((SELECT d.id FROM departments d JOIN colleges c ON c.id = d.college_id WHERE c.acronym = 'CM' AND d.acronym = 'DMed'), 'Doctor of Medicine', 'MD') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id;
