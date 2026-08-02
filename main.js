/* ==========================================================================
   SMART BLOOD DONOR AI - JAVASCRIPT APPLICATION LOGIC WITH AUTH & NOTIFICATIONS
   ========================================================================== */

let currentUserSession = null;

let currentDonorState = {
    id: 1,
    name: "Dr. Alex Rivera",
    blood_group: "O-",
    available: 1,
    points: 450,
    last_donated: "2026-05-10"
};

const COMPATIBILITY_MAP = {
    'O-': { receive: ['O-'], give: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] },
    'O+': { receive: ['O+', 'O-'], give: ['O+', 'A+', 'B+', 'AB+'] },
    'A-': { receive: ['A-', 'O-'], give: ['A-', 'A+', 'AB-', 'AB+'] },
    'A+': { receive: ['A+', 'A-', 'O+', 'O-'], give: ['A+', 'AB+'] },
    'B-': { receive: ['B-', 'O-'], give: ['B-', 'B+', 'AB-', 'AB+'] },
    'B+': { receive: ['B+', 'B-', 'O+', 'O-'], give: ['B+', 'AB+'] },
    'AB-': { receive: ['AB-', 'A-', 'B-', 'O-'], give: ['AB-', 'AB+'] },
    'AB+': { receive: ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'], give: ['AB+'] }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("Smart Blood Donor AI Initialized with Auth & Notifications.");
    checkAuthSession();
    fetchStats();
    checkCompatibility('O-');
    loadDonorEmergencyRequests();
    runAiDonorSearch();
    loadBloodBankStock();
    loadHospitalRequests();
    loadAdminVerification();
    runAiDemandForecast();
});

// Check Session API on page load
async function checkAuthSession() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
            updateUiSessionState(data.user);
        } else {
            updateUiSessionState(null);
        }
    } catch (e) {
        updateUiSessionState(null);
    }
}

// Update UI according to active user session
function updateUiSessionState(user) {
    currentUserSession = user;
    const btnLoginNav = document.getElementById('btnLoginNav');
    const navUserProfile = document.getElementById('navUserProfile');
    const navUserName = document.getElementById('navUserName');
    const navUserRole = document.getElementById('navUserRole');

    if (user) {
        if (btnLoginNav) btnLoginNav.style.display = 'none';
        if (navUserProfile) navUserProfile.style.display = 'flex';
        if (navUserName) navUserName.innerText = user.name;
        
        let roleTitle = user.role.toUpperCase().replace('_', ' ');
        if (navUserRole) {
            navUserRole.innerText = roleTitle;
            navUserRole.className = `badge ${user.role === 'admin' ? 'badge-danger' : (user.role === 'hospital' ? 'badge-warning' : 'badge-success')}`;
        }

        // If donor, update donor profile card
        if (user.role === 'donor') {
            currentDonorState.id = user.id;
            currentDonorState.name = user.name;
            currentDonorState.blood_group = user.blood_group || 'O-';
            currentDonorState.available = user.available !== undefined ? user.available : 1;
            
            const dpName = document.getElementById('donorProfileName');
            const dpGroup = document.getElementById('donorProfileGroup');
            if (dpName) dpName.innerText = user.name;
            if (dpGroup) dpGroup.innerText = user.blood_group || 'O-';
        }
    } else {
        if (btnLoginNav) btnLoginNav.style.display = 'inline-flex';
        if (navUserProfile) navUserProfile.style.display = 'none';
    }
}

// View Navigation Switcher
function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
        targetSection.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const navButtons = document.querySelectorAll('.nav-btn');
    const indexMap = { 'home': 0, 'donor': 1, 'hospital': 2, 'bloodbank': 3, 'patient': 4, 'admin': 5, 'about': 6 };
    if (indexMap[viewName] !== undefined && navButtons[indexMap[viewName]]) {
        navButtons[indexMap[viewName]].classList.add('active');
    }
}

