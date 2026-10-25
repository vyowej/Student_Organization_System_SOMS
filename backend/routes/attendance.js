/**
 * Event Registrations & Attendance Routes (backend/routes/attendance.js)
 *
 * Links to `event_registrations` and `attendance` tables in
 * ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');

// ============================================================
// ATTENDANCE SESSION CODE MANAGER (IN-MEMORY + FILE BACKED)
// Allows random generated attendance codes per event without
// creating new database tables.
// ============================================================
const CODES_FILE = path.join(__dirname, '../attendance_codes.json');

function loadAttendanceCodes() {
  try {
    if (fs.existsSync(CODES_FILE)) {
      const data = JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
      return new Map(Object.entries(data));
    }
  } catch (err) {
    console.error('[ATTENDANCE] Error reading attendance_codes.json:', err.message);
  }
  return new Map();
}

function saveAttendanceCodes(map) {
  try {
    const obj = Object.fromEntries(map);
    fs.writeFileSync(CODES_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('[ATTENDANCE] Error saving attendance_codes.json:', err.message);
  }
}

const attendanceCodes = loadAttendanceCodes();

function generateRandomCode(prefix = 'WMSU') {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${rand}`;
}

function getOrCreateEventCode(eventId) {
  const key = String(eventId);
  if (attendanceCodes.has(key)) {
    return attendanceCodes.get(key);
  }
  const newRecord = {
    event_id: Number(eventId),
    code: generateRandomCode(),
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  attendanceCodes.set(key, newRecord);
  saveAttendanceCodes(attendanceCodes);
  return newRecord;
}

function normalizeCode(str) {
  return String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function resolveStudentDbId(identifier) {
  if (!identifier) return null;
  if (Number.isFinite(Number(identifier))) {
    const byId = await db.query(
      'SELECT id FROM students WHERE id = $1 OR user_id = $1 ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1',
      [Number(identifier)]
    );
    if (byId.rows.length > 0) return byId.rows[0].id;
  }
  const trimmed = String(identifier).trim();
  const byNumber = await db.query(
    'SELECT id FROM students WHERE lower(student_number) = lower($1) LIMIT 1',
    [trimmed]
  );
  if (byNumber.rows.length > 0) return byNumber.rows[0].id;

  // Support registration format (e.g. REG-1, UNIDOS-1)
  const matchReg = trimmed.match(/^(?:REG|UNIDOS)[-_]?(\d+)$/i);
  if (matchReg) {
    const regId = Number(matchReg[1]);
    const byReg = await db.query(
      'SELECT student_id FROM event_registrations WHERE id = $1 LIMIT 1',
      [regId]
    );
    if (byReg.rows.length > 0) return byReg.rows[0].student_id;
  }

  return null;
}

const REGISTRATION_SELECT_QUERY = `
  SELECT er.id,
         er.event_id,
         er.student_id,
         er.registered_at,
         er.status,
         e.title AS event_title,
         e.location AS event_location,
         e.start_date,
         e.end_date,
         e.organization_id,
         o.name AS organization_name,
         o.acronym AS organization_acronym,
         s.user_id,
         s.student_number,
         s.year_level,
         u.first_name,
         u.middle_name,
         u.last_name,
         u.suffix,
         (u.last_name || ', ' || u.first_name || COALESCE(' ' || u.suffix, '')) AS student_name,
         u.email,
         p.name AS program_name,
         p.acronym AS program_acronym,
         att.id AS attendance_id,
         att.checked_in_at,
         att.method AS checkin_method,
         att.recorded_by
    FROM event_registrations er
    JOIN events e ON e.id = er.event_id
    JOIN organizations o ON o.id = e.organization_id
    JOIN students s ON s.id = er.student_id
    JOIN users u ON u.id = s.user_id
    JOIN programs p ON p.id = s.program_id
    LEFT JOIN attendance att ON att.event_id = er.event_id AND att.student_id = er.student_id
`;

// GET /api/attendance/registrations — List all event registrations (with optional event_id / student_id filter)
router.get('/registrations', async (req, res) => {
  try {
    const { event_id, student_id } = req.query;
    let queryText = `${REGISTRATION_SELECT_QUERY} WHERE 1=1`;
    const params = [];

    if (event_id) {
      params.push(event_id);
      queryText += ` AND er.event_id = $${params.length}`;
    }
    if (student_id) {
      const resolvedId = await resolveStudentDbId(student_id);
      params.push(resolvedId || -1);
      queryText += ` AND er.student_id = $${params.length}`;
    }

    queryText += ' ORDER BY er.registered_at DESC';
    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/attendance/registrations/:event_id — List all student registrations for an event
router.get('/registrations/:event_id', async (req, res) => {
  try {
    const { event_id } = req.params;
    const result = await db.query(
      `${REGISTRATION_SELECT_QUERY}
        WHERE er.event_id = $1
        ORDER BY er.registered_at ASC`,
      [event_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/attendance/register — Register a student for a published event (respecting max_participants)
router.post('/register', async (req, res) => {
  try {
    const { event_id, student_id, user_id } = req.body;
    const resolvedStudentId = await resolveStudentDbId(student_id || user_id);

    if (!event_id || !resolvedStudentId) {
      return res.status(400).json({ error: 'event_id and a valid student_id are required' });
    }

    // Verify event exists before allowing registration
    const eventRes = await db.query(
      'SELECT id, status, max_participants FROM events WHERE id = $1',
      [event_id]
    );

    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventRes.rows[0];
    if (!['PUBLISHED', 'APPROVED'].includes(event.status)) {
      return res.status(400).json({ error: 'Cannot register for an event that is not open for registration' });
    }

    // Enforce max_participants capacity limit when set on the event
    if (event.max_participants) {
      const countRes = await db.query(
        "SELECT COUNT(*) FROM event_registrations WHERE event_id = $1 AND status != 'CANCELLED' AND student_id != $2",
        [event_id, resolvedStudentId]
      );
      const currentCount = parseInt(countRes.rows[0].count, 10);
      if (currentCount >= event.max_participants) {
        return res.status(400).json({ error: 'Event has reached maximum participant capacity' });
      }
    }

    const insertRes = await db.query(
      `INSERT INTO event_registrations (event_id, student_id, status)
       VALUES ($1, $2, 'REGISTERED')
       ON CONFLICT (event_id, student_id)
       DO UPDATE SET status = 'REGISTERED', registered_at = now()
       RETURNING id`,
      [event_id, resolvedStudentId]
    );

    const fullRow = await db.query(`${REGISTRATION_SELECT_QUERY} WHERE er.id = $1`, [insertRes.rows[0].id]);
    const registration = fullRow.rows[0];

    // Dispatch registration confirmation notification to the student
    try {
      const studentUser = await db.query('SELECT user_id FROM students WHERE id = $1', [resolvedStudentId]);
      if (studentUser.rows.length > 0) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, created_at)
           VALUES ($1, 'EVENT_REGISTRATION', $2, $3, now())`,
          [
            studentUser.rows[0].user_id,
            `Registered: ${registration.event_title || 'Campus Event'}`,
            `You have successfully registered for "${registration.event_title}". Access your Event Pass for attendance check-in.`
          ]
        );

        // Record audit trail
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, created_at)
           VALUES ($1, 'REGISTER_EVENT', 'event_registrations', $2, $3::jsonb, now())`,
          [
            studentUser.rows[0].user_id,
            String(registration.id),
            JSON.stringify({ event_id, student_id: resolvedStudentId, event_title: registration.event_title })
          ]
        ).catch(() => null);
      }
    } catch (notifErr) {
      console.error('[ATTENDANCE NOTIF ERROR]', notifErr);
    }

    res.status(201).json(registration);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/attendance/registrations/:id/cancel — Cancel a registration by registration id
router.put('/registrations/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE event_registrations
          SET status = 'CANCELLED'
        WHERE id = $1
        RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration record not found' });
    }

    const fullRow = await db.query(`${REGISTRATION_SELECT_QUERY} WHERE er.id = $1`, [id]);
    const cancelledReg = fullRow.rows[0];

    // Dispatch cancellation notification to student
    try {
      if (cancelledReg?.user_id) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, created_at)
           VALUES ($1, 'EVENT_REGISTRATION', $2, $3, now())`,
          [
            cancelledReg.user_id,
            `Registration Cancelled: ${cancelledReg.event_title || 'Campus Event'}`,
            `Your registration for "${cancelledReg.event_title}" has been cancelled.`
          ]
        );
      }
    } catch (notifErr) {
      console.error('[CANCEL NOTIF ERROR]', notifErr);
    }

    res.json({ message: 'Registration cancelled', registration: cancelledReg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/attendance/registrations/:event_id/:student_id — Cancel a student's event registration
router.delete('/registrations/:event_id/:student_id', async (req, res) => {
  try {
    const { event_id, student_id } = req.params;
    const resolvedStudentId = await resolveStudentDbId(student_id);
    const result = await db.query(
      `UPDATE event_registrations
          SET status = 'CANCELLED'
        WHERE event_id = $1 AND student_id = $2
        RETURNING id`,
      [event_id, resolvedStudentId || student_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration record not found' });
    }

    const fullRow = await db.query(`${REGISTRATION_SELECT_QUERY} WHERE er.id = $1`, [result.rows[0].id]);
    res.json({ message: 'Registration cancelled', registration: fullRow.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/attendance — List all attendance check-ins across events
router.get('/', async (req, res) => {
  try {
    const { event_id, student_id } = req.query;
    let queryText = `
      SELECT a.id,
             a.event_id,
             a.student_id,
             a.checked_in_at,
             a.method,
             a.recorded_by,
             e.title AS event_title,
             e.organization_id,
             o.name AS organization_name,
             s.user_id,
             s.student_number,
             u.first_name,
             u.last_name,
             (u.last_name || ', ' || u.first_name) AS student_name,
             u.email,
             p.acronym AS program_acronym,
             recorder.first_name AS recorder_first_name,
             recorder.last_name  AS recorder_last_name
        FROM attendance a
        JOIN events e ON e.id = a.event_id
        JOIN organizations o ON o.id = e.organization_id
        JOIN students s ON s.id = a.student_id
        JOIN users u ON u.id = s.user_id
        JOIN programs p ON p.id = s.program_id
   LEFT JOIN users recorder ON recorder.id = a.recorded_by
       WHERE 1=1
    `;
    const params = [];

    if (event_id) {
      params.push(event_id);
      queryText += ` AND a.event_id = $${params.length}`;
    }
    if (student_id) {
      const resolvedId = await resolveStudentDbId(student_id);
      params.push(resolvedId || -1);
      queryText += ` AND a.student_id = $${params.length}`;
    }

    queryText += ' ORDER BY a.checked_in_at DESC';
    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/attendance/event/:event_id — List all attendance check-ins for a specific event
router.get('/event/:event_id', async (req, res) => {
  try {
    const { event_id } = req.params;
    const result = await db.query(
      `SELECT a.id,
              a.event_id,
              a.student_id,
              a.checked_in_at,
              a.method,
              a.recorded_by,
              s.user_id,
              s.student_number,
              u.first_name,
              u.middle_name,
              u.last_name,
              u.suffix,
              (u.last_name || ', ' || u.first_name || COALESCE(' ' || u.suffix, '')) AS student_name,
              u.email,
              p.acronym AS program_acronym,
              recorder.first_name AS recorder_first_name,
              recorder.last_name  AS recorder_last_name
         FROM attendance a
         JOIN students s ON s.id = a.student_id
         JOIN users u ON u.id = s.user_id
         JOIN programs p ON p.id = s.program_id
    LEFT JOIN users recorder ON recorder.id = a.recorded_by
        WHERE a.event_id = $1
        ORDER BY a.checked_in_at DESC`,
      [event_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/attendance/check-in — Record student attendance (QR_SCAN, MANUAL, or SELF_CHECKIN)
router.post('/check-in', async (req, res) => {
  try {
    const { event_id, student_id, user_id, student_number, method, recorded_by } = req.body;
    const resolvedStudentId = await resolveStudentDbId(student_id || student_number || user_id);

    if (!event_id || !resolvedStudentId) {
      return res.status(400).json({ error: 'event_id and a valid student_id or student_number are required' });
    }

    const rawMethod = String(method || 'QR_SCAN').toUpperCase();
    const checkInMethod = ['QR_SCAN', 'MANUAL', 'SELF_CHECKIN'].includes(rawMethod) ? rawMethod : 'QR_SCAN';

    const result = await db.query(
      `INSERT INTO attendance (event_id, student_id, method, recorded_by, checked_in_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (event_id, student_id)
       DO UPDATE SET checked_in_at = now(), method = $3, recorded_by = $4
       RETURNING *`,
      [event_id, resolvedStudentId, checkInMethod, recorded_by || null]
    );

    // Synchronize or create corresponding event_registrations record with status = 'ATTENDED'
    const regRes = await db.query(
      `INSERT INTO event_registrations (event_id, student_id, status)
       VALUES ($1, $2, 'ATTENDED')
       ON CONFLICT (event_id, student_id)
       DO UPDATE SET status = 'ATTENDED'
       RETURNING id`,
      [event_id, resolvedStudentId]
    );

    const fullReg = await db.query(`${REGISTRATION_SELECT_QUERY} WHERE er.id = $1`, [regRes.rows[0].id]);
    const checkedInReg = fullReg.rows[0];

    // Dispatch attendance verification notification to student
    try {
      if (checkedInReg?.user_id) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, created_at)
           VALUES ($1, 'ATTENDANCE', $2, $3, now())`,
          [
            checkedInReg.user_id,
            `Attendance Verified: ${checkedInReg.event_title || 'Campus Event'}`,
            `Your attendance check-in for "${checkedInReg.event_title}" was successfully recorded.`
          ]
        );
      }
    } catch (notifErr) {
      console.error('[ATTENDANCE VERIFY NOTIF ERROR]', notifErr);
    }

    res.status(201).json({
      message: 'Attendance recorded successfully',
      attendance: result.rows[0],
      registration: checkedInReg,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/attendance/event/:event_id/code — Retrieve active attendance code for an event
router.get('/event/:event_id/code', async (req, res) => {
  try {
    const session = getOrCreateEventCode(req.params.event_id);
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/attendance/event/:event_id/code — Regenerate random code or toggle session
router.post('/event/:event_id/code', async (req, res) => {
  try {
    const { event_id } = req.params;
    const { action, active } = req.body;
    const current = getOrCreateEventCode(event_id);

    if (action === 'generate' || action === 'regenerate') {
      current.code = generateRandomCode();
      current.updated_at = new Date().toISOString();
    }
    if (typeof active === 'boolean') {
      current.active = active;
      current.updated_at = new Date().toISOString();
    }

    attendanceCodes.set(String(event_id), current);
    saveAttendanceCodes(attendanceCodes);

    res.json(current);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/attendance/verify-code — Student attends with random generated code
router.post('/verify-code', async (req, res) => {
  try {
    const { event_id, code, student_id, student_number, user_id } = req.body;
    const eventIdNum = Number(event_id);
    if (!event_id || !Number.isFinite(eventIdNum)) {
      return res.status(400).json({ error: 'Valid event_id is required' });
    }
    if (!code || !String(code).trim()) {
      return res.status(400).json({ error: 'Please enter the attendance code for this event.' });
    }

    const session = getOrCreateEventCode(eventIdNum);
    if (!session || !session.active) {
      return res.status(400).json({ error: 'Attendance session for this event is currently closed by the organizer.' });
    }

    const inputNorm = normalizeCode(code);
    const sessionNorm = normalizeCode(session.code);
    const sessionShort = sessionNorm.replace(/^WMSU/, '');

    const isMatch = inputNorm === sessionNorm || 
                    inputNorm === sessionShort || 
                    sessionNorm.endsWith(inputNorm);

    if (!isMatch) {
      return res.status(400).json({ error: `Invalid attendance code "${code}". Please check the code announced by the organizer.` });
    }

    const resolvedStudentId = await resolveStudentDbId(student_id || student_number || user_id);
    if (!resolvedStudentId) {
      return res.status(400).json({ error: 'Student record could not be found. Please ensure you are logged in.' });
    }

    // Verify event exists
    const eventRes = await db.query('SELECT id, title, status FROM events WHERE id = $1', [eventIdNum]);
    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const event = eventRes.rows[0];

    // Check if student already checked in
    const existingAtt = await db.query(
      'SELECT id, checked_in_at, method FROM attendance WHERE event_id = $1 AND student_id = $2',
      [eventIdNum, resolvedStudentId]
    );

    if (existingAtt.rows.length > 0) {
      return res.status(200).json({
        ok: true,
        alreadyCheckedIn: true,
        message: `You are already checked in for "${event.title}"!`,
        attendance: existingAtt.rows[0],
      });
    }

    // Insert attendance with method 'SELF_CHECKIN'
    const attResult = await db.query(
      `INSERT INTO attendance (event_id, student_id, method, checked_in_at)
       VALUES ($1, $2, 'SELF_CHECKIN', now())
       ON CONFLICT (event_id, student_id)
       DO UPDATE SET checked_in_at = now(), method = 'SELF_CHECKIN'
       RETURNING *`,
      [eventIdNum, resolvedStudentId]
    );

    // Update or insert event_registrations with status 'ATTENDED'
    const regRes = await db.query(
      `INSERT INTO event_registrations (event_id, student_id, status)
       VALUES ($1, $2, 'ATTENDED')
       ON CONFLICT (event_id, student_id)
       DO UPDATE SET status = 'ATTENDED'
       RETURNING id`,
      [eventIdNum, resolvedStudentId]
    );

    const fullReg = await db.query(`${REGISTRATION_SELECT_QUERY} WHERE er.id = $1`, [regRes.rows[0].id]);
    const checkedInReg = fullReg.rows[0];

    // Send notification
    try {
      if (checkedInReg?.user_id) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, created_at)
           VALUES ($1, 'ATTENDANCE', $2, $3, now())`,
          [
            checkedInReg.user_id,
            `Attendance Verified: ${event.title}`,
            `Your attendance for "${event.title}" was recorded successfully using code ${session.code}.`
          ]
        );
      }
    } catch (notifErr) {
      console.error('[ATTENDANCE NOTIF ERROR]', notifErr);
    }

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, created_at)
       VALUES ($1, 'ATTENDANCE_SELF_CHECKIN', 'attendance', $2, $3::jsonb, now())`,
      [
        checkedInReg?.user_id || null,
        String(attResult.rows[0].id),
        JSON.stringify({ event_id: eventIdNum, code: session.code, method: 'SELF_CHECKIN' })
      ]
    ).catch(() => null);

    res.status(200).json({
      ok: true,
      message: `Attendance confirmed! You are now marked PRESENT for "${event.title}".`,
      attendance: attResult.rows[0],
      registration: checkedInReg,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/attendance/manual-toggle — Officer quick-toggle attendance directly from roster
router.post('/manual-toggle', async (req, res) => {
  try {
    const { event_id, student_id, status, recorded_by } = req.body;
    const eventIdNum = Number(event_id);
    const resolvedStudentId = await resolveStudentDbId(student_id);
    if (!event_id || !Number.isFinite(eventIdNum) || !resolvedStudentId) {
      return res.status(400).json({ error: 'Valid event_id and student_id are required' });
    }

    if (status === 'ATTENDED') {
      const attRes = await db.query(
        `INSERT INTO attendance (event_id, student_id, method, recorded_by, checked_in_at)
         VALUES ($1, $2, 'MANUAL', $3, now())
         ON CONFLICT (event_id, student_id)
         DO UPDATE SET checked_in_at = now(), method = 'MANUAL', recorded_by = $3
         RETURNING *`,
        [eventIdNum, resolvedStudentId, recorded_by || null]
      );
      await db.query(
        `UPDATE event_registrations SET status = 'ATTENDED' WHERE event_id = $1 AND student_id = $2`,
        [eventIdNum, resolvedStudentId]
      );
      return res.json({ ok: true, status: 'ATTENDED', message: 'Marked as Attended', attendance: attRes.rows[0] });
    } else {
      await db.query(
        `DELETE FROM attendance WHERE event_id = $1 AND student_id = $2`,
        [eventIdNum, resolvedStudentId]
      );
      await db.query(
        `UPDATE event_registrations SET status = 'REGISTERED' WHERE event_id = $1 AND student_id = $2`,
        [eventIdNum, resolvedStudentId]
      );
      return res.json({ ok: true, status: 'REGISTERED', message: 'Status reset to Pending' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/attendance/student/:student_id — Retrieve a student's event registration and attendance history
router.get('/student/:student_id', async (req, res) => {
  try {
    const resolvedStudentId = await resolveStudentDbId(req.params.student_id);
    if (!resolvedStudentId) return res.json([]);

    const result = await db.query(
      `${REGISTRATION_SELECT_QUERY}
        WHERE er.student_id = $1
        ORDER BY e.start_date DESC`,
      [resolvedStudentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
