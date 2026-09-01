const user = requireRole('Warden');

let allOutpassRequests = [];
let allComplaints = [];
let wardenFilter = 'pending';
let currentReviewId = null;
let currentComplaintId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!user) return;
  loadAnalytics();
  loadRequests();
  loadComplaints();
});

function onViewShown(target) {
  if (target === 'rooms') loadRooms();
}

// ============ Analytics ============
async function loadAnalytics() {
  const data = await fetchApi('/warden/analytics');
  if (!data.success) {
    showToast(data.message || 'Could not load analytics', 'error');
    return;
  }
  const a = data.data;
  document.getElementById('w-students').textContent = a.totalStudents;
  document.getElementById('w-occupied-rooms').textContent = a.occupiedRooms;
  document.getElementById('w-available-rooms').textContent = a.availableRooms;
  document.getElementById('w-occupancy-pct').textContent = `${a.occupancyPercentage}%`;
  document.getElementById('w-pending-outpass').textContent = a.pendingOutpass;
  document.getElementById('w-pending-complaints').textContent = a.pendingComplaints;
  document.getElementById('w-approved-outpass').textContent = a.approvedOutpass;
  document.getElementById('w-resolved-complaints').textContent = a.resolvedComplaints;

  const outpassBadge = document.getElementById('pending-outpass-badge');
  if (a.pendingOutpass > 0) { outpassBadge.textContent = a.pendingOutpass; outpassBadge.classList.remove('hidden'); }
  else outpassBadge.classList.add('hidden');

  const complaintsBadge = document.getElementById('pending-complaints-badge');
  if (a.pendingComplaints > 0) { complaintsBadge.textContent = a.pendingComplaints; complaintsBadge.classList.remove('hidden'); }
  else complaintsBadge.classList.add('hidden');
}

// ============ Outpass Requests ============
async function loadRequests() {
  const data = await fetchApi('/warden/requests');
  if (!data.success) {
    showToast(data.message || 'Could not load requests', 'error');
    return;
  }
  allOutpassRequests = data.data;
  renderPendingOverview();
  renderRequestsTable();
}

function renderPendingOverview() {
  const pending = allOutpassRequests.filter(r => r.status === 'Pending Warden').slice(0, 6);
  const tbody = document.getElementById('pending-outpass-body');
  if (!pending.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Nothing waiting on you right now.</td></tr>';
    return;
  }
  tbody.innerHTML = pending.map(r => `
    <tr class="row-click" onclick="openReview('${r._id}')">
      <td>${escapeHtml(r.student ? r.student.name : 'Unknown')}</td>
      <td>${escapeHtml(r.destination)}</td>
      <td>${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}</td>
      <td><button class="btn btn-sm btn-brass" onclick="event.stopPropagation();openReview('${r._id}')">Review</button></td>
    </tr>
  `).join('');
}

function setWardenFilter(f) {
  wardenFilter = f;
  document.querySelectorAll('[data-w-filter]').forEach(b => {
    const active = b.getAttribute('data-w-filter') === f;
    b.classList.toggle('btn-primary', active);
    b.classList.toggle('btn-outline', !active);
  });
  renderRequestsTable();
}

function renderRequestsTable() {
  const tbody = document.getElementById('requests-body');
  const list = wardenFilter === 'pending' ? allOutpassRequests.filter(r => r.status === 'Pending Warden') : allOutpassRequests;
  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No requests found.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(r => `
    <tr class="row-click" onclick="openReview('${r._id}')">
      <td>${escapeHtml(r.student ? r.student.name : 'Unknown')}</td>
      <td>${escapeHtml(r.destination)}</td>
      <td>${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}</td>
      <td><span class="badge ${statusBadgeClass(r.status)}">${r.status}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openReview('${r._id}')">View</button></td>
    </tr>
  `).join('');
}

function openReview(id) {
  const r = allOutpassRequests.find(x => x._id === id);
  if (!r) return;
  currentReviewId = id;
  document.getElementById('review-modal-title').textContent = `Outpass · ${escapeHtml(r.student ? r.student.name : 'Unknown')}`;
  document.getElementById('review-modal-body').innerHTML = renderLedger(r);

  const canAct = r.status === 'Pending Warden';
  document.getElementById('review-approve-btn').style.display = canAct ? 'inline-flex' : 'none';
  document.getElementById('review-reject-btn').style.display = canAct ? 'inline-flex' : 'none';
  document.getElementById('review-approve-btn').onclick = () => actOnRequest('Approved');
  document.getElementById('review-reject-btn').onclick = () => actOnRequest('Rejected');

  openModal('review-modal');
}

