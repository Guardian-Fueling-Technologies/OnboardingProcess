// src/pages/SubmissionsPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import './SubmissionsPage.css';
import { Edit } from 'lucide-react';
import Sidebar from '../sidebar/sidebar';
import { useNavigate, Link } from 'react-router-dom';
import api from '../config';
import { useAuth } from '../AuthContext';

const SubmissionsPage = () => {
  const [submissionsData, setSubmissionsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const authHeaders = useMemo(
    () => (user?.role_id ? { Authorization: `Bearer demo:${user.role_id}` } : {}),
    [user?.role_id]
  );

  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const userRole = user?.role?.toLowerCase();
  const displayName = user?.display_name || user?.email || 'User';
  const avatarUrl =
  user?.avatar?.startsWith('http')
    ? user.avatar
    : `https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=${encodeURIComponent(displayName)}`;  const isManager = userRole === 'manager';
  const isHR = userRole === 'hr';
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;

    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        setError("");

        // 🧠 Filter so managers only get their own submissions
        const res = await api.get("/api/submissions", {
          headers: authHeaders,
          params: {
            page: currentPage,
            per_page: rowsPerPage,
            ...(isManager ? { created_by: user?.email } : {}),
          },
        });

        if (res.status === 401) {
          setSubmissionsData([]);
          setError("Not authorized to view submissions (401).");
          return;
        }

        if (res.status !== 200)
          throw new Error(`GET /api/submissions returned status ${res.status}`);
        
        console.log(res.data.items);
        
        const { items = [], page, per_page, total_pages = 1 } = res.data || {};
        const transformed = items.map((rawItem) => {
          // normalize keys to lowercase
          const item = Object.fromEntries(
            Object.entries(rawItem).map(([k, v]) => [k.toLowerCase(), v])
          );
        
          return {
            submission_id: item.submission_id ?? "",
            newName: [item.legalfirstname, item.legalmiddlename, item.legallastname]
              .filter(Boolean)
              .join(" "),
            userType: item.type ?? "",
            positionTitle: item.positiontitle ?? "",
            location: item.location ?? "",
            manager: item.manager ?? "",
            payRate: item.payrate ?? null,
            payRateType: item.payratetype ?? "",
            projectedStartDate: item.projectedstartdate ?? "",
            department: item.department ?? "",
            additionType: item.additiontype ?? "",
            createdAt: item.createdat ?? "",
            updatedAt: item.updatedat ?? "",
            createdBy: item.createdby ?? item.create_by ?? "",
          };
        });
        
        // 🧠 Manager filtering is already handled on the backend
        setSubmissionsData(transformed);
        
        if (page) setCurrentPage(page);
        if (per_page) setRowsPerPage(per_page);
        setTotalRows(transformed.length);
        setTotalPages(total_pages);
        
      } catch (err) {
        console.error("Error fetching submissions:", err);
        setError(err.message || "Failed to fetch submissions.");
        setSubmissionsData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [isAuthenticated, user?.email, authHeaders, currentPage, rowsPerPage, isManager]);

  const handleEditClick = (submission_id) => {
    if (isAdmin || isHR) navigate(`/submissions/${submission_id}`);
  };


  const startIndex = (currentPage - 1) * rowsPerPage;

  const handleRowsChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  if (authLoading) {
    return (
      <div className="main-page-layout">
        <Sidebar />
        <main className="main-content">
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Loading submissions…</p>
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
            {/* Managers can only add new requests */}
            {/* All users can access both Requested Form and Status Change Form */}
            <Link className="requested-form" to="/submissions/new">
              Requested Form
            </Link>
            <Link className="requested-form" to="/EmployeeStatusChangeForm">
              Status Change Form
            </Link>


            <Link to="/profile" title="View profile">
            <img
              className="profile-avatar"
              src={avatarUrl}
              alt={displayName}
            />
            </Link>
          </div>
        </header>

        {error && (
          <div className="error-message-container">
            <p className="error-text">{error}</p>
          </div>
        )}

        <section className="submissions-table-section">
          <div className="table-filters">
            <input type="text" placeholder="New Hire Name" className="filter-input" />
            <input type="text" placeholder="User Type" className="filter-input" />
            <input type="text" placeholder="Position Title" className="filter-input" />
            <input type="text" placeholder="Location" className="filter-input" />
            <input type="text" placeholder="Manager" className="filter-input" />
            <span className="action-header">Action</span>
          </div>

          <div className="submissions-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>New Hire Name</th>
                  <th>User Type</th>
                  <th>Position Title</th>
                  <th>Location</th>
                  <th>Manager</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center" }}>Loading...</td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", color: "red" }}>{error}</td>
                  </tr>
                )}
                {!loading && !error && submissionsData.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", color: "#666" }}>No submissions found.</td>
                  </tr>
                )}
                {!loading && !error && submissionsData.length > 0 &&
                  submissionsData.map((submission, idx) => (
                    <tr key={submission.submission_id}>
                      <td>{startIndex + idx + 1}</td>
                      <td>{submission.newName}</td>
                      <td>
                        <span
                          className={`user-type-tag ${String(submission.userType || "")
                            .toLowerCase()
                            .replace(/\s/g, "-")}`}
                        >
                          {submission.userType}
                        </span>
                      </td>
                      <td>{submission.positionTitle}</td>
                      <td>{submission.location}</td>
                      <td>{submission.manager}</td>
                      <td>
                      {/* Only HR or Admin can edit */}
                      {(isAdmin || isHR) && (
                        <button
                          className="edit-button"
                          onClick={() => handleEditClick(submission.submission_id)}
                        >
                          <Edit size={16} />
                        </button>
                      )}
                    </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="table-pagination">
            <div className="rows-per-page">
              Rows per page:
              <select value={rowsPerPage} onChange={handleRowsChange}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>

            <div className="pagination-info">
              {totalRows === 0
                ? "0 of 0"
                : `${startIndex + 1}-${Math.min(startIndex + rowsPerPage, totalRows)} of ${totalRows}`}
            </div>

            <div className="pagination-controls">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                &lt;
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                &gt;
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default SubmissionsPage;
