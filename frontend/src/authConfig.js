// src/authConfig.js
import { PublicClientApplication } from "@azure/msal-browser";

export const msalConfig = {
    auth: {
        clientId: "52e98c1f-5fdf-4da1-9780-51068c5bc14b", // Replace with your Application (client) ID from Azure AD
        // authority: "https://login.microsoftonline.com/common", // For multi-tenant applications or personal accounts
        authority: "https://login.microsoftonline.com/3f55f1df-18ff-4c55-baac-79c960fb03e6", // For single-tenant applications
        redirectUri: "https://hrportal.guardianfueltech.com", // Must match the Redirect URI in Azure AD
        postLogoutRedirectUri: window.location.origin,
        navigateToLoginRequestUrl: false, 
    },
    cache: {
        cacheLocation: "sessionStorage", // This configures where your tokens will be stored. "localStorage" is also an option.
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or edge
    }
};

export const devmsalConfig = {
    auth: {
        clientId: "52e98c1f-5fdf-4da1-9780-51068c5bc14b", // Replace with your Application (client) ID from Azure AD
        // authority: "https://login.microsoftonline.com/common", // For multi-tenant applications or personal accounts
        authority: "https://login.microsoftonline.com/3f55f1df-18ff-4c55-baac-79c960fb03e6", // For single-tenant applications
        redirectUri: "http://localhost:3000", // Must match the Redirect URI in Azure AD
        postLogoutRedirectUri: window.location.origin,
        navigateToLoginRequestUrl: false, 
    },
    cache: {
        cacheLocation: "sessionStorage", // This configures where your tokens will be stored. "localStorage" is also an option.
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or edge
    }
};

// Add scopes for the API calls.
// The default "openid", "profile", "User.Read" are usually enough for basic login.
export const loginRequest = {
    scopes: ["openid", "profile", "User.Read"] // Add more scopes if needed (e.g., "Mail.Read")
};

// If you need to call Microsoft Graph API (e.g., to get more user details)
export const graphConfig = {
    graphMeEndpoint: "https://graph.microsoft.com/v1.0/me"
};

export const msalInstance = new PublicClientApplication(msalConfig);
export const devmsalInstance = new PublicClientApplication(devmsalConfig);
