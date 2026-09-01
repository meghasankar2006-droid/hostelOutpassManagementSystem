document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, skip straight to the right dashboard
  const existingToken = localStorage.getItem('token');
  const existingUser = JSON.parse(localStorage.getItem('user') || 'null');
  if (existingToken && existingUser) {
    window.location.href = ROLE_HOME[existingUser.role] || 'index.html';
    return;
  }

  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const btnLabel = document.getElementById('login-btn-label');
  const btnSpinner = document.getElementById('login-spinner');
  const errorBox = document.getElementById('login-error');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const roleTabs = document.querySelectorAll('.role-tab');
  const demoBox = document.getElementById('demo-creds-box');

  const DEMO = {
    SuperAdmin: { email: 'admin@hostel.com', label: 'Super Admin' },
    Department: { email: 'hod.cs@hostel.com', label: 'Department (HOD/Advisor)' },
    Warden: { email: 'warden.a@hostel.com', label: 'Warden' },
    Student: { email: 'student1@hostel.com', label: 'Student' }
  };

  let selectedRole = 'Student';

  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      roleTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedRole = tab.getAttribute('data-role');
      updateDemoHint();
    });
  });

  function updateDemoHint() {
    if (!demoBox) return;
    const demo = DEMO[selectedRole];
    demoBox.innerHTML = `
      <strong>Demo access (after seeding)</strong>
      <div class="row"><span>${demo.label}</span><span>${demo.email}</span></div>
      <div class="row"><span>Password</span><span>password123</span></div>
    `;
  }
  updateDemoHint();

  // Password visibility toggle
  const toggleBtn = document.querySelector('.toggle-visibility');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      toggleBtn.innerHTML = isPassword ? eyeOffIcon() : eyeIcon();
    });
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        const home = ROLE_HOME[data.user.role];
        if (!home) {
          showError('Unknown user role — contact your Super Admin.');
          setLoading(false);
          return;
        }

        if (data.user.mustChangePassword) {
          // Show change password form
          loginForm.classList.add('hidden');
          document.querySelector('.role-tabs').classList.add('hidden');
          document.getElementById('change-password-form').classList.remove('hidden');
          document.querySelector('h2').textContent = 'Change Password';
          document.querySelector('.lede').textContent = 'Please set a new password to continue.';
          setLoading(false);
          return;
        }

        btnLabel.textContent = 'Success — redirecting…';
        setTimeout(() => { window.location.replace(home); }, 400);
      } else {
        showError(data.message || 'Login failed. Please check your credentials.');
        setLoading(false);
      }
    } catch (err) {
      showError('Network error — make sure the server is running.');
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    btnSpinner.classList.toggle('hidden', !isLoading);
    btnLabel.textContent = isLoading ? 'Signing in…' : 'Sign in';
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
    emailInput.classList.add('invalid');
    passwordInput.classList.add('invalid');
  }
  function hideError() {
    errorBox.classList.add('hidden');
    emailInput.classList.remove('invalid');
    passwordInput.classList.remove('invalid');
  }

  function eyeIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
  function eyeOffIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a21.7 21.7 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  }
});
