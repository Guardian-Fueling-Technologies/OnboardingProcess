import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react'; // Ensure lucide-react is installed: npm install lucide-react
import './requestform.css'; // Make sure you have this CSS file in the same directory or adjust the path

function App() {

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formattedToday = getTodayDate(); // Renamed for consistency

  const [formData, setFormData] = useState({
    // Corresponds to DB Columns
    type: '', // VARCHAR(255) - 'Admin', 'Field-Employee', 'Full-time', 'Part-time'
    projectedStartDate: formattedToday, // DATE
    legalFirstName: '', // VARCHAR(255)
    legalMiddleName: '', // VARCHAR(255) - Not Required
    legalLastName: '', // VARCHAR(255)
    suffix: '', // VARCHAR(50) - Not Required
    positionTitle: '', // VARCHAR(255)
    manager: '', // VARCHAR(255)
    department: '', // VARCHAR(255)
    location: '', // VARCHAR(255) - Initialized to empty for validation
    payRateType: '', // VARCHAR(255) - 'Hourly'/'Yearly' -> maps to DB 'Hour'/'Salary'
    payRate: '', // DECIMAL(10, 2)
    additionType: '', // VARCHAR(255) - "What kind of addition is this?"
    isRehire: 'No', // BIT (boolean) - maps from 'Yes'/'No' string
    isDriver: false, // BIT (boolean)

    // Admin/Field Request Booleans & Descriptions (mapped to DB BITs)
    employeeID_Requested: false, // BIT DEFAULT 0 (changed from adminEmployeeId for DB mapping)
    purchasingCard_Requested: false, // BIT DEFAULT 0 (changed from adminPurchasingCard)
    gasCard_Requested: false, // BIT DEFAULT 0 (changed from adminGasCard)
    emailAddress_Provided: '', // VARCHAR(255) - This is the new hire's email
    mobilePhone_Requested: false, // BIT DEFAULT 0 (changed from adminMobilePhone) - Display only for Admin Type
    tlcBonusEligible: false, // BIT DEFAULT (changed from adminTLCBonusEligible)
    noteField: '', // VARCHAR(255)

    // Frontend-specific fields, or descriptions not directly in main DB columns
    // If these descriptions are needed, they'd be separate columns, or concatenated into NoteField
    employeeID_RequestedDescription: '',
    purchasingCard_RequestedDescription: '',
    gasCard_RequestedDescription: '',
    emailAddress_ProvidedDescription: '', // Description for *providing* the email, not the address itself
    mobilePhone_RequestedDescription: '',
    shirtIncludeSize: false, // This is not in DB, assuming it relates to a general note
    shirtIncludeSizeDescription: '',
    tlcBonusEligibleDescription: '',
    vpnAccess: false, // Not in DB schema provided, assuming for internal system
    vpnAccessDescription: '',
    wifiDomain: false, // Not in DB schema provided
    wifiDomainDescription: '',
    citrixAccess: false, // Not in DB schema provided
    citrixAccessDescription: '',
    opAccess: false, // Not in DB schema provided
    opAccessDescription: '',
    computer: false, // Not in DB schema provided
    computerDescription: '',

    // Email Distribution Checkboxes (If these are just for internal email lists, not direct DB columns)
    emailAdminNoTech: false,
    emailBranchManager: false,
    emailSales: false,
    emailBranchTech: false,
    emailPartsManager: false,
    emailServiceManager: false,
    emailTechGlobal: false,
    emailGlobal: false,
    emailBranchDispatch: false,
    // emailOther: '',
    // emailOtherChecked: false, // Controls visibility of 'Other' text area

    // adminSpField from previous formData, map if needed
    // If this maps to a specific DB column not listed, it needs to be added to DB schema
    adminSpField: '', // Assuming this is for Admin type specific info, not a DB column in your list
  });


  const handleChange = (e) => {
    const { name, type, value , checked} = e.target;
  
    // Update form data immediately
    setFormData((prevData) => ({
        ...prevData,
        [name]: value,
    }));
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prevFormData => ({
      ...prevFormData,
      [name]: newValue,
    }));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      
  
    // Perform validation after state update (or as part of it)
    if (name === 'projectedStartDate' && value) {
        const selectedDate = new Date(value); // This 'value' must be 'YYYY-MM-DD'
        const dayOfWeek = selectedDate.getDay(); // Sunday is 0, Saturday is 6

        // Check if selectedDate is a valid date before checking dayOfWeek
        if (isNaN(selectedDate.getTime())) { // getTime() returns NaN for invalid dates
            alert('Invalid Date Selected. Please choose a valid date.');
            setFormData((prevData) => ({
                ...prevData,
                [name]: '', // Clear the invalid date
            }));
            return; // Stop further processing
        }

        // none sense logic of -1 sunday
        if (dayOfWeek === 6 || dayOfWeek === 5) {
            alert('The Projected Start Date cannot be a weekend. Please choose a weekday.');
            setFormData((prevData) => ({
                ...prevData,
                [name]: '', // Clear the invalid date
            }));
        }
    }
    // ... other handleChange logic
};

  // const handleOtherCheckboxChange = (e) => {
  //   const { checked } = e.target;
  //   setFormData((prevData) => ({
  //     ...prevData,
  //     emailOtherChecked: checked,
  //     emailOther: checked ? prevData.emailOther : '',
  //   }));
  // };

  // Generic handler for description inputs linked to checkboxes
  const handleDescriptionInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // This handles the checkboxes whose names directly map to DB fields like EmployeeID_Requested
  const handleDbCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: checked,
    }));
  };

  // Specific handler for Shirt checkbox to manage its description visibility
  const handleShirtCheckboxChange = (e) => {
    const { checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      shirtIncludeSize: checked, // This directly controls the checkbox state
      shirtIncludeSizeDescription: checked ? prevData.shirtIncludeSizeDescription : '', // Clear if unchecked
    }));
  };

  const handleSubmit = async (e)  => {
    e.preventDefault();

    // --- Validation Checks ---
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
    // Check if location is still 'Select Location' or empty string
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

    // if (formData.emailOtherChecked && !formData.emailOther.trim()) {
    //   alert('Please specify the "Other" email group.');
    //   return;
    // }

    // --- Data Transformation to Backend Format ---
    const now = new Date();
    // Format timestamp for DATETIME2() as per DB schema
    // Example: "2025-06-13 12:48:57.9866667"
    const currentTimestamp = now.toISOString()
      .replace('T', ' ')
      .replace('Z', '')
      .split('.')[0] + '.' + now.getMilliseconds().toString().padStart(3, '0') + '0000'; // Appending 4 zeros for 7 decimal places precision


    const transformedData = {
      Type: formData.type,
      ProjectedStartDate: formData.projectedStartDate, // YYYY-MM-DD
      LegalFirstName: formData.legalFirstName,
      LegalMiddleName: formData.legalMiddleName || null, // Not Required, send null if empty
      LegalLastName: formData.legalLastName,
      Suffix: formData.suffix || null, // Not Required, send null if empty
      PositionTitle: formData.positionTitle,
      Manager: formData.manager,
      Department: formData.department,
      Location: formData.location,
      PayRateType: formData.payRateType === 'Yearly' ? 'Salary' : 'Hourly', // Map 'Yearly' to 'Salary' for DB
      PayRate: parseFloat(formData.payRate), // Send as number for DECIMAL DB type
      AdditionType: formData.additionType,
      IsReHire: formData.isRehire === 'Yes', // Convert to BIT (true/false)
      IsDriver: formData.isDriver ? 1 : 0,

      // Directly mapped BIT fields
      EmployeeID_Requested: formData.employeeID_Requested,
      PurchasingCard_Requested: formData.purchasingCard_Requested,
      GasCard_Requested: formData.gasCard_Requested,
      EmailAddress_Provided: formData.emailAddress_Provided,
      MobilePhone_Requested: formData.mobilePhone_Requested,
      TLCBonusEligible: formData.tlcBonusEligible,
      NoteField: formData.noteField, // NoteField will consolidate frontend descriptions if needed

      Createdby: "Frontend_User", // This will likely come from actual user auth
      CreatedAt: currentTimestamp,
      // Id and UpdatedAt are handled by the database
    };

    // Concatenate descriptions into NoteField if needed, or send as separate fields
    // This depends on whether your DB wants individual description columns or one big note field
    // For simplicity, let's assume they are consolidated if DB only has 'NoteField'
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
    // if (formData.emailOtherChecked && formData.emailOther) fullNoteField += `\nOther Email Distribution: ${formData.emailOther}`;
    if (formData.adminSpField && formData.type === 'Admin') fullNoteField += `\nAdmin Specific Field: ${formData.adminSpField}`;

    // Update the NoteField in the transformedData
    transformedData.NoteField = fullNoteField.trim();

    // *** Keep this console.log for full data inspection in dev tools ***
    console.log('Transformed Data for Submission (console):', JSON.stringify(transformedData, null, 2));

    // *** Double Confirmation Step (with potentially truncated display) ***
    const userConfirmed = window.confirm(
      "Are you sure you want to submit this request? \n\n" +
      "Click OK to confirm, or Cancel to review details in the console (F12)."
    );

    if (userConfirmed) {
      console.log('User confirmed submission. Data will now be sent to SQL (or API):', transformedData);
      try {
        const response = await fetch('http://127.0.0.1:5000/api/submissions', { // Ensure this URL matches your Flask server
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transformedData),
        });

        if (response.ok) { // Check if the response status is 2xx
          const result = await response.json();
          alert(result.message || 'Request submitted successfully!');
          console.log('Submission success:', result);
          // Optionally, reset the form after successful submission
          // setFormData(initialState); // You'd define an initialState object
        } else {
          const errorData = await response.json();
          alert(errorData.error || 'Failed to submit request.');
          console.error('Submission error:', errorData);
        }
      } catch (error) {
        alert('There was an error connecting to the server or processing your request.');
        console.error('Network or unexpected error during submission:', error);
      }
    } else {
      console.log('User cancelled submission.');
      // alert('Submission cancelled.'); // Optional: alert cancellation
    }
  };

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
        <h1 className="form-title">New Hire Request Form</h1>

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
                  <option value="Full-time">Full-time</option> {/* Added as per DB suggestion */}
                  <option value="Part-time">Part-time</option> {/* Added as per DB suggestion */}
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
            {/* <div className="form-field-group">
              <label htmlFor="emailAddress_Provided" className="form-label">New Hire Email Address</label>
              <input
                type="email"
                id="emailAddress_Provided"
                name="emailAddress_Provided"
                value={formData.emailAddress_Provided}
                onChange={handleChange}
                className="form-input"
                placeholder="e.g., jane.doe@guardian.com"
              />
            </div> */}
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

              {/* Other Checkbox and conditionally rendered extended Text Area */}
              {/* <div className="checkbox-group full-width">
                <div className="other-option">
                  <input
                    type="checkbox"
                    id="emailOtherChecked"
                    name="emailOtherChecked"
                    checked={formData.emailOtherChecked}
                    onChange={handleOtherCheckboxChange}
                    className="checkbox-input"
                  />
                  <label htmlFor="emailOtherChecked" className="checkbox-label">Other</label>
                </div>
                {formData.emailOtherChecked && (
                  <textarea
                    id="emailOther"
                    name="emailOther"
                    value={formData.emailOther}
                    onChange={handleChange}
                    className="form-textarea extended-textarea"
                    rows="6"
                    placeholder="Enter other email distribution lists, one per line or separated by commas."
                  ></textarea>
                )}
              </div> */}
            </div>
          </>

          {/* Step 3: Admin/Field */}
          <>
            <h2 className="form-section-title">Admin/Field Information</h2>
            <div className="admin-table-container">
              <table className="admin-features-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Choose</th>
                    <th>Description</th>
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
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        id="employeeID_RequestedDescription"
                        name="employeeID_RequestedDescription"
                        value={formData.employeeID_RequestedDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input table-input"
                        placeholder="Add description..."
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
                    </td>
                    <td>
                      <input
                        type="text"
                        id="purchasingCard_RequestedDescription"
                        name="purchasingCard_RequestedDescription"
                        value={formData.purchasingCard_RequestedDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input table-input"
                        placeholder="Add description..."
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
                    </td>
                    <td>
                      <input
                        type="text"
                        id="gasCard_RequestedDescription"
                        name="gasCard_RequestedDescription"
                        value={formData.gasCard_RequestedDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input table-input"
                        placeholder="Add description..."
                      />
                    </td>
                  </tr>
                  {/* Email Address (Admin Provisioning) */}
                  <tr>
                    <td>Email Address</td>
                    <td>
                      <input
                        type="checkbox"
                        id="emailAddress_Provided" // Renamed from adminEmailAddress
                        name="emailAddress_Provided"
                        checked={formData.emailAddress_Provided}
                        onChange={handleDbCheckboxChange}
                        className="checkbox-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        id="emailAddress_ProvidedDescription"
                        name="emailAddress_ProvidedDescription"
                        value={formData.emailAddress_ProvidedDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input table-input"
                        placeholder="Add description (e.g., specific format, aliases)..."
                      />
                    </td>
                  </tr>
                  {/* Mobile Phone */}
                  {formData.type === 'Admin' && ( // Only display for Admin Type as per DB comment
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
                      </td>
                      <td>
                        <input
                          type="text"
                          id="mobilePhone_RequestedDescription"
                          name="mobilePhone_RequestedDescription"
                          value={formData.mobilePhone_RequestedDescription}
                          onChange={handleDescriptionInputChange}
                          className="form-input table-input"
                          placeholder="Add description..."
                        />
                      </td>
                    </tr>
                  )}
                  {/* Shirt (Include size) - Not directly a DB column, relates to NoteField */}
                  {/* <tr>
                    <td>Shirt (Include size)</td>
                    <td>
                      <input
                        type="checkbox"
                        id="shirtIncludeSize"
                        name="shirtIncludeSize"
                        checked={formData.shirtIncludeSize}
                        onChange={handleShirtCheckboxChange}
                        className="checkbox-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        id="shirtIncludeSizeDescription"
                        name="shirtIncludeSizeDescription"
                        value={formData.shirtIncludeSizeDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input table-input"
                        placeholder="Enter size (e.g., M, L, XL)"
                        disabled={!formData.shirtIncludeSize}
                      />
                    </td>
                  </tr> */}
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
                    </td>
                    <td>
                      <input
                        type="text"
                        id="tlcBonusEligibleDescription"
                        name="tlcBonusEligibleDescription"
                        value={formData.tlcBonusEligibleDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input table-input"
                        placeholder="Add description..."
                      />
                    </td>
                  </tr>
                  {/* VPN Access - Not in DB schema provided */}
                  {/* <tr>
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
                    </td>
                    <td>
                      <input
                        type="text"
                        id="vpnAccessDescription"
                        name="vpnAccessDescription"
                        value={formData.vpnAccessDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input table-input"
                        placeholder="Add description..."
                      />
                    </td>
                  </tr> */}
                  {/* Wifi Domain - Not in DB schema provided */}
                  {/* <tr>
                    <td>Wifi Domain</td>
                    <td>
                      <input
                        type="checkbox"
                        id="wifiDomain"
                        name="wifiDomain"
                        checked={formData.wifiDomain}
                        onChange={handleDbCheckboxChange}
                        className="checkbox-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        id="wifiDomainDescription"
                        name="wifiDomainDescription"
                        value={formData.wifiDomainDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input table-input"
                        placeholder="Add description..."
                      />
                    </td>
                  </tr> */}
                  {/* Citrix Access - Not in DB schema provided */}
                  {/* <tr>
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
                    </td>
                    <td>
                      <input
                        type="text"
                        id="citrixAccessDescription"
                        name="citrixAccessDescription"
                        value={formData.citrixAccessDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input table-input"
                        placeholder="Add description..."
                      />
                    </td>
                  </tr> */}
                  {/* Op Access - Not in DB schema provided */}
                  {/* <tr>
                    <td>Op Access</td>
                    <td>
                      <input
                        type="checkbox"
                        id="opAccess"
                        name="opAccess"
                        checked={formData.opAccess}
                        onChange={handleDbCheckboxChange}
                        className="checkbox-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        id="opAccessDescription"
                        name="opAccessDescription"
                        value={formData.opAccessDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input table-input"
                        placeholder="Add description..."
                      />
                    </td>
                  </tr> */}
                  {/* Computer - Not in DB schema provided */}
                  {/* <tr>
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
                    </td>
                    <td>
                      <input
                        type="text"
                        id="computerDescription"
                        name="computerDescription"
                        value={formData.computerDescription}
                        onChange={handleDescriptionInputChange}
                        className="form-input table-input"
                        placeholder="Add description..."
                      />
                    </td>
                  </tr> */}
                </tbody>
              </table>
            </div>

            {/* Note Field (textarea) */}
            <div className="form-field-group">
              <label htmlFor="noteField" className="form-label">Notes/Comments</label>
              <textarea
                id="noteField"
                name="noteField"
                value={formData.noteField}
                onChange={handleChange}
                className="form-textarea"
                rows="4"
                placeholder="Add any additional notes here..."
              ></textarea>
            </div>
          </>

          {/* Navigation Buttons (Submit) */}
          <div className="form-navigation">
            <button type="submit" className="form-button primary-button">
              Submit
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default App;