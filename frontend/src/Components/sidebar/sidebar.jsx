// src/components/Sidebar/Sidebar.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaUserCircle, FaTachometerAlt, FaFileAlt, FaTasks } from 'react-icons/fa';
import '../sidebar/sidebar'; // Create a dedicated CSS file for the sidebar

const Sidebar = () => {
  const location = useLocation(); // Get the current location object

  // Helper function to check if a path is active
  const isActive = (path) => location.pathname === path;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={require('../Assets/img/guardianlogo.jpg')} alt="Guardian Fueling Technologies" />
      </div>
      <div className="user-profile">
      <Link to="/profile">
        <FaUserCircle className="profile-avatar"/>
      </Link>
        <p className="user-name">Charlie</p>
        <p className="user-role">Hiring Manager</p>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {/* Dashboard Link */}
          <li className={isActive('/dashboard') ? 'active' : ''}>
            <Link to="/dashboard" className="nav-link">
              <FaTachometerAlt className="nav-icon" />
              <span>Dashboard</span>
            </Link>
          </li>

          {/* Submissions Link */}
          <li className={isActive('/submissions') ? 'active' : ''}>
            <Link to="/submissions" className="nav-link">
              <FaFileAlt className="nav-icon" />
              <span>Submissions</span>
            </Link>
          </li>

          {/* Tasks Link */}
          <li className={isActive('/tasks') ? 'active' : ''}>
            <Link to="/tasks" className="nav-link">
              <FaTasks className="nav-icon" />
              <span>Tasks</span>
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;