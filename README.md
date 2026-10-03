# Student Organization Management System (SOMS)

Welcome to the SOMS project repository! Below are the instructions to set up and run the project locally on your machine.

## Getting Started

To run this project locally, you will need to set up and start both the frontend and backend servers.

### 1. Frontend Setup

First, install the necessary dependencies for the frontend project:

```bash
npm install
```

Once the dependencies are installed, start the frontend development server:

```bash
npm run dev
```

> [!NOTE]
> **Work in Progress:** The backend and frontend are not fully configured to work together yet. The following backend instructions are here just in case and also i'm not sure if this is needed 😁

### 2. Backend Setup

Open a new integrated terminal specifically for the `backend` folder. You can do this by right-clicking the `backend` folder and selecting **Open in Integrated Terminal**, or by navigating to it via command line:

```bash
cd backend
```

Install the backend dependencies:

```bash
npm install
```

> [!WARNING]
> **Missing Packages?**
> If you encounter an error stating that a package was not found, manually install the required packages by running the following commands:
> 
> ```bash
> npm install pg express dotenv cors
> npm install -g nodemon
> ```
> *(Note: The `-g` flag installs `nodemon` globally. If you prefer to install it only for this project, omit the `-g` flag.)*

Finally, start the backend development server. This command uses `nodemon`, which will automatically restart the server whenever you make changes to the code:

```bash
npm run dev
```