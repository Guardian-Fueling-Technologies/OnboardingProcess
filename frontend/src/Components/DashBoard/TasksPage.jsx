// src/components/TasksPage/TasksPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import Sidebar from "../sidebar/sidebar";
import "./TasksPage.css";
import { useAuth } from "../AuthContext";
import { Edit } from "lucide-react";
import api from "../config";
import { Link } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

const GRAPH_SCOPES = ["User.Read"];
const GUIDE_KEY = "tasksPage.showGuide.v1"; // bump version to re-show after copy changes

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [, setLoading] = useState(true);
  const [, setError] = useState(null);


  // Popup state
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupTask, setPopupTask] = useState(null);
  const [popupForm, setPopupForm] = useState({ status: "", assignedTo: "", notes: "" });
  const [popupError, setPopupError] = useState(null);
  const [popupSaving, setPopupSaving] = useState(false);

  const [filterTask, setFilterTask] = useState("");
  const [filterHire, setFilterHire] = useState("");
  const [filterManager, setFilterManager] = useState("");
  const [filterAssigned, setFilterAssigned] = useState("");

  // Page help / guide
  const [showGuide, setShowGuide] = useState(false);

  // MSAL / Graph
  const { instance, accounts } = useMsal();
  const activeAccount = useMemo(
    () => instance.getActiveAccount?.() || accounts?.[0] || null,
    [instance, accounts]
  );
  const { user } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const canEditTasks = ["admin", "hr", "manager", "fr"].includes(role);
  const userRole = user?.role;
  const isHiringManagerOrAdmin = userRole === 'admin' || userRole === 'hiring_manager';
  const displayName = user?.display_name || user?.email || 'User';
  const fallbackAvatar = `https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=${encodeURIComponent(displayName || 'User')}`;
  

  const [photoUrl, setPhotoUrl] = useState(null);

  // Prefill guide visibility (remembered in localStorage)
  useEffect(() => {
    const hidden = localStorage.getItem(GUIDE_KEY) === "hide";
    setShowGuide(!hidden);
  }, []);

  const dismissGuide = (persist = true) => {
    if (persist) localStorage.setItem(GUIDE_KEY, "hide");
    setShowGuide(false);
  };

  // Fetch profile + avatar from Graph
  useEffect(() => {
    let alive = true;
    let toRevoke = null;

    (async () => {
      try {
        if (!activeAccount) return;
        const token = await instance.acquireTokenSilent({
          scopes: GRAPH_SCOPES,
          account: activeAccount,
        });

        const phRes = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        });
        if (alive && phRes.ok) {
          const blob = await phRes.blob();
          const url = URL.createObjectURL(blob);
          toRevoke = url;
          setPhotoUrl(url);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
      if (toRevoke) URL.revokeObjectURL(toRevoke);
    };
  }, [instance, activeAccount, photoUrl]);

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get("/api/tasks");
        const arr = Array.isArray(res.data) ? res.data : [];

        const mapped = arr.map((t) => {
          let taskName = "N/A";
          if (t.task_type) {
            if (t.task_type.includes("Issuance")) taskName = t.task_type.replace(" Issuance", "");
            else if (t.task_type === "Email Account Setup") taskName = "Email Account";
            else if (t.task_type === "TLC Bonus Eligibility") taskName = "TLC Bonus";
            else taskName = t.task_type;
          } else if (t.name) {
            if (t.name.startsWith("Issue Employee ID for")) taskName = "Employee ID";
            else if (t.name.startsWith("Order Purchasing Card for")) taskName = "Purchasing Card";
            else if (t.name.startsWith("Order Gas Card for")) taskName = "Gas Card";
            else if (t.name.startsWith("Order Mobile Phone for")) taskName = "Mobile Phone";
            else taskName = t.name;
          }

          const createdAtDate = t.created_at ? new Date(t.created_at) : null;
          const createdAt =
            createdAtDate && !isNaN(createdAtDate)
              ? createdAtDate.toLocaleDateString("en-US", {
                  month: "2-digit",
                  day: "2-digit",
                  year: "numeric",
                })
              : "N/A";

          const duration =
            createdAtDate && !isNaN(createdAtDate)
              ? `${Math.ceil((Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24))} days`
              : "N/A";

          return {
            id: String(t.id || t.task_id || t.name || t.task_type || "").trim(),
            taskName,
            newHireName: t.employee_full_name || "N/A",
            manager: t.manager || "N/A",
            assignedTo: t.assignedTo || "N/A",
            createdAt,
            duration,
            status: t.Status || "Open",
            notes: t.notes || "",
          };
        });
        const uniqueTasks = [];
        const seen = new Set();
        
        for (const task of mapped) {
          if (!seen.has(task.id)) {
            seen.add(task.id);
            uniqueTasks.push(task);
          }
        }
        
        setTasks(uniqueTasks);
      } catch (err) {
        console.error(err);
        setError("Failed to load tasks");
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter((t) => {
    const matchTask = t.taskName.toLowerCase().includes(filterTask.toLowerCase());
    const matchHire = t.newHireName.toLowerCase().includes(filterHire.toLowerCase());
    const matchManager = t.manager.toLowerCase().includes(filterManager.toLowerCase());
    const matchAssigned = t.assignedTo.toLowerCase().includes(filterAssigned.toLowerCase());
    return matchTask && matchHire && matchManager && matchAssigned;
  });
  // Popup handlers
  const notesRef = useRef(null);

  const openPopup = (task, focusField) => {
    setPopupTask(task);
    setPopupForm({
      status: task.status,
      assignedTo: task.assignedTo,
      notes: task.notes,
    });
    setPopupError(null);
    setPopupOpen(true);

    // optional: focus Notes when opened via a "notes" action
    setTimeout(() => {
      if (focusField === "notes") notesRef.current?.focus();
    }, 0);
  };

  const closePopup = () => {
    setPopupOpen(false);
    setPopupTask(null);
  };

  const savePopup = async () => {
    if (!popupTask) return;
    try {
      setPopupSaving(true);
      await api.post(`/api/tasks/update`, {
        task_id: popupTask.id,
        Status: popupForm.status,
        assignedTo: popupForm.assignedTo,
        description: popupForm.notes,
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === popupTask.id
            ? { ...t, status: popupForm.status, assignedTo: popupForm.assignedTo, notes: popupForm.notes }
            : t
        )
      );
      closePopup();
    } catch (err) {
      console.error(err);
      setPopupError("Failed to save changes");
    } finally {
      setPopupSaving(false);
    }
  };

  return (<div className="main-page-layout">
    <Sidebar />
    <main className="main-content">
      <header className="main-header">
        <h2>Welcome to Guardian</h2>
        <div className="header-right">
          {isHiringManagerOrAdmin && (
            <>
              <Link className="requested-form" to="/submissions/new">Requested Form</Link>
              <Link className="requested-form" to="/EmployeeStatusChangeForm">Status Change Form</Link>
            </>
          )}

          <Link to="/profile" title="View profile">
            <img
              className="profile-avatar"
              src={fallbackAvatar}
              alt="Profile"
            />
          </Link>
        </div>
      </header>

        {/* Role-aware instructions (dismissible) */}
        {showGuide && (
          <div className="tasks-guide" role="note" aria-live="polite">
            <div className="tasks-guide-text">
              <strong>Quick tips</strong>
              <ul>
                <li>
                  <span className="pill">New employees</span> — click a task to read the
                  instructions and complete what’s needed. Your manager/HR will update the status.
                </li>
                <li>
                  <span className="pill">Task editors</span> — click{" "}
                  <Edit size={14} style={{ verticalAlign: "-2px" }} /> to change <b>Status</b> and{" "}
                  <b>Assigned To</b>, and add context in <b>Notes</b>.
                </li>
              </ul>
            </div>
            <div className="tasks-guide-actions">
              <button className="btn btn-ghost" onClick={() => dismissGuide(false)}>
                Hide for now
              </button>
              <button className="btn btn-primary" onClick={() => dismissGuide(true)}>
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <section className="tasks-table-section">
        {/* Search / Filter Bar (same style as SubmissionsPage) */}
        {/* Filter row styled like Submissions */}
        <div className="tasks-filter-row">
          <input
            type="text"
            className="filter-box"
            placeholder="Task Name"
            value={filterTask}
            onChange={(e) => setFilterTask(e.target.value)}
          />
          <input
            type="text"
            className="filter-box"
            placeholder="New Hire Name"
            value={filterHire}
            onChange={(e) => setFilterHire(e.target.value)}
          />
          <input
            type="text"
            className="filter-box"
            placeholder="Manager"
            value={filterManager}
            onChange={(e) => setFilterManager(e.target.value)}
          />
          <input
            type="text"
            className="filter-box"
            placeholder="Assigned To"
            value={filterAssigned}
            onChange={(e) => setFilterAssigned(e.target.value)}
          />
        </div>

        {/* Scrollable Table */}
        <div className="tasks-table-scroll">
          <table className="tasks-table">
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
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center" }}>No tasks found</td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.taskName}</td>
                    <td>{task.newHireName}</td>
                    <td>{task.manager}</td>
                    <td>{task.assignedTo}</td>
                    <td>{task.createdAt}</td>
                    <td>{task.duration}</td>
                    <td>{task.status}</td>
                    <td>
                      {canEditTasks && (
                        <button className="edit-button" onClick={() => openPopup(task)}>
                          <Edit size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      </main>

      {/* Popup */}
      {popupOpen && (
        <div className="popup-overlay" role="dialog" aria-modal="true">
          <div className="popup">
            <div className="popup-header">
              <h3 className="popup-title">Edit Task</h3>
              <button className="popup-close" aria-label="Close" onClick={closePopup}>
                ×
              </button>
            </div>

            <div className="popup-body">
              <div className="popup-form">
                <label className="popup-label" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  className="popup-select"
                  value={popupForm.status}
                  onChange={(e) => setPopupForm({ ...popupForm, status: e.target.value })}
                >
                  <option>Open</option>
                  <option>In Progress</option>
                  <option>Blocked</option>
                  <option>Resolved</option>
                  <option>On Hold</option>
                </select>

                <label className="popup-label" htmlFor="assignedTo">
                  Assigned To
                </label>
                <input
                  id="assignedTo"
                  className="popup-input"
                  placeholder="e.g., HR/Payroll"
                  readOnly
                  value={popupForm.assignedTo}
                  onChange={(e) => setPopupForm({ ...popupForm, assignedTo: e.target.value })}
                />

                <label className="popup-label" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  ref={notesRef}
                  id="notes"
                  className="popup-textarea"
                  placeholder="Optional notes for this task…"
                  value={popupForm.notes}
                  onChange={(e) => setPopupForm({ ...popupForm, notes: e.target.value })}
                />

                {popupError && <div className="popup-error">{popupError}</div>}
              </div>
            </div>

            <div className="popup-footer">
              <button className="btn btn-ghost" onClick={closePopup}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={savePopup} disabled={popupSaving}>
                {popupSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
