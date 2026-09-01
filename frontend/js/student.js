const user = requireRole('Student');

let allRequests = [];
let requestFilter = 'All';
let profileCache = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!user) return;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('welcome-heading').textContent = `${greeting}, ${user.name.split(' ')[0]}`;

  loadProfile();
  loadRequests();
  loadComplaints();

  document.getElementById('create-request-form').addEventListener('submit', submitRequest);
  document.getElementById('create-complaint-form').addEventListener('submit', submitComplaint);

  document.getElementById('req-type').addEventListener('change', updateRequestFormMode);

  document.querySelectorAll('#fb-stars button').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.getAttribute('data-star'));
      document.getElementById('fb-rating').value = val;
      document.querySelectorAll('#fb-stars button').forEach(b => {
        b.classList.toggle('active', Number(b.getAttribute('data-star')) <= val);
      });
    });
  });
});

// ============ Profile / Room ============
async function loadProfile() {
  const data = await fetchApi('/student/profile');
  if (!data.success) {
    showToast(data.message || 'Could not load your profile', 'error');
    return;
  }
  profileCache = data.data;
  const p = data.data;

  if (p.room) {
    document.getElementById('stat-room').textContent = p.room.roomNumber || p.roomNumber || '—';
    document.getElementById('stat-room-sub').textContent = p.hostel ? p.hostel.name : 'Hostel not set';
  } else {
    document.getElementById('stat-room').textContent = 'Unallocated';
    document.getElementById('stat-room-sub').textContent = 'Contact Super Admin';
  }

  const roomCard = document.getElementById('room-info-card');
  if (p.room) {
    roomCard.innerHTML = `
      <div class="detail-grid">
        <div class="detail-item"><div class="d-label">Hostel</div><div class="d-value">${escapeHtml(p.hostel ? p.hostel.name : '—')}</div></div>
        <div class="detail-item"><div class="d-label">Block</div><div class="d-value">${escapeHtml(p.block ? p.block.name : '—')}</div></div>
        <div class="detail-item"><div class="d-label">Room</div><div class="d-value">${escapeHtml(p.room.roomNumber || p.roomNumber)}</div></div>
        <div class="detail-item"><div class="d-label">Capacity</div><div class="d-value">${p.room.capacity || '—'} beds</div></div>
      </div>
      <div class="d-label" style="margin-bottom:8px;">Roommates</div>
      ${p.roommates && p.roommates.length ? `
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Year</th></tr></thead><tbody>
          ${p.roommates.map(r => `<tr><td>${escapeHtml(r.name)}</td><td>Year ${r.year || '—'}</td></tr>`).join('')}
        </tbody></table></div>
      ` : `<p class="muted" style="font-size:13px;">No roommates yet — you have the room to yourself.</p>`}
    `;
  } else {
    roomCard.innerHTML = `
      <div class="empty-state">
        <div class="glyph"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>
        <h4>No room allocated yet</h4>
        <p>Your Super Admin hasn't assigned you to a room. Reach out to them to get allocated.</p>
      </div>`;
  }
}

// ============ Requests (Outpass & Leave) ============
async function loadRequests() {
  const data = await fetchApi('/student/requests');
  if (!data.success) {
    showToast(data.message || 'Could not load requests', 'error');
    return;
  }
  allRequests = data.data;

  const pendingCount = allRequests.filter(r => r.status.includes('Pending')).length;
  const latestOutpass = allRequests.find(r => r.type === 'Outpass');
  const latestLeave = allRequests.find(r => r.type === 'Leave');
  document.getElementById('stat-outpass').textContent = latestOutpass ? latestOutpass.status : 'None yet';
  document.getElementById('stat-leave').textContent = latestLeave ? latestLeave.status : 'None yet';

  renderRecent();
  renderRequestsTable();
}

function setRequestFilter(f) {
  requestFilter = f;
  document.querySelectorAll('[data-req-filter]').forEach(b => {
    b.classList.toggle('btn-primary', b.getAttribute('data-req-filter') === f);
    b.classList.toggle('btn-outline', b.getAttribute('data-req-filter') !== f);
  });
  renderRequestsTable();
}

function renderRecent() {
  const tbody = document.getElementById('recent-requests-body');
  const recent = allRequests.slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No activity yet — apply for an outpass or leave to get started.</td></tr>';
    return;
  }
  tbody.innerHTML = recent.map(r => `
    <tr class="row-click" onclick="openRequestDetail('${r._id}')">
      <td>${r.type}</td>
      <td>${escapeHtml(r.type === 'Outpass' ? r.destination : r.reason)}</td>
      <td>${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}</td>
      <td><span class="badge ${statusBadgeClass(r.status)}">${r.status}</span></td>
    </tr>
  `).join('');
}

