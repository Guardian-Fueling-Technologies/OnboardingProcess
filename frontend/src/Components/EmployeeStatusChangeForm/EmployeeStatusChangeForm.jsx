import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './EmployeeStatusChangeForm.css'; // Make sure this path is correct
import api from '../config'; // Assuming you have an axios instance configured here

/**
 * Helper function to format a Date object into MM/DD/YY.
 * @param {Date} date - The Date object to format.
 * @returns {string} Formatted date string (e.g., "01/03/25").
 */
const formatDateToMMDDYY = (date) => {
    if (!date) {
        return '';
    }
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2); // Get last two digits
    return `${month}/${day}/${year}`;
};

/**
 * Generates a list of payroll dates and their corresponding pay periods
 * starting from a specified effective date string up to the end of a target year.
 *
 * Pattern:
 * - Pay Day is a Friday.
 * - Pay Period is 13 days long.
 * - Pay Day occurs 20 days after the start of the pay period.
 *
 * @param {string} startEffectiveDateStr - The first effective pay date to start from (YYYY-MM-DD).
 * Must be a Friday.
 * @param {number} endYear - The last year for which to generate payroll dates.
 * @returns {Array<Object>} A list of objects with value and label for dropdowns.
 * (e.g., [{ value: "01/03/25 (12/14/24-12/27/24)", label: "01/03/25 (12/14/24-12/27/24)" }])
 */

const generatePayrollDatesRange = (startEffectiveDateStr = '2025-01-03', displayStartEffectiveDateStr = null, endYear = 2028) => {
  const payrollList = [{ value: "", label: "Choose an item." }]; // Initial default option

  // Parse the initial effective date string into a Date object.
  // Using setHours(12) to avoid potential timezone issues with UTC/local time conversions.
  const startParts = startEffectiveDateStr.split('-').map(Number);
  let currentEffectiveDate = new Date(startParts[0], startParts[1] - 1, startParts[2], 12, 0, 0); // Month is 0-indexed

  // Parse the display start date if provided for filtering
  let displayStartDateFilter = null;
  if (displayStartEffectiveDateStr) {
      const displayStartParts = displayStartEffectiveDateStr.split('-').map(Number);
      displayStartDateFilter = new Date(displayStartParts[0], displayStartParts[1] - 1, displayStartParts[2], 12, 0, 0);
  }

  // Ensure the startEffectiveDate is indeed a Friday (getDay() returns 5 for Friday)
  if (currentEffectiveDate.getDay() !== 5) {
      console.error("Error: The startEffectiveDateStr must correspond to a Friday.");
      // In a real application, you might want to provide a fallback or more robust error handling
      return [{ value: "", label: "Error: Invalid start date." }]; 
  }

  // Generate dates until the effective date crosses into the year after endYear
  // We add a buffer of 14 days (one payroll period) to ensure we capture the last dates of endYear.
  while (currentEffectiveDate.getFullYear() <= endYear || 
         (currentEffectiveDate.getFullYear() === endYear && currentEffectiveDate.getMonth() < 12)) {
      
      // Calculate Pay Period End Date: 7 days before Effective Pay Date
      const periodEndDate = new Date(currentEffectiveDate.getTime());
      periodEndDate.setDate(currentEffectiveDate.getDate() - 7);

      // Calculate Pay Period Start Date: 13 days before Pay Period End Date
      const periodStartDate = new Date(periodEndDate.getTime());
      periodStartDate.setDate(periodEndDate.getDate() - 13);

      const effectiveDateStr = formatDateToMMDDYY(currentEffectiveDate);
      const periodStartStr = formatDateToMMDDYY(periodStartDate);
      const periodEndStr = formatDateToMMDDYY(periodEndDate);

      const label = `${effectiveDateStr} (${periodStartStr}-${periodEndStr})`;

      // Only add to list if the current effective date is on or after the displayStartEffectiveDateStr
      if (!displayStartDateFilter || currentEffectiveDate.getTime() >= displayStartDateFilter.getTime()) {
          payrollList.push({ value: label, label: label });
      }

      // Move to the next effective payroll date (2 weeks later)
      currentEffectiveDate.setDate(currentEffectiveDate.getDate() + 14);
  }

  return payrollList;
};


