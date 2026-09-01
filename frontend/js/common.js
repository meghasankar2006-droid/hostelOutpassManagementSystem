/* ============================================================
   Shared runtime for every dashboard: auth guard, API fetch,
   toasts, a real confirm modal, sidebar nav, notification bell.
   Loaded on every dashboard page before the page-specific JS.
   ============================================================ */

// --- API base: same-origin relative path, works regardless of host/port ---
const API_BASE = '/api';

const ROLE_LABEL = {
  SuperAdmin: 'Super Admin',
  HOD: 'HOD',
  Advisor: 'Advisor',
  Warden: 'Warden',
  Student: 'Student'
};

const ROLE_HOME = {
  SuperAdmin: 'admin-dashboard.html',
  Student: 'student-dashboard.html',
  Advisor: 'department-dashboard.html',
  HOD: 'department-dashboard.html',
  Warden: 'warden-dashboard.html'
};

function getToken() { return localStorage.getItem('token'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch (e) { return null; }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

/**
 * Auth guard: run at the very top of every dashboard page.
 * Redirects to login if not authenticated, or to the correct
 * dashboard if the logged-in role doesn't match this page.
 */
function requireRole(...allowedRoles) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    window.location.href = 'index.html';
    return null;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    window.location.href = ROLE_HOME[user.role] || 'index.html';
    return null;
  }
  return user;
}

/**
 * fetchApi: wraps fetch with auth header, JSON handling, and
 * automatic logout on an expired/invalid token (401).
 */
async function fetchApi(endpoint, options = {}) {
  const token = getToken();
  const finalOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  };

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, finalOptions);
  } catch (networkErr) {
    return { success: false, message: 'Network error — please check the server is running.', networkError: true };
  }

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
    return { success: false, message: 'Session expired' };
  }

  let data;
  try { data = await response.json(); }
  catch (e) { data = { success: false, message: 'Unexpected server response' }; }
  return data;
}

// ============ Toasts ============
function ensureToastStack() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

const TOAST_ICONS = {
  success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
  error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

function showToast(message, type = 'info', duration = 4200) {
  const stack = ensureToastStack();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span><span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .2s ease, transform .2s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(16px)';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// ============ Confirm modal (replaces window.confirm) ============
function ensureConfirmModal() {
  let el = document.getElementById('confirm-modal-overlay');
  if (el) return el;
  el = document.createElement('div');
  el.className = 'modal-overlay';
  el.id = 'confirm-modal-overlay';
  el.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <div class="modal-head"><h3 id="confirm-modal-title">Are you sure?</h3></div>
      <div class="modal-body">
        <p id="confirm-modal-msg" style="color:var(--text-600);font-size:13.5px;"></p>
        <div class="field hidden" id="confirm-modal-reason-wrap" style="margin-top:14px;">
          <label for="confirm-modal-reason">Reason</label>
          <textarea id="confirm-modal-reason" placeholder="Explain why..."></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" id="confirm-modal-cancel">Cancel</button>
        <button class="btn btn-danger" id="confirm-modal-ok">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  return el;
}

/**
 * confirmAction: promise-based replacement for window.confirm/prompt.
 * opts: { title, message, okLabel, danger (bool), needsReason (bool) }
 * resolves to false if cancelled, or { reason } / true if confirmed.
 */
function confirmAction(opts = {}) {
  return new Promise((resolve) => {
    const el = ensureConfirmModal();
    el.querySelector('#confirm-modal-title').textContent = opts.title || 'Are you sure?';
    el.querySelector('#confirm-modal-msg').textContent = opts.message || 'This action cannot be undone.';
    const okBtn = el.querySelector('#confirm-modal-ok');
    okBtn.textContent = opts.okLabel || 'Confirm';
    okBtn.className = `btn ${opts.danger === false ? 'btn-primary' : 'btn-danger'}`;
    const reasonWrap = el.querySelector('#confirm-modal-reason-wrap');
    const reasonInput = el.querySelector('#confirm-modal-reason');
    reasonInput.value = '';
    if (opts.needsReason) reasonWrap.classList.remove('hidden');
    else reasonWrap.classList.add('hidden');

    el.classList.add('active');

    function cleanup(result) {
      el.classList.remove('active');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      el.removeEventListener('click', onOverlay);
      resolve(result);
    }
    function onOk() {
      if (opts.needsReason && !reasonInput.value.trim()) {
        reasonInput.classList.add('invalid');
        reasonInput.focus();
        return;
      }
      cleanup(opts.needsReason ? { reason: reasonInput.value.trim() } : true);
    }
    function onCancel() { cleanup(false); }
    function onOverlay(e) { if (e.target === el) cleanup(false); }

    const cancelBtn = el.querySelector('#confirm-modal-cancel');
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    el.addEventListener('click', onOverlay);
  });
}

// ============ Generic modal open/close ============
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

// ============ Helpers ============
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function statusBadgeClass(status) {
  if (!status) return 'badge-neutral';
  if (status.includes('Pending')) return 'badge-pending';
  if (status === 'Approved' || status === 'Resolved') return 'badge-approved';
  if (status === 'Rejected' || status === 'Dismissed') return 'badge-rejected';
  if (status === 'In Progress' || status === 'Under Review') return 'badge-info';
  return 'badge-neutral';
}
function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ============ Shell wiring: runs on every dashboard page ============
document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (!user) return; // page-level requireRole() already handled the redirect

  // User chip
  document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = user.name);
  document.querySelectorAll('[data-user-email]').forEach(el => el.textContent = user.email);
  document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = ROLE_LABEL[user.role] || user.role);
  document.querySelectorAll('[data-user-avatar]').forEach(el => el.textContent = initials(user.name));

  // Sidebar nav switching
  const navLinks = document.querySelectorAll('.nav-link[data-target]');
  const viewSections = document.querySelectorAll('.view-section');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      viewSections.forEach(section => section.style.display = 'none');
      const targetId = `view-${link.getAttribute('data-target')}`;
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.style.display = 'block';
        if (typeof onViewShown === 'function') onViewShown(link.getAttribute('data-target'));
      }
      closeSidebarMobile();
    });
  });

  // Logout
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmAction({
        title: 'Log out?',
        message: 'You\u2019ll need to sign in again to access your dashboard.',
        okLabel: 'Log out',
        danger: false
      });
      if (ok) logout();
    });
  });

  // Mobile sidebar toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (scrim) scrim.classList.toggle('active');
    });
  }
  if (scrim) scrim.addEventListener('click', closeSidebarMobile);

  // Notifications bell
  initNotifications();

  document.body.classList.remove('auth-pending');
});

