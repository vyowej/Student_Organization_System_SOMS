# Student Organization Management System (SOMS) Backend

This is the Express.js backend for the Student Organization Management System (SOMS).
It uses Express, CORS, and PostgreSQL (`pg`), with its database schema linked directly to the `database` folder.

## Setup Instructions

1. **Install Dependencies**
   Run `npm install` in this directory:
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment Variables**
   Copy `.env.example` to `.env` (or update `.env`) to match your local PostgreSQL configuration:
   ```env
   PORT=5000
   DB_USER=postgres
   DB_PASSWORD=yourpassword
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=student_org_db
   ```

3. **Database Setup & Schema Linking**
   Ensure PostgreSQL is installed and running. Create the database if it doesn't already exist:
   ```sql
   CREATE DATABASE student_org_db;
   ```
   Then initialize and link all schema tables, types, triggers, and constraints from `../database/student_org_db.sql` by running:
   ```bash
   npm run db:init
   ```

4. **Running the Server**
   Start the development server with automatic reloading:
   ```bash
   npm run dev
   ```
   Or for production:
   ```bash
   npm start
   ```

5. **Verifying the Connection**
   Open your browser or run a GET request to:
   - `http://localhost:5000/` (Root API status)
   - `http://localhost:5000/api/health` (Database & Schema link diagnostic)

## Modules & Endpoints Implemented
- **Health**: `GET /api/health` — Checks database connectivity and schema link status.
- **Users** (`/api/users`):
  - `GET /api/users` — Fetch users (id, email, first_name, last_name, role, status).
  - `POST /api/users/register` — Register a new student/user.
  - `POST /api/users/login` — Sign in with email and password.
- **Organizations** (`/api/organizations`):
  - `GET /api/organizations` — Fetch all active student organizations with college and department details.
  - `POST /api/organizations` — Propose / create a new organization (respects UNIVERSITY, COLLEGE, DEPARTMENT scopes).
  - `PUT /api/organizations/:id/approve` — Approve an organization.
- **Events** (`/api/events`):
  - `GET /api/events` — Retrieve published events with organization info.
  - `POST /api/events` — Propose a new organization event.
  - `PUT /api/events/:id/publish` — Publish an event to the calendar.
- **Members & Applications** (`/api/members`):
  - `GET /api/members/org/:organization_id` — List active members and officers of an organization.
  - `GET /api/members/student/:student_id` — List organizations a student is enrolled in.
  - `POST /api/members` — Add student to organization with role/position.
  - `PUT /api/members/:id/position` — Update position or custom officer title.
  - `DELETE /api/members/:id` — Leave or deactivate membership.
  - `GET /api/members/applications/org/:organization_id` — List pending applications for an organization.
  - `POST /api/members/applications` — Submit application to join (enforces database eligibility trigger).
  - `PUT /api/members/applications/:id/review` — Approve/reject application.
- **Academic Structure** (`/api/academic`):
  - `GET /api/academic/colleges` & `POST /api/academic/colleges` — Colleges.
  - `GET /api/academic/departments` & `POST /api/academic/departments` — Departments.
  - `GET /api/academic/programs` & `POST /api/academic/programs` — Degree programs.
  - `GET /api/academic/students`, `GET /api/academic/students/:id`, & `POST /api/academic/students` — Student profiles.
  - `GET /api/academic/advisers` & `POST /api/academic/advisers` — Adviser profiles.
- **Attendance & Registrations** (`/api/attendance`):
  - `GET /api/attendance/registrations/:event_id` — List registered students for an event.
  - `POST /api/attendance/register` — Register student for an event (enforces `max_participants`).
  - `DELETE /api/attendance/registrations/:event_id/:student_id` — Cancel event registration.
  - `GET /api/attendance/event/:event_id` — List attendees checked in for an event.
  - `POST /api/attendance/check-in` — Record attendance check-in (`QR_SCAN`, `MANUAL`, `SELF_CHECKIN`).
  - `GET /api/attendance/student/:student_id` — Student event history and attendance record.
- **Documents** (`/api/documents`):
  - `GET /api/documents/org/:organization_id` — List constitution, proposals, financial reports, etc.
  - `GET /api/documents/:id` — View document details.
  - `POST /api/documents` — Submit a document.
  - `PUT /api/documents/:id/review` — Adviser/Admin review (approve/reject with remarks).
  - `DELETE /api/documents/:id` — Delete document.
- **Announcements** (`/api/announcements`):
  - `GET /api/announcements` — List latest announcements across all organizations.
  - `GET /api/announcements/:id` — View single announcement.
  - `POST /api/announcements` — Post new announcement.
  - `PUT /api/announcements/:id` & `DELETE /api/announcements/:id` — Edit or delete announcement.
- **Notifications** (`/api/notifications`):
  - `GET /api/notifications/user/:user_id` — List user notifications (with unread filter).
  - `GET /api/notifications/user/:user_id/count` — Unread notification count.
  - `PUT /api/notifications/:id/read` — Mark notification as read.
  - `PUT /api/notifications/user/:user_id/read-all` — Mark all user notifications as read.
  - `POST /api/notifications` & `DELETE /api/notifications/:id` — Create or delete notification.
- **Advisers & Change Requests** (`/api/advisers`):
  - `GET /api/advisers/org/:organization_id` — Current and past advisers for an organization.
  - `POST /api/advisers/assign` — Assign or change active adviser.
  - `GET /api/advisers/requests` — View adviser change requests.
  - `POST /api/advisers/requests` — Propose adviser change for an organization.
  - `PUT /api/advisers/requests/:id/review` — Approve/reject adviser change request.
- **Audit Logs** (`/api/audit-logs`):
  - `GET /api/audit-logs` — Activity logs with user and entity filters and pagination.
  - `POST /api/audit-logs` — Record system action and metadata.

## Schema Link
The database schema is defined in:
`../database/student_org_db.sql`
The backend script `init-db.js` (`npm run db:init`) reads and applies this file directly to the PostgreSQL database, ensuring backend and database are always synchronized.


