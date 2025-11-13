import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../config";
import "./Editroles.css";
import { getAuthHeaders } from "../utils/getAuthHeaders";
import { useAuth } from '../AuthContext';

/* ---------- Roles ---------- */
const ALL_ROLES = ["admin", "hr", "manager", "fr", "simple"];
const ROLE_SET = new Set(ALL_ROLES);
const DEFAULT_ROLE = ALL_ROLES[ALL_ROLES.length - 1];

const ROLE_LABELS = {
  admin: "admin",
  hr: "hr",
  manager: "manager",
  fr: "facilitator",
  simple: "simple",
};


const toRole = (r) => {
  const v = (r || "").toLowerCase();
  return ROLE_SET.has(v) ? v : DEFAULT_ROLE;
};
const roleLabel = (r) => ROLE_LABELS[toRole(r)] || toRole(r);
const makeDictFromRoles = (factory) =>
  Object.fromEntries(ALL_ROLES.map((r) => [r, factory(r)]));

/* ---------- Helpers ---------- */
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const Highlight = ({ text, query }) => {
  const t = String(text ?? "");
  const q = (query || "").trim();
  if (!q) return t;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return t;

  const re = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "ig");
  const parts = t.split(re);

  return parts.map((part, i) =>
    i % 2 === 1 ? <mark key={i}>{part}</mark> : <React.Fragment key={i}>{part}</React.Fragment>
  );
};

