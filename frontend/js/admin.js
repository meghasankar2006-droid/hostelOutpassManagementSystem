const user = requireRole('SuperAdmin');

let allUsers = [];
let allDepartments = [];
let allHostels = [];
let allBlocks = [];
let allRooms = [];
let editingUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!user) return;
  loadAnalytics();
  loadUsers();
  loadDepartments();
  loadHostels();
  loadBlocksAndRooms();

  document.getElementById('user-form').addEventListener('submit', saveUser);
  document.getElementById('dept-form').addEventListener('submit', saveDept);
  document.getElementById('hostel-form').addEventListener('submit', saveHostel);
  document.getElementById('block-form').addEventListener('submit', saveBlock);
  document.getElementById('room-form').addEventListener('submit', saveRoom);
  document.getElementById('allocate-form').addEventListener('submit', saveAllocation);
});

// ============ Analytics ============
async function loadAnalytics() {
  const data = await fetchApi('/admin/analytics');
  if (!data.success) { showToast(data.message || 'Could not load analytics', 'error'); return; }
  const a = data.data;
  document.getElementById('s-departments').textContent = a.totalDepartments;
  document.getElementById('s-students').textContent = a.totalStudents;
  document.getElementById('s-hods').textContent = a.totalHODs;
  document.getElementById('s-advisors').textContent = a.totalAdvisors;
  document.getElementById('s-wardens').textContent = a.totalWardens;
  document.getElementById('s-hostels').textContent = a.totalHostels;
  document.getElementById('s-rooms').textContent = a.totalRooms;
  document.getElementById('s-occupied').textContent = a.occupiedRooms;
  document.getElementById('s-available').textContent = a.availableRooms;
  document.getElementById('s-occ-pct').textContent = `${a.occupancyPercentage}%`;
  document.getElementById('s-pending-req').textContent = a.pendingRequests;
  document.getElementById('s-pending-comp').textContent = a.pendingComplaints;
}

