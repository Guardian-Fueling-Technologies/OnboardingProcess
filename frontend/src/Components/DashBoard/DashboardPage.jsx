// src/DashboardPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import './DashboardPage.css';
import { FaUserCircle } from 'react-icons/fa';
import Sidebar from '../sidebar/sidebar';
import { useNavigate } from 'react-router-dom';
import api from '../config'; // Import your configured Axios instance

const DashboardPage = () => {
    const [totalSubmissions, setTotalSubmissions] = useState(0);
    const [submissionsToday, setSubmissionsToday] = useState(0);
    const [monthlySubmissions, setMonthlySubmissions] = useState(Array(12).fill(0));
    const [openTasks, setOpenTasks] = useState(0);
    const [totalTasks, setTotalTasks] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // New states for API-driven search
    const [searchTerm, setSearchTerm] = useState('');
    const [apiSearchResults, setApiSearchResults] = useState([]); // Stores results from the /api/employee-search endpoint
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);

    // Ref for debouncing the search input
    const searchTimeoutRef = useRef(null);

    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const navigate = useNavigate(); // <-- This line is crucial

    // --- MOVE THIS FUNCTION OUT OF useEffect ---
    const handleEmployeeSelect = (employee) => {
        // Navigate to the EmployeeStatusChangeForm page.
        // Pass the employee data as state. This is cleaner than
        // putting all data in query parameters for a full form.
        navigate('/EmployeeStatusChangeForm', { state: { employeeData: employee } });

        console.log("Selected employee:", employee);
    };

    // --- REMOVE handleRowClick from here. It's causing an error. ---
    // You likely intended to use this logic for the submissions page, not here.
    // The handleEmployeeSelect function above is for your employee search results.
    // The previous 'handleRowClick' function you had here was never used anyway
    // and was incorrectly placed.

    // Effect to fetch initial dashboard data and calculate overall stats (runs once on mount)
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                setError(null);

                // --- Fetch Submissions Data (for overall stats) ---
                const submissionsResponse = await api.get('/api/submissions');
                let rawSubmissionsData = [];

                if (submissionsResponse.data && typeof submissionsResponse.data === 'object' && 'message' in submissionsResponse.data) {
                    console.log("Backend message from /api/submissions:", submissionsResponse.data.message);
                    rawSubmissionsData = [];
                } else if (Array.isArray(submissionsResponse.data)) {
                    rawSubmissionsData = submissionsResponse.data;
                } else {
                    console.warn("Unexpected data format from /api/submissions:", submissionsResponse.data);
                    rawSubmissionsData = [];
                }

                // Calculate overall submission stats (these remain based on ALL data)
                const today = new Date();
                const currentYear = today.getFullYear();
                const todayLocaleString = today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

                const countToday = rawSubmissionsData.filter(submission => {
                    const createdAtDatePart = submission.CreatedAt && typeof submission.CreatedAt === 'string' ? submission.CreatedAt.split(' ')[0] : '';
                    const submissionDate = new Date(createdAtDatePart);
                    return !isNaN(submissionDate.getTime()) && submissionDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) === todayLocaleString;
                }).length;

                setTotalSubmissions(rawSubmissionsData.length);
                setSubmissionsToday(countToday);

                const monthlyCounts = Array(12).fill(0);
                rawSubmissionsData.forEach(submission => {
                    const createdAtDate = submission.CreatedAt && typeof submission.CreatedAt === 'string' ? new Date(submission.CreatedAt) : null;
                    if (createdAtDate && !isNaN(createdAtDate.getTime()) && createdAtDate.getFullYear() === currentYear) {
                        const month = createdAtDate.getMonth();
                        monthlyCounts[month]++;
                    }
                });
                setMonthlySubmissions(monthlyCounts);

                // --- Fetch Tasks Data ---
                let rawTasksData = [];
                try {
                    const tasksResponse = await api.get('/api/tasks');
                    if (tasksResponse.data && typeof tasksResponse.data === 'object' && 'message' in tasksResponse.data) {
                        console.log("Backend tasks message:", tasksResponse.data.message);
                        rawTasksData = [];
                    } else if (Array.isArray(tasksResponse.data)) {
                        rawTasksData = tasksResponse.data;
                    } else {
                        console.warn("Unexpected data format from /api/tasks:", tasksResponse.data);
                        rawTasksData = [];
                    }
                } catch (taskErr) {
                    console.warn("Could not fetch tasks:", taskErr);
                    // Fallback to mock data if API call fails
                    const tasksMockData = [
                        { id: 'mock1', Status: 'Open', description: 'Review new hire paperwork' },
                        { id: 'mock2', Status: 'Completed', description: 'Schedule onboarding meeting' },
                        { id: 'mock3', Status: 'Open', description: 'Order laptop for new employee' },
                        { id: 'mock4', Status: 'In Progress', description: 'Set up CRM access' },
                    ];
                    rawTasksData = tasksMockData;
                }

                const openTasksCount = rawTasksData.filter(task => task.Status === 'Open').length;
                setOpenTasks(openTasksCount);
                setTotalTasks(rawTasksData.length);

            } catch (err) {
                console.error("Error fetching dashboard data:", err);
                setError(err.message || 'An error occurred while fetching data.');
                // Clear all relevant states on error
                setTotalSubmissions(0);
                setSubmissionsToday(0);
                setMonthlySubmissions(Array(12).fill(0));
                setOpenTasks(0);
                setTotalTasks(0);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []); // Empty dependency array, runs once on mount

    // Effect to handle debounced API search
    useEffect(() => {
        // Clear any existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchTerm.trim() === '') {
            // If search term is empty, clear results and stop searching
            setApiSearchResults([]);
            setIsSearching(false);
            setSearchError(null);
            return; // Exit early
        }

        setIsSearching(true); // Indicate that a search is pending
        setSearchError(null); // Clear previous errors

        // Set a new timeout to call the API after a delay (e.g., 500ms)
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const response = await api.get('/api/employee-search', {
                    params: { term: searchTerm.trim() }
                });
                setApiSearchResults(response.data);
                console.log("API Search Results:", response.data);
            } catch (err) {
                console.error("Error searching employees:", err);
                setApiSearchResults([]); // Clear results on error
                if (err.response && err.response.data && err.response.data.message) {
                    // Your backend returns 404 with {"message": "No matching employees found"}
                    if (err.response.status === 404 && err.response.data.message.includes("No matching employees found")) {
                        setSearchError("No employees found for this search term.");
                    } else {
                        setSearchError(err.response.data.message);
                    }
                } else {
                    setSearchError("Failed to search employees. Please try again.");
                }
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms debounce delay

        // Cleanup function: This runs when the component unmounts or before the effect runs again
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchTerm]); // Re-run this effect whenever searchTerm changes

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const maxSubmissionsInMonth = Math.max(...monthlySubmissions);
    const minBarHeight = 10;
    const maxBarVisualHeight = 100;
    const currentYearDisplay = new Date().getFullYear();

    if (loading) {
        return (
            <div className="main-page-layout">
                <Sidebar />
                <main className="main-content">
                    <div className="loading-indicator">
                        <div className="spinner"></div>
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
                    <div className="error-message-container">
                        <h3>Error Loading Dashboard</h3>
                        <p className="error-text">{error}</p>
                        <button onClick={() => {
                            setError(null);
                            setLoading(true);
                            window.location.reload(); // Simple reload to re-fetch
                        }} className="retry-button">Retry</button>
                    </div>
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
                        <a className="requested-form" href="/requestform">Requested Form</a>
                        <a className="requested-form" href="/EmployeeStatusChangeForm" > Status Change Form </a>
                        <FaUserCircle className="profile-avatar" />
                    </div>
                </header>

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

                <section className="charts-section">
                    <div className="chart-container submissions-chart">
                        <h3>Submissions (Monthly Trend - {currentYearDisplay})</h3>
                        <div className="bar-chart-placeholder">
                            {monthlySubmissions.map((count, index) => {
                                const heightPercentage = maxSubmissionsInMonth > 0
                                    ? Math.max(minBarHeight, (count / maxSubmissionsInMonth) * maxBarVisualHeight)
                                    : minBarHeight;
                                return (
                                    <div
                                        key={monthLabels[index]}
                                        className="bar-chart-bar"
                                        style={{ height: `${heightPercentage}%` }}
                                        title={`${monthLabels[index]}: ${count} submissions`}
                                    >
                                        {count > 0 && <span className="bar-value">{count}</span>}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="x-axis-labels">
                            {monthLabels.map(month => (
                                <span key={month} className="x-axis-label-item">{month}</span>
                            ))}
                        </div>
                    </div>

                    <div className="chart-container search-employee-container">
                        <h3>Search Employee Details</h3> {/* Changed title slightly */}
                        <div className="search-input-wrapper">
                            <input
                                type="text"
                                placeholder="Enter name, or email..." // Updated placeholder
                                value={searchTerm}
                                onChange={handleSearchChange}
                                className="search-input full-width"
                                aria-label="Search employee by name, ID, or email"
                            />
                        </div>

                        {/* Display search results, loading, or error messages */}
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
                            <div className="search-results-table-container"> {/* Changed class name */}
                                <h4>Search Results:</h4>
                                <table className="employee-search-table"> {/* Changed from <ul> to <table> */}
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Title</th>
                                            <th>Branch</th>
                                            <th>Supervisor</th>
                                            {/* Add more <th> if you want to display more columns */}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {apiSearchResults.map((employee) => (
                                            <tr
                                                key={employee.EmployeeID || employee.Email || employee.EmployeeName} // Robust key
                                                onClick={() => handleEmployeeSelect(employee)} // Clickable row, passes full employee object
                                                className="clickable-row" // For CSS styling
                                            >
                                                <td>{employee.EmployeeName || 'N/A'}</td>
                                                <td>{employee.EmployeeTitle || 'N/A'}</td>
                                                <td>{employee.BRANCH || 'N/A'}</td>
                                                <td>{employee.Supervisor || 'N/A'}</td>
                                                {/* Add more <td> for additional columns if needed */}
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