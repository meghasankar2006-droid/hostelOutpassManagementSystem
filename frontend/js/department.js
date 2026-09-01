const user = requireRole('Advisor', 'HOD');

let myStaffRole = null; // 'Advisor' | 'HOD' — determines which endpoint approve/reject hits
let allDeptRequests = [];
let deptFilter = 'pending';
let currentReviewId = null;
let allStudentsCache = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!user) return;
  init();
});

async function init() {
  const me = await fetchApi('/department/me');
  if (!me.success) {
    showToast(me.message || 'Could not determine your department role', 'error');
    return;
  }
  myStaffRole = me.data.staffRole;

  document.getElementById('dept-role-label').textContent = `${me.data.department.name} · ${myStaffRole}`;
  document.getElementById('staff-role-chip').textContent = myStaffRole;
  document.getElementById('dept-heading').textContent = `${myStaffRole} Overview`;
  document.getElementById('dept-sub').textContent = `${me.data.department.name} department`;

  if (myStaffRole !== 'HOD') {
    document.getElementById('nav-advisors').style.display = 'none';
  }

  document.getElementById('att-date').valueAsDate = new Date();

  loadAnalytics();
  loadRequests();
  loadStudents();
  if (myStaffRole === 'HOD') loadAdvisors();
}

function onViewShown(target) {
  if (target === 'attendance') loadAttendanceRoster();
}

// ============ Analytics ============
async function loadAnalytics() {
  const data = await fetchApi('/department/analytics');
  if (!data.success) {
    showToast(data.message || 'Could not load analytics', 'error');
    return;
  }
  const a = data.data;
  document.getElementById('a-total').textContent = a.totalStudents;
  document.getElementById('a-pending-leave').textContent = a.pendingLeave;
  document.getElementById('a-pending-outpass').textContent = a.pendingOutpass;
  document.getElementById('a-approved-leave').textContent = a.approvedLeave;
  document.getElementById('a-approved-outpass').textContent = a.approvedOutpass;
  document.getElementById('a-rejected').textContent = a.rejected;

  const pendingBadge = document.getElementById('pending-badge');
  const total = a.pendingLeave + a.pendingOutpass;
  if (total > 0) { pendingBadge.textContent = total; pendingBadge.classList.remove('hidden'); }
  else pendingBadge.classList.add('hidden');
}

// ============ Requests ============
function isPendingForMe(r) {
  return r.status === 'Pending Department';
}

// Fixed: this app previously called the non-existent /department/requests/hod
// and /department/requests/advisor endpoints. The real endpoint is /department/requests.
async function loadRequests() {
  const data = await fetchApi('/department/requests');
  if (!data.success) {
    showToast(data.message || 'Could not load requests', 'error');
    return;
  }
  allDeptRequests = data.data;
  renderPendingOverview();
  renderDeptRequestsTable();
}

function renderPendingOverview() {
  const pending = allDeptRequests.filter(isPendingForMe).slice(0, 6);
  const tbody = document.getElementById('pending-body');
  if (!pending.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Nothing waiting on you right now.</td></tr>';
    return;
  }
  tbody.innerHTML = pending.map(r => `
    <tr class="row-click" onclick="openReview('${r._id}')">
      <td>${escapeHtml(r.student ? r.student.name : 'Unknown')}</td>
      <td>${r.type}</td>
      <td>${escapeHtml(r.type === 'Outpass' ? r.destination : r.reason)}</td>
      <td>${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}</td>
      <td><button class="btn btn-sm btn-brass" onclick="event.stopPropagation();openReview('${r._id}')">Review</button></td>
    </tr>
  `).join('');
}

function setDeptFilter(f) {
  deptFilter = f;
  document.querySelectorAll('[data-r-filter]').forEach(b => {
    const active = b.getAttribute('data-r-filter') === f;
    b.classList.toggle('btn-primary', active);
    b.classList.toggle('btn-outline', !active);
  });
  renderDeptRequestsTable();
}

