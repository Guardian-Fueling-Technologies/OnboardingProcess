// src/App.jsx (or src/App.js)
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import your LoginForm and DashboardPage components
import { LoginForm } from './Components/LoginForm/LoginForm';
import DashboardPage from './Components/DashBoard/DashboardPage'; // Assuming DashboardPage is a default export
import SubmissionsPage from './Components/DashBoard/SubmissionsPage';
import TaskPage from './Components/DashBoard/TasksPage';
import SideBar from './Components/sidebar/sidebar';
import Profile from './Components/Profile/profile';
import EditForm from "./Components/EditForm/editform"
import EmployeeStatusChangeForm from './Components/EmployeeStatusChangeForm/EmployeeStatusChangeForm';
import Employee from './Components/DashBoard/Employee'

function App() {
  return (
    <BrowserRouter> {/* BrowserRouter wraps your entire routing */}
      <Routes> {/* Routes defines your different route paths */}
        <Route path="/" element={<LoginForm />} /> {/* Login page at the root path */}
        <Route path="/dashboard" element={<DashboardPage />} /> {/* Dashboard page at /dashboard */}
        <Route path="/submissions" element={<SubmissionsPage />} /> {/* Dashboard page at /dashboard */}
        <Route path="/tasks" element={<TaskPage />} /> {/* Dashboard page at /dashboard */}
        <Route path="/sidebar" element={<SideBar />} /> {/* Dashboard page at /dashboard */}
        <Route path="/profile" element={<Profile />} /> {/* Dashboard page at /dashboard */}
        <Route path="/submissions/new" element={<EditForm />} />
        {/* Route for editing an existing submission */}
        <Route path="/submissions/:id" element={<EditForm />} />
        <Route path="/EmployeeStatusChangeForm" element={<EmployeeStatusChangeForm />} />
        <Route path="/Employee" element={<Employee/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;