const initials = (name = "", email = "") => {
  const fromName = (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
  if (fromName) return fromName.toUpperCase();
  const local = String(email || "").split("@")[0] || "";
  return (local.slice(0, 2) || "?").toUpperCase();
};

/* ============================================================= */

export default function EditRoles() {
  /* State */
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  
  // View: "table" | "board"
  const [view, setView] = useState("table");

  // Global search for table
  const [tableQuery, setTableQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Per-column queries for board
  const [colQuery, setColQuery] = useState(() => makeDictFromRoles(() => ""));

  // Drag state for board
  const [dragOver, setDragOver] = useState(null);
  const headers = getAuthHeaders(user);
  const canEdit = user?.role === "admin" || user?.role === "hr";

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };
  
  /* Debounce table search */
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery((tableQuery || "").toLowerCase().trim());
    }, 150);
    return () => clearTimeout(t);
  }, [tableQuery]);
  
  useEffect(() => {
    let cancelled = false;
  
    (async () => {
      setError("");
      try {
        const resp = await api.put(`/api/users/${user?.role}`, undefined, {
          headers,
          validateStatus: () => true,
        });
  
        if (cancelled) return;
  
        if (resp.status !== 200) {
          throw new Error(
            resp?.data?.error || `PUT /api/users/${user?.role} ${resp.status}`
          );
        }
  
        setUsers(Array.isArray(resp.data) ? resp.data : []);
      } catch (e) {
        console.log(e);
      }
    })();
  
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Counts by role */
  const totals = useMemo(() => {
    const acc = makeDictFromRoles(() => 0);
    for (const u of users) {
      const r = toRole(u.role);
      acc[r] = (acc[r] || 0) + 1;
    }
    return acc;
  }, [users]);
  const stableUsers = useMemo(
    () => users.filter((u) => (u.status || "").toLowerCase() === "stable"),
    [users]
  );
  const nonStableUsers = useMemo(
    () => users.filter((u) => (u.status || "").toLowerCase() !== "stable"),
    [users]
  );

  /* Table filter */
  // For table filtering + sorting
  const tableFiltered = useMemo(() => {
    const q = debouncedQuery;
    if (!q) return stableUsers;

    const tokens = q.split(/\s+/).filter(Boolean);
    if (!tokens.length) return stableUsers;

    return stableUsers.filter((u) => {
      const hay =
        `${u.display_name || ""} ${u.email || ""} ${toRole(u.role) || ""} ${u.role_id || ""}`.toLowerCase();
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [stableUsers, debouncedQuery]);

  const sortedTable = useMemo(() => {
    const sorted = [...tableFiltered];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal = "";
        let bVal = "";
        switch (sortConfig.key) {
          case "display_name":
            aVal = a.display_name || "";
            bVal = b.display_name || "";
            break;
          case "email":
            aVal = a.email || "";
            bVal = b.email || "";
            break;
          case "role":
            aVal = toRole(a.role) || "";
            bVal = toRole(b.role) || "";
            break;
          default:
            return 0;
        }
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [tableFiltered, sortConfig]);

  // For board grouping
  const board = useMemo(() => {
    const next = makeDictFromRoles(() => []);
    for (const u of stableUsers) {
      const r = toRole(u.role);
      const q = (colQuery[r] || "").toLowerCase();
      const matches =
        !q ||
        [u.display_name, u.email, u.role_id]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      if (matches) next[r].push(u);
    }
    ALL_ROLES.forEach((k) =>
      next[k].sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""))
    );
    return next;
  }, [stableUsers, colQuery]);


  const onSearchSubmit = (e) => {
    e?.preventDefault?.();
    setDebouncedQuery((tableQuery || "").toLowerCase().trim());
  };

  /* Persist role change */const onChangeRole = async (userEmail, evOrValue) => {
  setError("");

  const raw =
    typeof evOrValue === "string"
      ? evOrValue
      : evOrValue?.target?.value ?? "";

  const nextRole = toRole(raw);
  if (!nextRole) return;

  if (saving[userEmail]) return;

  setSaving((s) => ({ ...s, [userEmail]: true }));

  try {
    const resp = await api.put(
      `/api/users/adminEdit`,
      { email: userEmail, new_role: nextRole },
      {
        headers: headers,
        validateStatus: () => true,
      }
    );
  
    if (resp.status !== 200) {
      throw new Error(
        resp?.data?.error || `PUT /api/users/adminEdit/${resp.status}`
      );
    }
  
    setUsers((list) =>
      list.map((u) => (u.email === userEmail ? { ...u, role: nextRole } : u))
    );
  } catch (e) {
    setError(e?.message || "Failed to update role");
  } finally {
    setSaving((s) => ({ ...s, [userEmail]: false }));
  }
};

const handleEscalationDecision = async (user, decision) => {
  try {
    setSaving((s) => ({ ...s, [user.email]: true }));
    const status = (user.status || "").trim();
    const targetRole = status.toLowerCase().startsWith("to ")
      ? status.slice(3).trim().toLowerCase()
      : null;    
      if (decision === "approve") {
        if (!targetRole) throw new Error("No target role found in status");
      
        const resp = await api.put(
          `/api/users/adminEdit`,
          { email: user.email, new_role: targetRole },
          { headers, validateStatus: () => true }
        );      

      if (resp.status !== 200) {
        throw new Error(resp?.data?.error || `AdminEdit failed: ${resp.status}`);
      }

      // ✅ Update UI state — role updated, status stable
      setUsers((list) =>
        list.map((u) =>
          u.email === user.email
            ? { ...u, role: targetRole, status: "stable" }
            : u
        )
      );
    } 
    else if (decision === "reject") {
      // ❌ Keep their current role (the original one) and reset status
      const resp = await api.put(
        `/api/users/adminEdit`,
        { email: user.email, new_role: user.role },
        { headers, validateStatus: () => true }
      );

      if (resp.status !== 200) {
        throw new Error(resp?.data?.error || `Reject failed: ${resp.status}`);
      }

      // ✅ Revert to original role, mark stable
      setUsers((list) =>
        list.map((u) =>
          u.email === user.email ? { ...u, status: "stable" } : u
        )
      );
    }
  } catch (err) {
    console.error(err);
    setError(err?.message || "Failed to handle escalation");
  } finally {
    setSaving((s) => ({ ...s, [user.email]: false }));
  }
};

// Keep saving keyed by email everywhere:
const canDragUser = (u) => !saving[u.email];
const handleDragStart = (e, u) => {
  e.stopPropagation();
  e.dataTransfer.setData("text/plain", u.email);   // ✅ email as payload
  e.dataTransfer.effectAllowed = "move";
};

const handleDragOver = (e, role) => {
  e.preventDefault();                               // ✅ REQUIRED to allow drop
  e.dataTransfer.dropEffect = "move";
  if (dragOver !== role) setDragOver(role);
};

const handleDragLeave = () => setDragOver(null);
const handleDrop = async (e, targetRoleRaw) => {
  e.preventDefault();                               // ✅ also prevent default here
  e.stopPropagation();

  const userEmail = e.dataTransfer.getData("text/plain"); // ✅ read email
  const u = users.find((x) => x.email === userEmail);
  const targetRole = toRole(targetRoleRaw);


  if (!u) return;
  if (toRole(u.role) === targetRole) return;
  if (!canDragUser(u)) return;

  await onChangeRole(userEmail, targetRole);
};

  if (!canEdit) {
    return (
      <div className="er-wrap">
        <h2>Edit Roles</h2>
        <div className="er-unauthorized">
          403 — Only Admin and HR can edit roles.
        </div>
      </div>
    );
  }

  return (
    <div className="er-wrap">
      {/* Header */}
      <div className="er-header">
        <div className="er-title-row">
          <h2>Edit Roles</h2>

          <div className="er-controls">
            {/* View toggle */}
            <div className="er-view-toggle" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-selected={view === "table"}
              className={`er-toggle ${view === "table" ? "is-active" : ""}`}
              onClick={() => setView("table")}
            >
              Table
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "board"}
              className={`er-toggle ${view === "board" ? "is-active" : ""}`}
              onClick={() => setView("board")}
            >
              Board
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "escalate"}
              className={`er-toggle ${view === "escalate" ? "is-active" : ""}`}
              onClick={() => setView("escalate")}
            >
              Escalate <span className="er-badge-count">{nonStableUsers.length}</span>
            </button>
          </div>


            {/* Dashboard link */}
            <nav>
              <Link to="/dashboard" className="header-nav-link">
                Dashboard
              </Link>
            </nav>
          </div>
        </div>

        {/* Actions row */}
        <div className="er-actions">
          {view === "table" && (
            <form className="er-search" onSubmit={onSearchSubmit} role="search">
              <input
                type="search"
                placeholder="Search name, email, role, or ID…"
                value={tableQuery}
                onChange={(e) => setTableQuery(e.target.value)}
                aria-label="Search users in table"
              />
              <button
                type="submit"
                className="er-toggle is-active"
                aria-label="Submit search"
              >
                Search
              </button>
            </form>
          )}

          {/* Only show saving state while saving; don't show 'Ready' otherwise */}
          {Object.values(saving).some(Boolean) && (
            <div className="er-admin-warning">
              Saving changes…
            </div>
          )}
        </div>


        {error && <div className="er-error">{error}</div>}
      </div>

      {/* TABLE VIEW */}
      {view === "table" && (
        <>
          <div className="er-table-wrap">
            <table className="er-table">
            <thead>
            <tr>
              <th>#</th>
              <th onClick={() => handleSort("display_name")}>
                User {sortConfig.key === "display_name" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th onClick={() => handleSort("email")}>
                Email {sortConfig.key === "email" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th onClick={() => handleSort("role")}>
                Current Role {sortConfig.key === "role" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th scope="col">Set Role</th>
            </tr>
          </thead>
          <tbody>
          {sortedTable.length === 0 ? (
            <tr>
              <td colSpan={5} className="er-empty">
                No users match “{debouncedQuery}”.
              </td>
            </tr>
          ) : (
            sortedTable.map((u, index) => {
              const role = toRole(u.role);
              const userKey = u.user_id ?? u.email;      // ✅ stable unique key
              const isSaving = !!saving[userKey];         // ✅ saving keyed by the same

              return (
                <tr key={userKey} className="er-row">
                  {/* Index column (1-based) */}
                  <td><div className="er-col-index">
                          <Highlight text={index + 1} query={debouncedQuery} />
                    </div></td>
                  <td>
                    <div className="er-user">
                      <div className="er-user-info">
                        <div className="er-name">
                          <Highlight text={u.display_name || (u.email?.split('@')[0] ?? '—')} query={debouncedQuery} />
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="er-email">
                    <Highlight text={u.email} query={debouncedQuery} />
                  </td>

                  <td>
                    <span className={`er-badge role-${role}`}>
                      <Highlight text={roleLabel(role)} query={debouncedQuery} />
                    </span>
                    {isSaving && <span className="er-badge-lock">saving…</span>}
                  </td>

                  <td>
                    <div className="er-control-stack">
                      <select
                        className="er-select sm"
                        value={role}
                        disabled={isSaving}
                        onChange={(e) => onChangeRole(userKey, e.target.value)} // ✅ pass value with stable id
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>{roleLabel(r)}</option>
                        ))}
                      </select>
                      {isSaving && <span className="er-saving">Updating…</span>}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
            </table>
          </div>

          {/* Count summary */}
          <div className="er-tip" style={{ marginTop: 8 }}>
            Showing <strong>{sortedTable.length}</strong> of <strong>{users.length}</strong> users.
          </div>
        </>
      )}

      {/* Escalate View */}
      {view === "escalate" && (
      <div className="er-escalate">
        <h3>Escalate Users</h3>
        {nonStableUsers.length === 0 ? (
          <div className="er-empty">No users need escalation 🎉</div>
        ) : (
          <div className="er-table-wrap">
          <table className="er-table">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Email</th>
                <th>Status</th>
                <th>Current Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {nonStableUsers.map((u, idx) => (
                <tr key={u.email}>
                  <td><div className="er-col-index">{idx + 1}</div></td>
                  <td>                    
                    <div className="er-user">
                      <div className="er-user-info">
                        <div className="er-name">
                          {u.display_name || "—"}
                          </div>
                          </div>
                          </div>
                          </td>
                  <td  className="er-email">{u.email}</td>
                  <td>
                    <span className="er-badge status-escalate">
                      {u.status}
                    </span>
                  </td>
                  <td>
                    <span className={`er-badge role-${toRole(u.role)}`}>
                      {toRole(u.role)}
                    </span>
                  </td>
                  <td>
                    <div className="er-actions-inline">
                      <button
                        className="er-btn-approve"
                        onClick={() => handleEscalationDecision(u, "approve")}
                      >
                        ✅ Agree
                      </button>
                      <button
                        className="er-btn-reject"
                        onClick={() => handleEscalationDecision(u, "reject")}
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )
        }
      </div>
    )}

      {/* BOARD VIEW */}
      {view === "board" && (
        <div className="er-dnd">
          <h3 className="er-tip">Drag a user card into a role column to change their role.</h3>
          <div className="er-columns">
            {ALL_ROLES.map((r) => {
              const filteredCount = board[r]?.length || 0;
              const totalCount = totals[r] || 0;

                            
              return (
                <div
                  key={r}
                  className={`er-col ${dragOver === r ? "is-over" : ""}`}
                  onDragEnter={() => setDragOver(r)}
                  onDragLeave={handleDragLeave}
                  aria-label={`${r} column`}
                >
                  <div className="er-col-head">
                    <div className="er-col-title">
                      {roleLabel(r).toUpperCase()} <span className="er-muted">({filteredCount}/{totalCount})</span>
                    </div>
                    <input
                      className="er-col-search"
                      type="text"
                      placeholder={`Filter ${r}…`}
                      value={colQuery[r]}
                      onChange={(e) => setColQuery((s) => ({ ...s, [r]: e.target.value }))}
                      aria-label={`Filter ${r} users`}
                      // ⬇️ Prevent input from swallowing drop as text
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                    />
                  </div>

                  {/* ✅ Make the scrollable body the actual drop target */}
                  <div
                    className="er-col-body"
                    onDragOver={(e) => handleDragOver(e, r)}
                    onDrop={(e) => handleDrop(e, r)}
                  >
                    {filteredCount === 0 ? (
                      <div
                        className="er-col-empty"
                        onDragOver={(e) => handleDragOver(e, r)}
                        onDrop={(e) => handleDrop(e, r)}
                        style={{ minHeight: 64 }}
                      >
                        No users
                      </div>
                    ) : (
                      board[r].map((u) => {
                        const locked = !canDragUser(u);
                        const role = toRole(u.role);
                        return (
                          <div
                            key={u.email}  // ✅ stable key
                            data-email={u.email}
                            className={`er-card ${locked ? "is-locked" : ""} ${saving[u.email] ? "is-saving" : ""}`}
                            draggable={!locked}
                            onDragStart={(e) => !locked && handleDragStart(e, u)}
                            title={locked ? "Saving in progress" : "Drag to move to another role"}
                          >
                            <div className="er-card-content">
                              <div className="er-card-top">
                                <div className="er-avatar er-avatar-sm">
                                  {initials(u.display_name, u.email)}
                                </div>
                                <div className="er-card-meta">
                                  <div className="er-card-name">{u.display_name}</div>
                                  <div className="er-email" title={u.email}>{u.email}</div>
                                </div>
                              </div>
                              <div className="er-card-bottom">
                                <span className={`er-badge role-${role}`}>{roleLabel(role)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
