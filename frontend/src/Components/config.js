// src/axiosConfig.js
import axios from 'axios'; // Make sure you have axios installed: npm install axios

const getBaseUrl = () => {
  let url;
  // process.env.NODE_ENV is set automatically by Create React App / build tools
  switch(process.env.REACT_APP_API_BASE_URL) {
    case 'production':
      // This would be your LIVE production API URL
      url = 'https://api.yourproductiondomain.com';
      break;
    case 'development':
    default:
      // This would be your LOCAL development API URL (e.g., your Flask server)
      url = 'http://127.0.0.1:5000'; // Your Flask app
  }

  console.log(`API Base URL: ${url} (NODE_ENV: ${process.env.NODE_ENV})`); // For debugging
  return url;
}

// entraid thingy
// Export a pre-configured Axios instance
export default axios.create({
  baseURL: getBaseUrl(),
  // You can add other default headers here if needed
  headers: {
    'Content-Type': 'application/json',
    // 'Authorization': `Bearer ${yourAuthToken}` // Example for authentication
  }
});