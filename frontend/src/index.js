import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./authConfig";
import { devmsalInstance } from "./authConfig";
import App from "./App";
const env = "prod";
let instance;

switch (env) {
  case "prod":
    instance = msalInstance;
    break;
  case "dev":
  default:
    instance = devmsalInstance;
    break;
}

(async () => {
  await instance.initialize();
  await instance.handleRedirectPromise();

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <MsalProvider instance={instance}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MsalProvider>
    </React.StrictMode>
  );
})();