function closeSidebarMobile() {
  const sidebar = document.querySelector('.sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  if (sidebar) sidebar.classList.remove('open');
  if (scrim) scrim.classList.remove('active');
}

// ============ Notifications ============
async function initNotifications() {
  const bell = document.getElementById('notif-bell');
  const panel = document.getElementById('notif-panel');
  if (!bell || !panel) return;

  bell.addEventListener('click', async (e) => {
    e.stopPropagation();
    panel.classList.toggle('active');
    if (panel.classList.contains('active')) await loadNotifications();
  });
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== bell) panel.classList.remove('active');
  });

  await refreshNotifBadge();
  setInterval(refreshNotifBadge, 30000);
}

async function refreshNotifBadge() {
  const dot = document.getElementById('notif-dot');
  if (!dot) return;
  const data = await fetchApi('/notifications');
  if (data.success && data.unread > 0) dot.classList.remove('hidden');
  else dot.classList.add('hidden');
}

async function loadNotifications() {
  const panel = document.getElementById('notif-panel');
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div class="notif-item"><span class="muted">Loading…</span></div>';

  const data = await fetchApi('/notifications');
  if (!data.success) {
    list.innerHTML = `<div class="notif-item"><span class="muted">${escapeHtml(data.message || 'Could not load notifications')}</span></div>`;
    return;
  }
  if (!data.data.length) {
    list.innerHTML = '<div class="notif-item"><span class="muted">No notifications yet.</span></div>';
    return;
  }
  list.innerHTML = data.data.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n._id}" onclick="markNotifRead('${n._id}')">
      <div class="n-msg">${escapeHtml(n.message)}</div>
      <div class="n-time">${fmtDateTime(n.createdAt)}</div>
    </div>
  `).join('');

  if (data.unread > 0) {
    const markAllBtn = document.getElementById('notif-mark-all');
    if (markAllBtn) markAllBtn.classList.remove('hidden');
  }
}

async function markNotifRead(id) {
  await fetchApi(`/notifications/${id}/read`, { method: 'PUT' });
  await refreshNotifBadge();
  await loadNotifications();
}

async function markAllNotifsRead() {
  await fetchApi('/notifications/read-all', { method: 'PUT' });
  await refreshNotifBadge();
  await loadNotifications();
}
