import { useEffect } from "react";

export default function AuthPopup() {
  // MSAL will parse the hash and close the window automatically.
  // This is a safety net if the auto-close message is blocked.
  useEffect(() => {
    const t = setTimeout(() => {
      if (window.opener && !window.opener.closed) {
        try { window.opener.focus(); } catch {}
        window.close();
      }
    }, 2000);
    return () => clearTimeout(t);
  }, []);
  return <div style={{ padding: 16 }}>Signing you in…</div>;
}
