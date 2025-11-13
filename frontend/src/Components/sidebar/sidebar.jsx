// src/components/Sidebar/Sidebar.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useMsal } from "@azure/msal-react";
import { Link, useLocation } from 'react-router-dom';
import { FaTachometerAlt, FaFileAlt, FaTasks } from 'react-icons/fa';
import { useAuth } from "../AuthContext";
import '../sidebar/sidebar'; // or './Sidebar.css'

const GRAPH_SCOPES = ["User.Read"]; // change/add scopes if needed

const Sidebar = () => {
  const { instance, accounts } = useMsal();

  // Prefer the explicitly active account; otherwise first signed-in account
  const activeAccount = useMemo(
    () => instance.getActiveAccount?.() || accounts?.[0] || null,
    [instance, accounts]
  );
  const { user } = useAuth();
  const canShowFormLinks = ["admin", "hr", "manager"].includes(user?.role);

  const [photoUrl, setPhotoUrl] = useState(null);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    jobTitle: '',
    department: '',
    mobilePhone: '',
    businessPhone: '',
    officeLocation: ''
  });

  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    let alive = true;
    let objectUrlToRevoke = null;

    (async () => {
      try {
        // If nobody is signed in, skip
        if (!activeAccount) return;

        // Acquire token silently for MS Graph
        const tokenResp = await instance.acquireTokenSilent({
          scopes: GRAPH_SCOPES,
          account: activeAccount
        });

        // ----- /me
        const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${tokenResp.accessToken}` },
        });

        if (alive && meRes.ok) {
          const me = await meRes.json();
          setProfile((p) => ({
            ...p,
            name: me.displayName || p.name,
            email: me.mail || me.userPrincipalName || p.email,
            jobTitle: me.jobTitle || "",
            department: me.department || "",
            mobilePhone: me.mobilePhone || "",
            businessPhone:
              Array.isArray(me.businessPhones) && me.businessPhones.length
                ? me.businessPhones[0]
                : "",
            officeLocation: me.officeLocation || "",
          }));
        }

        // ----- /me/photo/$value
        const phRes = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
          headers: { Authorization: `Bearer ${tokenResp.accessToken}` },
        });

        if (alive && phRes.ok) {
          const blob = await phRes.blob();
          const url = URL.createObjectURL(blob);
          objectUrlToRevoke = url;
          setPhotoUrl(url);
        }
      } catch (err) {
        // Optional: log for debugging
        // console.error("Sidebar Graph fetch error:", err);
      }
    })();

    return () => {
      alive = false;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [instance, activeAccount]);

  const fallbackAvatar = `https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=${encodeURIComponent(profile.name || "User")}`;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={require('../Assets/img/guardianlogo.jpg')} alt="Guardian Fueling Technologies" />
      </div>

      <div className="user-profile">
        <Link to="/profile">
          <img
            className="profile-avatar"
            src={photoUrl || fallbackAvatar}
            alt="avatar"
          />
        </Link>
        <p className="user-name">{profile.name || "Charlie (offline)"}</p>
        <p className="user-role">{profile.jobTitle || "Simple (offline)"}</p>
      </div>

      <nav className="sidebar-nav">
        <ul>
        {canShowFormLinks && (
            <>
              <li className={isActive('/dashboard') ? 'active' : ''}>
                <Link to="/dashboard" className="nav-link">
                  <FaTachometerAlt className="nav-icon" />
                  <span>Dashboard</span>
                </Link>
              </li>
              <li className={isActive('/submissions') ? 'active' : ''}>
                <Link to="/submissions" className="nav-link">
                  <FaFileAlt className="nav-icon" />
                  <span>Submissions</span>
                </Link>
              </li>
            </>
          )}
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
