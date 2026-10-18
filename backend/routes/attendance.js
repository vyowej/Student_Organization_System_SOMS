const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/registrations/:event_id', async (req, res) => {
  try {
    const { event_id } = req.params;
    const result = await db.query(
      `SELECT er.id,
              er.event_id,
              er.student_id,
              er.registered_at,
              er.status,
              s.student_number,
              s.year_level,
              u.first_name,
              u.last_name,
              u.email,
              p.acronym AS program_acronym
         FROM event_registrations er
         JOIN students s ON s.id = er.student_id
         JOIN users u ON u.id = s.user_id
         JOIN programs p ON p.id = s.program_id
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

router.post('/register', async (req, res) => {
  try {
    const { event_id, student_id } = req.body;

    if (!event_id || !student_id) {
      return res.status(400).json({ error: 'event_id and student_id are required' });
    }

    const eventRes = await db.query(
      'SELECT id, status, max_participants FROM events WHERE id = $1',
      [event_id]
    );

    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventRes.rows[0];
    if (event.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Cannot register for an event that is not published' });
    }

    if (event.max_participants) {
      const countRes = await db.query(
        "SELECT COUNT(*) FROM event_registrations WHERE event_id = $1 AND status != 'CANCELLED'",
        [event_id]
      );
      const currentCount = parseInt(countRes.rows[0].count, 10);
      if (currentCount >= event.max_participants) {
        return res.status(400).json({ error: 'Event has reached maximum participant capacity' });
      }
    }

    const result = await db.query(
      `INSERT INTO event_registrations (event_id, student_id, status)
       VALUES ($1, $2, 'REGISTERED')
       ON CONFLICT (event_id, student_id)
       DO UPDATE SET status = 'REGISTERED', registered_at = now()
       RETURNING *`,
      [event_id, student_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/registrations/:event_id/:student_id', async (req, res) => {
  try {
    const { event_id, student_id } = req.params;
    const result = await db.query(
      `UPDATE event_registrations
          SET status = 'CANCELLED'
        WHERE event_id = $1 AND student_id = $2
        RETURNING *`,
      [event_id, student_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration record not found' });
    }

    res.json({ message: 'Registration cancelled', registration: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

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
              s.student_number,
              u.first_name,
              u.last_name,
              u.email,
              recorder.first_name AS recorder_first_name,
              recorder.last_name  AS recorder_last_name
         FROM attendance a
         JOIN students s ON s.id = a.student_id
         JOIN users u ON u.id = s.user_id
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

router.post('/check-in', async (req, res) => {
  try {
    const { event_id, student_id, method, recorded_by } = req.body;

    if (!event_id || !student_id) {
      return res.status(400).json({ error: 'event_id and student_id are required' });
    }

    const checkInMethod = method || 'QR_SCAN';

    const result = await db.query(
      `INSERT INTO attendance (event_id, student_id, method, recorded_by, checked_in_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (event_id, student_id)
       DO UPDATE SET checked_in_at = now(), method = $3, recorded_by = $4
       RETURNING *`,
      [event_id, student_id, checkInMethod, recorded_by || null]
    );

    await db.query(
      `UPDATE event_registrations
          SET status = 'ATTENDED'
        WHERE event_id = $1 AND student_id = $2`,
      [event_id, student_id]
    );

    res.status(201).json({ message: 'Attendance recorded successfully', attendance: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/student/:student_id', async (req, res) => {
  try {
    const { student_id } = req.params;
    const result = await db.query(
      `SELECT e.id AS event_id,
              e.title,
              e.location,
              e.start_date,
              e.end_date,
              o.name AS organization_name,
              er.registered_at,
              er.status AS registration_status,
              a.checked_in_at,
              a.method AS checkin_method
         FROM event_registrations er
         JOIN events e ON e.id = er.event_id
         JOIN organizations o ON o.id = e.organization_id
    LEFT JOIN attendance a ON a.event_id = er.event_id AND a.student_id = er.student_id
        WHERE er.student_id = $1
        ORDER BY e.start_date DESC`,
      [student_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