function renderLedger(r) {
  const steps = [{ role: 'Student', name: r.student ? r.student.name : 'Student', meta: `Submitted ${fmtDateTime(r.createdAt)}`, state: 'done' }];

  steps.push({
    role: 'Department',
    name: r.departmentStatus === 'Pending' ? 'Awaiting review' : (r.departmentApprovedBy ? r.departmentApprovedBy.name : 'Department'),
    meta: r.departmentApprovedAt ? `${r.departmentStatus} ${fmtDateTime(r.departmentApprovedAt)}` : '',
    state: r.departmentStatus === 'Approved' ? 'done' : r.departmentStatus === 'Rejected' ? 'rejected' : ''
  });
  steps.push({
    role: 'Warden',
    name: r.wardenStatus === 'Pending' ? 'Awaiting your decision' : (r.wardenApprovedBy ? r.wardenApprovedBy.name : 'Warden'),
    meta: r.wardenApprovedAt ? `${r.wardenStatus} ${fmtDateTime(r.wardenApprovedAt)}` : '',
    state: r.wardenStatus === 'Approved' ? 'done' : r.wardenStatus === 'Rejected' ? 'rejected' : (r.status === 'Pending Warden' ? 'current' : '')
  });

  const detailsHtml = `
    <div class="detail-grid" style="margin-bottom:20px;">
      <div class="detail-item"><div class="d-label">Status</div><div class="d-value"><span class="badge ${statusBadgeClass(r.status)}">${r.status}</span></div></div>
      <div class="detail-item"><div class="d-label">Dates</div><div class="d-value">${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}</div></div>
      <div class="detail-item"><div class="d-label">Destination</div><div class="d-value">${escapeHtml(r.destination)}</div></div>
      <div class="detail-item"><div class="d-label">Out / Return</div><div class="d-value">${escapeHtml(r.outTime || '—')} → ${escapeHtml(r.expectedReturnTime || '—')}</div></div>
      <div class="detail-item" style="grid-column:1/-1;"><div class="d-label">Reason</div><div class="d-value">${escapeHtml(r.reason)}</div></div>
    </div>
  `;
  const ledgerHtml = `<div class="ledger">${steps.map(s => `
    <div class="ledger-step ${s.state}">
      <div class="ledger-role">${s.role}</div>
      <div class="ledger-name">${escapeHtml(s.name)}</div>
      ${s.meta ? `<div class="ledger-meta">${escapeHtml(s.meta)}</div>` : ''}
    </div>`).join('')}</div>`;
  return detailsHtml + `<div class="eyebrow" style="margin-bottom:16px;">Approval ledger</div>` + ledgerHtml;
}

async function actOnRequest(status) {
  const r = allOutpassRequests.find(x => x._id === currentReviewId);
  if (!r) return;

  let rejectionReason;
  if (status === 'Rejected') {
    const result = await confirmAction({
      title: 'Reject this outpass?',
      message: `This will reject ${r.student ? r.student.name : 'this student'}'s outpass request.`,
      okLabel: 'Reject', needsReason: true
    });
    if (!result) return;
    rejectionReason = result.reason;
  } else {
    const ok = await confirmAction({ title: 'Approve this outpass?', message: 'This is the final approval stage.', okLabel: 'Approve', danger: false });
    if (!ok) return;
  }

  const data = await fetchApi(`/warden/requests/${r._id}`, { method: 'PUT', body: JSON.stringify({ status, rejectionReason }) });
  if (data.success) {
    closeModal('review-modal');
    showToast(`Outpass ${status.toLowerCase()}.`, 'success');
    loadRequests();
    loadAnalytics();
  } else {
    showToast(data.message || 'Could not update request', 'error');
  }
}