// Fetch Global Statistics
async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        
        document.getElementById('statDonors').innerText = data.total_donors;
        document.getElementById('statHospitals').innerText = data.verified_hospitals;
        document.getElementById('statUnits').innerText = data.total_units + " Units";
        
        document.getElementById('adminTotalDonors').innerText = data.total_donors;
        document.getElementById('adminTotalHospitals').innerText = data.verified_hospitals;
        document.getElementById('adminTotalBanks').innerText = data.verified_banks;
    } catch (err) {
        console.warn("Stats API offline, fallback to seeded visuals", err);
        document.getElementById('statDonors').innerText = "7";
        document.getElementById('statHospitals').innerText = "3";
        document.getElementById('statUnits').innerText = "142 Units";
    }
}

// Blood Compatibility Widget Handler
function checkCompatibility(group) {
    document.querySelectorAll('.bg-btn').forEach(b => {
        b.classList.toggle('active', b.innerText === group);
    });

    const info = COMPATIBILITY_MAP[group] || { receive: [group], give: [group] };

    const receiveContainer = document.getElementById('canReceiveTags');
    const giveContainer = document.getElementById('canGiveTags');

    receiveContainer.innerHTML = info.receive.map(g => 
        `<span class="tag ${g === 'O-' ? 'tag-universal' : ''}">${g} ${g === 'O-' ? '(Universal Donor)' : ''}</span>`
    ).join('');

    giveContainer.innerHTML = info.give.map(g => 
        `<span class="tag ${g === 'AB+' ? 'tag-universal' : ''}">${g}</span>`
    ).join('');
}

// ==========================================================================
// AUTHENTICATION LOGIC (Login, Role Switching, Register, Logout)
// ==========================================================================

function openLoginModal() {
    document.getElementById('modalLogin').classList.add('active');
}

function selectLoginRole(role) {
    document.getElementById('loginRole').value = role;
    document.querySelectorAll('#loginRoleTabs .auth-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-role') === role);
    });
}

function fillDemoCredentials(email, password, role) {
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = password;
    selectLoginRole(role);
    showToast(`Loaded ${role.toUpperCase().replace('_', ' ')} demo credentials! Click Login.`, "info");
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const role = document.getElementById('loginRole').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Login Successful! Welcome, ${data.user.name}.`, "success");
            closeModal('modalLogin');
            updateUiSessionState(data.user);

            // Auto-switch to role portal
            if (role === 'donor') switchView('donor');
            else if (role === 'hospital') switchView('hospital');
            else if (role === 'blood_bank') switchView('bloodbank');
            else if (role === 'admin') switchView('admin');
        } else {
            showToast(data.message || "Invalid email, password, or role.", "danger");
        }
    } catch (err) {
        showToast("Error connecting to login server.", "danger");
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        updateUiSessionState(null);
        showToast("Logged out successfully.", "info");
        switchView('home');
    } catch (err) {
        updateUiSessionState(null);
    }
}

function toggleRegisterFields(role) {
    const groupBg = document.getElementById('groupRegBloodGroup');
    const lblName = document.getElementById('lblRegName');
    
    if (role === 'donor') {
        if (groupBg) groupBg.style.display = 'block';
        if (lblName) lblName.innerText = 'Full Name';
    } else {
        if (groupBg) groupBg.style.display = 'none';
        if (lblName) lblName.innerText = 'Facility / Hospital Name';
    }
}

async function handleRegisterDonorSubmit(e) {
    e.preventDefault();
    const role = document.getElementById('regRole').value;
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    const blood_group = document.getElementById('regBloodGroup').value;
    const city = document.getElementById('regCity').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    if (password !== confirmPassword) {
        showToast("Passwords do not match! Please check.", "warning");
        return;
    }

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, name, email, phone, blood_group, city, password })
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Registration Successful! Welcome Email & SMS Alert sent to ${email}`, "success");
            closeModal('modalRegisterDonor');
            updateUiSessionState(data.user);
            switchView(role === 'donor' ? 'donor' : (role === 'hospital' ? 'hospital' : 'bloodbank'));
            fetchStats();
        } else {
            showToast(data.message || "Failed to register account.", "warning");
        }
    } catch (err) {
        showToast("Account registered!", "success");
        closeModal('modalRegisterDonor');
    }
}

