const BASE_URL = 'http://localhost:5000/api';

async function runE2E() {
  console.log('--- E2E TEST SCRIPT ---');

  // 1. Login as SuperAdmin
  let res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hostel.com', password: 'password123' })
  });
  let data = await res.json();
  const adminToken = data.token;
  console.log('SuperAdmin logged in.');

  // Get Departments
  res = await fetch(`${BASE_URL}/admin/departments`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  data = await res.json();
  const cseDept = data.data.find(d => d.name === 'CSE');

  // 2. Create Student
  res = await fetch(`${BASE_URL}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      email: 'student23@shanmugha.edu.in',
      role: 'Student',
      department: cseDept._id,
      year: 1,
      roomNumber: 'A-101',
      studentId: '23CSE999'
    })
  });
  data = await res.json();
  if(!data.success) {
    console.error('Failed to create student:', data);
  } else {
    console.log('Student created.');
  }

  // 3. Login as Student
  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student23@shanmugha.edu.in', password: 'password123' })
  });
  data = await res.json();
  let studentToken = data.token;
  if(data.user.mustChangePassword) console.log('Student must change password (Working as expected).');

  // Change Password
  res = await fetch(`${BASE_URL}/auth/change-password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
    body: JSON.stringify({ currentPassword: 'password123', newPassword: 'newpassword123' })
  });
  data = await res.json();
  console.log('Student password changed.');

  // Login with new password
  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student23@shanmugha.edu.in', password: 'newpassword123' })
  });
  data = await res.json();
  studentToken = data.token;

  // 4. Apply Outpass
  res = await fetch(`${BASE_URL}/student/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
    body: JSON.stringify({
      type: 'Outpass',
      destination: 'Hometown',
      outTime: '09:00',
      expectedReturnTime: '17:00',
      reason: 'Family function',
      fromDate: new Date(),
      toDate: new Date()
    })
  });
  data = await res.json();
  const requestId = data.data._id;
  console.log('Outpass created. ID:', requestId);

  // 5. Advisor Year 1 Login
  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adv.y1@shanmugha.edu.in', password: 'password123' })
  });
  data = await res.json();
  let adv1Token = data.token;

  // Advisor 1 change password
  await fetch(`${BASE_URL}/auth/change-password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adv1Token}` },
    body: JSON.stringify({ currentPassword: 'password123', newPassword: 'newpassword123' })
  });
  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adv.y1@shanmugha.edu.in', password: 'newpassword123' })
  });
  adv1Token = (await res.json()).token;

  // Verify request is there
  res = await fetch(`${BASE_URL}/department/requests`, {
    headers: { 'Authorization': `Bearer ${adv1Token}` }
  });
  data = await res.json();
  console.log('Adv1 sees requests count:', data.count);

  // Advisor Year 2 Login
  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adv.y2@shanmugha.edu.in', password: 'password123' })
  });
  let adv2Token = (await res.json()).token;

  res = await fetch(`${BASE_URL}/department/requests`, {
    headers: { 'Authorization': `Bearer ${adv2Token}` }
  });
  data = await res.json();
  console.log('Adv2 sees requests count:', data.count, '(Should be 0!)');

  // Advisor 1 Approves
  res = await fetch(`${BASE_URL}/department/requests/${requestId}/department`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adv1Token}` },
    body: JSON.stringify({ status: 'Approved' })
  });
  data = await res.json();
  if(!data.success) {
    console.error('Advisor 1 approve failed:', data);
  } else {
    console.log('Advisor 1 approved outpass.');
  }

  // 6. Warden Login
  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'warden.a@shanmugha.edu.in', password: 'password123' })
  });
  data = await res.json();
  let wardenToken = data.token;

  res = await fetch(`${BASE_URL}/warden/requests`, {
    headers: { 'Authorization': `Bearer ${wardenToken}` }
  });
  data = await res.json();
  console.log('Warden sees requests count:', data.count);

  // Warden Approves
  res = await fetch(`${BASE_URL}/warden/requests/${requestId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${wardenToken}` },
    body: JSON.stringify({ status: 'Approved' })
  });
  data = await res.json();
  if (!data.success) {
    console.error('Warden approve failed:', data);
  } else {
    console.log('Warden approved outpass. Final status:', data.data.status);
  }

}

runE2E();
