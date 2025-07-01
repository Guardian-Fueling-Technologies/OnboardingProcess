// src/SubmissionsPage.jsx (or src/components/SubmissionsPage/SubmissionsPage.jsx)
import React, { useState, useEffect } from 'react';
import './SubmissionsPage.css'; // Link to the CSS file
import { Edit } from 'lucide-react'; // Edit icon for table
import Sidebar from '../sidebar/sidebar';
import { FaUserCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import api from '../config'; // Import your configured Axios instance

// REMOVE THE 'async' KEYWORD HERE
const SubmissionsPage = () => { // Corrected: Removed 'async (e)'
  const [submissionsData, setSubmissionsData] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const submissionsResponse = await api.get('/api/submissions');
        let submissionsResult = []; // Initialize as an empty array
  
        // Check if the response is an object with a 'message' property
        if (submissionsResponse.data && typeof submissionsResponse.data === 'object' && 'message' in submissionsResponse.data) {
          // If it's a message like "No submissions found", treat it as no data
          console.log("Backend message:", submissionsResponse.data.message);
          submissionsResult = []; // Keep it as an empty array
        } else if (Array.isArray(submissionsResponse.data)) {
          // If it's an array (the expected data format for submissions)
          submissionsResult = submissionsResponse.data;
        } else {
          // Handle any other unexpected data format
          console.warn("Unexpected data format from /api/submissions:", submissionsResponse.data);
          submissionsResult = [];
        }
  
        console.log('Processed submissionsResult:', submissionsResult); // Now this should always be an array
  
        // Only proceed with mapping if submissionsResult is not empty
        let transformedForFrontend = [];
        if (submissionsResult.length > 0) {
          transformedForFrontend = submissionsResult.map(item => {
            const newName = [item.LegalFirstName, item.LegalMiddleName, item.LegalLastName]
              .filter(Boolean)
              .join(' ');
  
            return {
              id: item.Id,
              newName: newName,
              userType: item.Type,
              positionTitle: item.PositionTitle,
              location: item.Location,
              manager: item.Manager,
            };
          });
        }
  
        setSubmissionsData(transformedForFrontend);
        console.log('Transformed data for frontend:', transformedForFrontend);
  
      } catch (error) {
        alert('There was an error connecting to the server or processing your request.');
        console.error('Network or unexpected error during fetch:', error);
        setSubmissionsData([]); // Clear submissions data on error to ensure empty state
      }
    };
  
    fetchSubmissions();
  }, []); // Add dependencies if needed, e.g., [api]


  const handleEditClick = (id) => {
    navigate(`/editform/${id}`); // Navigate to the edit form with the ID
  };

  return (
    <div className="main-page-layout">
      {/* Sidebar - Reused from Dashboard structure */}
      <Sidebar />

      {/* Main Content */}
      <main className="main-content">
        {/* Header - Reused from Dashboard structure */}
        <header className="main-header">
          <h2>Submissions</h2> {/* Changed title */}
          <div className="header-right">
            <a className="requested-form" href="/requestform">Requested Form</a>
            <a className="requested-form" href="/EmployeeStatusChangeForm" > Status Change Form </a>
            <FaUserCircle className="profile-avatar" />
          </div>
        </header>

        {/* Submissions Table Section */}
        <section className="submissions-table-section">
          <div className="table-filters">
            <input type="text" placeholder="New Hire Name" className="filter-input" />
            <input type="text" placeholder="User Type" className="filter-input" />
            <input type="text" placeholder="Position Title" className="filter-input" />
            <input type="text" placeholder="Location" className="filter-input" />
            <input type="text" placeholder="Manager" className="filter-input" />
            <span className="action-header">Action</span> {/* Placeholder for Action column header */}
          </div>

          <div className="submissions-table">
            <table>
              <thead>
                <tr>
                  <th>New Hire Name</th>
                  <th>User Type</th>
                  <th>Position Title</th>
                  <th>Location</th>
                  <th>Manager</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {submissionsData.map((submission) => (
                  <tr key={submission.id}>
                    <td>{submission.newName}</td>
                    <td>
                      <span className={`user-type-tag ${submission.userType.toLowerCase().replace(/\s/g, '-')}`}>
                        {submission.userType}
                      </span>
                    </td>
                    <td>{submission.positionTitle}</td>
                    <td>{submission.location}</td>
                    <td>{submission.manager}</td>
                    <td>
                      <button className="edit-button"  onClick={() => handleEditClick(submission.id)}>
                        <Edit size={16} /> {/* Lucide React icon */}
                      </button>
                    </td>
                  </tr>
                ))}
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
              1-5 of 11
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

export default SubmissionsPage;