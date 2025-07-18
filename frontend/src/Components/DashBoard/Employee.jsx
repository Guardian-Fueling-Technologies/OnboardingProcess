// src/DashboardPage.jsx (example)
import React, { useState, useEffect } from 'react';
import './DashboardPage.css';
import { FaUserCircle } from 'react-icons/fa';
import Sidebar from '../sidebar/sidebar';
import api from '../config'; // Import your configured Axios instance

const DashboardPage = () => {
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [submissionsToday, setSubmissionsToday] = useState(0);
  const [monthlySubmissions, setMonthlySubmissions] = useState(Array(12).fill(0));
  const [openTasks, setOpenTasks] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const today = new Date();
        const currentYear = today.getFullYear();

        // --- Fetch Submissions Data using configured Axios instance ---
        const submissionsResponse = await api.get('/api/submissions'); // Axios handles base URL automatically
        let submissionsResult = submissionsResponse.data; // Axios puts response data in .data
        // console.log('Backend Submissions GET result:', submissionsResult);

        // Check if the response is an object with a 'message' property
        if (submissionsResponse.data && typeof submissionsResponse.data === 'object' && 'message' in submissionsResponse.data) {
          // If it's a message like "No submissions found", treat it as no data
          console.log("Backend message:", submissionsResponse.data.message);
          submissionsResult = []; // Keep it as an empty array
        } else if (Array.isArray(submissionsResponse.data)) {
          // If it's an array (which is the expected data format for submissions)
          submissionsResult = submissionsResponse.data;
        } else {
          // Handle any other unexpected data format
          console.warn("Unexpected data format from /api/submissions:", submissionsResponse.data);
          submissionsResult = [];
        }
  
        // Now, submissionsResult is guaranteed to be an array (empty or with data)
        // The rest of your logic can proceed as before.
  
        if (submissionsResult.length === 0) {
          // If no submissions, set all counts to 0 and exit early
          setTotalSubmissions(0);
          setSubmissionsToday(0);
          setMonthlySubmissions(Array(12).fill(0));
          // You might also set a state to display a "No data available" message
          // setError("No submission data available.");
          setLoading(false); // Ensure loading is turned off
          return; // Exit the function
        }

        const todayLocaleString = today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

        if (submissionsResult.length === 0) {
          // If no submissions, set all counts to 0 and exit early
          setTotalSubmissions(0);
          setSubmissionsToday(0);
          setMonthlySubmissions(Array(12).fill(0));
          setLoading(false);
          // You might also set a state to display a "No data available" message
          // setError("No submission data available."); // Optional: if you have an error state
          return; // Exit the function
        }
        const countToday = submissionsResult.filter(submission => {
            const createdAtDatePart = submission.CreatedAt.split(' ')[0];
            const submissionDate = new Date(createdAtDatePart);
            return submissionDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) === todayLocaleString;
        }).length;

        setTotalSubmissions(submissionsResult.length);
        setSubmissionsToday(countToday);

        const monthlyCounts = Array(12).fill(0);
        submissionsResult.forEach(submission => {
            const createdAtDate = new Date(submission.CreatedAt);
            if (createdAtDate.getFullYear() === currentYear) {
                const month = createdAtDate.getMonth();
                monthlyCounts[month]++;
            }
        });
        setMonthlySubmissions(monthlyCounts);

        // --- Example: Fetching Tasks Data using configured Axios instance ---
        // (Assuming you create a /api/tasks endpoint in Flask later)
        try {
            const tasksResponse = await api.get('/api/tasks'); // Axios handles base URL
            const tasksResult = tasksResponse.data;
            const openTasksCount = tasksResult.filter(task => task.Status === 'Open').length;
            setOpenTasks(openTasksCount);
            setTotalTasks(tasksResult.length);
        } catch (taskErr) {
            console.warn("Could not fetch tasks, using mock data:", taskErr);
            const tasksMockData = [
              { id: 1, Status: 'Open', description: 'Review new hire paperwork' },
              { id: 2, Status: 'Completed', description: 'Schedule onboarding meeting' },
              { id: 3, Status: 'Open', description: 'Order laptop for new employee' },
              { id: 4, Status: 'In Progress', description: 'Set up CRM access' },
            ];
            setOpenTasks(tasksMockData.filter(task => task.Status === 'Open').length);
            setTotalTasks(tasksMockData.length);
        }


      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError(err.message || 'An error occurred while fetching data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const maxSubmissionsInMonth = Math.max(...monthlySubmissions);
  const minBarHeight = 10; 
  const maxBarVisualHeight = 100;
  const currentYearDisplay = new Date().getFullYear();

  if (loading) {
    return (
      <div className="main-page-layout">
        <Sidebar />
        <main className="main-content">
          {/* You can add a spinner, loading text, or a skeleton loader here */}
          <div className="loading-indicator">
            <div className="spinner"></div> {/* Add CSS for spinner */}
            <p>Loading dashboard data...</p>
          </div>
        </main>
      </div>
    );
  }

  // --- ERROR STATE JSX ---
  if (error) {
    return (
      <div className="main-page-layout">
        <Sidebar />
        <main className="main-content">
          <div className="error-message-container">
            <h3>Error Loading Dashboard</h3>
            <p className="error-text">{error}</p>
            <button onClick={() => {
                setError(null); // Clear error
                setLoading(true); // Set loading to true
                window.location.reload();
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
            <a className="requested-form" href="/submissions/new">Requested Form</a>
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

          <div className="chart-container tasks-status-chart">
            <h3>Tasks Status</h3>
            <div className="pie-chart-placeholder">
              <p>Pie chart coming soon with real data...</p>
              <div className="pie-chart-circle"></div>
              <div className="pie-chart-legend">
                <div className="legend-item"><span className="legend-color open"></span>Open</div>
                <div className="legend-item"><span className="legend-color completed"></span>Completed</div>
                <div className="legend-item"><span className="legend-color in-progress"></span>In Progress</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;