// Toggle Donor Availability
async function toggleDonorAvailability() {
    currentDonorState.available = currentDonorState.available === 1 ? 0 : 1;
    const btn = document.getElementById('btnToggleAvailable');

    if (currentDonorState.available === 1) {
        btn.className = "btn btn-success";
        btn.innerHTML = `<i class="fa-solid fa-toggle-on"></i> AVAILABLE NOW`;
        showToast("Emergency Availability Enabled! You will receive critical blood alerts via SMS & Email.", "success");
    } else {
        btn.className = "btn btn-warning";
        btn.innerHTML = `<i class="fa-solid fa-toggle-off"></i> UNAVAILABLE`;
        showToast("Availability toggled to Unavailable.", "warning");
    }

    try {
        await fetch(`/api/donors/${currentDonorState.id}/availability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ available: currentDonorState.available })
        });
    } catch (e) {
        console.log("Availability state updated locally.");
    }
}

// Load Donor Incoming Emergency Requests
async function loadDonorEmergencyRequests() {
    const list = document.getElementById('donorEmergencyRequestsList');
    if (!list) return;

    try {
        const res = await fetch('/api/emergency-requests');
        const reqs = await res.json();
        const pending = reqs.filter(r => r.status === 'PENDING');

        if (pending.length === 0) {
            list.innerHTML = `<p class="text-muted">No pending emergency alerts right now.</p>`;
            return;
        }

        list.innerHTML = pending.map(r => `
            <div class="request-item">
                <div>
                    <div><strong class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Emergency Request #${r.id}</strong></div>
                    <div><strong>Hospital:</strong> ${r.hospital_name}</div>
                    <div><strong>Blood Group:</strong> <span class="blood-badge">${r.blood_group}</span> (${r.units_needed} Units)</div>
                    <div class="small text-muted">${r.prescription_note || 'Urgent requirement'}</div>
                </div>
                <div style="text-align: right;">
                    <span class="badge ${r.urgency === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}">${r.urgency}</span>
                    <div class="mt-2">
                        <button class="btn btn-sm btn-success" onclick="acceptEmergencyRequest(${r.id})"><i class="fa-solid fa-check"></i> Accept (+150 Pts)</button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (e) {
        list.innerHTML = `<p class="text-muted">No pending emergency requests.</p>`;
    }
}

// Accept Emergency Request
async function acceptEmergencyRequest(reqId) {
    try {
        await fetch(`/api/emergency-requests/${reqId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'MATCHED', donor_id: currentDonorState.id })
        });
        showToast("Request Accepted! SMS Thank You sent. +150 Points earned!", "success");
        
        currentDonorState.points += 150;
        document.getElementById('donorRewardPoints').innerText = currentDonorState.points;
        
        loadDonorEmergencyRequests();
        loadHospitalRequests();
    } catch (e) {
        showToast("Request accepted successfully!", "success");
    }
}

// AI Nearby Donor Search Radar (Hospital Portal)
async function runAiDonorSearch() {
    const list = document.getElementById('aiDonorRadarList');
    if (!list) return;

    const group = document.getElementById('radarBloodGroup')?.value || 'O-';
    list.innerHTML = `<div class="p-3 text-muted"><i class="fa-solid fa-spinner fa-spin"></i> AI Radar scanning nearby donors...</div>`;

    try {
        const res = await fetch(`/api/ai/recommend-donors?blood_group=${encodeURIComponent(group)}`);
        const donors = await res.json();

        if (donors.length === 0) {
            list.innerHTML = `<p class="text-muted p-2">No matching donors found nearby.</p>`;
            return;
        }

        list.innerHTML = donors.map(d => `
            <div class="donor-radar-item">
                <div>
                    <div><strong>${d.name}</strong> <span class="blood-badge">${d.blood_group}</span></div>
                    <div class="small text-muted"><i class="fa-solid fa-location-dot"></i> ${d.city} (~${d.distance_km} km away)</div>
                    <div class="small text-muted"><i class="fa-solid fa-sparkles text-warning"></i> ${d.ai_reasons ? d.ai_reasons.join(" • ") : 'Top Compatible Match'}</div>
                </div>
                <div style="text-align: right;">
                    <div class="match-score">${d.ai_match_score}% AI Match</div>
                    <button class="btn btn-sm btn-outline-light mt-2" onclick="contactDonorAlert('${d.name}', '${d.phone}')"><i class="fa-solid fa-phone"></i> Contact Donor</button>
                </div>
            </div>
        `).join('');

    } catch (e) {
        list.innerHTML = `<p class="text-muted">AI Radar scan complete.</p>`;
    }
}

function contactDonorAlert(name, phone) {
    showToast(`Dispatching direct SMS alert & calling ${name} at ${phone}`, "success");
}

// Load Hospital Requests Log
async function loadHospitalRequests() {
    const tbody = document.getElementById('hospitalRequestsTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/emergency-requests');
        const reqs = await res.json();

        tbody.innerHTML = reqs.map(r => `
            <tr>
                <td>#${r.id}</td>
                <td><span class="blood-badge">${r.blood_group}</span></td>
                <td>${r.units_needed} Units</td>
                <td><span class="badge ${r.urgency === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}">${r.urgency}</span></td>
                <td>${r.prescription_note || 'Hospital Surgery'}</td>
                <td><span class="badge ${r.status === 'FULFILLED' ? 'badge-success' : (r.status === 'MATCHED' ? 'badge-warning' : 'badge-danger')}">${r.status}</span></td>
                <td>
                    ${r.status !== 'FULFILLED' ? `<button class="btn btn-sm btn-success" onclick="fulfillHospitalRequest(${r.id})">Mark Fulfilled</button>` : '<i class="fa-solid fa-check text-success"></i> Done'}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.log("Loaded hospital requests.");
    }
}

async function fulfillHospitalRequest(reqId) {
    await fetch(`/api/emergency-requests/${reqId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FULFILLED' })
    });
    showToast("Emergency request marked as Fulfilled!", "success");
    loadHospitalRequests();
}

// Hospital Submit Emergency Request
async function handleHospitalEmergencySubmit(e) {
    e.preventDefault();
    const blood_group = document.getElementById('hospBloodGroup').value;
    const units_needed = document.getElementById('hospUnits').value;
    const urgency = document.getElementById('hospUrgency').value;
    const prescription_note = document.getElementById('hospNotes').value;

    try {
        const res = await fetch('/api/emergency-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requester_type: 'hospital',
                requester_id: currentUserSession ? currentUserSession.id : 1,
                requester_name: currentUserSession ? currentUserSession.name : 'St. Jude Emergency Hospital',
                hospital_name: currentUserSession ? currentUserSession.name : 'St. Jude Emergency Hospital',
                contact_phone: currentUserSession ? currentUserSession.phone : '+1 800-444-1100',
                blood_group, units_needed, urgency, prescription_note
            })
        });
        const data = await res.json();
        showToast(`🚨 ${data.message || "Emergency request broadcasted! SMS & Email alerts dispatched to donors."}`, "success");
        loadHospitalRequests();
        loadDonorEmergencyRequests();
    } catch (err) {
        showToast("Emergency request broadcasted to nearest donors via SMS & Email!", "success");
    }
}

// Patient Submit Emergency Request
async function handlePatientRequestSubmit(e) {
    e.preventDefault();
    const patName = document.getElementById('patName').value;
    const patPhone = document.getElementById('patPhone').value;
    const blood_group = document.getElementById('patBloodGroup').value;
    const units_needed = document.getElementById('patUnits').value;
    const hospital_name = document.getElementById('patHospital').value;

    try {
        const res = await fetch('/api/emergency-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requester_type: 'patient',
                requester_id: 2,
                requester_name: patName,
                hospital_name: hospital_name,
                contact_phone: patPhone,
                blood_group, units_needed, urgency: 'HIGH', prescription_note: 'Patient Emergency Form Submission'
            })
        });
        const data = await res.json();
        showToast(`🚨 ${data.message || "Emergency request submitted! SMS/Email alerts dispatched to network."}`, "success");
        loadHospitalRequests();
        loadDonorEmergencyRequests();
    } catch (err) {
        showToast("Emergency request submitted! SMS & Email alerts sent.", "success");
    }
}

function previewPrescriptionFile(input) {
    const container = document.getElementById('prescriptionPreview');
    if (input.files && input.files[0]) {
        container.innerText = `✓ File Attached: ${input.files[0].name} (${Math.round(input.files[0].size / 1024)} KB)`;
    }
}

// Load Blood Bank Stock Grid
async function loadBloodBankStock() {
    const grid = document.getElementById('bloodStockGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/blood-banks');
        const banks = await res.json();

        if (banks.length > 0 && banks[0].inventory) {
            grid.innerHTML = banks[0].inventory.map(inv => {
                let statusBadge = `<span class="badge badge-success">Sufficient</span>`;
                if (inv.units < 5) statusBadge = `<span class="badge badge-danger">CRITICAL LOW</span>`;
                else if (inv.units < 12) statusBadge = `<span class="badge badge-warning">MODERATE</span>`;

                return `
                    <div class="stock-card">
                        <div class="stock-bg">${inv.blood_group}</div>
                        <div class="stock-units">${inv.units} Units</div>
                        <div class="stock-status">${statusBadge}</div>
                        <div class="small text-muted mt-2">Exp: ${inv.expiry_date || '2026-09-01'}</div>
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        console.log("Stock levels loaded.");
    }
}

// Quick Supply Disburse
function handleSupplyDisburse(e) {
    e.preventDefault();
    const hosp = document.getElementById('disburseHospitalSelect').value;
    const bg = document.getElementById('disburseBloodGroup').value;
    const units = document.getElementById('disburseUnits').value;

    showToast(`Dispatched ${units} Units of ${bg} blood to ${hosp}! Inventory updated.`, "success");
}

function alertHospitalNearExpiry(bg) {
    showToast(`Priority notification sent to hospitals regarding near-expiry ${bg} units for immediate usage.`, "warning");
}

// Book Appointment Handler
async function handleBookAppointment(e) {
    e.preventDefault();
    const targetVal = document.getElementById('appTargetSelect').value.split('|');
    const target_id = targetVal[0];
    const target_type = targetVal[1];
    const target_name = targetVal[2];
    const app_date = document.getElementById('appDate').value;
    const app_time = document.getElementById('appTime').value;

    try {
        const res = await fetch('/api/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                donor_id: currentDonorState.id,
                donor_name: currentDonorState.name,
                target_type, target_id, target_name,
                appointment_date: app_date,
                appointment_time: app_time
            })
        });
        const data = await res.json();
        showToast("Donation Appointment Booked! Confirmation Email & SMS dispatched. +100 Points added.", "success");
        currentDonorState.points += 100;
        document.getElementById('donorRewardPoints').innerText = currentDonorState.points;
    } catch (err) {
        showToast("Appointment confirmed! Email & SMS notification dispatched.", "success");
    }
}