function renderDeptRequestsTable() {
  const tbody = document.getElementById('dept-requests-body');
  const list = deptFilter === 'pending' ? allDeptRequests.filter(isPendingForMe) : allDeptRequests;
  if (!list.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No requests found.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(r => `
    <tr class="row-click" onclick="openReview('${r._id}')">
      <td>${escapeHtml(r.student ? r.student.name : 'Unknown')}</td>
      <td>${r.type}</td>
      <td>${escapeHtml(r.type === 'Outpass' ? r.destination : r.reason)}</td>
      <td>${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}</td>
      <td><span class="badge ${statusBadgeClass(r.status)}">${r.status}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openReview('${r._id}')">View</button></td>
    </tr>
  `).join('');
}

function openReview(id) {
  const r = allDeptRequests.find(x => x._id === id);
  if (!r) return;
  currentReviewId = id;

  document.getElementById('review-modal-title').textContent = `${r.type} · ${escapeHtml(r.student ? r.student.name : 'Unknown')}`;
  document.getElementById('review-modal-body').innerHTML = renderReviewLedger(r);

  const canAct = isPendingForMe(r);
  const approveBtn = document.getElementById('review-approve-btn');
  const rejectBtn = document.getElementById('review-reject-btn');
  approveBtn.style.display = canAct ? 'inline-flex' : 'none';
  rejectBtn.style.display = canAct ? 'inline-flex' : 'none';
  approveBtn.onclick = () => actOnRequest('Approved');
  rejectBtn.onclick = () => actOnRequest('Rejected');

  openModal('review-modal');
}

function renderReviewLedger(r) {
  const steps = [{ role: 'Student', name: r.student ? r.student.name : 'Student', meta: `Submitted ${fmtDateTime(r.createdAt)}`, state: 'done' }];

  steps.push({
    role: 'Department',
    name: r.departmentStatus === 'Pending' ? 'Awaiting review' : (r.departmentApprovedBy ? r.departmentApprovedBy.name : 'Department'),
    meta: r.departmentApprovedAt ? `${r.departmentStatus} ${fmtDateTime(r.departmentApprovedAt)}` : '',
    state: r.departmentStatus === 'Approved' ? 'done' : r.departmentStatus === 'Rejected' ? 'rejected' : (r.status === 'Pending Department' ? 'current' : '')
  });

  if (r.type === 'Outpass') {
    steps.push({
      role: 'Warden',
      name: r.wardenStatus === 'Pending' ? 'Awaiting final approval' : (r.wardenApprovedBy ? r.wardenApprovedBy.name : 'Warden'),
      meta: r.wardenApprovedAt ? `${r.wardenStatus} ${fmtDateTime(r.wardenApprovedAt)}` : '',
      state: r.wardenStatus === 'Approved' ? 'done' : r.wardenStatus === 'Rejected' ? 'rejected' : (r.status === 'Pending Warden' ? 'current' : '')
    });
  }

  const detailsHtml = `
    <div class="detail-grid" style="margin-bottom:20px;">
      <div class="detail-item"><div class="d-label">Status</div><div class="d-value"><span class="badge ${statusBadgeClass(r.status)}">${r.status}</span></div></div>
      <div class="detail-item"><div class="d-label">Dates</div><div class="d-value">${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}</div></div>
      ${r.type === 'Outpass' ? `<div class="detail-item"><div class="d-label">Destination</div><div class="d-value">${escapeHtml(r.destination || '—')}</div></div>` : ''}
      ${r.type === 'Outpass' ? `<div class="detail-item"><div class="d-label">Out / Return</div><div class="d-value">${escapeHtml(r.outTime || '—')} → ${escapeHtml(r.expectedReturnTime || '—')}</div></div>` : ''}
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
  const r = allDeptRequests.find(x => x._id === currentReviewId);
  if (!r) return;

  let rejectionReason;
  if (status === 'Rejected') {
    const result = await confirmAction({
      title: 'Reject this request?',
      message: `This will reject the ${r.type.toLowerCase()} request from ${r.student ? r.student.name : 'this student'}.`,
      okLabel: 'Reject',
      needsReason: true
    });
    if (!result) return;
    rejectionReason = result.reason;
  } else {
    const ok = await confirmAction({
      title: 'Approve this request?',
      message: `This will move the ${r.type.toLowerCase()} request forward in the approval chain.`,
      okLabel: 'Approve',
      danger: false
    });
    if (!ok) return;
  }

  const endpoint = `/department/requests/${r._id}/department`;

  const data = await fetchApi(endpoint, {
    method: 'PUT',
    body: JSON.stringify({ status, rejectionReason })
  });

  if (data.success) {
    closeModal('review-modal');
    showToast(`Request ${status.toLowerCase()}.`, 'success');
    loadRequests();
    loadAnalytics();
  } else {
    showToast(data.message || 'Could not update request', 'error');
  }
}

// ============ Students ============
async function loadStudents() {
  const data = await fetchApi('/department/students');
  if (!data.success) {
    showToast(data.message || 'Could not load students', 'error');
    return;
  }
  allStudentsCache = data.data;
  const tbody = document.getElementById('students-body');
  if (!data.data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No students in this department yet.</td></tr>';
    return;
  }
  tbody.innerHTML = data.data.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${s.year ? `Year ${s.year}` : '—'}</td>
      <td>${s.hostel ? escapeHtml(s.hostel.name) : '<span class="muted">Unallocated</span>'}</td>
      <td>${s.room ? escapeHtml(s.room.roomNumber) : '—'}</td>
    </tr>
  `).join('');
}

// ============ Advisors (HOD only) ============
async function loadAdvisors() {
  const data = await fetchApi('/department/advisors');
  if (!data.success) return;
  const tbody = document.getElementById('advisors-body');
  if (!data.data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="2">No advisors assigned yet.</td></tr>';
    return;
  }
  tbody.innerHTML = data.data.map(a => `<tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.email)}</td></tr>`).join('');
}

// ============ Attendance ============
async function loadAttendanceRoster() {
  const tbody = document.getElementById('attendance-body');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="2">Loading…</td></tr>';
  const students = allStudentsCache.length ? allStudentsCache : (await fetchApi('/department/students')).data || [];
  if (!students.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="2">No students to mark attendance for.</td></tr>';
    return;
  }
  tbody.innerHTML = students.map(s => `
    <tr data-student-id="${s._id}">
      <td>${escapeHtml(s.name)}</td>
      <td>
        <select class="att-status" style="width:160px;">
          <option value="Present" selected>Present</option>
          <option value="Absent">Absent</option>
          <option value="Leave">On Leave</option>
        </select>
      </td>
    </tr>
  `).join('');
}

async function saveAttendance() {
  const date = document.getElementById('att-date').value;
  if (!date) { showToast('Please pick a date.', 'error'); return; }
  const rows = document.querySelectorAll('#attendance-body tr[data-student-id]');
  if (!rows.length) { showToast('No students to mark.', 'error'); return; }

  const records = Array.from(rows).map(row => ({
    studentId: row.getAttribute('data-student-id'),
    status: row.querySelector('.att-status').value
  }));

  const data = await fetchApi('/department/attendance', {
    method: 'POST',
    body: JSON.stringify({ date, records })
  });

  if (data.success) showToast(`Attendance saved for ${data.count} student(s).`, 'success');
  else showToast(data.message || 'Could not save attendance', 'error');
}
