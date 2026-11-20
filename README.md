# Student Organization Management System (SOMS) — UNIDOS

Welcome to the **Student Organization Management System (SOMS)**, Western Mindanao State University's unified portal for managing student organizations, accreditation, member rosters, event proposals, compliance documents, and attendance tracking.

### Quick Start (Automatic Setup)
Clone the repository, ensure PostgreSQL is running locally, and run one command from the project root:

```bash
npm start
```
*(Or alternatively: `npm run dev:all`)*

Running `npm install` installs both frontend and backend dependencies (`node_modules` + `backend/node_modules`) and initializes `backend/.env` from `backend/.env.example` if missing. Running `npm start` automatically handles:
1. Checking and installing any missing or major-outdated frontend/backend dependencies (`node_modules` and `backend/node_modules`).
2. Creating `backend/.env` from `backend/.env.example` if missing.
3. Creating PostgreSQL database `student_org_db`, applying `database/student_org_db.sql`, running incremental schema updates, and seeding canonical WMSU data + default accounts when needed.
4. Starting both the Express backend API ([http://localhost:5000](http://localhost:5000)) and Vite React frontend ([http://localhost:5173](http://localhost:5173)).

- **Frontend App**: Open your browser at [http://localhost:5173](http://localhost:5173)
- **Backend API**: Running on [http://localhost:5000](http://localhost:5000)
- **Health & Schema Status**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

> **Different PostgreSQL password or user?** Edit `DB_USER` and `DB_PASSWORD` in `backend/.env` (default: `postgres` / `postgres` on `localhost:5432`), then re-run `npm start`. You can also manually install or re-sync the database anytime via `npm install` and `npm run db:init`.

---

## 🧪 System Health & Diagnostic Suite
Run the built-in system verification suite anytime to verify database connectivity, core tables, triggers, and notification engines:

```bash
npm run test:system
```

---

## 🔑 Default Roles & Accounts
The database initializer automatically provisions a default institutional administrator:
- **Admin Email**: `admin@wmsu.edu.ph`
- **Password**: `admin123`

You can also register student, officer, or adviser accounts directly from the login/registration interface at [http://localhost:5173/login](http://localhost:5173/login).

---

## 🛠️ Project Structure

```
Student_Organization_System_SOMS/
├── backend/                  # Express REST API
│   ├── routes/               # API endpoints (users, events, documents, orgs, etc.)
│   ├── scripts/              # Seeders & system diagnostic test runner
│   ├── db.js                 # PostgreSQL connection pool & schema link
│   ├── init-db.js            # Automated DB initialization runner
│   ├── notificationsHelper.js# Centralized notification & audit logging engine
│   └── server.js             # Express entry point (port 5000)
├── database/                 # Canonical PostgreSQL schema
│   └── student_org_db.sql    # Single source of truth for DB schema & triggers
├── scripts/                  # Development scripts
│   └── dev.js                # One-command dual dev runner (npm start)
├── src/                      # React 19 Frontend
│   ├── components/           # UI components, layout shells, modals, tables
│   ├── context/              # Authentication & Portal Data contexts
│   ├── data/                 # Canonical constants, positions, & navigation
│   ├── pages/                # Admin, Officer, Adviser, & Student portal pages
│   ├── App.jsx               # Application route definitions
│   └── main.jsx              # React DOM mounting
└── vite.config.js            # Vite configuration with /api reverse proxy
```

---

## 📦 Available NPM Scripts

| Command | Action |
| :--- | :--- |
| `npm start`, `npm run dev`, or `npm run dev:all` | **Starts both Backend API and Frontend Vite simultaneously** |
| `npm run dev:vite` | Runs the Vite frontend development server only (port 5173) |
| `npm run backend` | Runs the Node.js Express backend API only (port 5000) |
| `npm run db:init` | Applies PostgreSQL schema, constraints, and seeds default admin |
| `npm run test:system` | Runs comprehensive system health & diagnostic checks |
| `npm run build` | Compiles the production frontend bundle into `dist/` |
| `npm run lint` | Runs the `oxlint` code quality linter |