// ============ Users ============
async function loadUsers() {
  const role = document.getElementById('user-role-filter').value;
  const data = await fetchApi(`/admin/users${role ? `?role=${role}` : ''}`);
  if (!data.success) { showToast(data.message || 'Could not load users', 'error'); return; }
  allUsers = data.data;
  const tbody = document.getElementById('users-body');
  if (!data.data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No users found.</td></tr>';
    return;
  }
  tbody.innerHTML = data.data.map(u => `
    <tr>
      <td>${escapeHtml(u.name)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="badge badge-info">${u.role}</span></td>
      <td>${u.department ? escapeHtml(u.department.name) : (u.hostel ? escapeHtml(u.hostel.name) : '<span class="muted">—</span>')}</td>
      <td><span class="badge ${u.isActive ? 'badge-approved' : 'badge-neutral'}">${u.isActive ? 'Active' : 'Disabled'}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="openUserModal('${u._id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleUserActive('${u._id}')">${u.isActive ? 'Disable' : 'Enable'}</button>
          <button class="btn btn-ghost btn-sm" onclick="resetUserPassword('${u._id}', '${escapeHtml(u.email)}')">Reset PW</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--bad-600);" onclick="deleteUser('${u._id}', '${escapeHtml(u.name)}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function populateDeptAndHostelSelects() {
  const deptSelect = document.getElementById('u-department');
  deptSelect.innerHTML = allDepartments.map(d => `<option value="${d._id}">${escapeHtml(d.name)}</option>`).join('') || '<option value="">No departments yet</option>';
  const hostelSelect = document.getElementById('u-hostel');
  hostelSelect.innerHTML = allHostels.map(h => `<option value="${h._id}">${escapeHtml(h.name)}</option>`).join('') || '<option value="">No hostels yet</option>';
}

function openUserModal(id) {
  document.getElementById('user-form').reset();
  populateDeptAndHostelSelects();
  editingUserId = id || null;
  document.getElementById('u-id').value = id || '';
  document.getElementById('user-modal-title').textContent = id ? 'Edit User' : 'Add User';

  if (id) {
    const u = allUsers.find(x => x._id === id);
    if (u) {
      document.getElementById('u-role').value = u.role;
      document.getElementById('u-email').value = u.email;
      updateUserFormFields();
      if (u.department) document.getElementById('u-department').value = u.department._id || u.department;
      if (u.hostel) document.getElementById('u-hostel').value = u.hostel._id || u.hostel;
      if (u.roomNumber) document.getElementById('u-room-number').value = u.roomNumber;
    }
  } else {
    document.getElementById('u-role').value = 'Student';
    updateUserFormFields();
  }
  openModal('user-modal');
}

function updateUserFormFields() {
  const role = document.getElementById('u-role').value;
  document.getElementById('u-department-field').classList.toggle('hidden', !['Student', 'HOD', 'Advisor'].includes(role));
  document.getElementById('u-hostel-field').classList.toggle('hidden', role !== 'Warden');
  document.getElementById('u-room-number-field').classList.toggle('hidden', role !== 'Student');
  document.getElementById('u-student-id-field').classList.toggle('hidden', role !== 'Student');
  document.getElementById('u-year-field').classList.toggle('hidden', !['Student', 'Advisor'].includes(role));
}

async function saveUser(e) {
  e.preventDefault();
  const role = document.getElementById('u-role').value;
  const payload = {
    email: document.getElementById('u-email').value.trim(),
    role
  };
  if (['Student', 'HOD', 'Advisor'].includes(role)) payload.department = document.getElementById('u-department').value;
  if (['Student', 'Advisor'].includes(role)) payload.year = document.getElementById('u-year').value;
  
  if (role === 'Student') {
    payload.roomNumber = document.getElementById('u-room-number').value.trim();
    payload.studentId = document.getElementById('u-student-id').value.trim();
  }
  if (role === 'Warden') payload.hostel = document.getElementById('u-hostel').value;

  let data;
  if (editingUserId) {
    data = await fetchApi(`/admin/users/${editingUserId}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    data = await fetchApi('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
  }

  if (data.success) {
    closeModal('user-modal');
    showToast(editingUserId ? 'User updated.' : 'User created.', 'success');
    loadUsers();
    loadAnalytics();
  } else {
    showToast(data.message || 'Could not save user', 'error');
  }
}

async function toggleUserActive(id) {
  const data = await fetchApi(`/admin/users/${id}/toggle-active`, { method: 'PUT' });
  if (data.success) { showToast('User status updated.', 'success'); loadUsers(); }
  else showToast(data.message || 'Could not update status', 'error');
}

async function resetUserPassword(id, email) {
  const pwResult = await confirmAction({
    title: `New password for ${email}`,
    message: 'Enter a temporary password (min 6 characters) the user will use to sign in.',
    okLabel: 'Set password',
    needsReason: true,
    danger: false
  });
  if (!pwResult || !pwResult.reason || pwResult.reason.length < 6) {
    if (pwResult) showToast('Password must be at least 6 characters.', 'error');
    return;
  }
  const data = await fetchApi(`/admin/users/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ newPassword: pwResult.reason }) });
  if (data.success) showToast('Password reset.', 'success');
  else showToast(data.message || 'Could not reset password', 'error');
}

async function deleteUser(id, name) {
  const ok = await confirmAction({ title: 'Delete this user?', message: `${name} will be permanently removed, including their room allocation if any.`, okLabel: 'Delete' });
  if (!ok) return;
  const data = await fetchApi(`/admin/users/${id}`, { method: 'DELETE' });
  if (data.success) { showToast('User deleted.', 'success'); loadUsers(); loadAnalytics(); }
  else showToast(data.message || 'Could not delete user', 'error');
}

// ============ Departments ============
async function loadDepartments() {
  const data = await fetchApi('/admin/departments');
  if (!data.success) { showToast(data.message || 'Could not load departments', 'error'); return; }
  allDepartments = data.data;
  const tbody = document.getElementById('departments-body');
  if (!data.data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No departments yet.</td></tr>';
    return;
  }
  tbody.innerHTML = data.data.map(d => `
    <tr>
      <td>${escapeHtml(d.name)}</td>
      <td>${d.hod ? escapeHtml(d.hod.name) : '<span class="muted">Unassigned</span>'}</td>
      <td>${d.advisors && d.advisors.length ? d.advisors.map(a => escapeHtml(a.name)).join(', ') : '<span class="muted">None</span>'}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openDeptModal('${d._id}')">Edit</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--bad-600);" onclick="deleteDept('${d._id}', '${escapeHtml(d.name)}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function openDeptModal(id) {
  document.getElementById('dept-form').reset();
  document.getElementById('d-id').value = id || '';
  document.getElementById('dept-modal-title').textContent = id ? 'Edit Department' : 'Add Department';
  if (id) {
    const d = allDepartments.find(x => x._id === id);
    if (d) document.getElementById('d-name').value = d.name;
  }
  openModal('dept-modal');
}

async function saveDept(e) {
  e.preventDefault();
  const id = document.getElementById('d-id').value;
  const name = document.getElementById('d-name').value.trim();
  const data = id
    ? await fetchApi(`/admin/departments/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })
    : await fetchApi('/admin/departments', { method: 'POST', body: JSON.stringify({ name }) });
  if (data.success) {
    closeModal('dept-modal');
    showToast(id ? 'Department updated.' : 'Department created.', 'success');
    loadDepartments();
    loadAnalytics();
  } else {
    showToast(data.message || 'Could not save department', 'error');
  }
}

async function deleteDept(id, name) {
  const ok = await confirmAction({ title: 'Delete this department?', message: `"${name}" will be removed. This fails if any users are still linked to it.`, okLabel: 'Delete' });
  if (!ok) return;
  const data = await fetchApi(`/admin/departments/${id}`, { method: 'DELETE' });
  if (data.success) { showToast('Department deleted.', 'success'); loadDepartments(); loadAnalytics(); }
  else showToast(data.message || 'Could not delete department', 'error');
}

// ============ Hostels & Blocks ============
async function loadHostels() {
  const data = await fetchApi('/admin/hostels');
  if (!data.success) { showToast(data.message || 'Could not load hostels', 'error'); return; }
  allHostels = data.data;
  renderHostels();
}

function renderHostels() {
  const container = document.getElementById('hostels-container');
  if (!allHostels.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="glyph"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>
        <h4>No hostels yet</h4>
        <p>Add your first hostel to start creating blocks and rooms.</p>
      </div>`;
    return;
  }
  container.innerHTML = allHostels.map(h => `
    <div class="card section-card">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(h.name)}</h3>
          <p class="hint" style="margin-top:2px;">Warden: ${h.warden ? escapeHtml(h.warden.name) : 'Unassigned'}</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm btn-outline" onclick="openBlockModal(null, '${h._id}')">+ Block</button>
          <button class="btn btn-sm btn-ghost" onclick="openHostelModal('${h._id}')">Edit</button>
          <button class="btn btn-sm btn-ghost" style="color:var(--bad-600);" onclick="deleteHostel('${h._id}', '${escapeHtml(h.name)}')">Delete</button>
        </div>
      </div>
      <div class="section-body">
        ${h.blocks && h.blocks.length ? `
          <div class="table-wrap"><table><thead><tr><th>Block</th><th></th></tr></thead><tbody>
            ${h.blocks.map(b => `
              <tr>
                <td>${escapeHtml(b.name)}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick='openBlockModal(${JSON.stringify(JSON.stringify(b))}, "${h._id}")'>Edit</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--bad-600);" onclick="deleteBlock('${b._id}', '${escapeHtml(b.name)}')">Delete</button>
                </td>
              </tr>`).join('')}
          </tbody></table></div>
        ` : `<p class="muted" style="font-size:13px;">No blocks yet.</p>`}
      </div>
    </div>
  `).join('');
}

function openHostelModal(id) {
  document.getElementById('hostel-form').reset();
  document.getElementById('h-id').value = id || '';
  document.getElementById('hostel-modal-title').textContent = id ? 'Edit Hostel' : 'Add Hostel';

  const wardenSelect = document.getElementById('h-warden');
  const wardens = allUsers.filter(u => u.role === 'Warden');
  wardenSelect.innerHTML = '<option value="">— Unassigned —</option>' + wardens.map(w => `<option value="${w._id}">${escapeHtml(w.name)}</option>`).join('');

  if (id) {
    const h = allHostels.find(x => x._id === id);
    if (h) {
      document.getElementById('h-name').value = h.name;
      if (h.warden) wardenSelect.value = h.warden._id || h.warden;
    }
  }
  openModal('hostel-modal');
}

async function saveHostel(e) {
  e.preventDefault();
  const id = document.getElementById('h-id').value;
  const payload = { name: document.getElementById('h-name').value.trim() };
  const warden = document.getElementById('h-warden').value;
  if (warden) payload.warden = warden;
  const data = id
    ? await fetchApi(`/admin/hostels/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : await fetchApi('/admin/hostels', { method: 'POST', body: JSON.stringify(payload) });
  if (data.success) {
    closeModal('hostel-modal');
    showToast(id ? 'Hostel updated.' : 'Hostel created.', 'success');
    loadHostels();
    loadAnalytics();
  } else {
    showToast(data.message || 'Could not save hostel', 'error');
  }
}

async function deleteHostel(id, name) {
  const ok = await confirmAction({ title: 'Delete this hostel?', message: `"${name}" will be removed. This fails if it still has blocks.`, okLabel: 'Delete' });
  if (!ok) return;
  const data = await fetchApi(`/admin/hostels/${id}`, { method: 'DELETE' });
  if (data.success) { showToast('Hostel deleted.', 'success'); loadHostels(); loadAnalytics(); }
  else showToast(data.message || 'Could not delete hostel', 'error');
}

function openBlockModal(blockJson, hostelId) {
  document.getElementById('block-form').reset();
  document.getElementById('b-hostel').value = hostelId;
  const block = blockJson ? JSON.parse(blockJson) : null;
  document.getElementById('b-id').value = block ? block._id : '';
  document.getElementById('block-modal-title').textContent = block ? 'Edit Block' : 'Add Block';
  if (block) document.getElementById('b-name').value = block.name;
  openModal('block-modal');
}

async function saveBlock(e) {
  e.preventDefault();
  const id = document.getElementById('b-id').value;
  const hostel = document.getElementById('b-hostel').value;
  const name = document.getElementById('b-name').value.trim();
  const data = id
    ? await fetchApi(`/admin/blocks/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })
    : await fetchApi('/admin/blocks', { method: 'POST', body: JSON.stringify({ name, hostel }) });
  if (data.success) {
    closeModal('block-modal');
    showToast(id ? 'Block updated.' : 'Block created.', 'success');
    loadHostels();
    loadBlocksAndRooms();
  } else {
    showToast(data.message || 'Could not save block', 'error');
  }
}

async function deleteBlock(id, name) {
  const ok = await confirmAction({ title: 'Delete this block?', message: `"${name}" will be removed. This fails if it still has rooms.`, okLabel: 'Delete' });
  if (!ok) return;
  const data = await fetchApi(`/admin/blocks/${id}`, { method: 'DELETE' });
  if (data.success) { showToast('Block deleted.', 'success'); loadHostels(); loadBlocksAndRooms(); }
  else showToast(data.message || 'Could not delete block', 'error');
}

// ============ Rooms & Allocation ============
async function loadBlocksAndRooms() {
  const blocksData = await fetchApi('/admin/blocks');
  if (blocksData.success) {
    allBlocks = blocksData.data;
    const blockFilter = document.getElementById('room-block-filter');
    const roomBlockSelect = document.getElementById('r-block');
    const opts = allBlocks.map(b => `<option value="${b._id}">${escapeHtml(b.hostel ? b.hostel.name : '')} · Block ${escapeHtml(b.name)}</option>`).join('');
    blockFilter.innerHTML = '<option value="">All blocks</option>' + opts;
    roomBlockSelect.innerHTML = opts || '<option value="">Create a block first</option>';
  }
  loadRooms();
}

async function loadRooms() {
  const block = document.getElementById('room-block-filter').value;
  const data = await fetchApi(`/admin/rooms${block ? `?block=${block}` : ''}`);
  if (!data.success) { showToast(data.message || 'Could not load rooms', 'error'); return; }
  allRooms = data.data;
  const tbody = document.getElementById('rooms-body');
  if (!data.data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No rooms found.</td></tr>';
    return;
  }
  tbody.innerHTML = data.data.map(r => `
    <tr>
      <td>${escapeHtml(r.roomNumber)}</td>
      <td>${r.block ? escapeHtml(r.block.name) : '—'}</td>
      <td>${r.block && r.block.hostel ? escapeHtml(r.block.hostel.name) : '—'}</td>
      <td><span class="badge ${r.occupants.length >= r.capacity ? 'badge-approved' : 'badge-neutral'}">${r.occupants.length}/${r.capacity}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick='openRoomModal(${JSON.stringify(JSON.stringify(r))})'>Edit</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--bad-600);" onclick="deleteRoom('${r._id}', '${escapeHtml(r.roomNumber)}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function openRoomModal(roomJson) {
  document.getElementById('room-form').reset();
  const room = roomJson ? JSON.parse(roomJson) : null;
  document.getElementById('r-id').value = room ? room._id : '';
  document.getElementById('room-modal-title').textContent = room ? 'Edit Room' : 'Add Room';
  if (room) {
    document.getElementById('r-block').value = room.block ? room.block._id : '';
    document.getElementById('r-number').value = room.roomNumber;
    document.getElementById('r-capacity').value = room.capacity;
  }
  openModal('room-modal');
}

async function saveRoom(e) {
  e.preventDefault();
  const id = document.getElementById('r-id').value;
  const payload = {
    block: document.getElementById('r-block').value,
    roomNumber: document.getElementById('r-number').value.trim(),
    capacity: Number(document.getElementById('r-capacity').value)
  };
  const data = id
    ? await fetchApi(`/admin/rooms/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : await fetchApi('/admin/rooms', { method: 'POST', body: JSON.stringify(payload) });
  if (data.success) {
    closeModal('room-modal');
    showToast(id ? 'Room updated.' : 'Room created.', 'success');
    loadRooms();
    loadAnalytics();
  } else {
    showToast(data.message || 'Could not save room', 'error');
  }
}

async function deleteRoom(id, number) {
  const ok = await confirmAction({ title: 'Delete this room?', message: `Room ${number} will be removed. This fails if students are still allocated to it.`, okLabel: 'Delete' });
  if (!ok) return;
  const data = await fetchApi(`/admin/rooms/${id}`, { method: 'DELETE' });
  if (data.success) { showToast('Room deleted.', 'success'); loadRooms(); loadAnalytics(); }
  else showToast(data.message || 'Could not delete room', 'error');
}

function openAllocateModal() {
  document.getElementById('allocate-form').reset();
  const studentSelect = document.getElementById('al-student');
  const unallocated = allUsers.filter(u => u.role === 'Student' && !u.room);
  studentSelect.innerHTML = unallocated.length
    ? unallocated.map(s => `<option value="${s._id}">${escapeHtml(s.name)} (${escapeHtml(s.email)})</option>`).join('')
    : '<option value="">No unallocated students</option>';

  const roomSelect = document.getElementById('al-room');
  const available = allRooms.filter(r => r.occupants.length < r.capacity);
  roomSelect.innerHTML = available.length
    ? available.map(r => `<option value="${r._id}">${r.block ? escapeHtml(r.block.name) : ''} · ${escapeHtml(r.roomNumber)} (${r.occupants.length}/${r.capacity})</option>`).join('')
    : '<option value="">No rooms with free capacity</option>';

  openModal('allocate-modal');
}

async function saveAllocation(e) {
  e.preventDefault();
  const studentId = document.getElementById('al-student').value;
  const roomId = document.getElementById('al-room').value;
  if (!studentId || !roomId) { showToast('Select both a student and a room.', 'error'); return; }

  const data = await fetchApi('/admin/allocate', { method: 'POST', body: JSON.stringify({ studentId, roomId }) });
  if (data.success) {
    closeModal('allocate-modal');
    showToast('Student allocated.', 'success');
    loadUsers();
    loadRooms();
    loadAnalytics();
  } else {
    showToast(data.message || 'Could not allocate student', 'error');
  }
}
