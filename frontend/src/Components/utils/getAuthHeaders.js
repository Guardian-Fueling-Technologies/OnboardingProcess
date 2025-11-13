// src/utils/getAuthHeaders.js
export function getAuthHeaders(user) {
    if (!user?.role_id) return {};
  
    const env = (user.env || "dev").toLowerCase();
  
    if (env === "prod") {
      return { Authorization: `Bearer ${user.role_id}` };
    } else {
      return { Authorization: `Bearer demo:${user.role_id}` };
  }
}