function renderRequestsTable() {
  const tbody = document.getElementById('requests-body');
  const list = requestFilter === 'All' ? allRequests : allRequests.filter(r => r.type === requestFilter);
  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No requests found for this filter.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(r => `
    <tr class="row-click" onclick="openRequestDetail('${r._id}')">
      <td>${r.type}</td>
      <td>${escapeHtml(r.type === 'Outpass' ? r.destination : r.reason)}</td>
      <td>${fmtDate(r.fromDate)}</td>
      <td>${fmtDate(r.toDate)}</td>
      <td><span class="badge ${statusBadgeClass(r.status)}">${r.status}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openRequestDetail('${r._id}')">View</button></td>
    </tr>
  `).join('');
}

function openRequestDetail(id) {
  const r = allRequests.find(x => x._id === id);
  if (!r) return;
  document.getElementById('detail-modal-title').textContent = `${r.type} · ${escapeHtml(r.type === 'Outpass' ? r.destination : 'Leave request')}`;
  document.getElementById('detail-modal-body').innerHTML = renderLedger(r);
  openModal('detail-modal');
}

/** Builds the signature "approval ledger" stepper from real backend fields. */
function renderLedger(r) {
  const steps = [];
  steps.push({
    role: 'Student', name: 'Request submitted', meta: fmtDateTime(r.createdAt), state: 'done'
  });

  steps.push({
    role: 'Department',
    name: r.departmentStatus === 'Pending' ? 'Awaiting department review'
      : `Approved by: ${r.departmentApprovedBy ? r.departmentApprovedBy.name : 'Department'} | Role: ${r.departmentApprovedByRole || 'Department'}`,
    meta: r.departmentApprovedAt ? `${r.departmentStatus} on ${fmtDateTime(r.departmentApprovedAt)}` : (r.status === 'Pending Department' ? 'Currently under review' : ''),
    state: r.departmentStatus === 'Approved' ? 'done' : r.departmentStatus === 'Rejected' ? 'rejected' : (r.status === 'Pending Department' ? 'current' : '')
  });

  if (r.type === 'Outpass') {
    steps.push({
      role: 'Warden',
      name: r.wardenStatus === 'Pending' ? 'Awaiting warden approval' : `${r.wardenApprovedBy ? r.wardenApprovedBy.name : 'Warden'}`,
      meta: r.wardenApprovedAt ? `${r.wardenStatus} on ${fmtDateTime(r.wardenApprovedAt)}` : (r.status === 'Pending Warden' ? 'Final stage' : ''),
      state: r.wardenStatus === 'Approved' ? 'done' : r.wardenStatus === 'Rejected' ? 'rejected' : (r.status === 'Pending Warden' ? 'current' : '')
    });
  }

  const ledgerHtml = `
    <div class="ledger">
      ${steps.map(s => `
        <div class="ledger-step ${s.state}">
          <div class="ledger-role">${s.role}</div>
          <div class="ledger-name">${escapeHtml(s.name)}</div>
          ${s.meta ? `<div class="ledger-meta">${escapeHtml(s.meta)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  const detailsHtml = `
    <div class="detail-grid" style="margin-bottom:22px;">
      <div class="detail-item"><div class="d-label">Status</div><div class="d-value"><span class="badge ${statusBadgeClass(r.status)}">${r.status}</span></div></div>
      <div class="detail-item"><div class="d-label">Dates</div><div class="d-value">${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}</div></div>
      ${r.type === 'Outpass' ? `<div class="detail-item"><div class="d-label">Destination</div><div class="d-value">${escapeHtml(r.destination || '—')}</div></div>` : ''}
      ${r.type === 'Outpass' ? `<div class="detail-item"><div class="d-label">Out / Return</div><div class="d-value">${escapeHtml(r.outTime || '—')} → ${escapeHtml(r.expectedReturnTime || '—')}</div></div>` : ''}
      <div class="detail-item" style="grid-column:1/-1;"><div class="d-label">Reason</div><div class="d-value">${escapeHtml(r.reason)}</div></div>
      ${r.rejectionReason ? `<div class="detail-item" style="grid-column:1/-1;"><div class="d-label">Rejection reason</div><div class="d-value" style="color:var(--bad-600);">${escapeHtml(r.rejectionReason)}</div></div>` : ''}
    </div>
  `;

  return detailsHtml + `<div class="eyebrow" style="margin-bottom:16px;">Approval ledger</div>` + ledgerHtml;
}

function openRequestModal(type) {
  document.getElementById('create-request-form').reset();
  document.getElementById('req-type').value = type;
  document.getElementById('request-modal-title').textContent = type === 'Outpass' ? 'Apply Outpass' : 'Apply Leave';
  updateRequestFormMode();
  document.getElementById('request-form-error').classList.add('hidden');
  openModal('request-modal');
}

function updateRequestFormMode() {
  const type = document.getElementById('req-type').value;
  const isOutpass = type === 'Outpass';
  document.getElementById('req-dest-field').style.display = isOutpass ? 'block' : 'none';
  document.getElementById('req-outpass-times').style.display = isOutpass ? 'grid' : 'none';
  document.getElementById('req-dest').required = isOutpass;
}

async function submitRequest(e) {
  e.preventDefault();
  const type = document.getElementById('req-type').value;
  const errorBox = document.getElementById('request-form-error');
  errorBox.classList.add('hidden');

  const fromDate = document.getElementById('req-from').value;
  const toDate = document.getElementById('req-to').value;
  const reason = document.getElementById('req-reason').value.trim();

  if (!fromDate || !toDate || !reason) {
    errorBox.textContent = 'Please fill in all required fields.';
    errorBox.classList.remove('hidden');
    return;
  }
  if (new Date(toDate) < new Date(fromDate)) {
    errorBox.textContent = 'To date cannot be before the from date.';
    errorBox.classList.remove('hidden');
    return;
  }

  const payload = {
    type,
    reason,
    fromDate,
    toDate
  };
  if (type === 'Outpass') {
    payload.destination = document.getElementById('req-dest').value.trim();
    payload.outTime = document.getElementById('req-out-time').value;
    payload.expectedReturnTime = document.getElementById('req-return-time').value;
    if (!payload.destination || !payload.outTime || !payload.expectedReturnTime) {
      errorBox.textContent = 'Destination, out time and expected return time are required for an outpass.';
      errorBox.classList.remove('hidden');
      return;
    }
  }

  const btn = document.getElementById('request-submit-btn');
  const spinner = document.getElementById('request-submit-spinner');
  const label = document.getElementById('request-submit-label');
  btn.disabled = true; spinner.classList.remove('hidden'); label.textContent = 'Submitting…';

  const data = await fetchApi('/student/requests', { method: 'POST', body: JSON.stringify(payload) });

  btn.disabled = false; spinner.classList.add('hidden'); label.textContent = 'Submit request';

  if (data.success) {
    closeModal('request-modal');
    showToast(`${type} request submitted successfully.`, 'success');
    loadRequests();
  } else {
    errorBox.textContent = data.message || 'Something went wrong submitting your request.';
    errorBox.classList.remove('hidden');
  }
}

// ============ Complaints ============
async function loadComplaints() {
  const data = await fetchApi('/student/complaints');
  if (!data.success) {
    showToast(data.message || 'Could not load complaints', 'error');
    return;
  }
  const open = data.data.filter(c => c.status === 'Pending' || c.status === 'In Progress').length;
  document.getElementById('stat-complaints').textContent = open;

  const tbody = document.getElementById('complaints-body');
  if (!data.data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No complaints filed yet.</td></tr>';
    return;
  }
  tbody.innerHTML = data.data.map(c => `
    <tr>
      <td>${c.type}</td>
      <td>${escapeHtml(c.title)}</td>
      <td>${fmtDate(c.createdAt)}</td>
      <td><span class="badge ${statusBadgeClass(c.status)}">${c.status}</span></td>
      <td>${c.resolution ? escapeHtml(c.resolution) : '<span class="muted">—</span>'}</td>
    </tr>
  `).join('');
}

function openComplaintModal() {
  document.getElementById('create-complaint-form').reset();
  openModal('complaint-modal');
}

async function submitComplaint(e) {
  e.preventDefault();
  const payload = {
    type: document.getElementById('comp-type').value,
    title: document.getElementById('comp-title').value.trim(),
    description: document.getElementById('comp-desc').value.trim()
  };
  if (!payload.title || !payload.description) {
    showToast('Please fill in the title and description.', 'error');
    return;
  }

  const spinner = document.getElementById('complaint-submit-spinner');
  const label = document.getElementById('complaint-submit-label');
  spinner.classList.remove('hidden'); label.textContent = 'Filing…';

  const data = await fetchApi('/student/complaints', { method: 'POST', body: JSON.stringify(payload) });

  spinner.classList.add('hidden'); label.textContent = 'File complaint';

  if (data.success) {
    closeModal('complaint-modal');
    showToast('Complaint filed successfully.', 'success');
    loadComplaints();
  } else {
    showToast(data.message || 'Error filing complaint', 'error');
  }
}