const EmployeeStatusChangeForm = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  const presentDateFormatted = `${year}-${month}-${day}`;

  // Generate payroll dates once when the component mounts
  // This will be a local variable for this component instance
  const payrollDates = generatePayrollDatesRange(
      '2025-01-03', // Start generating from this date (must be a Friday)
      presentDateFormatted, // Display dates from the present date onwards
      2028          // Generate dates up to the end of this year
  );

  const positionCodeOptions = [
    { value: "", label: "Choose an item." },
    { value: "20101 - Field Service or Field Fuel Guard", label: "20101 - Field Service or Field Fuel Guard" },
    { value: "52100 - Field Projects or Field Construction", label: "52100 - Field Projects or Field Construction" },
    { value: "60000 - Sales", label: "60000 - Sales" },
    { value: "80000 - Admin", label: "80000 - Admin" },
  ];

  // Options for newBranch dropdown (still needed for 'New Branch')
  const locationOptions = [
    { value: "", label: "Choose an item." },
    { value: "100 - Corporate Admin, FL", label: "100 - Corporate Admin, FL" },
    { value: "101 - Jacksonville, FL", label: "101 - Jacksonville, FL" },
    { value: "102 - Sanford, FL", label: "102 - Sanford, FL" },
    { value: "103 - Tampa, FL", label: "103 - Tampa, FL" },
    { value: "104 - Ft. Lauderdale, FL", label: "104 - Ft. Lauderdale, FL" },
    { value: "105 - Savannah, GA", label: "105 - Savannah, GA" },
    { value: "106 - Ft Myers, FL", label: "106 - Ft Myers, FL" },
    { value: "107 - Construction Southeast, FL", label: "107 - Construction Southeast, FL" },
    { value: "108 - Gulf Coast Pensacola, FL", label: "108 - Gulf Coast Pensacola, FL" },
    { value: "109 - Safeguard, FL", label: "109 - Safeguard, FL" },
    { value: "110 - Guardian Connect, FL", label: "110 - Guardian Connect, FL" },
    { value: "111 - Tallahassee, FL", label: "111 - Tallahassee, FL" },
    { value: "113 - Communications South Atlantic, FL", label: "113 - Communications South Atlantic, FL" },
    { value: "115 - Birmingham, AL", label: "115 - Birmingham, AL" },
    { value: "120 - Columbia, SC", label: "120 - Columbia, SC" },
    { value: "125 - Raleigh, NC", label: "125 - Raleigh, NC" },
    { value: "130 - Greensboro, NC", label: "130 - Greensboro, NC" },
    { value: "135 - Charlotte, NC", label: "135 - Charlotte, NC" },
    { value: "140 - Atlanta, GA", label: "140 - Atlanta, GA" },
    { value: "145 - Knoxville, TN", label: "145 - Knoxville, TN" },
    { value: "147 - Nesbit, MS (Near Memphis, TN)", label: "147 - Nesbit, MS (Near Memphis, TN)" },
    { value: "150 - Nashville, TN", label: "150 - Nashville, TN" },
    { value: "155 - Richmond, VA", label: "155 - Richmond, VA" },
    { value: "160 - Lafayette, Louisiana", label: "160 - Lafayette, Louisiana" },
    { value: "165 - Roanoke, VA", label: "165 - Roanoke, VA" },
    { value: "170 - Houston, TX", label: "170 - Houston, TX" },
    { value: "175 - Central Texas", label: "175 - Central Texas" },
    { value: "180 - Tulsa, Oklahoma", label: "180 - Tulsa, Oklahoma" },
    { value: "185 - Oklahoma City, Oklahoma", label: "185 - Oklahoma City, Oklahoma" },
    { value: "190 - Denver, CO", label: "190 - Denver, CO" },
    { value: "200 - Mid Atlantic Corp Admin", label: "200 - Mid Atlantic Corp Admin" },
    { value: "300 - Southeast Corporate", label: "300 - Southeast Corporate" },
  ];

  // Options for newDepartment dropdown (still needed for 'New Department')
  const departmentOptions = [
    { value: "", label: "Choose an item." },
    { value: "00 - Admin", label: "00 - Admin" },
    { value: "10 - Parts", label: "10 - Parts" },
    { value: "20 - Service", label: "20 - Service" },
    { value: "21 - Fuel Guard", label: "21 - Fuel Guard" },
    { value: "22 - Projects", label: "22 - Projects" },
    { value: "25 - Guardian Connect", label: "25 - Guardian Connect" },
    { value: "30 - Construction", label: "30 - Construction" },
  ];

  const initialState = {
    employeeName: '',
    effectiveDate: '', // Will store the selected dropdown value
    employeeTitle: '',
    positionCode: '',
    location: '',
    department: '',
    supervisor: '',
    employeeId: '',

    currentRate: '',
    newRate: '',
    rateReason: '',

    newTitle: '',
    newSupervisor: '',
    newBranch: '',
    newDepartment: '',
    newPositionCode: '',
    comments: '',

    compType: '',
    compAmount: '',
    compNotes: '',

    approvals: {
      supervisorSignature: '',
      supervisorDate: '',
      nextManagerSignature: '',
      nextManagerDate: '',
      svpHrSignature: '',
      svpHrDate: '',
    },
  };

  const [formData, setFormData] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Function to parse the effective date from the dropdown string
  // Returns BIP-MM-DD for backend compatibility
  const parseEffectiveDateString = (dateString) => {
    // Expects "MM/DD/YY (MM/DD/YY-MM/DD/YY)" or "MM/DD/YYYY (MM/DD/YYYY-MM/DD/YYYY)"
    if (!dateString || dateString === "Choose an date.") {
      return null;
    }
    const effectiveDatePart = dateString.split(' ')[0]; // "MM/DD/YY" or "MM/DD/YYYY"
    const parts = effectiveDatePart.split('/');
    if (parts.length !== 3) return null;

    let [month, day, year] = parts;
    if (year.length === 2) {
        year = `20${year}`; // Convert 'YY' to '20YY'
    }

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const submissionId = queryParams.get('id');

    if (submissionId) {
      console.log(`Loading data for submission ID: ${submissionId}`);
      setLoading(true);
      setError(null);

      api.get(`/api/submissions/${submissionId}`)
        .then(response => {
          const fetchedData = response.data;
          if (fetchedData) {
            const updatedFormData = {
              ...initialState, // Start with initial state to ensure all fields are covered
              employeeName: `${fetchedData.LegalFirstName || ''} ${fetchedData.LegalLastName || ''}`.trim(),
              employeeId: fetchedData.Id ? String(fetchedData.Id) : '',
              
              employeeTitle: fetchedData.PositionTitle || '',
              positionCode: fetchedData.PositionCode || '', 
              location: fetchedData.Location || '',
              department: fetchedData.Department || '',
              supervisor: fetchedData.Manager || '',

              currentRate: fetchedData.PayRate ? String(fetchedData.PayRate) : '',
              rateReason: fetchedData.RateReason || '',

              newTitle: fetchedData.NewTitle || '',
              newSupervisor: fetchedData.NewSupervisor || '',
              newBranch: fetchedData.NewBranch || fetchedData.Location || '', 
              newDepartment: fetchedData.NewDepartment || fetchedData.Department || '',
              newPositionCode: fetchedData.NewPositionCode || fetchedData.PositionCode || '',
              comments: fetchedData.NoteField || '',

              compType: fetchedData.CompType || '',
              compAmount: fetchedData.CompAmount ? String(fetchedData.CompAmount) : '',
              compNotes: fetchedData.CompNotes || '',

              approvals: {
                supervisorSignature: fetchedData.SupervisorSignature || '',
                supervisorDate: fetchedData.SupervisorDate || '',
                nextManagerSignature: fetchedData.NextManagerSignature || '',
                nextManagerDate: fetchedData.NextManagerDate || '',
                svpHrSignature: fetchedData.SvpHrSignature || '',
                svpHrDate: fetchedData.SvpHrDate || '',
              },
            };

            // Logic to pre-select the effectiveDate dropdown
            if (fetchedData.ProjectedStartDate) {
              const fetchedDate = new Date(fetchedData.ProjectedStartDate);
              const formattedFetchedDate = fetchedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
              
              const matchingPayrollOption = payrollDates.find(option =>
                option.value.startsWith(formattedFetchedDate)
              );
              updatedFormData.effectiveDate = matchingPayrollOption ? matchingPayrollOption.value : "";
            }
            
            setFormData(updatedFormData);
            setLoading(false);

          } else {
            console.warn("No data returned for submission ID:", submissionId);
            setError("No data found for this submission ID.");
            setLoading(false);
          }
        })
        .catch(err => {
          console.error("Error fetching submission:", err);
          setError("Failed to load submission data. Please ensure the backend is running and the ID is valid.");
          setLoading(false);
        });
    } else {
      setFormData(initialState); // Reset form if no ID is provided
    }
  }, [location.search, api, payrollDates]); // Added payrollDates to dependency array

  const handleChange = (e) => {
    const { name, value } = e.target;

    setError(null);
    setSuccess(false);

    if (name.startsWith('approvals.')) {
      const [parentKey, childKey] = name.split('.');
      setFormData(prevData => ({
        ...prevData,
        [parentKey]: {
          ...prevData[parentKey],
          [childKey]: value,
        },
      }));
    } else {
      setFormData(prevData => ({
        ...prevData,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const fieldsToExclude = ['comments', 'compNotes', 'newRate', 'newTitle', 'newSupervisor', 'newBranch', 'newDepartment', 'newPositionCode', 'currentRate', 'rateReason', 'compType', 'compAmount'];
    let formIsValid = true;
    let errorMessage = '';

    // Validate main required fields (Employee Name, Employee ID, Effective Payroll Date, Approval Signatures/Dates)
    const requiredMainFields = ['employeeName', 'employeeId'];
    for (const field of requiredMainFields) {
        if (!formData[field].trim()) {
            errorMessage = `${field.replace(/([A-Z])/g, ' $1').trim()} is required.`;
            formIsValid = false;
            break;
        }
    }

    if (formIsValid && (formData.effectiveDate === "" || formData.effectiveDate === "Choose an date.")) {
      errorMessage = "Effective Payroll Date is required.";
      formIsValid = false;
    }

    // Validate nested approvals fields
    if (formIsValid) {
      for (const key in formData.approvals) {
        if (!formData.approvals[key].trim()) {
          errorMessage = `Approval field ${key.replace(/([A-Z])/g, ' $1').trim()} is required.`;
          formIsValid = false;
          break;
        }
      }
    }

    if (!formIsValid) {
      setError(errorMessage);
      setLoading(false);
      return;
    }

    // --- Specific Date Validation (after general required check) ---
    const effectiveDateForValidation = parseEffectiveDateString(formData.effectiveDate);

    if (!effectiveDateForValidation) {
      setError('Invalid Effective Payroll Date. Please choose a valid date from the dropdown.');
      setLoading(false);
      return;
    }

    const selectedDateObj = new Date(effectiveDateForValidation + 'T12:00:00'); // Add time to avoid timezone issues
    if (isNaN(selectedDateObj.getTime())) {
      setError('Invalid Effective Payroll Date. Please choose a valid date from the dropdown.');
      setLoading(false);
      return;
    }

    const dayOfWeek = selectedDateObj.getDay(); // Sunday is 0, Saturday is 6
    if (dayOfWeek === 0 || dayOfWeek === 6) { 
      setError('The Effective Payroll Date cannot be a weekend. Please choose a weekday.');
      setLoading(false);
      return;
    }
    // --- End Date Validation ---

    try {
      const dataToSend = {
        ...formData,
        effectiveDate: effectiveDateForValidation, // Send BIP-MM-DD to backend
        ...formData.approvals
      };
      delete dataToSend.approvals; // Remove nested approvals object

      console.log('Submitting Employee Status Change Form Data:', dataToSend);
      
      const queryParams = new URLSearchParams(location.search);
      const submissionId = queryParams.get('id');

      let response;
      if (submissionId) {
        response = await api.put(`/api/submissions/${submissionId}`, dataToSend); 
      } else {
        response = await api.post('/api/employee-status-changes', dataToSend);
      }

      console.log('Submission successful:', response.data);
      setSuccess(true);
      // Optionally reset form: setFormData(initialState); 
    } catch (err) {
      console.error("API Call Error:", err);
      if (err.response) {
        console.error("Server Response Data:", err.response.data);
        console.error("Server Response Status:", err.response.status);
        if (typeof err.response.data === 'string' && err.response.data.startsWith('<!doctype html>')) {
          setError(`Unexpected HTML response from server. Endpoint might be incorrect or server had an internal error (Status: ${err.response.status}).`);
        } else {
          setError(`Server error: ${err.response.status} - ${err.response.data.message || JSON.stringify(err.response.data) || 'Please try again.'}`);
        }
      } else if (err.request) {
        setError('No response from server. Please check your network connection and backend server status.');
      } else {
        setError(`Request error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    navigate(-1);
  };

  return (
    <div className="page-container">
      <header className="header">
        <div className="header-logo">GUARDIAN <span className="logo-subtext">PLATFORM TECHNOLOGIES</span></div>
        <nav>
          <a onClick={handleBackClick} className="header-nav-link">
            Back
          </a>
        </nav>
      </header>

      <main className="form-main-content">
        <h1 className="form-title">Employee Status Change Request Form – 2025</h1>

        <div className="form-page-container">
          <form onSubmit={handleSubmit} className="status-change-form">

            <div className="form-section">
              <h4>Employee Details</h4>
              <div className="form-grid">
                <div className="form-field-group">
                  <label htmlFor="employeeName" className="form-label">Employee Name (Legal):</label>
                  <input type="text" id="employeeName" name="employeeName" value={formData.employeeName} onChange={handleChange} className="form-input" required />
                </div>
                <div className="form-field-group">
                  <label htmlFor="effectiveDate" className="form-label">Effective Payroll Date:</label>
                  <select
                    id="effectiveDate"
                    name="effectiveDate"
                    value={formData.effectiveDate}
                    onChange={handleChange}
                    className="form-select" // Using form-select class for dropdown styling
                    required
                  >
                    {payrollDates.map((option, index) => (
                      <option key={index} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field-group">
                  <label htmlFor="employeeTitle" className="form-label">Current Employee Title:</label>
                  <input type="text" id="employeeTitle" name="employeeTitle" value={formData.employeeTitle} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-field-group">
                  <label htmlFor="positionCode" className="form-label">Position Code:</label>
                  <select
                    id="positionCode"
                    name="positionCode"
                    value={formData.positionCode}
                    onChange={handleChange}
                    className="form-select"
                  >
                    {positionCodeOptions.map((option, index) => (
                      <option key={index} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field-group">
                  <label htmlFor="location" className="form-label">Location/Branch:</label>
                  <select
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="form-select"
                  >
                    {locationOptions.map((option, index) => (
                      <option key={index} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field-group">
                  <label htmlFor="department" className="form-label">Department:</label>
                  <select
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="form-select"
                  >
                    {departmentOptions.map((option, index) => (
                      <option key={index} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field-group">
                  <label htmlFor="supervisor" className="form-label">Current Supervisor Name:</label>
                  <input type="text" id="supervisor" name="supervisor" value={formData.supervisor} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-field-group">
                  <label htmlFor="employeeId" className="form-label">Employee #:</label>
                  <input type="text" id="employeeId" name="employeeId" value={formData.employeeId} onChange={handleChange} className="form-input" />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4>Rate Change Details</h4>
              <div className="form-grid">
                <div className="form-field-group">
                  <label htmlFor="currentRate" className="form-label">Current Rate:</label>
                  <input type="text" id="currentRate" name="currentRate" value={formData.currentRate} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-field-group">
                  <label htmlFor="newRate" className="form-label">New Rate:</label>
                  <input type="text" id="newRate" name="newRate" value={formData.newRate} onChange={handleChange} className="form-input" />
                </div>
              </div>
              <div className="form-field-group">
                <label htmlFor="rateReason" className="form-label">Reason for Rate Change:</label>
                <textarea id="rateReason" name="rateReason" value={formData.rateReason} onChange={handleChange} className="form-textarea" rows="3" />
              </div>
            </div>

            <div className="form-section">
              <h4>Title/Department Change Details</h4>
              <div className="form-grid">
                <div className="form-field-group">
                  <label htmlFor="newTitle" className="form-label">New Title:</label>
                  <input type="text" id="newTitle" name="newTitle" value={formData.newTitle} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-field-group">
                  <label htmlFor="newSupervisor" className="form-label">New Supervisor:</label>
                  <input type="text" id="newSupervisor" name="newSupervisor" value={formData.newSupervisor} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-field-group">
                  <label htmlFor="newBranch" className="form-label">New Branch:</label>
                  <select id="newBranch" name="newBranch" value={formData.newBranch} onChange={handleChange} className="form-select">
                    <option value="">Choose an item.</option>
                    <option value="100 - Corporate Admin, FL">100 - Corporate Admin, FL</option>
                    <option value="101 - Jacksonville, FL">101 - Jacksonville, FL</option>
                    <option value="102 - Sanford, FL">102 - Sanford, FL</option>
                    <option value="103 - Tampa, FL">103 - Tampa, FL</option>
                    <option value="104 - Ft. Lauderdale, FL">104 - Ft. Lauderdale, FL</option>
                    <option value="105 - Savannah, GA">105 - Savannah, GA</option>
                    <option value="106 - Ft Myers, FL">106 - Ft Myers, FL</option>
                    <option value="107 - Construction Southeast, FL">107 - Construction Southeast, FL</option>
                    <option value="108 - Gulf Coast Pensacola, FL">108 - Gulf Coast Pensacola, FL</option>
                    <option value="109 - Safeguard, FL">109 - Safeguard, FL</option>
                    <option value="110 - Guardian Connect, FL">110 - Guardian Connect, FL</option>
                    <option value="111 - Tallahassee, FL">111 - Tallahassee, FL</option>
                    <option value="113 - Communications South Atlantic, FL">113 - Communications South Atlantic, FL</option>
                    <option value="115 - Birmingham, AL">115 - Birmingham, AL</option>
                    <option value="120 - Columbia, SC">120 - Columbia, SC</option>
                    <option value="125 - Raleigh, NC">125 - Raleigh, NC</option>
                    <option value="130 - Greensboro, NC">130 - Greensboro, NC</option>
                    <option value="135 - Charlotte, NC">135 - Charlotte, NC</option>
                    <option value="140 - Atlanta, GA">140 - Atlanta, GA</option>
                    <option value="145 - Knoxville, TN">145 - Knoxville, TN</option>
                    <option value="147 - Nesbit, MS (Near Memphis, TN)">147 - Nesbit, MS (Near Memphis, TN)</option>
                    <option value="150 - Nashville, TN">150 - Nashville, TN</option>
                    <option value="155 - Richmond, VA">155 - Richmond, VA</option>
                    <option value="160 - Lafayette, Louisiana">160 - Lafayette, Louisiana</option>
                    <option value="165 - Roanoke, VA">165 - Roanoke, VA</option>
                    <option value="170 - Houston, TX">170 - Houston, TX</option>
                    <option value="175 - Central Texas">175 - Central Texas</option>
                    <option value="180 - Tulsa, Oklahoma">180 - Tulsa, Oklahoma</option>
                    <option value="185 - Oklahoma City, Oklahoma">185 - Oklahoma City, Oklahoma</option>
                    <option value="190 - Denver, CO">190 - Denver, CO</option>
                    <option value="200 - Mid Atlantic Corp Admin">200 - Mid Atlantic Corp Admin</option>
                    <option value="300 - Southeast Corporate">300 - Southeast Corporate</option>
                  </select>
                </div>
                <div className="form-field-group">
                  <label htmlFor="newDepartment" className="form-label">New Department:</label>
                  <select id="newDepartment" name="newDepartment" value={formData.newDepartment} onChange={handleChange} className="form-select">
                    <option value="">Choose an item.</option>
                    <option value="00 - Admin">00 - Admin</option>
                    <option value="10 - Parts">10 - Parts</option>
                    <option value="20 - Service">20 - Service</option>
                    <option value="21 - Fuel Guard">21 - Fuel Guard</option>
                    <option value="22 - Projects">22 - Projects</option>
                    <option value="25 - Guardian Connect">25 - Guardian Connect</option>
                    <option value="30 - Construction">30 - Construction</option>
                  </select>
                </div>
              </div>
              <div className="form-field-group">
                <label htmlFor="newPositionCode" className="form-label">New Position Code:</label>
                <select id="newPositionCode" name="newPositionCode" value={formData.newPositionCode} onChange={handleChange} className="form-select">
                  <option value="">Choose an item.</option>
                  <option value="20101 - Field Service or Field Fuel Guard">20101 - Field Service or Field Fuel Guard</option>
                  <option value="52100 - Field Projects or Field Construction">52100 - Field Projects or Field Construction</option>
                  <option value="60000 - Sales">60000 - Sales</option>
                  <option value="80000 - Admin">80000 - Admin</option>
                </select>
              </div>
              <div className="form-field-group">
                <label htmlFor="comments" className="form-label">Comments:</label>
                <textarea id="comments" name="comments" value={formData.comments} onChange={handleChange} className="form-textarea" rows="4" />
              </div>
            </div>

            <div className="form-section">
              <h4>Specialized/Additional Compensation Details</h4>
              <div className="form-grid">
                <div className="form-field-group">
                  <label htmlFor="compType" className="form-label">Type of Compensation:</label>
                  <input type="text" id="compType" name="compType" value={formData.compType} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-field-group">
                  <label htmlFor="compAmount" className="form-label">Amount:</label>
                  <input type="text" id="compAmount" name="compAmount" value={formData.compAmount} onChange={handleChange} className="form-input" />
                </div>
              </div>
              <div className="form-field-group">
                <label htmlFor="compNotes" className="form-label">Additional Notes:</label>
                <textarea id="compNotes" name="compNotes" value={formData.compNotes} onChange={handleChange} className="form-textarea" rows="3" />
              </div>
            </div>

            <div className="form-section">
              <h3>Approvals / Signatures</h3>
              <div className="form-grid">
                <div className="form-field-group">
                  <label htmlFor="supervisorSignature" className="form-label">Immediate Supervisor Signature:</label>
                  <input type="text" id="supervisorSignature" name="approvals.supervisorSignature" value={formData.approvals.supervisorSignature} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-field-group">
                  <label htmlFor="supervisorDate" className="form-label">Date:</label>
                  <input type="date" id="supervisorDate" name="approvals.supervisorDate" value={formData.approvals.supervisorDate} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-field-group">
                  <label htmlFor="nextManagerSignature" className="form-label">Next Level Manager Signature:</label>
                  <input type="text" id="nextManagerSignature" name="approvals.nextManagerSignature" value={formData.approvals.nextManagerSignature} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-field-group">
                  <label htmlFor="nextManagerDate" className="form-label">Date:</label>
                  <input type="date" id="nextManagerDate" name="approvals.nextManagerDate" value={formData.approvals.nextManagerDate} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-field-group">
                  <label htmlFor="svpHrSignature" className="form-label">SVP or HR Signature:</label>
                  <input type="text" id="svpHrSignature" name="approvals.svpHrSignature" value={formData.approvals.svpHrSignature} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-field-group">
                  <label htmlFor="svpHrDate" className="form-label">Date:</label>
                  <input type="date" id="svpHrDate" name="approvals.svpHrDate" value={formData.approvals.svpHrDate} onChange={handleChange} className="form-input" />
                </div>
              </div>
            </div>

            <div className="termination-note-container">
              <p className="termination-note-text">
                <strong className="termination-note-strong">Important:</strong> If processing a Termination, please email HR and do not use this form.
              </p>
            </div>

            {loading && <p className="form-message loading-message">Submitting...</p>}
            {error && <p className="form-message error-message">Error: {error}</p>}
            {success && <p className="form-message success-message">Form submitted successfully!</p>}

            <button type="submit" className="submit-button" disabled={loading}>Submit Request</button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default EmployeeStatusChangeForm;