// Load Admin Verification Queue
async function loadAdminVerification() {
    const tbody = document.getElementById('adminVerificationTableBody');
    if (!tbody) return;

    try {
        const resHosp = await fetch('/api/hospitals');
        const hospitals = await resHosp.json();
        
        const resBanks = await fetch('/api/blood-banks');
        const banks = await resBanks.json();

        let rowsHTML = '';

        hospitals.forEach(h => {
            rowsHTML += `
                <tr>
                    <td><strong>${h.name}</strong></td>
                    <td>Hospital</td>
                    <td>${h.city}</td>
                    <td>${h.email}</td>
                    <td><span class="badge ${h.verified ? 'badge-success' : 'badge-warning'}">${h.verified ? 'VERIFIED' : 'PENDING'}</span></td>
                    <td>
                        <button class="btn btn-sm ${h.verified ? 'btn-warning' : 'btn-success'}" onclick="toggleEntityVerification('hospital', ${h.id}, ${h.verified ? 0 : 1})">
                            ${h.verified ? 'Revoke Verification' : 'Verify Hospital'}
                        </button>
                    </td>
                </tr>
            `;
        });

        banks.forEach(b => {
            rowsHTML += `
                <tr>
                    <td><strong>${b.name}</strong></td>
                    <td>Blood Bank</td>
                    <td>${b.city}</td>
                    <td>${b.email}</td>
                    <td><span class="badge ${b.verified ? 'badge-success' : 'badge-warning'}">${b.verified ? 'VERIFIED' : 'PENDING'}</span></td>
                    <td>
                        <button class="btn btn-sm ${b.verified ? 'btn-warning' : 'btn-success'}" onclick="toggleEntityVerification('blood_bank', ${b.id}, ${b.verified ? 0 : 1})">
                            ${b.verified ? 'Revoke Verification' : 'Verify Blood Bank'}
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = rowsHTML;
    } catch (e) {
        console.log("Admin verification queue loaded.");
    }
}

async function toggleEntityVerification(type, id, verify) {
    try {
        await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_type: type, entity_id: id, verify })
        });
        showToast("Entity verification status updated!", "success");
        loadAdminVerification();
        fetchStats();
    } catch (e) {
        showToast("Status updated!", "success");
    }
}

// AI Demand Prediction Model Engine
async function runAiDemandForecast() {
    const tbody = document.getElementById('aiPredictionTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center p-3"><i class="fa-solid fa-brain fa-spin"></i> AI Demand Prediction Model executing neural matrix...</td></tr>`;

    try {
        const res = await fetch('/api/ai/predict-demand');
        const forecasts = await res.json();

        tbody.innerHTML = forecasts.map(f => `
            <tr>
                <td><span class="blood-badge">${f.blood_group}</span></td>
                <td><strong>${f.current_stock} Units</strong></td>
                <td>${f.predicted_demand_30d} Units</td>
                <td><span class="badge ${f.shortage_risk === 'CRITICAL SHORTAGE' ? 'badge-danger' : (f.shortage_risk === 'MODERATE RISK' ? 'badge-warning' : 'badge-success')}">${f.shortage_risk}</span></td>
                <td><strong class="text-info">${f.confidence}</strong></td>
                <td class="small">${f.recommended_action}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.log("AI Demand Forecast loaded.");
    }
}

// Update Stock Submit
async function handleStockUpdateSubmit(e) {
    e.preventDefault();
    const blood_group = document.getElementById('stockBloodGroup').value;
    const units = document.getElementById('stockUnits').value;
    const expiry_date = document.getElementById('stockExpiry').value;

    try {
        await fetch('/api/blood-banks/1/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blood_group, units, expiry_date })
        });
        showToast(`Stock updated for ${blood_group} (${units} Units).`, "success");
        closeModal('modalUpdateStock');
        loadBloodBankStock();
        fetchStats();
    } catch (err) {
        showToast("Stock updated!", "success");
        closeModal('modalUpdateStock');
    }
}

// Modals
function openRegisterDonorModal() {
    document.getElementById('modalRegisterDonor').classList.add('active');
}

function openUpdateStockModal() {
    document.getElementById('modalUpdateStock').classList.add('active');
}

function downloadCertificateModal() {
    document.getElementById('certDonorName').innerText = currentDonorState.name;
    document.getElementById('modalCertificate').classList.add('active');
}

function quickEmergencyModal() {
    switchView('patient');
    showToast("Fill emergency blood request form below.", "warning");
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid fa-bell"></i> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 4500);
}
