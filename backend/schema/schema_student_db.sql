DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('STUDENT', 'OFFICER', 'ADVISER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE org_scope AS ENUM ('UNIVERSITY', 'COLLEGE', 'DEPARTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE org_type AS ENUM ('STUDENT_COUNCIL', 'ACADEMIC', 'RELIGIOUS', 'CULTURAL',
                                  'SPORTS_RECREATION', 'SOCIO_CIVIC', 'SPECIAL_INTEREST', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE org_status AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE member_position AS ENUM ('PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER',
                                         'AUDITOR', 'PRO', 'OTHER_OFFICER', 'MEMBER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE member_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE application_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE change_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE event_status AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE registration_status AS ENUM ('REGISTERED', 'CANCELLED', 'ATTENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_method AS ENUM ('QR_SCAN', 'MANUAL', 'SELF_CHECKIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('CONSTITUTION', 'PROPOSAL', 'FINANCIAL', 'REPORT', 'CERTIFICATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE document_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (lower(email));

CREATE TABLE IF NOT EXISTS colleges (
    id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    VARCHAR(150) NOT NULL UNIQUE,
    acronym VARCHAR(20)  NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS departments (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    college_id INTEGER      NOT NULL REFERENCES colleges(id),
    name       VARCHAR(150) NOT NULL,
    acronym    VARCHAR(20),
    UNIQUE (college_id, name),
    UNIQUE (id, college_id)
);

CREATE TABLE IF NOT EXISTS programs (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id INTEGER      NOT NULL REFERENCES departments(id),
    name          VARCHAR(150) NOT NULL,
    acronym       VARCHAR(20)  NOT NULL UNIQUE,
    UNIQUE (department_id, name)
);

CREATE TABLE IF NOT EXISTS students (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        INTEGER     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    student_number VARCHAR(50) NOT NULL UNIQUE,
    program_id     INTEGER     NOT NULL REFERENCES programs(id),
    year_level     INTEGER     NOT NULL CHECK (year_level BETWEEN 1 AND 6)
);

CREATE TABLE IF NOT EXISTS advisers (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         INTEGER     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_number VARCHAR(50) UNIQUE,
    college_id      INTEGER REFERENCES colleges(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS organizations (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    acronym       VARCHAR(20),
    description   TEXT,
    logo          TEXT,
    org_type      org_type   NOT NULL DEFAULT 'OTHER',
    scope         org_scope  NOT NULL DEFAULT 'COLLEGE',
    college_id    INTEGER REFERENCES colleges(id),
    department_id INTEGER,
    status        org_status NOT NULL DEFAULT 'PENDING',
    created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_org_department_college
        FOREIGN KEY (department_id, college_id) REFERENCES departments (id, college_id),
    CONSTRAINT chk_org_scope CHECK (
        (scope = 'UNIVERSITY' AND college_id IS NULL     AND department_id IS NULL) OR
        (scope = 'COLLEGE'    AND college_id IS NOT NULL AND department_id IS NULL) OR
        (scope = 'DEPARTMENT' AND college_id IS NOT NULL AND department_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_name_per_owner
    ON organizations (lower(name), COALESCE(college_id, 0), COALESCE(department_id, 0));

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_acronym_per_owner
    ON organizations (lower(acronym), COALESCE(college_id, 0), COALESCE(department_id, 0))
    WHERE acronym IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_council_per_college
    ON organizations (college_id)
    WHERE org_type = 'STUDENT_COUNCIL' AND scope = 'COLLEGE';

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_university_council
    ON organizations (org_type)
    WHERE org_type = 'STUDENT_COUNCIL' AND scope = 'UNIVERSITY';

CREATE TABLE IF NOT EXISTS organization_advisers (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    adviser_id      INTEGER NOT NULL REFERENCES advisers(id),
    assigned_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_current_adviser
    ON organization_advisers (organization_id)
    WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS adviser_change_requests (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_pending_change_request
    ON adviser_change_requests (organization_id)
    WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS organization_members (
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

CREATE TABLE IF NOT EXISTS organization_applications (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_pending_application
    ON organization_applications (organization_id, applicant_id)
    WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS events (
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

CREATE TABLE IF NOT EXISTS event_registrations (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
    student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ         NOT NULL DEFAULT now(),
    status        registration_status NOT NULL DEFAULT 'REGISTERED',
    UNIQUE (event_id, student_id)
);

CREATE TABLE IF NOT EXISTS attendance (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
    student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ       NOT NULL DEFAULT now(),
    method        attendance_method NOT NULL,
    recorded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (event_id, student_id)
);

CREATE TABLE IF NOT EXISTS documents (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type            document_type   NOT NULL,
    title           VARCHAR(200)    NOT NULL,
    file_url        TEXT            NOT NULL,
    status          document_status NOT NULL DEFAULT 'PENDING',
    uploaded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    review_remarks  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS announcements (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    content         TEXT         NOT NULL,
    published_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50)  NOT NULL,
    title      VARCHAR(200) NOT NULL,
    message    TEXT         NOT NULL,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(100) NOT NULL,
    entity     VARCHAR(100) NOT NULL,
    entity_id  VARCHAR(50),
    metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION student_can_join(p_org_id INTEGER, p_student_id INTEGER)
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

CREATE OR REPLACE FUNCTION trg_member_eligibility() RETURNS trigger AS $$
BEGIN
    IF NOT student_can_join(NEW.organization_id, NEW.student_id) THEN
        RAISE EXCEPTION 'Student is not eligible to join this organization (college/department restriction).';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_application_eligibility() RETURNS trigger AS $$
BEGIN
    IF NOT student_can_join(NEW.organization_id, NEW.applicant_id) THEN
        RAISE EXCEPTION 'Student is not eligible to apply to this organization (college/department restriction).';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_eligibility ON organization_members;
CREATE TRIGGER trg_members_eligibility
    BEFORE INSERT ON organization_members
    FOR EACH ROW EXECUTE FUNCTION trg_member_eligibility();

DROP TRIGGER IF EXISTS trg_applications_eligibility ON organization_applications;
CREATE TRIGGER trg_applications_eligibility
    BEFORE INSERT ON organization_applications
    FOR EACH ROW EXECUTE FUNCTION trg_application_eligibility();

CREATE INDEX IF NOT EXISTS idx_departments_college        ON departments (college_id);
CREATE INDEX IF NOT EXISTS idx_programs_department        ON programs (department_id);
CREATE INDEX IF NOT EXISTS idx_students_program           ON students (program_id);
CREATE INDEX IF NOT EXISTS idx_advisers_college           ON advisers (college_id);
CREATE INDEX IF NOT EXISTS idx_organizations_college      ON organizations (college_id);
CREATE INDEX IF NOT EXISTS idx_organizations_department   ON organizations (department_id);
CREATE INDEX IF NOT EXISTS idx_organizations_scope_status ON organizations (scope, status);
CREATE INDEX IF NOT EXISTS idx_org_advisers_adviser       ON organization_advisers (adviser_id);
CREATE INDEX IF NOT EXISTS idx_adviser_requests_status    ON adviser_change_requests (status);
CREATE INDEX IF NOT EXISTS idx_org_members_student        ON organization_members (student_id);
CREATE INDEX IF NOT EXISTS idx_org_applications_org       ON organization_applications (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_org_applications_applicant ON organization_applications (applicant_id);
CREATE INDEX IF NOT EXISTS idx_events_org_start           ON events (organization_id, start_date);
CREATE INDEX IF NOT EXISTS idx_event_regs_student         ON event_registrations (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student         ON attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_documents_org              ON documents (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_announcements_org          ON announcements (organization_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread  ON notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time       ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity          ON audit_logs (entity, entity_id);
