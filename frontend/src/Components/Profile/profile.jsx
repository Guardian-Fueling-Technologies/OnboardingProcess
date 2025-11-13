// src/Components/Profile/Profile.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { Mail, User, Shield, Phone, Building2, MapPin, LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getAuthHeaders } from "../utils/getAuthHeaders";
import "./profile.css";
import api from "../config";
import { useAuth } from "../AuthContext";

const GRAPH_SCOPES = ["User.Read"];

// Tiny inline spinner
function Spinner() {
  return (
    <div style={{ display: "grid", placeItems: "center", padding: "2rem", minHeight: 160 }}>
      <div
        aria-label="Loading"
        style={{
          width: 40,
          height: 40,
          border: "4px solid rgba(0,0,0,.1)",
          borderTopColor: "#0D8ABC",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// --- Role helpers (canonical values + display labels) ---
const ROLE_LABEL = {
  simple: "Simple",
  fr: "Facilitator",
  manager: "Hiring Manager",
  hr: "Human Resource",
  admin: "Admin",
};

// Only canonicalize when we actually have a role string
const toCanonRole = (r) => {
  if (!r) return null;
  const s = String(r || "").toLowerCase().trim();
  if (["simple", "user", "basic"].includes(s)) return "simple";
  if (["facilitator", "fr"].includes(s)) return "fr";
  if (["hiring manager", "manager"].includes(s)) return "manager";
  if (["human resource", "human resources", "hr", "h.r."].includes(s)) return "hr";
  if (["admin", "administrator", "owner"].includes(s)) return "admin";
  return "simple";
};

export default function ProfilePage() {// ✅ Fully reactive currentUser synced with sessionStorage
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem("currentUser");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  
  useEffect(() => {
    // Update currentUser when storage changes in same tab or other tabs
    const sync = () => {
      try {
        const raw = sessionStorage.getItem("currentUser");
        const parsed = raw ? JSON.parse(raw) : null;
        setCurrentUser(parsed);
      } catch {
        // ignore JSON errors
      }
    };
  
    // ✅ 1. Listen to storage events (cross-tab updates)
    window.addEventListener("storage", sync);
  
    // ✅ 2. Monkey-patch setItem so same-tab updates also trigger re-render
    const originalSetItem = sessionStorage.setItem;
    sessionStorage.setItem = function (key, value) {
      originalSetItem.apply(this, arguments);
      if (key === "currentUser") {
        window.dispatchEvent(new Event("storage")); // trigger sync
      }
    };
  
    // Cleanup
    return () => {
      window.removeEventListener("storage", sync);
      sessionStorage.setItem = originalSetItem;
    };
  }, []);
  
  const navigate = useNavigate();

  // 2) MSAL + Auth Context
  const { instance, accounts } = useMsal();
  const { user, setUser } = useAuth();

  const activeAccount = useMemo(
    () => instance.getActiveAccount() || accounts?.[0] || null,
    [instance, accounts]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const roleAlertShownRef = useRef(false);

  // Track when we actually know the role (prevents flicker)
  const [roleHydrated, setRoleHydrated] = useState(Boolean(currentUser?.role));

  // Profile model (role starts as null to avoid "simple" flash)
  const [profile, setProfile] = useState({
    role_id: currentUser?.role_id ?? null,
    display_name: currentUser?.display_name || "",
    email: currentUser?.email || "",
    role: currentUser?.role ?? null, // <-- start null
    jobTitle: "",
    department: "",
    mobilePhone: "",
    businessPhone: "",
    officeLocation: "",
  });

  // ---------- Bootstrap: seed from session and auth ----------
  useEffect(() => {
    if (!currentUser) return;

    setProfile((p) => ({
      ...p,
      role_id: currentUser.role_id ?? p.role_id,
      display_name: currentUser.display_name || p.display_name,
      email:
        currentUser.email ||
        currentUser.mail ||
        currentUser.userPrincipalName ||
        p.email,
      jobTitle: currentUser.jobTitle ?? p.jobTitle,
      department: currentUser.department ?? p.department,
      mobilePhone: currentUser.mobilePhone ?? p.mobilePhone,
      businessPhone:
        currentUser.businessPhone ||
        currentUser.businessPhones?.[0] ||
        p.businessPhone,
      officeLocation: currentUser.officeLocation ?? p.officeLocation,
      // set role only if present
      role: toCanonRole(currentUser.role) ?? p.role,
      status: currentUser.status ?? p.status,
    }));

    if (currentUser.role) setRoleHydrated(true);
  }, [currentUser, roleHydrated]);

  // Keep the role in Profile synced with the role from AuthContext — but only if present
  useEffect(() => {
    const effective =
      user?.role || (Array.isArray(user?.roles) && user.roles[0]) || null;

    if (effective) {
      setProfile((prev) => ({ ...prev, role: toCanonRole(effective) }));
      setRoleHydrated(true);
    }
  }, [user]);

  // ---------- Load your user from your API by email (server source of truth) ----------
  useEffect(() => {
    let ignore = false;
    (async () => {
      const email =
        profile.email ||
        user?.email ||
        activeAccount?.username ||
        currentUser?.email ||
        "";
      if (!email) return;

      setLoading(true);
      try {
        // If you fetch from BE, map results here WITHOUT forcing role to "simple".
        // Do not overwrite role unless BE returns one.
        setProfile((p) => ({
          ...p,
          role_id: currentUser?.role_id ?? p.role_id,
          display_name: currentUser?.display_name || p.display_name,
          email:
            currentUser?.email ||
            currentUser?.mail ||
            currentUser?.userPrincipalName ||
            p.email,
          jobTitle: currentUser?.jobTitle ?? p.jobTitle,
          department: currentUser?.department ?? p.department,
          mobilePhone: currentUser?.mobilePhone ?? p.mobilePhone,
          businessPhone:
            currentUser?.businessPhone ||
            (Array.isArray(currentUser?.businessPhones) &&
              currentUser.businessPhones[0]) ||
            p.businessPhone,
          officeLocation: currentUser?.officeLocation ?? p.officeLocation,
          role:
            toCanonRole(
              currentUser?.role ||
                currentUser?.appRole ||
                (Array.isArray(currentUser?.roles) && currentUser.roles[0])
            ) ?? p.role,
        }));
        if (
          currentUser?.role ||
          currentUser?.appRole ||
          (Array.isArray(currentUser?.roles) && currentUser.roles[0])
        ) {
          setRoleHydrated(true);
        }

        // Optional: keep context aligned
        setUser?.((prev) => ({
          ...prev,
          ...currentUser,
          role:
            toCanonRole(
              currentUser?.role ||
                currentUser?.appRole ||
                (Array.isArray(currentUser?.roles) && currentUser.roles[0])
            ) ?? prev?.role,
        }));
      } catch {
        /* non-fatal */
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.email, user?.email, activeAccount?.username]);

  // ---------- Fetch Microsoft Graph for backfilling missing fields + photo ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await instance.acquireTokenSilent({
          scopes: GRAPH_SCOPES,
          account: activeAccount || undefined,
        });

        // Profile fields (do NOT touch role here)
        const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          if (!alive) return;
          setProfile((p) => ({
            ...p,
            display_name: me.displayName || p.display_name || "",
            email: p.email || me.mail || me.userPrincipalName || "",
            jobTitle: p.jobTitle || me.jobTitle || "",
            department: p.department || me.department || "",
            mobilePhone: p.mobilePhone || me.mobilePhone || "",
            businessPhone:
              p.businessPhone ||
              (Array.isArray(me.businessPhones) && me.businessPhones[0]) ||
              "",
            officeLocation: p.officeLocation || me.officeLocation || "",
          }));
        }

        // Photo
        const phRes = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        });
        if (phRes.ok) {
          const blob = await phRes.blob();
          if (!alive) return;
          setPhotoUrl(URL.createObjectURL(blob));
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, [instance, activeAccount]);

  // Avoid blob URL leaks
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // ---------- Handlers ----------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((p) => ({ ...p, [name]: value }));
  };

  const handleRoleChange = (e) => {
    const next = toCanonRole(e.target.value);
    setProfile((prev) => ({ ...prev, role: next }));
    setRoleHydrated(true);

    if (!roleAlertShownRef.current) {
      alert(
        "Role change requested.\n\nPlease wait for an admin to run the database update. Your new role will not take effect until the admin completes this step."
      );
      roleAlertShownRef.current = true;
    }
  };
  const handleSave = async () => {
    try {
      setSaving(true);
  
      const requestedRole = profile.role;
      const originalRole = currentUser?.role;
  
      const payload = {
        id: profile.role_id,
        display_name: profile.display_name,
        email: profile.email,
        role: originalRole, // ✅ keep the original role
        jobTitle: profile.jobTitle,
        department: profile.department,
        mobilePhone: profile.mobilePhone,
        businessPhone: profile.businessPhone,
        officeLocation: profile.officeLocation,
        edited_by: currentUser?.edited_by,
        auth_provider: currentUser?.auth_provider || "local",
        env: currentUser?.env,
        createdTime: currentUser?.createdTime,
        editTime: new Date().toISOString(),
        // ✅ mark status as “To X” if changed
        status:
          originalRole !== requestedRole
            ? `To ${requestedRole}`
            : "stable",
        // optionally track what they requested
        requested_role:
          originalRole !== requestedRole ? requestedRole : null,
      };
  
      console.log("Saving profile:", payload);
  
      await api.put(`/api/user/by-email`, payload, {
        headers: {
          ...getAuthHeaders(user), // ✅ includes Authorization: Bearer demo:<role_id> or real JWT
          "Content-Type": "application/json",
        },
        validateStatus: () => true, // ✅ prevents axios from throwing automatically
      });
        
      // ✅ Keep current role in session the same (no premature role change)
      const updatedUser = {
        ...(currentUser || {}),
        ...payload,
      };
  
      sessionStorage.setItem("currentUser", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      setUser?.((prev) => ({ ...prev, ...updatedUser }));
  
      setIsEditing(false);
      alert("Saved. Role change request submitted to admin.");
    } catch (e) {
      console.error(e);
      alert("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (instance.getActiveAccount()) {
        await instance.logoutRedirect();
      } else {
        sessionStorage.removeItem("currentUser");
        setUser(null);
        navigate("/login", { replace: true });
      }
    } catch (e) {
      console.error("Logout failed:", e);
      sessionStorage.removeItem("currentUser");
      setUser(null);
      navigate("/login", { replace: true });
    }
  };

  const canEditRoles = profile.status === "stable" && (profile.role === "admin" || profile.role === "hr");

  // Optional: page-level loading state (while hydrating)
  if (loading) return <Spinner />;

  return (
    <div className="profile-page">
      <div className="profile-card">
        {/* Header */}
        <div className="profile-header">
          <button
            className="profile-btn-back"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft size={18} style={{ marginRight: "4px" }} />
            Back
          </button>

          <div className="profile-user">
          <img
            className="profile-avatar"
            src={
              photoUrl ||
              `https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=${encodeURIComponent(
                profile.display_name || "U"
              )}`
            }
            alt="avatar"
          />
          <div>
            <div className="profile-name">{profile.display_name || "—"}</div>
            <div className="profile-email">{profile.email || "—"}</div>
            <div className="profile-status">
              {profile.status && (
                <span
                  className={`status-badge ${
                    profile.status.toLowerCase().includes("stable")
                      ? "status-stable"
                      : "status-escalate"
                  }`}
                >
                {"Current Status: " + profile.status}
                </span>
              )}
            </div>
          </div>
        </div>


          <div className="profile-actions">
            {canEditRoles && (
              <button
                type="button"
                className="profile-btn profile-btn-secondary"
                onClick={() => navigate("/editroles")}
                title="Edit application roles"
              >
                <Settings size={16} style={{ marginRight: 6 }} />
                Edit Roles
              </button>
            )}

            <button
              type="button"
              className="profile-btn profile-btn-edit"
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
              disabled={(isEditing && saving) || loading}
              title={loading ? "Loading user profile..." : undefined}
            >
              {isEditing ? (saving ? "Saving…" : "Save") : "Edit"}
            </button>

            <button className="profile-btn profile-btn-logout" onClick={handleLogout}>
              <LogOut size={16} />
              <span style={{ marginLeft: 6 }}>Logout</span>
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="profile-fields">
        {/* Display Name */}
        <div className="profile-field">
          <User className="icon" size={18} />
          <div>
            <div className="label">Display Name</div>
            {isEditing ? (
              <input
                className="profile-input"
                name="display_name"
                value={profile.display_name}
                onChange={handleChange}
              />
            ) : (
              <div className="value">{profile.display_name || "—"}</div>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="profile-field">
          <Mail className="icon" size={18} />
          <div>
            <div className="label">Email</div>
            {isEditing ? (
              <input
                className="profile-input"
                name="email"
                value={profile.email}
                onChange={handleChange}
                disabled
              />
            ) : (
              <div className="value">{profile.email || "—"}</div>
            )}
          </div>
        </div>

        {/* App Role */}
        <div className="profile-field">
          <Shield className="icon" size={18} />
          <div>
            <div className="label">App Role</div>
            {isEditing ? (
              <select
                className="profile-input"
                name="role"
                value={profile.role || ""}
                onChange={handleRoleChange}
              >
                {!profile.role && <option value="">— Select —</option>}
                <option value="simple">{ROLE_LABEL.simple}</option>
                <option value="fr">{ROLE_LABEL.fr}</option>
                <option value="manager">{ROLE_LABEL.manager}</option>
                <option value="hr">{ROLE_LABEL.hr}</option>
                <option value="admin">{ROLE_LABEL.admin}</option>
              </select>
            ) : (
              <div className="value">{ROLE_LABEL[profile.role] || "—"}</div>
            )}
          </div>
        </div>

        {/* Job Title */}
        <div className="profile-field">
          <Building2 className="icon" size={18} />
          <div>
            <div className="label">Job Title</div>
            {isEditing ? (
              <input
                className="profile-input"
                name="jobTitle"
                value={profile.jobTitle}
                onChange={handleChange}
              />
            ) : (
              <div className="value">{profile.jobTitle || "—"}</div>
            )}
          </div>
        </div>

        {/* Department */}
        <div className="profile-field">
          <Building2 className="icon" size={18} />
          <div>
            <div className="label">Department</div>
            {isEditing ? (
              <input
                className="profile-input"
                name="department"
                value={profile.department}
                onChange={handleChange}
              />
            ) : (
              <div className="value">{profile.department || "—"}</div>
            )}
          </div>
        </div>

        {/* Phones (two inputs) */}
        <div className="profile-field">
          <Phone className="icon" size={18} />
          <div>
            <div className="label">Phones</div>
            {isEditing ? (
              <div style={{ display: "grid", gap: ".5rem" }}>
                <input
                  className="profile-input"
                  name="mobilePhone"
                  placeholder="Mobile"
                  value={profile.mobilePhone}
                  onChange={handleChange}
                />
                <input
                  className="profile-input"
                  name="businessPhone"
                  placeholder="Business"
                  value={profile.businessPhone}
                  onChange={handleChange}
                />
              </div>
            ) : (
              <div className="value">
                Mobile: {profile.mobilePhone || "—"} • Business: {profile.businessPhone || "—"}
              </div>
            )}
          </div>
        </div>

        {/* Office Location */}
        <div className="profile-field">
          <MapPin className="icon" size={18} />
          <div>
            <div className="label">Office Location</div>
            {isEditing ? (
              <input
                className="profile-input"
                name="officeLocation"
                value={profile.officeLocation}
                onChange={handleChange}
              />
            ) : (
              <div className="value">{profile.officeLocation || "—"}</div>
            )}
          </div>
        </div>

        {/* Save button */}
        {isEditing && (
          <button className="profile-save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
