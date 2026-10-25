# Student Organization Management System (SOMS) — UNIDOS

Welcome to the **Student Organization Management System (SOMS)**, Western Mindanao State University's unified portal for managing student organizations, accreditation, member rosters, event proposals, compliance documents, and attendance tracking.

### Step 1: Install All Dependencies
Clone the repository and install all frontend and backend dependencies in one command from the project root:

```bash
npm install
```
*(A built-in `postinstall` script automatically installs the backend dependencies as well.)*

---

### Step 2: Configure & Initialize Database
1. Open PostgreSQL (`psql` or pgAdmin) and create the database if you haven't yet:
   ```sql
   CREATE DATABASE student_org_db;
   ```
2. Verify your database credentials in `backend/.env` (defaults to `postgres`/`postgres` on `localhost:5432`). If needed, create `backend/.env` from `backend/.env.example`.
3. Run the automated database initializer and schema link runner:
   ```bash
   npm run db:init
   ```
   *This automatically sets up all PostgreSQL tables, ENUM types, single-president constraints, eligibility triggers, audit logs, and seeds the default administrative account.*

---

### Step 3: Start the Application (One Command)
Run both the Express backend API and the Vite React frontend concurrently with unified logging:

```bash
npm start
```
*(Or alternatively: `npm run dev:all`)*

- **Frontend App**: Open your browser at [http://localhost:5173](http://localhost:5173)
- **Backend API**: Running on [http://localhost:5000](http://localhost:5000)
- **Health & Schema Status**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

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
| `npm start` or `npm run dev:all` | **Starts both Backend API and Frontend Vite simultaneously** |
| `npm run dev` | Runs the Vite frontend development server only (port 5173) |
| `npm run backend` | Runs the Node.js Express backend API only (port 5000) |
| `npm run db:init` | Applies PostgreSQL schema, constraints, and seeds default admin |
| `npm run test:system` | Runs comprehensive system health & diagnostic checks |
| `npm run build` | Compiles the production frontend bundle into `dist/` |
| `npm run lint` | Runs the `oxlint` code quality linter |
