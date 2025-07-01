// src/LoginForm.jsx
import React, { useState } from 'react'; // Import useState hook
import './LoginForm.css';
import { FaUser, FaLock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for redirection

export const LoginForm = () => {
    // State variables to hold username and password input values
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // useNavigate hook for programmatic navigation
    const navigate = useNavigate();

    // Event handler for form submission
    const handleLogin = (e) => {
        e.preventDefault(); // Prevent the default form submission behavior (page reload)

        // Basic authentication check:
        // You would typically send these credentials to a backend server for validation.
        // For this example, we're hardcoding "admin" and "admin111".
        if (username === 'admin' && password === 'admin111') {
            console.log('Login successful! Redirecting to Dashboard...');
            navigate('/dashboard'); // Redirect to the /dashboard route
        } else {
            alert('Invalid username or password!'); // Show an alert for incorrect credentials
            console.log('Login failed: Invalid credentials provided.');
        }
    };

    return (
        <div className='wrapper'>
            {/* Attach the handleLogin function to the form's onSubmit event */}
            <form onSubmit={handleLogin}>
                {/* Ensure the image path is correct based on your file structure.
                    If 'guardianlogo-removebg-preview.png' is in `public/`, use `src="/guardianlogo-removebg-preview.png"`
                    If using Vite, and image is in `src/Assets/img/`, you might do `import logo from '../Assets/img/guardianlogo-removebg-preview.png';` then `src={logo}`
                    The `require()` syntax is typical for Create React App (CRA) when images are in `src/`.
                */}
                <img
                    src={require('../Assets/img/guardianlogo-removebg-preview.png')}
                    alt="Guardian Logo"
                    className="guardianlogo"
                />
                {/* <h1>Login</h1> */}
                <div className='input-box'>
                    <input
                        type="text"
                        required
                        placeholder='Enter your username'
                        value={username} // Bind input value to the username state
                        onChange={(e) => setUsername(e.target.value)} // Update username state on change
                    />
                    <FaUser className="icon" />
                </div>
                <div className='input-box'>
                    <input
                        type="password" // Use type="password" for password fields (hides characters)
                        required
                        placeholder='Enter your password'
                        value={password} // Bind input value to the password state
                        onChange={(e) => setPassword(e.target.value)} // Update password state on change
                    />
                    <FaLock className="icon" />
                </div>
                <br />
                <div className='register-link'>
                    <p>Don't have an account? <a href="#">Register</a></p>
                    <p>Forgot Password? <a href="#">Reset</a></p>
                </div>
                <br />
                <button type='submit'>Login</button>
            </form>
        </div>
    );
};