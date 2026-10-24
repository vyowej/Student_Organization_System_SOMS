-- ============================================================
-- SOMS — Schema changes for graduate/undergrad + year-level eligibility
-- Run AFTER student_org_db.sql and BEFORE 03_seed.sql.
-- Run this file as its own query (new enum value must be committed
-- before the seed file uses it).
-- ============================================================

-- 1. New org type for student publications
ALTER TYPE org_type ADD VALUE IF NOT EXISTS 'PUBLICATION' BEFORE 'OTHER';

-- 2. Undergraduate vs graduate programs
CREATE TYPE education_level AS ENUM ('UNDERGRADUATE', 'GRADUATE');

ALTER TABLE programs
    ADD COLUMN level education_level NOT NULL DEFAULT 'UNDERGRADUATE';

-- 3. Org eligibility rules
--    eligible_level: NULL = open to both undergrad and graduate students
--    min/max_year_level: NULL = no year restriction
ALTER TABLE organizations
    ADD COLUMN eligible_level    education_level DEFAULT 'UNDERGRADUATE',
    ADD COLUMN min_year_level    INTEGER,
    ADD COLUMN max_year_level    INTEGER,
    ADD COLUMN eligibility_notes TEXT,
    ADD CONSTRAINT chk_org_year_range CHECK (
        (min_year_level IS NULL OR min_year_level BETWEEN 1 AND 6) AND
        (max_year_level IS NULL OR max_year_level BETWEEN 1 AND 6) AND
        (min_year_level IS NULL OR max_year_level IS NULL OR min_year_level <= max_year_level)
    );

-- 4. Eligibility function now also checks level and year
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

    -- undergrad / graduate restriction
    IF o.eligible_level IS NOT NULL AND o.eligible_level <> s_level THEN
        RETURN FALSE;
    END IF;

    -- year-level restriction
    IF o.min_year_level IS NOT NULL AND s_year < o.min_year_level THEN
        RETURN FALSE;
    END IF;
    IF o.max_year_level IS NOT NULL AND s_year > o.max_year_level THEN
        RETURN FALSE;
    END IF;

    -- college / department restriction
    IF o.scope = 'UNIVERSITY' THEN
        RETURN TRUE;
    END IF;

    IF o.scope = 'COLLEGE' THEN
        RETURN s_college = o.college_id;
    END IF;

    RETURN s_dept = o.department_id;
END;
$$ LANGUAGE plpgsql STABLE;
