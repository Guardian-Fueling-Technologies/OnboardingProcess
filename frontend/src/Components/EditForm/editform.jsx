// src/EditForm.jsx (or src/components/EditForm/EditForm.jsx)
import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom'; // Import useParams and useNavigate
import './editform.css'; // Make sure you have this CSS file in the same directory or adjust the path
import api from '../config';

const EditForm = () => {
  const { id } = useParams(); // Get the ID from the URL (will be undefined for new submissions)
  const navigate = useNavigate(); // For redirecting after update/creation

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formattedToday = useMemo(() => getTodayDate(), []); // This ensures formattedToday is calculated only once

const initialFormData = useMemo(() => ({ // Memoize initialFormData as well
  type: '',
  projectedStartDate: formattedToday, // This will now be stable
  legalFirstName: '',
  legalMiddleName: '',
  legalLastName: '',
  suffix: '',
  positionTitle: '',
  manager: '',
  department: '',
  location: '',
  payRateType: '',
  payRate: '',
  additionType: '',
  isRehire: 'No', // Default for new forms
  isDriver: false, // Default for new forms

  employeeID_Requested: false,
  purchasingCard_Requested: false,
  gasCard_Requested: false,
  tlcBonusEligible: false,
  noteField: '',

  employeeID_RequestedDescription: '',
  purchasingCard_RequestedDescription: '',
  gasCard_RequestedDescription: '',
  shirtIncludeSize: false,
  shirtIncludeSizeDescription: '',
  tlcBonusEligibleDescription: '',
  vpnAccess: false,
  vpnAccessDescription: '',
  wifiDomain: false,
  wifiDomainDescription: '',
  citrixAccess: false,
  citrixAccessDescription: '',
  opAccess: false,
  opAccessDescription: '',
  computer: false,
  computerDescription: '',

  emailAdminNoTech: false,
  emailBranchManager: false,
  emailSales: false,
  emailBranchTech: false,
  emailPartsManager: false,
  emailServiceManager: false,
  emailTechGlobal: false,
  emailGlobal: false,
  emailBranchDispatch: false,
  adminSpField: '',
}), [formattedToday]); // initialFormData depends on formattedToday


const [formData, setFormData] = useState(initialFormData);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

// --- useEffect to fetch data on component mount or ID change ---
useEffect(() => {
  const fetchAndInitializeFormData = async () => {
    setLoading(true); // Always start loading when initializing or fetching
    setError(null); // Clear any previous errors

    if (id) { // If ID exists, fetch data for editing
      try {
        const response = await api.get(`/api/submissions/${id}`);
        let rawSubmissionData = {};

        if (response.data && typeof response.data === 'object' && Object.keys(response.data).length > 0) {
          rawSubmissionData = response.data;
        } else if (response.data && 'message' in response.data) {
          console.warn("Backend message (no data for ID):", response.data.message);
          throw new Error(response.data.message || `No data found for submission with ID ${id}`);
        } else {
          console.warn("Unexpected or empty data format from /api/submissions/:id", response.data);
          throw new Error(`Unexpected data format or empty response for submission with ID ${id}`);
        }

        console.log("Fetched raw data for editing:", rawSubmissionData);

        const transformedFormData = {
          type: rawSubmissionData.Type || '',
          // HERE'S THE CHANGE: Use fetched date, no fallback to formattedToday for existing records
          projectedStartDate: rawSubmissionData.ProjectedStartDate ? new Date(rawSubmissionData.ProjectedStartDate).toISOString().split('T')[0] : '', // Keep empty if not present, or handle initial state where it might be missing
          legalFirstName: rawSubmissionData.LegalFirstName || '',
          legalMiddleName: rawSubmissionData.LegalMiddleName || '',
          legalLastName: rawSubmissionData.LegalLastName || '',
          suffix: rawSubmissionData.Suffix || '',
          positionTitle: rawSubmissionData.PositionTitle || '',
          manager: rawSubmissionData.Manager || '',
          department: rawSubmissionData.Department || '',
          location: rawSubmissionData.Location || '',
          payRateType: rawSubmissionData.PayRateType === 'Salary' ? 'Yearly' : (rawSubmissionData.PayRateType === 'Hourly' ? 'Hourly' : ''),
          payRate: rawSubmissionData.PayRate !== null ? rawSubmissionData.PayRate.toString() : '',
          additionType: rawSubmissionData.AdditionType || '',
          isRehire: rawSubmissionData.IsReHire ? 'Yes' : 'No',
          isDriver: rawSubmissionData.IsDriver || false,

          employeeID_Requested: rawSubmissionData.EmployeeID_Requested || false,
          purchasingCard_Requested: rawSubmissionData.PurchasingCard_Requested || false,
          gasCard_Requested: rawSubmissionData.GasCard_Requested || false,
          tlcBonusEligible: rawSubmissionData.TLCBonusEligible || false,
          noteField: rawSubmissionData.NoteField || '',

          // ... (rest of your description fields and email distribution checkboxes remain the same)
          employeeID_RequestedDescription: '',
          purchasingCard_RequestedDescription: '',
          gasCard_RequestedDescription: '',
          shirtIncludeSize: false,
          shirtIncludeSizeDescription: '',
          tlcBonusEligibleDescription: '',
          vpnAccess: false,
          vpnAccessDescription: '',
          wifiDomain: false,
          wifiDomainDescription: '',
          citrixAccess: false,
          citrixAccessDescription: '',
          opAccess: false,
          opAccessDescription: '',
          computer: false,
          computerDescription: '',

          emailAdminNoTech: false,
          emailBranchManager: false,
          emailSales: false,
          emailBranchTech: false,
          emailPartsManager: false,
          emailServiceManager: false,
          emailTechGlobal: false,
          emailGlobal: false,
          emailBranchDispatch: false,
          adminSpField: '',
        };

        console.log("Transformed form data for editing:", transformedFormData);
        setFormData(transformedFormData);

      } catch (err) {
        console.error("Error fetching submission:", err);
        setError(err.message || "Failed to load submission data. Please check the ID and try again.");
        // Consider what initial state formData should be on error (e.g., reset to empty, or keep what was there)
      } finally {
        setLoading(false);
      }
    } else {
      console.log("No submission ID provided. Initializing empty form for new submission.");
      setFormData(initialFormData); // initialFormData is now stable
      setLoading(false);
      setError(null);
    }
  };

  fetchAndInitializeFormData();
}, [id, initialFormData]);

const handleChange = (e) => {
  const { name, value, type, checked } = e.target;

  setFormData((prevData) => {
    const newData = {
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    };

    // Validation for Projected Start Date
    if (name === 'projectedStartDate' && value) {
      const selectedDate = new Date(value);
      const dayOfWeek = selectedDate.getDay(); // Sunday is 0, Saturday is 6

      if (isNaN(selectedDate.getTime())) {
        alert('Invalid Date Selected. Please choose a valid date.');
        newData[name] = ''; // Clear the invalid date
      } else if (dayOfWeek === 0 || dayOfWeek === 6) { // Check for Sunday (0) or Saturday (6)
        alert('The Projected Start Date cannot be a weekend. Please choose a weekday.');
        newData[name] = ''; // Clear the invalid date
      }
    }
    return newData;
  });
};

const handleDescriptionInputChange = (e) => {
  const { name, value } = e.target;
  setFormData((prevData) => ({
    ...prevData,
    [name]: value,
  }));
};

const handleDbCheckboxChange = (e) => {
  const { name, checked } = e.target;
  setFormData(prevData => ({
    ...prevData,
    [name]: checked,
  }));
};

const handleSubmit = async (e) => {
  e.preventDefault();

  // --- Validation Checks (reuse from your existing form) ---
  if (!formData.type) {
    alert('Please select a Type.');
    return;
  }
  if (!formData.additionType) {
    alert('Please select an Addition Type.');
    return;
  }

  if (!formData.legalFirstName.trim()) {
    alert('Please enter the Legal First Name.');
    return;
  }
  if (!formData.legalLastName.trim()) {
    alert('Please enter the Legal Last Name.');
    return;
  }

  if (!formData.positionTitle.trim()) {
    alert('Please enter the Position Title.');
    return;
  }
  if (!formData.manager.trim()) {
    alert('Please enter the Manager.');
    return;
  }
  if (!formData.department) {
    alert('Please select a Department.');
    return;
  }
  if (!formData.location || formData.location === 'Select Location') {
    alert('Please select a Location.');
    return;
  }

  if (!formData.payRate.trim()) {
    alert('Please enter a Pay Rate.');
    return;
  }
  if (isNaN(parseFloat(formData.payRate))) {
    alert('Pay Rate must be a valid number.');
    return;
  }
  if (!formData.payRateType) {
    alert('Please select a Pay Rate Type (Yearly/Hourly).');
    return;
  }

  // --- Data Transformation to Backend Format for UPDATE ---
  // Removed currentTimestamp as it was not used and causing a warning
  // const now = new Date();
  // const currentTimestamp = now.toISOString()
  //   .replace('T', ' ')
  //   .replace('Z', '')
  //   .split('.')[0] + '.' + now.getMilliseconds().toString().padStart(3, '0') + '0000';

  // Declare transformedData before its first use
  const transformedData = {
    // Example transformations - adjust based on your backend's exact needs
    Type: formData.type,
    ProjectedStartDate: formData.projectedStartDate,
    LegalFirstName: formData.legalFirstName,
    LegalMiddleName: formData.legalMiddleName,
    LegalLastName: formData.legalLastName,
    Suffix: formData.suffix,
    PositionTitle: formData.positionTitle,
    Manager: formData.manager,
    Department: formData.department,
    Location: formData.location,
    PayRateType: formData.payRateType === 'Yearly' ? 'Salary' : (formData.payRateType === 'Hourly' ? 'Hourly' : ''), // Convert back to backend format
    PayRate: parseFloat(formData.payRate), // Ensure it's a number
    AdditionType: formData.additionType,
    IsReHire: formData.isRehire === 'Yes', // Convert 'Yes'/'No' to boolean
    IsDriver: formData.isDriver,

    EmployeeID_Requested: formData.employeeID_Requested,
    PurchasingCard_Requested: formData.purchasingCard_Requested,
    GasCard_Requested: formData.gasCard_Requested,
    TLCBonusEligible: formData.tlcBonusEligible,
    // NoteField will be populated below
    NoteField: '', // Initialize to empty, then build it
    // Ensure all backend expected fields are mapped from formData,
    // even if they were just set to default empty values during fetch
    // Example for email distribution if your backend also handles them explicitly:
    // EmailAdminNoTech: formData.emailAdminNoTech,
    // ...
  };

  let fullNoteField = formData.noteField;
  if (formData.employeeID_RequestedDescription) fullNoteField += `\nEmployee ID: ${formData.employeeID_RequestedDescription}`;
  if (formData.purchasingCard_RequestedDescription) fullNoteField += `\nPurchasing Card: ${formData.purchasingCard_RequestedDescription}`;
  if (formData.gasCard_RequestedDescription) fullNoteField += `\nGas Card: ${formData.gasCard_RequestedDescription}`;
  if (formData.shirtIncludeSize && formData.shirtIncludeSizeDescription) fullNoteField += `\nShirt Size: ${formData.shirtIncludeSizeDescription}`;
  if (formData.tlcBonusEligibleDescription) fullNoteField += `\nTLC Bonus: ${formData.tlcBonusEligibleDescription}`;
  if (formData.adminSpField && formData.type === 'Admin') fullNoteField += `\nAdmin Specific Field: ${formData.adminSpField}`;
  if (formData.vpnAccessDescription) fullNoteField += `\nVPN Access: ${formData.vpnAccessDescription}`; // Added missing VPN description
  if (formData.wifiDomainDescription) fullNoteField += `\nWifi/Domain Access: ${formData.wifiDomainDescription}`; // Added missing Wifi/Domain description
  if (formData.citrixAccessDescription) fullNoteField += `\nCitrix Access: ${formData.citrixAccessDescription}`; // Added missing Citrix description
  if (formData.opAccessDescription) fullNoteField += `\nO/P Access: ${formData.opAccessDescription}`; // Added missing O/P description
  if (formData.computerDescription) fullNoteField += `\nComputer: ${formData.computerDescription}`; // Added missing Computer description


  transformedData.NoteField = fullNoteField.trim();

  console.log('Transformed Data for Update (console):', JSON.stringify(transformedData, null, 2));

  const userConfirmed = window.confirm(id ? 'Are you sure you want to update this request?' : 'Are you sure you want to create this new request?');

  if (userConfirmed) {
    console.log(id ? 'User confirmed update.' : 'User confirmed creation.', 'Data will now be sent:', transformedData);
    try {
      let response;
      let successMessage;

      if (id) {
        // Situation 2 & 3: Use api.put for updates
        response = await api.put(`/api/submissions/${id}`, transformedData);
        successMessage = 'Request updated successfully!';
      } else {
        // Situation 3: Use api.post for new submissions
        response = await api.post('/api/submissions', transformedData);
        successMessage = 'New request created successfully!';
      }

      const result = response.data; // Access the parsed JSON directly from response.data
      alert(result.message || successMessage);
      console.log(id ? 'Update success:' : 'Creation success:', result);
      navigate('/submissions'); // Redirect back to submissions list after successful operation

    } catch (error) {
      console.error('Error during submission:', error);

      let errorMessage = 'There was an error connecting to the server or processing your request.';

      if (error.response) {
        console.error('Server responded with:', error.response.data);
        console.error('Status:', error.response.status);
        errorMessage = error.response.data.error || error.response.data.message || `Failed to ${id ? 'update' : 'create'} request (Status: ${error.response.status})`;
      } else if (error.request) {
        console.error('No response received:', error.request);
        errorMessage = 'No response from server. Please check your network connection.';
      } else {
        console.error('Error in request setup:', error.message);
        errorMessage = error.message || 'An unexpected error occurred.';
      }

      alert(errorMessage);
    }
  } else {
    console.log(id ? 'User cancelled update.' : 'User cancelled creation.');
  }
};


if (loading) {
  return <div className="page-container loading-container">Loading submission data...</div>;
}

if (error) {
  return <div className="page-container error-container">Error: {error}</div>;
}


  return (
    <div className="page-container">
      {/* Header */}
      <header className="header">
        <div className="header-logo">GUARDIAN <span className="logo-subtext">PLATFORM TECHNOLOGIES</span></div>
        <nav>
          <a href="/dashboard" className="header-nav-link">Dashboard</a>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="form-main-content">
        <h1 className="form-title">Edit Hire Request Form (ID: {id})</h1> {/* Changed title for clarity */}

        {/* Form Section */}
        <form onSubmit={handleSubmit}>
          {/* Step 1: Basic Information */}
          <>
            <h2 className="form-section-title">Basic Information</h2>
            <div className="form-grid">
              {/* Type */}
              <div className="form-field-group">
                <label htmlFor="type" className="form-label">Type</label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">Select Type</option>
                  <option value="Admin">Admin</option>
                  <option value="Field-Employee">Field-Employee</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                </select>
              </div>

              {/* Addition Type */}
              <div className="form-field-group">
                <label htmlFor="additionType" className="form-label">What kind of addition is this?</label>
                <select
                  id="additionType"
                  name="additionType"
                  value={formData.additionType}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">Select an option</option>
                  <option value="New Role">New Role</option>
                  <option value="Replacement">Replacement</option>
                  <option value="Expansion">Expansion</option>
                </select>
              </div>

              {/* Projected Start Date */}
              <div className="form-field-group">
                <label htmlFor="projectedStartDate" className="form-label">Projected Start Date</label>
                <div className="date-input-wrapper">
                  <input
                    type="date"
                    id="projectedStartDate"
                    name="projectedStartDate"
                    value={formData.projectedStartDate}
                    onChange={handleChange}
                    className="form-input"
                  />
                  <CalendarDays className="date-icon" aria-hidden="true" />
                </div>
              </div>

              {/* Legal First Name */}
              <div className="form-field-group">
                <label htmlFor="legalFirstName" className="form-label">Legal First Name</label>
                <input
                  type="text"
                  id="legalFirstName"
                  name="legalFirstName"
                  value={formData.legalFirstName}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
              {/* Legal Middle Name */}
              <div className="form-field-group">
                <label htmlFor="legalMiddleName" className="form-label">Legal Middle Name (Optional)</label>
                <input
                  type="text"
                  id="legalMiddleName"
                  name="legalMiddleName"
                  value={formData.legalMiddleName}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
              {/* Legal Last Name */}
              <div className="form-field-group">
                <label htmlFor="legalLastName" className="form-label">Legal Last Name</label>
                <input
                  type="text"
                  id="legalLastName"
                  name="legalLastName"
                  value={formData.legalLastName}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
              {/* Suffix */}
              <div className="form-field-group">
                <label htmlFor="suffix" className="form-label">Suffix (Optional)</label>
                <input
                  type="text"
                  id="suffix"
                  name="suffix"
                  value={formData.suffix}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              {/* Position Title */}
              <div className="form-field-group">
                <label htmlFor="positionTitle" className="form-label">Position Title</label>
                <input
                  type="text"
                  id="positionTitle"
                  name="positionTitle"
                  value={formData.positionTitle}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              {/* Manager */}
              <div className="form-field-group">
                <label htmlFor="manager" className="form-label">Manager</label>
                <input
                  type="text"
                  id="manager"
                  name="manager"
                  value={formData.manager}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              {/* Department */}
              <div className="form-field-group">
                <label htmlFor="department" className="form-label">Department</label>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">Select Department</option>
                  <option value="Administration">Administration</option>
                  <option value="Parts">Parts</option>
                  <option value="Sales">Sales</option>
                  <option value="Service">Service</option>
                  <option value="Projects">Projects</option>
                  <option value="Construction">Construction</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              {/* Location */}
              <div className="form-field-group">
                <label htmlFor="location" className="form-label">Location</label>
                <select
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">Select Location</option>
                  <option value="Atlanta">Atlanta</option>
                  <option value="Birmingham">Birmingham</option>
                  <option value="Central Texas">Central Texas</option>
                  <option value="Charlotte">Charlotte</option>
                  <option value="Columbia">Columbia</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Dallas">Dallas</option>
                  <option value="Denver">Denver</option>
                  <option value="Ft Lauderdale">Ft Lauderdale</option>
                  <option value="Ft Myers">Ft Myers</option>
                  <option value="Greensboro">Greensboro</option>
                  <option value="GuardianConnect">GuardianConnect</option>
                  <option value="Houston">Houston</option>
                  <option value="Jacksonville">Jacksonville</option>
                  <option value="Knoxville">Knoxville</option>
                  <option value="LaFayette">LaFayette</option>
                  <option value="Memphis">Memphis</option>
                  <option value="Nashville">Nashville</option>
                  <option value="Oklahoma City">Oklahoma City</option>
                  <option value="Pensacola">Pensacola</option>
                  <option value="Raleigh">Raleigh</option>
                  <option value="Richmond">Richmond</option>
                  <option value="Roanoke">Roanoke</option>
                  <option value="Sanford">Sanford</option>
                  <option value="Savannah">Savannah</option>
                  <option value="Tallahassee">Tallahassee</option>
                  <option value="Tampa">Tampa</option>
                  <option value="Tulsa">Tulsa</option>
                </select>
              </div>

              {/* Pay Rate with Type Dropdown */}
              <div className="form-field-group">
                <label htmlFor="payRate" className="form-label">Pay Rate</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    id="payRate"
                    name="payRate"
                    value={formData.payRate}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g., 75000.00 or 25.00"
                    style={{ flexGrow: 1 }}
                  />
                  <select
                    id="payRateType"
                    name="payRateType"
                    value={formData.payRateType}
                    onChange={handleChange}
                    className="form-select"
                    style={{ width: 'auto' }}
                  >
                    <option value="">Select Type</option>
                    <option value="Yearly">Yearly</option>
                    <option value="Hourly">Hourly</option>
                  </select>
                </div>
              </div>

              {/* Is Re-Hire? */}
              <div className="form-field-group">
                <label className="form-label">Is this a Re-Hire?</label>
                <div className="form-radio-group">
                  <input
                    type="radio"
                    id="isRehireYes"
                    name="isRehire"
                    value="Yes"
                    checked={formData.isRehire === 'Yes'}
                    onChange={handleChange}
                    className="form-radio"
                  />
                  <label htmlFor="isRehireYes" className="form-radio-label">Yes</label>
                  <input
                    type="radio"
                    id="isRehireNo"
                    name="isRehire"
                    value="No"
                    checked={formData.isRehire === 'No'}
                    onChange={handleChange}
                    className="form-radio"
                  />
                  <label htmlFor="isRehireNo" className="form-radio-label">No</label>
                </div>
              </div>

              {/* Is Driver? */}
              <div className="form-field-group">
                <label className="form-label">Is Driver?</label>
                <div className="form-checkbox-group">
                  <input
                    type="checkbox"
                    id="isDriver"
                    name="isDriver"
                    checked={formData.isDriver}
                    onChange={handleChange}
                    className="form-checkbox"
                  />
                  <label htmlFor="isDriver" className="form-checkbox-label">Yes</label>
                </div>
              </div>

              {/* Conditional Admin Specific Field (adminSpField) */}
              {formData.type === 'Admin' && (
                <div className="form-field-group">
                  <label htmlFor="adminSpField" className="form-label">Admin Specific Field</label>
                  <input
                    type="text"
                    id="adminSpField"
                    name="adminSpField"
                    value={formData.adminSpField}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g., Administrator Level"
                  />
                </div>
              )}
            </div>
          </>

          {/* Step 2: Email Distribution */}
          <>
            <h2 className="form-section-title">Email Distribution</h2>
            <div className="checkbox-grid">
              <div className="checkbox-group">
                <input type="checkbox" id="emailAdminNoTech" name="emailAdminNoTech" checked={formData.emailAdminNoTech} onChange={handleChange} className="checkbox-input" />
                <label htmlFor="emailAdminNoTech" className="checkbox-label">Admin No Tech</label>
              </div>
              <div className="checkbox-group">
                <input type="checkbox" id="emailBranchManager" name="emailBranchManager" checked={formData.emailBranchManager} onChange={handleChange} className="checkbox-input" />
                <label htmlFor="emailBranchManager" className="checkbox-label">Branch Manager</label>
              </div>
              <div className="checkbox-group">
                <input type="checkbox" id="emailSales" name="emailSales" checked={formData.emailSales} onChange={handleChange} className="checkbox-input" />
                <label htmlFor="emailSales" className="checkbox-label">Sales</label>
              </div>
              <div className="checkbox-group">
                <input type="checkbox" id="emailBranchTech" name="emailBranchTech" checked={formData.emailBranchTech} onChange={handleChange} className="checkbox-input" />
                <label htmlFor="emailBranchTech" className="checkbox-label">Branch Tech</label>
              </div>
              <div className="checkbox-group">
                <input type="checkbox" id="emailPartsManager" name="emailPartsManager" checked={formData.emailPartsManager} onChange={handleChange} className="checkbox-input" />
                <label htmlFor="emailPartsManager" className="checkbox-label">Parts Manager</label>
              </div>
              <div className="checkbox-group">
                <input type="checkbox" id="emailServiceManager" name="emailServiceManager" checked={formData.emailServiceManager} onChange={handleChange} className="checkbox-input" />
                <label htmlFor="emailServiceManager" className="checkbox-label">Service Manager</label>
              </div>
              <div className="checkbox-group">
                <input type="checkbox" id="emailTechGlobal" name="emailTechGlobal" checked={formData.emailTechGlobal} onChange={handleChange} className="checkbox-input" />
                <label htmlFor="emailTechGlobal" className="checkbox-label">Tech Global</label>
              </div>
              <div className="checkbox-group">
                <input type="checkbox" id="emailGlobal" name="emailGlobal" checked={formData.emailGlobal} onChange={handleChange} className="checkbox-input" />
                <label htmlFor="emailGlobal" className="checkbox-label">Global</label>
              </div>
              <div className="checkbox-group">
                <input type="checkbox" id="emailBranchDispatch" name="emailBranchDispatch" checked={formData.emailBranchDispatch} onChange={handleChange} className="checkbox-input" />
                <label htmlFor="emailBranchDispatch" className="checkbox-label">Branch Dispatch</label>
              </div>
            </div>
          </>

          {/* Step 3: Admin/Field Information */}
          <>
            <h2 className="form-section-title">Admin/Field Information</h2>
            <div className="admin-table-container">
            <table className="admin-features-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Choose</th>
                  <th>Description / Notes</th> 
                </tr>
              </thead>
              <tbody>
                {/* Employee ID */}
                <tr>
                  <td>Employee ID</td>
                  <td>
                    <input
                      type="checkbox"
                      id="employeeID_Requested"
                      name="employeeID_Requested"
                      checked={formData.employeeID_Requested}
                      onChange={handleDbCheckboxChange}
                      className="checkbox-input"
                    /><label htmlFor="employeeID_Requested" className="checkbox-label visually-hidden">Request Employee ID</label>
                  </td>
                  <td>
                    <input
                      type="text"
                      name="employeeID_RequestedDescription"
                      value={formData.employeeID_RequestedDescription}
                      onChange={handleDescriptionInputChange}
                      className="form-input"
                      placeholder="Notes for Employee ID"
                    />
                  </td>
                </tr>

                {/* Purchasing Card */}
                <tr>
                  <td>Purchasing Card</td>
                  <td>
                    <input
                      type="checkbox"
                      id="purchasingCard_Requested"
                      name="purchasingCard_Requested"
                      checked={formData.purchasingCard_Requested}
                      onChange={handleDbCheckboxChange}
                      className="checkbox-input"
                    /><label htmlFor="purchasingCard_Requested" className="checkbox-label visually-hidden">Request Purchasing Card</label>
                  </td>
                  <td>
                    <input
                      type="text"
                      name="purchasingCard_RequestedDescription"
                      value={formData.purchasingCard_RequestedDescription}
                      onChange={handleDescriptionInputChange}
                      className="form-input"
                      placeholder="Notes for Purchasing Card"
                    />
                  </td>
                </tr>

                {/* Gas Card */}
                <tr>
                  <td>Gas Card</td>
                  <td>
                    <input
                      type="checkbox"
                      id="gasCard_Requested"
                      name="gasCard_Requested"
                      checked={formData.gasCard_Requested}
                      onChange={handleDbCheckboxChange}
                      className="checkbox-input"
                    /><label htmlFor="gasCard_Requested" className="checkbox-label visually-hidden">Request Gas Card</label>
                  </td>
                  <td>
                    <input
                      type="text"
                      name="gasCard_RequestedDescription"
                      value={formData.gasCard_RequestedDescription}
                      onChange={handleDescriptionInputChange}
                      className="form-input"
                      placeholder="Notes for Gas Card"
                    />
                  </td>
                </tr>

                {/* TLC Bonus Eligible */}
                <tr>
                  <td>TLC Bonus Eligible</td>
                  <td>
                    <input
                      type="checkbox"
                      id="tlcBonusEligible"
                      name="tlcBonusEligible"
                      checked={formData.tlcBonusEligible}
                      onChange={handleDbCheckboxChange}
                      className="checkbox-input"
                    /><label htmlFor="tlcBonusEligible" className="checkbox-label visually-hidden">TLC Bonus Eligible</label>
                  </td>
                  <td>
                    <input
                      type="text"
                      name="tlcBonusEligibleDescription"
                      value={formData.tlcBonusEligibleDescription}
                      onChange={handleDescriptionInputChange}
                      className="form-input"
                      placeholder="Notes for TLC Bonus"
                    />
                  </td>
                </tr>

                {/* Note Field (General) */}
                <tr>
                  <td>General Notes</td>
                  <td></td> 
                  <td>
                    <textarea
                      id="noteField"
                      name="noteField"
                      value={formData.noteField}
                      onChange={handleChange}
                      className="form-textarea"
                      rows="4"
                      placeholder="Any additional notes..."
                    ></textarea>
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </>

          <button type="submit" className="submit-button">Update Request</button> 
        </form>
      </main>
    </div>
  );
};

export default EditForm;