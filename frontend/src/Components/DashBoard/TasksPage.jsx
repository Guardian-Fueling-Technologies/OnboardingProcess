// src/TasksPage.jsx (or src/components/TasksPage/TasksPage.jsx)
import React, { useState, useEffect } from 'react';
import Sidebar from '../sidebar/sidebar';
import './TasksPage.css';
import { Edit } from 'lucide-react';
import api from '../config';
import { FaUserCircle } from 'react-icons/fa';

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAndTransformTasks = async () => {
      try {
        setLoading(true);
        setError(null);

        const tasksResponse = await api.get('/api/tasks');
        let rawTasksData = []; // This will hold the data directly from the backend

        if (tasksResponse.data && typeof tasksResponse.data === 'object' && 'message' in tasksResponse.data) {
          console.log("Backend message:", tasksResponse.data.message);
          rawTasksData = [];
        } else if (Array.isArray(tasksResponse.data)) {
          rawTasksData = tasksResponse.data;
        } else {
          console.warn("Unexpected data format from /api/tasks:", tasksResponse.data);
          rawTasksData = [];
        }

        // --- Data Transformation Logic ---
        const transformedTasks = rawTasksData.map(backendTask => {
          // 1. Determine taskName
          let taskName = 'N/A';
          if (backendTask.task_type) {
            // Adjust based on common patterns in your backend's task_type
            if (backendTask.task_type.includes('Issuance')) {
              taskName = backendTask.task_type.replace(' Issuance', '');
            } else if (backendTask.task_type === 'Email Account Setup') {
              taskName = 'Email Account';
            } else if (backendTask.task_type === 'TLC Bonus Eligibility') {
              taskName = 'TLC Bonus';
            } else {
              taskName = backendTask.task_type; // Fallback for other types
            }
          } else if (backendTask.name) {
            // If task_type is not available, try to derive from 'name'
            // Example: "Issue Employee ID for Charlie c" -> "Employee ID"
            if (backendTask.name.startsWith('Issue Employee ID for')) {
                taskName = 'Employee ID';
            } else if (backendTask.name.startsWith('Order Purchasing Card for')) {
                taskName = 'Purchasing Card';
            } else if (backendTask.name.startsWith('Order Gas Card for')) {
                taskName = 'Gas Card';
            } else if (backendTask.name.startsWith('Order Mobile Phone for')) {
                taskName = 'Mobile Phone';
            } else {
                taskName = backendTask.name; // Use name as fallback if no specific pattern matched
            }
          }

          // 2. Format createdAt
          let createdAtFormatted = 'N/A';
          if (backendTask.created_at) {
            try {
              const date = new Date(backendTask.created_at);
              if (!isNaN(date.getTime())) { // Check if date is valid
                createdAtFormatted = date.toLocaleDateString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric',
                });
              }
            } catch (e) {
              console.error("Error parsing created_at date:", e);
            }
          }

          // 3. Calculate duration (currdate - createdat)
          let duration = 'N/A';
          if (backendTask.created_at) {
            try {
              const createdDate = new Date(backendTask.created_at);
              const now = new Date();
              const diffTime = Math.abs(now.getTime() - createdDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Convert milliseconds to days
              if (!isNaN(diffDays)) {
                duration = `${diffDays} days`;
              }
            } catch (e) {
              console.error("Error calculating duration:", e);
            }
          }

          return {
            id: backendTask.id || 'N/A', // Use backend's 'id' directly (can be string)
            taskName: taskName, // Mapped task name
            newHireName: backendTask.employee_full_name || 'N/A',
            manager: backendTask.manager || 'N/A', // Assuming 'manager' might be absent or null from backend, default to 'N/A'
            assignedTo: backendTask.assignedTo || 'N/A',
            createdAt: createdAtFormatted,
            duration: duration,
            status: backendTask.Status || 'N/A', // Backend field is 'Status' (capital S)
          };
        });
        // --- End Data Transformation Logic ---

        console.log('Transformed tasks data:', transformedTasks);
        setTasks(transformedTasks); // Update the state with transformed data

      } catch (err) {
        console.error("Error fetching or transforming tasks:", err);
        setError("Failed to load tasks. Please try again later.");
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAndTransformTasks();

  }, []);

  return (
    <div className="tasks-container main-page-layout">
      <Sidebar />

      <main className="main-content">
        <header className="main-header">
          <h2>Tasks</h2>
          <div className="header-right">
            <a className="requested-form" href="/submissions/new">Requested Form</a>
            <a className="requested-form" href="/EmployeeStatusChangeForm" > Status Change Form </a>
            <FaUserCircle className="profile-avatar" />
          </div>
        </header>

        <section className="tasks-table-section">
          <div className="table-filters">
            {/* Filter inputs */}
            <input type="text" placeholder="Task Name" className="filter-input" />
            <input type="text" placeholder="New Hire Name" className="filter-input" />
            <input type="text" placeholder="Manager" className="filter-input" />
            <input type="text" placeholder="Assigned To" className="filter-input" />
            <input type="text" placeholder="Created At" className="filter-input" />
            <input type="text" placeholder="Duration" className="filter-input" />
            <input type="text" placeholder="Status" className="filter-input" />
            <span className="action-header">Action</span>
          </div>

          <div className="tasks-table">
            <table>
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>New Hire Name</th>
                  <th>Manager</th>
                  <th>Assigned To</th>
                  <th>Created At</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center' }}>Loading tasks...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: 'red' }}>{error}</td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center' }}>No tasks found.</td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.taskName}</td>
                      <td>{task.newHireName}</td>
                      <td>{task.manager}</td>
                      <td>{task.assignedTo}</td>
                      <td>{task.createdAt}</td>
                      <td>{task.duration}</td>
                      <td>
                        <span className={`status-tag ${task.status ? task.status.toLowerCase() : ''}`}>
                          {task.status || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <button className="edit-button">
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="table-pagination">
            <div className="rows-per-page">
              Rows per page:
              <select>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </div>
            <div className="pagination-info">
              {tasks.length > 0 ? `1-${tasks.length} of ${tasks.length}` : '0-0 of 0'}
            </div>
            <div className="pagination-controls">
              <button>&lt;</button>
              <button>&gt;</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TasksPage;