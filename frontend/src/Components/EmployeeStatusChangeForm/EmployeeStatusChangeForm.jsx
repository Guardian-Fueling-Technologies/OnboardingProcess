import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './EmployeeStatusChangeForm.css';
import api from '../config';
import { useAuth } from '../AuthContext'; 

/** Format Date -> MM/DD/YY */
const formatDateToMMDDYY = (date) => {
  if (!date) return '';
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${day}/${year}`;
};

/**
 * Generates payroll options:
 * - Pay day (effective date) is a Friday.
 * - Pay period: 13 days; pay day occurs 20 days after period start.
 */
const generatePayrollDatesRange = (
  startEffectiveDateStr = '2025-01-03',
  displayStartEffectiveDateStr = null,
  endYear = 2028
) => {
  const payrollList = [{ value: '', label: 'Choose an item.' }];

  const [y, m, d] = startEffectiveDateStr.split('-').map(Number);
  let currentEffectiveDate = new Date(y, m - 1, d, 12, 0, 0);

  let displayStartDateFilter = null;
  if (displayStartEffectiveDateStr) {
    const [dy, dm, dd] = displayStartEffectiveDateStr.split('-').map(Number);
    displayStartDateFilter = new Date(dy, dm - 1, dd, 12, 0, 0);
  }

  if (currentEffectiveDate.getDay() !== 5) {
    console.error('Error: startEffectiveDateStr must be a Friday.');
    return [{ value: '', label: 'Error: Invalid start date.' }];
  }

  while (currentEffectiveDate.getFullYear() <= endYear) {
    const periodEndDate = new Date(currentEffectiveDate.getTime());
    periodEndDate.setDate(currentEffectiveDate.getDate() - 7);

    const periodStartDate = new Date(periodEndDate.getTime());
    periodStartDate.setDate(periodEndDate.getDate() - 13);

    const effectiveDateStr = formatDateToMMDDYY(currentEffectiveDate);
    const periodStartStr = formatDateToMMDDYY(periodStartDate);
    const periodEndStr = formatDateToMMDDYY(periodEndDate);
    const label = `${effectiveDateStr} (${periodStartStr}-${periodEndStr})`;

    if (!displayStartDateFilter || currentEffectiveDate >= displayStartDateFilter) {
      payrollList.push({ value: label, label });
    }

    currentEffectiveDate.setDate(currentEffectiveDate.getDate() + 14);
  }

  return payrollList;
};

/** Map backend/selected strings to a <select> option value */
const resolveSelectValue = (options, incoming) => {
  if (!incoming) return '';
  // exact match
  let m = options.find((o) => o.value === incoming);
  if (m) return m.value;
  // code-only like "52100" -> "52100 - ..."
  m = options.find((o) =>
    o.value.toLowerCase().startsWith(incoming.toString().toLowerCase() + ' ')
  );
  if (m) return m.value;
  // name-only like "Raleigh, NC"
  m = options.find((o) =>
    o.label.toLowerCase().includes(incoming.toString().toLowerCase())
  );
  return m ? m.value : '';
};

/** Parse "MM/DD/YY (MM/DD/YY-MM/DD/YY)" -> "YYYY-MM-DD" */
const parseEffectiveDateString = (dateString) => {
  if (!dateString || dateString === 'Choose an item.') return null;
  const effectiveDatePart = dateString.split(' ')[0]; // "MM/DD/YY"
  const parts = effectiveDatePart.split('/');
  if (parts.length !== 3) return null;
  let [month, day, year] = parts;
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const EmployeeStatusChangeForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth(); 
  
  const authHeaders = useMemo(
    () => (user?.role_id ? { Authorization: `Bearer demo:${user.role_id}` } : {}),
    [user?.role_id]
  );

  // Freeze "today" for this mount to avoid time drift
  const presentDateFormatted = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
      t.getDate()
    ).padStart(2, '0')}`;
  }, []);

  // ✅ Memoize payroll dates so the reference is stable across renders
  const payrollDates = useMemo(
    () => generatePayrollDatesRange('2025-01-03', presentDateFormatted, 2028),
    [presentDateFormatted]
  );
  const nextPayday = payrollDates[1]?.value || ''; // first real option after placeholder

  // ✅ Memoize options so deps are stable
  const positionCodeOptions = useMemo(
    () => [
      { value: '', label: 'Choose an item.' },
      { value: '20101 - Field Service or Field Fuel Guard', label: '20101 - Field Service or Field Fuel Guard' },
      { value: '52100 - Field Projects or Field Construction', label: '52100 - Field Projects or Field Construction' },
      { value: '60000 - Sales', label: '60000 - Sales' },
      { value: '80000 - Admin', label: '80000 - Admin' },
    ],
    []
  );

  const locationOptions = useMemo(
    () => [
      { value: '', label: 'Choose an item.' },
      { value: '100 - Corporate Admin, FL', label: '100 - Corporate Admin, FL' },
      { value: '101 - Jacksonville, FL', label: '101 - Jacksonville, FL' },
      { value: '102 - Sanford, FL', label: '102 - Sanford, FL' },
      { value: '103 - Tampa, FL', label: '103 - Tampa, FL' },
      { value: '104 - Ft. Lauderdale, FL', label: '104 - Ft. Lauderdale, FL' },
      { value: '105 - Savannah, GA', label: '105 - Savannah, GA' },
      { value: '106 - Ft Myers, FL', label: '106 - Ft Myers, FL' },
      { value: '107 - Construction Southeast, FL', label: '107 - Construction Southeast, FL' },
      { value: '108 - Gulf Coast Pensacola, FL', label: '108 - Gulf Coast Pensacola, FL' },
      { value: '109 - Safeguard, FL', label: '109 - Safeguard, FL' },
      { value: '110 - Guardian Connect, FL', label: '110 - Guardian Connect, FL' },
      { value: '111 - Tallahassee, FL', label: '111 - Tallahassee, FL' },
      { value: '113 - Communications South Atlantic, FL', label: '113 - Communications South Atlantic, FL' },
      { value: '115 - Birmingham, AL', label: '115 - Birmingham, AL' },
      { value: '120 - Columbia, SC', label: '120 - Columbia, SC' },
      { value: '125 - Raleigh, NC', label: '125 - Raleigh, NC' },
      { value: '130 - Greensboro, NC', label: '130 - Greensboro, NC' },
      { value: '135 - Charlotte, NC', label: '135 - Charlotte, NC' },
      { value: '140 - Atlanta, GA', label: '140 - Atlanta, GA' },
      { value: '145 - Knoxville, TN', label: '145 - Knoxville, TN' },
      { value: '147 - Nesbit, MS (Near Memphis, TN)', label: '147 - Nesbit, MS (Near Memphis, TN)' },
      { value: '150 - Nashville, TN', label: '150 - Nashville, TN' },
      { value: '155 - Richmond, VA', label: '155 - Richmond, VA' },
      { value: '160 - Lafayette, Louisiana', label: '160 - Lafayette, Louisiana' },
      { value: '165 - Roanoke, VA', label: '165 - Roanoke, VA' },
      { value: '170 - Houston, TX', label: '170 - Houston, TX' },
      { value: '175 - Central Texas', label: '175 - Central Texas' },
      { value: '180 - Tulsa, Oklahoma', label: '180 - Tulsa, Oklahoma' },
      { value: '185 - Oklahoma City, Oklahoma', label: '185 - Oklahoma City, Oklahoma' },
      { value: '190 - Denver, CO', label: '190 - Denver, CO' },
      { value: '200 - Mid Atlantic Corp Admin', label: '200 - Mid Atlantic Corp Admin' },
      { value: '300 - Southeast Corporate', label: '300 - Southeast Corporate' },
    ],
    []
  );

  const departmentOptions = useMemo(
    () => [
      { value: '', label: 'Choose an item.' },
      { value: '00 - Admin', label: '00 - Admin' },
      { value: '10 - Parts', label: '10 - Parts' },
      { value: '20 - Service', label: '20 - Service' },
      { value: '21 - Fuel Guard', label: '21 - Fuel Guard' },
      { value: '22 - Projects', label: '22 - Projects' },
      { value: '25 - Guardian Connect', label: '25 - Guardian Connect' },
      { value: '30 - Construction', label: '30 - Construction' },
    ],
    []
  );

  const initialState = {
    employeeName: '',
    effectiveDate: '',
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

  // Load by ?id=... (overrides any prefill)
  useEffect(() => {
    const submissionId = new URLSearchParams(location.search).get('id');
    if (!submissionId) return;

    setLoading(true);
    setError(null);

    api
    .get(`/api/submissions/${submissionId}`, { headers: authHeaders }) 
      .then(({ data: f }) => {
        if (!f) {
          setError('No data found for this submission ID.');
          setLoading(false);
          return;
        }

        const updated = {
          ...initialState,
          employeeName: `${f.LegalFirstName || ''} ${f.LegalLastName || ''}`.trim(),
          employeeId: f.Id ? String(f.Id) : '',

          employeeTitle: f.PositionTitle || '',
          positionCode: resolveSelectValue(positionCodeOptions, f.PositionCode),
          location: resolveSelectValue(locationOptions, f.Location || f.BRANCH),
          department: resolveSelectValue(departmentOptions, f.Department),
          supervisor: f.Manager || '',

          currentRate: f.PayRate ? String(f.PayRate) : '',
          rateReason: f.RateReason || '',

          newTitle: f.NewTitle || '',
          newSupervisor: f.NewSupervisor || '',
          newBranch: resolveSelectValue(locationOptions, f.NewBranch || f.Location),
          newDepartment: resolveSelectValue(departmentOptions, f.NewDepartment || f.Department),
          newPositionCode: resolveSelectValue(
            positionCodeOptions,
            f.NewPositionCode || f.PositionCode
          ),
          comments: f.NoteField || '',

          compType: f.CompType || '',
          compAmount: f.CompAmount ? String(f.CompAmount) : '',
          compNotes: f.CompNotes || '',

          approvals: {
            supervisorSignature: f.SupervisorSignature || '',
            supervisorDate: f.SupervisorDate || '',
            nextManagerSignature: f.NextManagerSignature || '',
            nextManagerDate: f.NextManagerDate || '',
            svpHrSignature: f.SvpHrSignature || '',
            svpHrDate: f.SvpHrDate || '',
          },

          effectiveDate: (() => {
            if (!f.ProjectedStartDate) return nextPayday;
            const d = new Date(f.ProjectedStartDate);
            const mmddyy = d.toLocaleDateString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: '2-digit',
            });
            const match = payrollDates.find((o) => o.value.startsWith(mmddyy));
            return match?.value || nextPayday;
          })(),
        };
        setFormData(updated);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching submission:', err);
        setError('Failed to load submission data. Please ensure the backend is running and the ID is valid.');
        setLoading(false);
      });
  }, [location.search, payrollDates, nextPayday, positionCodeOptions, locationOptions, departmentOptions]);

  // Prefill from location.state when navigating from dashboard (no reload, no id)
  useEffect(() => {
    
    if (error) {
      alert(`Error: ${error}`);
    }
    
    const submissionId = new URLSearchParams(location.search).get('id');
    if (submissionId) return; // id-load overrides prefill

    const sel = location.state?.employee ?? location.state?.employeeData;
    if (!sel) return;

    setFormData((prev) => ({
      ...prev,
      employeeName: sel.EmployeeName || '',
      employeeTitle: sel.EmployeeTitle || '',
      positionCode: resolveSelectValue(positionCodeOptions, sel.PositionCode),
      location: resolveSelectValue(locationOptions, sel.BRANCH || sel.Location),
      department: resolveSelectValue(departmentOptions, sel.Department),
      supervisor: sel.Supervisor || '',
      employeeId: sel.EmployeeID ? String(sel.EmployeeID) : '',
      effectiveDate: prev.effectiveDate || nextPayday,
    }));
  }, [location.state, location.search, positionCodeOptions, locationOptions, departmentOptions, nextPayday]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setError(null);
    setSuccess(false);

    if (name.startsWith('approvals.')) {
      const [, childKey] = name.split('.');
      setFormData((prev) => ({
        ...prev,
        approvals: { ...prev.approvals, [childKey]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    console.log(formData)

    // Required checks
    for (const field of ['employeeName', 'employeeId']) {
      if (!formData[field].trim()) {
        setError(`${field.replace(/([A-Z])/g, ' $1').trim()} is required.`);
        setLoading(false);
        return;
      }
    }

    if (!formData.effectiveDate || formData.effectiveDate === 'Choose an item.') {
      setError('Effective Payroll Date is required.');
      setLoading(false);
      return;
    }

    for (const key in formData.approvals) {
      if (!formData.approvals[key].trim()) {
        setError(`Approval field ${key.replace(/([A-Z])/g, ' $1').trim()} is required.`);
        setLoading(false);
        return;
      }
    }

    const effectiveDateForValidation = parseEffectiveDateString(formData.effectiveDate);
    if (!effectiveDateForValidation) {
      setError('Invalid Effective Payroll Date. Please choose a valid date from the dropdown.');
      setLoading(false);
      return;
    }

    const selectedDateObj = new Date(`${effectiveDateForValidation}T12:00:00`);
    if (isNaN(selectedDateObj.getTime())) {
      setError('Invalid Effective Payroll Date. Please choose a valid date from the dropdown.');
      setLoading(false);
      return;
    }
    const dayOfWeek = selectedDateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setError('The Effective Payroll Date cannot be a weekend. Please choose a weekday.');
      setLoading(false);
      return;
    }

    try {
      const dataToSend = {
        ...formData,
        effectiveDate: effectiveDateForValidation, // YYYY-MM-DD to backend
        ...formData.approvals,
      };
      delete dataToSend.approvals;
      const submissionId = new URLSearchParams(location.search).get('id');
      const resp = submissionId
        ? await api.put(`/api/submissions/${submissionId}`, dataToSend, { headers: authHeaders })
        : await api.post('/api/employee-status-change', dataToSend, { headers: authHeaders });

      console.log('Submission successful:', resp.data);
      setSuccess(true);
    } catch (err) {
      console.error('API Call Error:', err);
      if (err.response) {
        if (typeof err.response.data === 'string' && err.response.data.startsWith('<!doctype html>')) {
          setError(
            `Unexpected HTML response from server. Endpoint might be incorrect or server had an internal error (Status: ${err.response.status}).`
          );
        } else {
          setError(
            `Server error: ${err.response.status} - ${
              err.response.data?.message || JSON.stringify(err.response.data) || 'Please try again.'
            }`
          );
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

  const handleBackClick = () => navigate(-1);

  return (
    <div className="page-container">
      <header className="header">
        <div className="header-logo">
          GUARDIAN <span className="logo-subtext">PLATFORM TECHNOLOGIES</span>
        </div>
        <nav>
          <a onClick={handleBackClick} className="header-nav-link">Back</a>
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
                  <select id="effectiveDate" name="effectiveDate" value={formData.effectiveDate} onChange={handleChange} className="form-select" required>
                    {payrollDates.map((option, idx) => (
                      <option key={idx} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field-group">
                  <label htmlFor="employeeTitle" className="form-label">Current Employee Title:</label>
                  <input type="text" id="employeeTitle" name="employeeTitle" value={formData.employeeTitle} onChange={handleChange} className="form-input" />
                </div>

                <div className="form-field-group">
                  <label htmlFor="positionCode" className="form-label">Position Code:</label>
                  <select id="positionCode" name="positionCode" value={formData.positionCode} onChange={handleChange} className="form-select">
                    {positionCodeOptions.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div className="form-field-group">
                  <label htmlFor="location" className="form-label">Location/Branch:</label>
                  <select id="location" name="location" value={formData.location} onChange={handleChange} className="form-select">
                    {locationOptions.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div className="form-field-group">
                  <label htmlFor="department" className="form-label">Department:</label>
                  <select id="department" name="department" value={formData.department} onChange={handleChange} className="form-select">
                    {departmentOptions.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
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
                    {locationOptions.slice(1).map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-field-group">
                  <label htmlFor="newDepartment" className="form-label">New Department:</label>
                  <select id="newDepartment" name="newDepartment" value={formData.newDepartment} onChange={handleChange} className="form-select">
                    <option value="">Choose an item.</option>
                    {departmentOptions.slice(1).map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-field-group">
                <label htmlFor="newPositionCode" className="form-label">New Position Code:</label>
                <select id="newPositionCode" name="newPositionCode" value={formData.newPositionCode} onChange={handleChange} className="form-select">
                  <option value="">Choose an item.</option>
                  {positionCodeOptions.slice(1).map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
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
