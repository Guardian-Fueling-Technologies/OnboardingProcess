// src/EditForm.jsx (or src/components/EditForm/EditForm.jsx)
import React, { useState, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom'; // Import useParams and useNavigate
import './editform.css'; // Make sure you have this CSS file in the same directory or adjust the path

const EditForm = () => { // Renamed from App to EditForm
  const { id } = useParams(); // Get the ID from the URL
  const navigate = useNavigate(); // For redirecting after update

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formattedToday = getTodayDate();

  // Initial state for the form data - these will be overridden by fetched data
  const [formData, setFormData] = useState({
    type: '',
    projectedStartDate: formattedToday,
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
    isRehire: 'No',
    isDriver: false,

    employeeID_Requested: false,
    purchasingCard_Requested: false,
    gasCard_Requested: false,
    emailAddress_Provided: '',
    mobilePhone_Requested: false,
    tlcBonusEligible: false,
    noteField: '',

    // Frontend-specific fields and descriptions
    employeeID_RequestedDescription: '',
    purchasingCard_RequestedDescription: '',
    gasCard_RequestedDescription: '',
    emailAddress_ProvidedDescription: '',
    mobilePhone_RequestedDescription: '',
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
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- useEffect to fetch data on component mount or ID change ---
  useEffect(() => {
    const fetchSubmissionData = async () => {
      if (!id) {
        setError("No submission ID provided.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`http://127.0.0.1:5000/api/submissions/${id}`); // Fetch by ID
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch submission with ID ${id}`);
        }
        const data = await response.json();
        console.log("Fetched data for editing:", data);

        // --- Map fetched data to form state ---
        // This mapping needs to be robust. Ensure fetched `data` keys match your `formData` keys.
        // Handle boolean conversions from DB (e.g., BIT to JS boolean) and date formatting.
        setFormData({
          type: data.Type || '',
          projectedStartDate: data.ProjectedStartDate ? new Date(data.ProjectedStartDate).toISOString().split('T')[0] : formattedToday, // Format date for input type="date"
          legalFirstName: data.LegalFirstName || '',
          legalMiddleName: data.LegalMiddleName || '',
          legalLastName: data.LegalLastName || '',
          suffix: data.Suffix || '',
          positionTitle: data.PositionTitle || '',
          manager: data.Manager || '',
          department: data.Department || '',
          location: data.Location || '',
          payRateType: data.PayRateType === 'Salary' ? 'Yearly' : (data.PayRateType === 'Hourly' ? 'Hourly' : ''), // Map 'Salary' to 'Yearly'
          payRate: data.PayRate !== null ? data.PayRate.toString() : '', // Ensure it's a string for input value
          additionType: data.AdditionType || '',
          isRehire: data.IsReHire ? 'Yes' : 'No', // Convert BIT to 'Yes'/'No' string
          isDriver: data.IsDriver || false, // Convert BIT to boolean

          employeeID_Requested: data.EmployeeID_Requested || false,
          purchasingCard_Requested: data.PurchasingCard_Requested || false,
          gasCard_Requested: data.GasCard_Requested || false,
          emailAddress_Provided: data.EmailAddress_Provided || '',
          mobilePhone_Requested: data.MobilePhone_Requested || false,
          tlcBonusEligible: data.TLCBonusEligible || false,
          noteField: data.NoteField || '', // Populate the main note field

          // For frontend-only description fields, you might need to parse `data.NoteField`
          // if they were concatenated there during submission. This is a common complexity.
          // For now, setting them to empty or you'd need a more complex parsing logic.
          employeeID_RequestedDescription: '', // Assuming these aren't returned individually
          purchasingCard_RequestedDescription: '',
          gasCard_RequestedDescription: '',
          emailAddress_ProvidedDescription: '',
          mobilePhone_RequestedDescription: '',
          shirtIncludeSize: false, // You'll need logic to parse NoteField for this
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
          
          // Assuming email distribution checkboxes are not stored as individual BITs
          // and might need to be derived from a larger NoteField or are not editable here.
          // If they ARE separate DB columns, add them to your `get_onboard_request_by_id` query
          // and map them here. For now, they'll remain false/default.
          emailAdminNoTech: false,
          emailBranchManager: false,
          emailSales: false,
          emailBranchTech: false,
          emailPartsManager: false,
          emailServiceManager: false,
          emailTechGlobal: false,
          emailGlobal: false,
          emailBranchDispatch: false,
          adminSpField: '', // Will also need to be parsed from NoteField if that's where it's stored
        });
        setLoading(false);

      } catch (err) {
        console.error("Error fetching submission:", err);
        setError(err.message);
        setLoading(false);
        // Optionally redirect to an error page or submissions list
        // navigate('/submissions');
      }
    };

    fetchSubmissionData();
  }, [id, formattedToday]); // Re-run if ID changes

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

  const handleShirtCheckboxChange = (e) => {
    const { checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      shirtIncludeSize: checked,
      shirtIncludeSizeDescription: checked ? prevData.shirtIncludeSizeDescription : '',
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
    if (!formData.projectedStartDate) {
      alert('Please select a Projected Start Date.');
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
    const now = new Date();
    const currentTimestamp = now.toISOString()
      .replace('T', ' ')
      .replace('Z', '')
      .split('.')[0] + '.' + now.getMilliseconds().toString().padStart(3, '0') + '0000';

    const transformedData = {
      Id: parseInt(id), // Include the ID for the update operation
      Type: formData.type,
      ProjectedStartDate: formData.projectedStartDate,
      LegalFirstName: formData.legalFirstName,
      LegalMiddleName: formData.legalMiddleName || null,
      LegalLastName: formData.legalLastName,
      Suffix: formData.suffix || null,
      PositionTitle: formData.positionTitle,
      Manager: formData.manager,
      Department: formData.department,
      Location: formData.location,
      PayRateType: formData.payRateType === 'Yearly' ? 'Salary' : 'Hourly',
      PayRate: parseFloat(formData.payRate),
      AdditionType: formData.additionType,
      IsReHire: formData.isRehire === 'Yes',
      IsDriver: formData.isDriver,

      EmployeeID_Requested: formData.employeeID_Requested,
      PurchasingCard_Requested: formData.purchasingCard_Requested,
      GasCard_Requested: formData.gasCard_Requested,
      EmailAddress_Provided: formData.emailAddress_Provided,
      MobilePhone_Requested: formData.mobilePhone_Requested,
      TLCBonusEligible: formData.tlcBonusEligible,
      // NoteField will be compiled below
      NoteField: '',

      Createdby: "Frontend_User", // This will likely come from actual user auth
      UpdatedAt: currentTimestamp,
      // Createdby and CreatedAt are handled by the database and should not be sent on update
    };

    let fullNoteField = formData.noteField;
    if (formData.employeeID_RequestedDescription) fullNoteField += `\nEmployee ID: ${formData.employeeID_RequestedDescription}`;
    if (formData.purchasingCard_RequestedDescription) fullNoteField += `\nPurchasing Card: ${formData.purchasingCard_RequestedDescription}`;
    if (formData.gasCard_RequestedDescription) fullNoteField += `\nGas Card: ${formData.gasCard_RequestedDescription}`;
    if (formData.emailAddress_ProvidedDescription) fullNoteField += `\nEmail Address Admin Note: ${formData.emailAddress_ProvidedDescription}`;
    if (formData.mobilePhone_RequestedDescription) fullNoteField += `\nMobile Phone: ${formData.mobilePhone_RequestedDescription}`;
    if (formData.shirtIncludeSize && formData.shirtIncludeSizeDescription) fullNoteField += `\nShirt Size: ${formData.shirtIncludeSizeDescription}`;
    if (formData.tlcBonusEligibleDescription) fullNoteField += `\nTLC Bonus: ${formData.tlcBonusEligibleDescription}`;
    if (formData.vpnAccessDescription) fullNoteField += `\nVPN Access: ${formData.vpnAccessDescription}`;
    if (formData.wifiDomainDescription) fullNoteField += `\nWifi Domain: ${formData.wifiDomainDescription}`;
    if (formData.citrixAccessDescription) fullNoteField += `\nCitrix Access: ${formData.citrixAccessDescription}`;
    if (formData.opAccessDescription) fullNoteField += `\nOp Access: ${formData.opAccessDescription}`;
    if (formData.computerDescription) fullNoteField += `\nComputer: ${formData.computerDescription}`;
    if (formData.adminSpField && formData.type === 'Admin') fullNoteField += `\nAdmin Specific Field: ${formData.adminSpField}`;

    transformedData.NoteField = fullNoteField.trim();

    console.log('Transformed Data for Update (console):', JSON.stringify(transformedData, null, 2));

    const userConfirmed = window.confirm(
      "Are you sure you want to update this request? \n\n" +
      "Click OK to confirm, or Cancel to review details in the console (F12)."
    );

    if (userConfirmed) {
      console.log('User confirmed update. Data will now be sent to SQL (or API):', transformedData);
      try {
        // Change method to 'PUT' and include ID in the URL
        const response = await fetch(`http://127.0.0.1:5000/api/submissions/${id}`, {
          method: 'PUT', // Changed from POST to PUT
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transformedData),
        });

        if (response.ok) {
          const result = await response.json();
          alert(result.message || 'Request updated successfully!');
          console.log('Update success:', result);
          navigate('/submissions'); // Redirect back to submissions list after successful update
        } else {
          const errorData = await response.json();
          alert(errorData.error || 'Failed to update request.');
          console.error('Update error:', errorData);
        }
      } catch (error) {
        alert('There was an error connecting to the server or processing your request.');
        console.error('Network or unexpected error during update:', error);
      }
    } else {
      console.log('User cancelled update.');
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
                    min={formattedToday}
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
                    <th>Description / Notes</th> {/* Added header for clarity */}
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
                        onChange={handleDbCheckboxChange} // Use generic handler for DB-mapped checkboxes
                        className="checkbox-input"
                      />
                      <label htmlFor="employeeID_Requested" className="checkbox-label visually-hidden">Request Employee ID</label>
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
                      />
                      <label htmlFor="purchasingCard_Requested" className="checkbox-label visually-hidden">Request Purchasing Card</label>
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
                      />
                      <label htmlFor="gasCard_Requested" className="checkbox-label visually-hidden">Request Gas Card</label>
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

                  {/* New Hire Email Address */}
                  <tr>
                    <td>New Hire Email Address</td>
                    <td>
                      <input
                        type="text" // This is an input for the email address itself
                        id="emailAddress_Provided"
                        name="emailAddress_Provided"
                        value={formData.emailAddress_Provided}
                        onChange={handleChange}
                        className="form-input"
                        placeholder="new.hire@example.com"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="emailAddress_ProvidedDescription"
                        value={formData.emailAddress_ProvidedDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input"
                        placeholder="Notes on email setup"
                      />
                    </td>
                  </tr>

                  {/* Mobile Phone */}
                  {formData.type === 'Admin' && ( // Only show if type is Admin
                    <tr>
                      <td>Mobile Phone</td>
                      <td>
                        <input
                          type="checkbox"
                          id="mobilePhone_Requested"
                          name="mobilePhone_Requested"
                          checked={formData.mobilePhone_Requested}
                          onChange={handleDbCheckboxChange}
                          className="checkbox-input"
                        />
                        <label htmlFor="mobilePhone_Requested" className="checkbox-label visually-hidden">Request Mobile Phone</label>
                      </td>
                      <td>
                        <input
                          type="text"
                          name="mobilePhone_RequestedDescription"
                          value={formData.mobilePhone_RequestedDescription}
                          onChange={handleDescriptionInputChange}
                          className="form-input"
                          placeholder="Notes for Mobile Phone"
                        />
                      </td>
                    </tr>
                  )}

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
                      />
                      <label htmlFor="tlcBonusEligible" className="checkbox-label visually-hidden">TLC Bonus Eligible</label>
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

                  {/* Shirt Include Size */}
                  <tr>
                    <td>Shirt (Include Size)</td>
                    <td>
                      <input
                        type="checkbox"
                        id="shirtIncludeSize"
                        name="shirtIncludeSize"
                        checked={formData.shirtIncludeSize}
                        onChange={handleShirtCheckboxChange} // Use specific handler for shirt
                        className="checkbox-input"
                      />
                      <label htmlFor="shirtIncludeSize" className="checkbox-label visually-hidden">Include Shirt</label>
                    </td>
                    <td>
                      <input
                        type="text"
                        name="shirtIncludeSizeDescription"
                        value={formData.shirtIncludeSizeDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input"
                        placeholder="Enter size (e.g., Large, XL)"
                        disabled={!formData.shirtIncludeSize} // Disable if checkbox is unchecked
                      />
                    </td>
                  </tr>

                  {/* VPN Access */}
                  <tr>
                    <td>VPN Access</td>
                    <td>
                      <input
                        type="checkbox"
                        id="vpnAccess"
                        name="vpnAccess"
                        checked={formData.vpnAccess}
                        onChange={handleDbCheckboxChange}
                        className="checkbox-input"
                      />
                      <label htmlFor="vpnAccess" className="checkbox-label visually-hidden">Request VPN Access</label>
                    </td>
                    <td>
                      <input
                        type="text"
                        name="vpnAccessDescription"
                        value={formData.vpnAccessDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input"
                        placeholder="Notes for VPN Access"
                      />
                    </td>
                  </tr>

                  {/* Wifi/Domain Access */}
                  <tr>
                    <td>Wifi / Domain Access</td>
                    <td>
                      <input
                        type="checkbox"
                        id="wifiDomain"
                        name="wifiDomain"
                        checked={formData.wifiDomain}
                        onChange={handleDbCheckboxChange}
                        className="checkbox-input"
                      />
                      <label htmlFor="wifiDomain" className="checkbox-label visually-hidden">Request Wifi/Domain Access</label>
                    </td>
                    <td>
                      <input
                        type="text"
                        name="wifiDomainDescription"
                        value={formData.wifiDomainDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input"
                        placeholder="Notes for Wifi/Domain"
                      />
                    </td>
                  </tr>

                  {/* Citrix Access */}
                  <tr>
                    <td>Citrix Access</td>
                    <td>
                      <input
                        type="checkbox"
                        id="citrixAccess"
                        name="citrixAccess"
                        checked={formData.citrixAccess}
                        onChange={handleDbCheckboxChange}
                        className="checkbox-input"
                      />
                      <label htmlFor="citrixAccess" className="checkbox-label visually-hidden">Request Citrix Access</label>
                    </td>
                    <td>
                      <input
                        type="text"
                        name="citrixAccessDescription"
                        value={formData.citrixAccessDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input"
                        placeholder="Notes for Citrix Access"
                      />
                    </td>
                  </tr>

                  {/* O/P Access */}
                  <tr>
                    <td>O/P Access</td>
                    <td>
                      <input
                        type="checkbox"
                        id="opAccess"
                        name="opAccess"
                        checked={formData.opAccess}
                        onChange={handleDbCheckboxChange}
                        className="checkbox-input"
                      />
                      <label htmlFor="opAccess" className="checkbox-label visually-hidden">Request O/P Access</label>
                    </td>
                    <td>
                      <input
                        type="text"
                        name="opAccessDescription"
                        value={formData.opAccessDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input"
                        placeholder="Notes for O/P Access"
                      />
                    </td>
                  </tr>

                  {/* Computer */}
                  <tr>
                    <td>Computer</td>
                    <td>
                      <input
                        type="checkbox"
                        id="computer"
                        name="computer"
                        checked={formData.computer}
                        onChange={handleDbCheckboxChange}
                        className="checkbox-input"
                      />
                      <label htmlFor="computer" className="checkbox-label visually-hidden">Request Computer</label>
                    </td>
                    <td>
                      <input
                        type="text"
                        name="computerDescription"
                        value={formData.computerDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input"
                        placeholder="Notes for Computer"
                      />
                    </td>
                  </tr>

                  {/* Note Field (General) */}
                  <tr>
                    <td>General Notes</td>
                    <td></td> {/* Empty cell for alignment */}
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

          <button type="submit" className="submit-button">Update Request</button> {/* Changed button text */}
        </form>
      </main>
    </div>
  );
};

export default EditForm;