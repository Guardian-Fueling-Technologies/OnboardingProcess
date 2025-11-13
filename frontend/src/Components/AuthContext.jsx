// src/Components/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus, EventType } from "@azure/msal-browser";

const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  setUser: () => {},
  account: null,
  displayName: "User",
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const { accounts, instance, inProgress } = useMsal();

  // Local user (set by your local/BE login)
  const [user, setUser] = useState(
    JSON.parse(sessionStorage.getItem("currentUser") || "null")
  );

  // Keep sessionStorage in sync with context user
  useEffect(() => {
    if (user) {
      sessionStorage.setItem("currentUser", JSON.stringify(user));
    } else {
      sessionStorage.removeItem("currentUser");
    }
  }, [user]);

  // Prefer the active account; fall back to the first account after MSAL finishes interacting
  const account = useMemo(() => {
    const active = instance.getActiveAccount?.();
    if (active) return active;
    if (inProgress === InteractionStatus.None && accounts?.length > 0) {
      return accounts[0];
    }
    return null;
  }, [instance, accounts, inProgress]);

  // Ensure an active account is set once interactions are done
  useEffect(() => {
    if (
      inProgress === InteractionStatus.None &&
      !instance.getActiveAccount() &&
      accounts.length > 0
    ) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [instance, accounts, inProgress]);

  // Keep active account in sync with MSAL events; clear local user on logout
  useEffect(() => {
    const cbId = instance.addEventCallback((event) => {
      // On any successful sign-in/token event, set the active account
      if (
        event.eventType === EventType.LOGIN_SUCCESS ||
        event.eventType === EventType.SSO_SILENT_SUCCESS ||
        event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS
      ) {
        const acc = event.payload?.account;
        if (acc) instance.setActiveAccount(acc);
      }

      // On logout, clear your local user
      if (event.eventType === EventType.LOGOUT_SUCCESS) {
        setUser(null);
        sessionStorage.removeItem("currentUser");
      }
    });
    return () => {
      if (cbId) instance.removeEventCallback(cbId);
    };
  }, [instance]);

  // Unified display name for UI
  const displayName =
    user?.display_name

  const isAuthenticated = Boolean(user || account);

  const logout = async () => {
    // Clear local user and MSAL session (choose popup or redirect)
    setUser(null);
    sessionStorage.removeItem("currentUser");
    await instance.logoutPopup?.({ postLogoutRedirectUri: window.location.origin });
    // or: await instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, setUser, account, displayName, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
