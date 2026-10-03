# Student Organization Management System (SOMS) Backend

This is a basic, easy-to-understand Express.js backend for the Student Organization Management System.
It uses Express, CORS, and PostgreSQL (`pg`).

## Setup Instructions

1. **Install Dependencies**
   Run `npm install` in this directory.

2. **Database Setup**
   Ensure PostgreSQL is installed and running. Create a database named `unidos_db`.
   Run the SQL script found in `database.sql` to initialize the necessary tables (`users`, `organizations`, `events`).

3. **Environment Variables**
   Modify the `.env` file to match your PostgreSQL configuration:
   ```
   PORT=5000
   DB_USER=postgres
   DB_PASSWORD=yourpassword
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=unidos_db
   ```

4. **Running the Server**
   Start the development server with:
   ```bash code run:
   npm run dev
   ```
   (Make sure you have a `dev` script in `package.json` that runs `nodemon server.js`, or run `npx nodemon server.js`)

## Modules Implemented
- **Users**: Registering and fetching users with basic roles (STUDENT, OFFICER, ADVISER, ADMIN).
- **Organizations**: Creating and retrieving active student organizations.
- **Events**: Creating and fetching events.

## Userful information here:
Make sure it links properly with the frontend and database, make sure it is organzied. If there are errors try to check the frontend and database, if the linking between them is correct.
