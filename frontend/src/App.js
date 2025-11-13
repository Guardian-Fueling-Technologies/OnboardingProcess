// src/App.jsx
import React, { useEffect } from "react"; 
import { Routes, Route, Navigate } from "react-router-dom";

import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication} from "@azure/msal-browser";

// MSAL config
import { msalConfig } from "./authConfig";

// Auth context (uses MSAL accounts)
import { AuthProvider} from "./Components/AuthContext";

// Pages
import LoginForm from "./Components/LoginForm/LoginForm";
import DashboardPage from "./Components/DashBoard/DashboardPage";
import SubmissionsPage from "./Components/DashBoard/SubmissionsPage";
import TaskPage from "./Components/DashBoard/TasksPage";
import SideBar from "./Components/sidebar/sidebar";
import Profile from "./Components/Profile/profile";
import EditForm from "./Components/EditForm/editSubmissionform";
import EmployeeStatusChangeForm from "./Components/EmployeeStatusChangeForm/EmployeeStatusChangeForm";
import Employee from "./Components/DashBoard/Employee";
import AuthPopup from "./Components/authPopup";
import EditRoles from "./Components/EditRoles/Editroles";
import ProtectedRoute, { PublicOnlyRoute } from "./Components/ProtectedRoute";

// Create once
const msalInstance = new PublicClientApplication(msalConfig);

export default function App() {
  useEffect(() => {
    document.title = "HR Portal";  // 🔹 sets browser tab title
  }, []);
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
      <Routes>
        
      {/* Login page only when NOT authenticated */}
      <Route path="/auth/popup" element={<AuthPopup />} />

      <Route path="/" element={<PublicOnlyRoute><LoginForm /></PublicOnlyRoute>} />
      <Route path="/login" element={<PublicOnlyRoute><LoginForm /></PublicOnlyRoute>} />

      {/* Auth-required routes */}
      <Route path="/dashboard" element={ <ProtectedRoute allow={["admin", "hr", "manager"]} fallbackInProgress={<div style={{ padding: 24 }}>Loading…</div>} > <DashboardPage /> </ProtectedRoute> } />
      <Route path="/submissions" element={<ProtectedRoute><SubmissionsPage /></ProtectedRoute>} />
      <Route path="/EditRoles" element={<ProtectedRoute><EditRoles/></ProtectedRoute>} />
      <Route path="/submissions/new" element={<ProtectedRoute><EditForm /></ProtectedRoute>} />
      <Route path="/submissions/:submission_id" element={<ProtectedRoute><EditForm /></ProtectedRoute>} />
      <Route path="/tasks" element={ <ProtectedRoute> <TaskPage /> </ProtectedRoute> } />
      <Route path="/task/new" element={<ProtectedRoute><EditForm /></ProtectedRoute>} />
      <Route path="/task/:id" element={<ProtectedRoute><EditForm /></ProtectedRoute>} />
      <Route path="/sidebar" element={<ProtectedRoute><SideBar /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/EmployeeStatusChangeForm" element={<ProtectedRoute><EmployeeStatusChangeForm /></ProtectedRoute>} />
      <Route path="/Employee" element={<ProtectedRoute><Employee /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
      <Route path="/403" element={<div>Access denied</div>} />

    </Routes>

      </AuthProvider>
    </MsalProvider>
  );
}
