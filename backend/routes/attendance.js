/**
 * Event Registrations & Attendance Routes (backend/routes/attendance.js)
 *
 * Links to `event_registrations` and `attendance` tables in
 * ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

async function resolveStudentDbId(identifier) {
  if (!identifier) return null;
  if (Number.isFinite(Number(identifier))) {
    const byId = await db.query(
      'SELECT id FROM students WHERE id = $1 OR user_id = $1 ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1',
      [Number(identifier)]
    );
    if (byId.rows.length > 0) return byId.rows[0].id;
  }
  const byNumber = await db.query(
    'SELECT id FROM students WHERE lower(student_number) = lower($1) LIMIT 1',
    [String(identifier).trim()]
  );
  if (byNumber.rows.length > 0) return byNumber.rows[0].id;
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
         u.last_name,
         (u.last_name || ', ' || u.first_name) AS student_name,
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
              u.last_name,
              (u.last_name || ', ' || u.first_name) AS student_name,
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
