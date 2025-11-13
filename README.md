# Onboarding Process Application

Welcome to the Onboarding Process application! This project provides a comprehensive system to manage the onboarding of new employees, offering functionalities for HR, managers, and new hires. It consists of a React.js frontend for the user interface and a Flask API backend for data management and business logic.

## Table of Contents

* [Features](#features)
* [Technologies Used](#technologies-used)
* [Project Structure](#project-structure)
* [Getting Started](#getting-started)
    * [Prerequisites](#prerequisites)
    * [Backend Setup](#backend-setup)
    * [Frontend Setup](#frontend-setup)
    * [Running the Application](#running-the-application)
* [API Endpoints](#api-endpoints)
* [Deployment](#deployment)
* [Contributing](#contributing)
* [License](#license)
* [Contact](#contact)

## Features

* **Employee Dashboard:** Overview of submissions, tasks, and monthly trends.
* **Employee Search:** Ability to search for employee details by name, title, branch, and supervisor.
* **Employee Status Change Request Form:** A dedicated form for submitting employee status changes.
* **Interactive Forms:** User-friendly forms with various input fields, dropdowns, and radio buttons.
* **Responsive Design:** Adapts to various screen sizes (desktop, tablet, mobile).

## Technologies Used

### Frontend

* **React.js:** JavaScript library for building user interfaces.
* **HTML5 / CSS3:** For structuring and styling the web content.
    * Custom CSS for dashboard layout, cards, charts, and tables.
    * Dedicated CSS for the "Employee Status Change Request Form" with a dark theme and background image.
* **JavaScript (ES6+):** For frontend logic and interactivity.

### Backend

* **Flask:** A lightweight Python web framework for building the RESTful API.
* **Python 3.x:** Programming language.
* **Flask-CORS:** For handling Cross-Origin Resource Sharing.
* **SQLAlchemy / Flask-SQLAlchemy (Optional):** For database ORM (if used).
* **[Your Database Choice, e.g., SQLite (Default) / PostgreSQL (Production)]:** Database system.

## Project Structure
onboarding-app/
├── backend/
│   ├── app.py              # Flask application entry point
│   ├── requirements.txt    # Python dependencies
│   ├── instance/           # Flask instance folder (e.g., SQLite db, configs)
│   ├── static/             # Static files served by Flask (e.g., React build)
│   └── ...                 # Other backend modules (e.g., models, routes, services)
├── frontend/
│   ├── public/             # React public assets (index.html, favicon)
│   ├── src/                # React source code (components, pages, styles)
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── EmployeeStatusChangeForm.jsx
│   │   │   └── ...
│   │   └── assets/         # Images, icons, etc.
│   │       └── ...
│   ├── package.json        # Node.js dependencies
│   ├── .env.development    # Local environment variables
│   └── ...                 # Other frontend config files
├── .gitignore              # Global Git ignore file
├── README.md               # This file
└── Dockerfile (notyet)   # For containerization

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

Before you begin, ensure you have the following installed:

* **Git:** For cloning the repository.
* **Python 3.8+:** For the Flask backend.
    * It's recommended to use `pip` for Python package management.
* **Node.js (LTS recommended):** For the React frontend.
    * It's recommended to use `npm` or `yarn` for Node package management.

### Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Create a Python virtual environment:**
    ```bash
    python -m venv venv
    ```
3.  **Activate the virtual environment:**
    * **macOS/Linux:**
        ```bash
        source venv/bin/activate
        ```
    * **Windows (Command Prompt):**
        ```bash
        venv\Scripts\activate.bat
        ```
    * **Windows (PowerShell):**
        ```bash
        .\venv\Scripts\Activate.ps1
        ```
4.  **Install backend dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
5.  **Set up environment variables:**
    Create a `.env` file in the `backend/` directory with necessary configurations (e.g., `FLASK_APP`, `FLASK_ENV`, database connection strings).
    ```
    # Example .env for Flask backend
    FLASK_APP=app.py
    FLASK_ENV=development
    DATABASE_URL=sqlite:///instance/database.db
    # Add any other sensitive keys here
    ```
6.  **Initialize the database (if applicable):**
    ```bash
    flask db upgrade # If using Flask-Migrate
    # Or run a script to create tables if no migrations are used
    ```

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```
2.  **Install frontend dependencies:**
    ```bash
    npm install # or yarn install
    ```
3.  **Set up environment variables:**
    Create a `.env.development` file in the `frontend/` directory. This is where you'll define variables like the backend API URL.
    ```
    # Example .env.development for React frontend sample
    REACT_APP_API_URL=[http://127.0.0.1:5000/api](http://127.0.0.1:5000/api)
    ```
    *(Note: React requires variables to be prefixed with `REACT_APP_`)*

### Running the Application

Make sure both the backend and frontend are set up as described above.

1.  **Start the Backend (in a separate terminal):**
    Ensure your virtual environment is active.
    ```bash
    cd backend
    flask run
    # The backend will typically run on [http://127.0.0.1:5000](http://127.0.0.1:5000)
    ```
2.  **Start the Frontend (in another separate terminal):**
    ```bash
    cd frontend
    npm start # or yarn start
    # The frontend will typically open in your browser on http://localhost:3000
    ```

The React frontend will proxy API requests to the Flask backend based on the `REACT_APP_API_URL` you configured.

## API Endpoints

*(This section should list your backend API endpoints, their methods, and expected request/response formats. Example below.)*

| Endpoint | Method | Description | Request Body Example | Response Body Example |
| :------- | :----- | :---------- | :------------------- | :-------------------- |
| `/api/employees` | `GET` | Get all employee records. | None | `[{ "id": 1, "name": "...", "role": "..." }]` |
| `/api/employees/<id>` | `GET` | Get a single employee record. | None | `{ "id": 1, "name": "...", "role": "..." }` |
| `/api/status-change` | `POST` | Submit a new status change request. | `{ "employeeId": 1, "changeType": "..." }` | `{ "message": "Request submitted." }` |
| `/api/search-employees` | `GET` | Search employees. | `?query=David` | `[{ "name": "David Brash", "title": "..." }]` |

## Deployment

*(This section should briefly describe how to deploy your application. Common options include:)*

* **Option 1: Flask serving React's `build` folder:**
    * Build the React app: `cd frontend && npm run build`.
    * Configure Flask `static_folder` and `static_url_path` to serve the `frontend/build` directory.
    * Deploy the entire Flask application (e.g., using Gunicorn/Waitress and a web server like Nginx on a VPS, or directly to a PaaS like Heroku/Render).
* **Option 2: Separate deployments:**
    * Deploy the React app to a static hosting service (e.g., Netlify, Vercel, GitHub Pages).
    * Deploy the Flask API to a separate backend hosting service (e.g., Heroku, Render, AWS EC2).
    * Ensure the `REACT_APP_API_URL` in the frontend's production environment points to the deployed Flask API URL.

## Contributing

We welcome contributions! Please follow these steps:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add new feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Create a new Pull Request.

Please ensure your code adheres to the project's coding standards and includes appropriate tests.

## License

This project is licensed under the [Your License Type, e.g., MIT License] - see the `LICENSE` file for details.

## Contact

* [Your Name/Team Name] - [Your Email/Website] will add in future
* Project Link: [https://github.com/Guardian-Fueling-Technologies/OnboardingProcess.git](https://github.com/Guardian-Fueling-Technologies/OnboardingProcess.git) fake