// ============ Complaints ============
async function loadComplaints() {
  const status = document.getElementById('complaint-status-filter').value;
  const data = await fetchApi(`/warden/complaints${status ? `?status=${encodeURIComponent(status)}` : ''}`);
  if (!data.success) {
    showToast(data.message || 'Could not load complaints', 'error');
    return;
  }
  allComplaints = data.data;
  const tbody = document.getElementById('complaints-body');
  if (!data.data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No complaints found.</td></tr>';
    return;
  }
  tbody.innerHTML = data.data.map(c => `
    <tr>
      <td>${escapeHtml(c.student ? c.student.name : 'Unknown')}</td>
      <td>${c.type}</td>
      <td>${escapeHtml(c.title)}</td>
      <td>${fmtDate(c.createdAt)}</td>
      <td><span class="badge ${statusBadgeClass(c.status)}">${c.status}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="openComplaintUpdate('${c._id}')">Update</button></td>
    </tr>
  `).join('');
}

function openComplaintUpdate(id) {
  const c = allComplaints.find(x => x._id === id);
  if (!c) return;
  currentComplaintId = id;
  document.getElementById('cm-title').textContent = c.title;
  document.getElementById('cm-desc').textContent = c.description;
  document.getElementById('cm-status').value = c.status;
  document.getElementById('cm-resolution').value = c.resolution || '';
  openModal('complaint-modal');
}

async function saveComplaintUpdate() {
  const status = document.getElementById('cm-status').value;
  const resolution = document.getElementById('cm-resolution').value.trim();
  const data = await fetchApi(`/warden/complaints/${currentComplaintId}`, { method: 'PUT', body: JSON.stringify({ status, resolution }) });
  if (data.success) {
    closeModal('complaint-modal');
    showToast('Complaint updated.', 'success');
    loadComplaints();
    loadAnalytics();
  } else {
    showToast(data.message || 'Could not update complaint', 'error');
  }
}

// ============ Rooms ============
async function loadRooms() {
  const container = document.getElementById('rooms-container');
  container.innerHTML = '<p class="muted">Loading…</p>';
  const data = await fetchApi('/warden/rooms');
  if (!data.success) {
    container.innerHTML = `<p class="muted">${escapeHtml(data.message || 'Could not load rooms')}</p>`;
    return;
  }
  if (!data.data.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="glyph"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>
        <h4>No rooms set up yet</h4>
        <p>Ask your Super Admin to create blocks and rooms for this hostel.</p>
      </div>`;
    return;
  }

  const byBlock = {};
  data.data.forEach(r => {
    const blockName = r.block ? r.block.name : 'Unassigned';
    if (!byBlock[blockName]) byBlock[blockName] = [];
    byBlock[blockName].push(r);
  });

  container.innerHTML = Object.keys(byBlock).map(blockName => `
    <div class="card section-card">
      <div class="section-head"><h3>Block ${escapeHtml(blockName)}</h3></div>
      <div class="section-body">
        <div class="room-grid">
          ${byBlock[blockName].map(room => {
            const full = room.occupants.length >= room.capacity;
            return `
              <div class="room-tile ${full ? 'full' : 'empty'}" onclick='openRoomDetail(${JSON.stringify(JSON.stringify(room))})'>
                <div class="r-num">${escapeHtml(room.roomNumber)}</div>
                <div class="r-occ">${room.occupants.length}/${room.capacity} occupied</div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

function openRoomDetail(roomJson) {
  const room = JSON.parse(roomJson);
  document.getElementById('room-modal-title').textContent = `Room ${room.roomNumber}`;
  document.getElementById('room-modal-body').innerHTML = `
    <div class="detail-grid" style="margin-bottom:16px;">
      <div class="detail-item"><div class="d-label">Capacity</div><div class="d-value">${room.capacity} beds</div></div>
      <div class="detail-item"><div class="d-label">Occupied</div><div class="d-value">${room.occupants.length}</div></div>
    </div>
    <div class="d-label" style="margin-bottom:8px;">Occupants</div>
    ${room.occupants.length ? `
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Year</th></tr></thead><tbody>
        ${room.occupants.map(o => `<tr><td>${escapeHtml(o.name)}</td><td>Year ${o.year || '—'}</td></tr>`).join('')}
      </tbody></table></div>
    ` : `<p class="muted" style="font-size:13px;">This room is currently empty.</p>`}
  `;
  openModal('room-modal');
}


