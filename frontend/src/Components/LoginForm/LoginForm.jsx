// src/Components/LoginForm/LoginForm.jsx
import React, { useRef, useCallback, useState } from "react";
import "./LoginForm.css";
import { FaUser, FaLock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../config";
import { useAuth } from "../AuthContext";

import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../../authConfig";

const landingPathForUser = (user) => {
  const role = (user?.role || user?.appRole || user?.roles?.[0] || "simple")
    .toLowerCase()
    .trim();
  switch (role) {
    case "admin": case "hr": case "manager": return "/dashboard";
    case "fr": case "simple":  return "/tasks";
    default : return "/iloveu" 
  }
};

export const LoginForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { setUser } = useAuth();

  // MSAL
  const { instance, inProgress } = useMsal();
  // ----- Local login -----
  const postLoginRedirect = useCallback((u) => {
    const dest = landingPathForUser(u);
    console.log(u)
    navigate(dest);
  }, [navigate]);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const resp = await api.post("/api/auth/local-login", { username, password }, { validateStatus: () => true });
      if (resp.status !== 200 || !resp?.data?.user) throw new Error(resp?.data?.error || "No user");
      const u = resp.data.user;
      sessionStorage.setItem("currentUser", JSON.stringify(u));
      setUser(u);
      console.log("✅ Logged in user data:", u);
  
      postLoginRedirect(u);
    } catch (err) {
      console.error("Local login failed:", err);
      alert("Invalid username/password or network error.");
    }
  };  

  // ----- Microsoft login (popup) -----
  const loginInFlightRef = useRef(null);

  const handleMicrosoftLogin = useCallback(async () => {
    // Prevent double-invokes (StrictMode, double click)
    if (loginInFlightRef.current) {
      console.warn(`[msal-login] duplicate call ignored; rid=${loginInFlightRef.current}`);
      return;
    }
    const rid = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    loginInFlightRef.current = rid;

    console.groupCollapsed(`%c[msal-login] start ${rid}`, "color:#0aa");
    console.trace("[msal-login] callsite");
    console.time(`[msal-login] ${rid}`);

    try {
      // 1) Interactive login
      const loginRes = await instance.loginPopup({
        ...loginRequest,
        prompt: "select_account",
        redirectUri: window.location.origin,
      });
      if (!loginRes || !loginRes.account) throw new Error("No account from loginPopup");
      instance.setActiveAccount(loginRes.account);

      // 2) Acquire token (silent -> popup fallback)
      let tokenRes;
      try {
        tokenRes = await instance.acquireTokenSilent({
          ...loginRequest,
          account: loginRes.account,
        });
      } catch (e) {
        if (e && e.errorCode === "interaction_required") {
          console.warn("[msal-login] silent failed; falling back to popup");
          tokenRes = await instance.acquireTokenPopup({
            ...loginRequest,
            account: loginRes.account,
          });
        } else {
          throw e;
        }
      }
      if (!tokenRes || !tokenRes.idToken) throw new Error("MSAL did not return idToken");

      const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${tokenRes.accessToken}`,
        },
      });
      
      if (!graphRes.ok) throw new Error("Failed to fetch Microsoft account info");
      
      const accountInfo = await graphRes.json();
      
      console.log("[msal-login] account info:", loginRes.account);
      console.log("[msal-login] account graphres:", accountInfo);

      // 3) Verify + upsert on the server
      const resp = await api.post("/api/auth/msal-login", { idToken: tokenRes.idToken }, { validateStatus: () => true });
      if (resp.status !== 200 || !resp?.data?.user) throw new Error(resp?.data?.error || "Server login failed");
      const savedUser = resp.data.user;
  
      // IMPORTANT: persist + redirect
      sessionStorage.setItem("currentUser", JSON.stringify(savedUser));
      setUser(savedUser);
      postLoginRedirect(savedUser);
    } catch (err) {
      if (err && (err.errorCode === "user_cancelled" || err.errorCode === "popup_window_error")) {
        console.warn("[msal-login] popup closed/blocked", err);
        return;
      }
      if (err && err.errorCode === "interaction_in_progress") {
        console.warn("[msal-login] interaction already in progress");
        return;
      }
      console.error("[msal-login] failed", err);
      alert("Microsoft sign-in failed. Check console for details.");
    } finally {
      console.timeEnd(`[msal-login] ${rid}`);
      console.groupEnd();
      loginInFlightRef.current = null;
    }
  }, [instance, setUser, postLoginRedirect]);  
  return (
    <div className="wrapper">
      <form onSubmit={handleLogin}>
        <img
          src={require("../Assets/img/guardianlogo-removebg-preview.png")}
          alt="Guardian Logo"
          className="guardianlogo"
        />

        <div className="input-box">
          <input
            type="text"
            required
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <FaUser className="icon" />
        </div>

        <div className="input-box">
          <input
            type="password"
            required
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <FaLock className="icon" />
        </div>

        <br />
        <div className="register-link">
          <p>Don't have an account? <a href="#!">Register</a></p>
          <p>Forgot Password? <a href="#!">Reset</a></p>
        </div>

        <br />
        <button type="submit">Login</button>

        <div style={{ margin: "12px 0", textAlign: "center" }}>— or —</div>
        <button
          type="button"
          onClick={handleMicrosoftLogin}
          disabled={inProgress !== InteractionStatus.None}
          title={inProgress !== InteractionStatus.None ? "Please wait…" : "Sign in with Microsoft"}
        >
          Sign in with Microsoft
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
