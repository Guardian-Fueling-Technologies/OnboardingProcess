// src/Components/DashBoard/DashboardPage.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import './DashboardPage.css';
import Sidebar from '../sidebar/sidebar';
import { useNavigate, Link } from 'react-router-dom';
import api from '../config';
import { useAuth } from '../AuthContext';

const DashboardPage = () => {
  const { user, isAuthenticated, loading: authLoading, account } = useAuth();
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [submissionsToday, setSubmissionsToday] = useState(0);
  const [monthlySubmissions, setMonthlySubmissions] = useState(Array(12).fill(0));
  const [openTasks, setOpenTasks] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [apiSearchResults, setApiSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchTimeoutRef = useRef(null);
  const navigate = useNavigate();

  const handleEmployeeSelect = (employee) => {
    navigate('/EmployeeStatusChangeForm', { state: { employeeData: employee } });
  };

  // Header + role
  const displayName = user?.display_name || user?.email || 'User';
  const userRole = user?.role;
  const fallbackAvatar = `https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=${encodeURIComponent(displayName || 'User')}`;

  // --- Role control logic ---
  const isAdminOrHR = userRole === 'admin' || userRole === 'hr';
  const isManager = userRole === 'manager';

  // --- Auth header memoization ---
  const authHeaders = useMemo(() => {
    if (account) {
      return { Authorization: `Bearer :${user?.role_id}` };
    }
    if (user?.role_id) {
      return { Authorization: `Bearer demo:${user.role_id}` };
    }
    return {};
  }, [account, user?.role_id]);

  // ----- Data fetching effect -----
  // ----- Data fetching effect -----
useEffect(() => {
  if (!isAuthenticated || !user?.email) return;

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // --- Submissions (filter for managers only) ---
      const submissionParams =
        userRole === "manager"
          ? { Createdby: user.email } // manager only sees their own
          : {};

      const submissionsResponse = await api.get("/api/submissions/count", {
        headers: authHeaders,
        params: submissionParams,
        validateStatus: () => true,
      });

      if (submissionsResponse.status === 200) {
        const raw = submissionsResponse.data;
        setTotalSubmissions(raw.count || 0);
        setSubmissionsToday(raw.today || 0);
        setMonthlySubmissions(raw.monthly || Array(12).fill(0));
      } else {
        throw new Error(`GET /api/submissions/count ${submissionsResponse.status}`);
      }

      // --- Tasks (optional: filter tasks if your backend supports Createdby) ---
      const taskParams =
        userRole === "manager"
          ? { Createdby: user.email }
          : {};

      let tasks = [];
      const tasksResponse = await api.get("/api/tasks", {
        headers: authHeaders,
        params: taskParams,
        validateStatus: () => true,
      });

      if (tasksResponse.status === 200) {
        tasks = Array.isArray(tasksResponse.data) ? tasksResponse.data : [];
      }

      // Filter tasks client-side as a safeguard (if backend doesn’t yet filter)
      if (userRole === "manager") {
        tasks = tasks.filter(
          (t) => t.Createdby?.toLowerCase() === user.email.toLowerCase()
        );
      }

      setOpenTasks(tasks.filter((t) => t.Status === "Open").length);
      setTotalTasks(tasks.length);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      let userMessage = "An error occurred while fetching data.";
      if (err.message?.includes("Network Error")) {
        userMessage = "Failed to connect to the server. Please ensure the backend is running.";
      } else if (err.response) {
        userMessage = `Server responded with status ${err.response.status}: ${
          err.response.data?.message || "Unknown error"
        }.`;
      }
      setError(userMessage);

      // reset visuals
      setTotalSubmissions(0);
      setSubmissionsToday(0);
      setMonthlySubmissions(Array(12).fill(0));
      setOpenTasks(0);
      setTotalTasks(0);
    } finally {
      setIsLoading(false);
    }
  };

  fetchDashboardData();
}, [isAuthenticated, user?.email, userRole, authHeaders]);

  // ----- debounced search effect -----
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (searchTerm.trim() === '') {
      setApiSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await api.get('/api/employee-search', {
          params: { term: searchTerm.trim() },
        });
        setApiSearchResults(response.data);
      } catch (err) {
        setApiSearchResults([]);
        if (err.response?.status === 404 && err.response?.data?.message?.includes("No matching employees")) {
          setSearchError("No employees found for this search term.");
        } else {
          setSearchError(err.response?.data?.message || "Failed to search employees. Please try again.");
        }
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => searchTimeoutRef.current && clearTimeout(searchTimeoutRef.current);
  }, [searchTerm]);

  const handleSearchChange = (e) => setSearchTerm(e.target.value);

  const maxSubmissionsInMonth = Math.max(...monthlySubmissions);
  const minBarHeight = 10;
  const maxBarVisualHeight = 100;
  const currentYearDisplay = new Date().getFullYear();

  if (authLoading) {
    return (
      <div className="main-page-layout">
        <Sidebar />
        <main className="main-content">
          <div className="dashboard-loading">
            <div className="spinner" />
            <p>Loading dashboard data...</p>
          </div>
        </main>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="main-page-layout">
        <Sidebar />
        <main className="main-content">
          <div className="dashboard-loading">
            <div className="spinner" />
            <p>Loading dashboard data...</p>
          </div>
        </main>
      </div>
    );
  }
  if (error) {
    return (
      <div className="main-page-layout">
        <Sidebar />
        <main className="main-content">
          <p style={{ color: "red" }}>{error}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="main-page-layout">
      <Sidebar />
      <main className="main-content">
        <header className="main-header">
          <h2>Welcome to Guardian</h2>
          <div className="header-right">
            {/* Admin + HR: can access both */}
            {/* All users can access both forms */}
            <Link className="requested-form" to="/submissions/new">
              Requested Form
            </Link>
            <Link className="requested-form" to="/EmployeeStatusChangeForm">
              Status Change Form
            </Link>
            <Link to="/profile" title="View profile">
              <img className="profile-avatar" src={fallbackAvatar} alt="Profile" />
            </Link>
          </div>
        </header>

        {/* Info Cards */}
        <section className="info-cards-section">
          <div className="info-card submissions-card">
            <h3>Submissions</h3>
            <div className="card-content">
              <div className="card-item">
                <span className="label">Today</span>
                <span className="value">{submissionsToday}</span>
              </div>
              <div className="card-item">
                <span className="label">Total</span>
                <span className="value">{totalSubmissions}</span>
              </div>
            </div>
            <div className="chart-placeholder red-gradient"></div>
          </div>

          <div className="info-card tasks-card">
            <h3>Tasks</h3>
            <div className="card-content">
              <div className="card-item">
                <span className="label">Open</span>
                <span className="value">{openTasks}</span>
              </div>
              <div className="card-item">
                <span className="label">Total</span>
                <span className="value">{totalTasks}</span>
              </div>
            </div>
            <div className="chart-placeholder blue-gradient"></div>
          </div>
        </section>

        {/* Charts and optional search */}
        <section className="charts-section">
          <div className="chart-container submissions-chart">
            <h3>Submissions (Monthly Trend - {currentYearDisplay})</h3>
            <div className="bar-chart-placeholder">
              {monthlySubmissions.map((count, index) => {
                const heightPercentage =
                  maxSubmissionsInMonth > 0
                    ? Math.max(minBarHeight, (count / maxSubmissionsInMonth) * maxBarVisualHeight)
                    : minBarHeight;
                return (
                  <div
                    key={index}
                    className="bar-chart-bar"
                    style={{ height: `${heightPercentage}%` }}
                    title={`${currentYearDisplay} ${index}: ${count} submissions`}
                  >
                    {count > 0 && <span className="bar-value">{count}</span>}
                  </div>
                );
              })}
            </div>
            <div className="x-axis-labels">
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(month => (
                <span key={month} className="x-axis-label-item">{month}</span>
              ))}
            </div>
          </div>

          {/* Only Admin + HR can use Search */}
            <div className="chart-container search-employee-container">
              <h3>Search Employee Details</h3>
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Enter name, or email..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="search-input full-width"
                  aria-label="Search employee by name, ID, or email"
                />
              </div>

              <div className="search-results-area">
                {isSearching && searchTerm.trim() !== '' && (
                  <p className="search-loading-message">Searching...</p>
                )}

                {searchError && searchTerm.trim() !== '' && (
                  <p className="search-error-message">{searchError}</p>
                )}

                {searchTerm.trim() !== '' && !isSearching && !searchError && apiSearchResults.length === 0 && (
                  <p className="no-results-message">No matching employees found.</p>
                )}

                {apiSearchResults.length > 0 && (
                  <div className="search-results-table-container">
                    <h4>Search Results:</h4>
                    <table className="employee-search-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Title</th>
                          <th>Branch</th>
                          <th>Supervisor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiSearchResults.map((employee) => (
                          <tr
                            key={employee.EmployeeID || employee.Email || employee.EmployeeName}
                            onClick={() => handleEmployeeSelect(employee)}
                            className="clickable-row"
                          >
                            <td>{employee.EmployeeName || 'N/A'}</td>
                            <td>{employee.EmployeeTitle || 'N/A'}</td>
                            <td>{employee.BRANCH || 'N/A'}</td>
                            <td>{employee.Supervisor || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="table-hint">Click a row to start a status change request for this employee.</p>
                  </div>
                )}
              </div>
            </div>
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;
