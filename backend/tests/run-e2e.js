const BASE_URL = 'http://localhost:5000/api';

async function runE2E() {
  console.log('--- E2E TEST SCRIPT ---');

  // 1. Login as SuperAdmin
  let res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hostel.com', password: 'newpassword123' })
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
  const studentEmail = 'test4@shanmugha.edu.in';
  res = await fetch(`${BASE_URL}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      email: studentEmail,
      role: 'Student',
      department: cseDept._id,
      year: 4,
      roomNumber: 'A-101',
      studentId: '23CSE999'
    })
  });
  data = await res.json();
  if(!data.success && data.message !== 'A user with this official email already exists') {
    console.error('Failed to create student:', data);
  } else {
    console.log('Student created or already exists.');
  }

  // 3. Login as Student
  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentEmail, password: 'newpassword123' })
  });
  data = await res.json();
  let studentToken = data.token;
  if(data.user && data.user.mustChangePassword) {
    console.log('Student must change password (Working as expected).');
    res = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
      body: JSON.stringify({ currentPassword: 'newpassword123', newPassword: 'newnewpassword123' })
    });
    const pwdData = await res.json();
    console.log('Student password changed.');
  }

  // 4. Test A: Apply Outpass and approve via Year 4 Advisor
  console.log('\n--- TEST A: ADVISOR APPROVES FIRST ---');
  res = await fetch(`${BASE_URL}/student/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
    body: JSON.stringify({
      type: 'Outpass',
      reason: 'Home Town',
      destination: 'Chennai',
      outTime: '06:00',
      expectedReturnTime: '18:00',
      fromDate: new Date().toISOString(),
      toDate: new Date(Date.now() + 86400000).toISOString()
    })
  });
  data = await res.json();
  if (!data.success) {
    console.error('Failed to create outpass:', data);
    process.exit(1);
  }
  let requestId = data.data._id;
  console.log('Outpass created. ID:', requestId);

  // 5. Check Year 1 Advisor (Should NOT see)
  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adv.cse.y1@shanmugha.edu.in', password: 'newpassword123' })
  });
  let adv1Token = (await res.json()).token;
  res = await fetch(`${BASE_URL}/department/requests`, { headers: { 'Authorization': `Bearer ${adv1Token}` } });
  let adv1Reqs = await res.json();
  console.log(`Year 1 Advisor sees requests count: ${adv1Reqs.count} (Should be 0)`);

  // 6. Check Year 4 Advisor (SHOULD see)
  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adv.cse.y4@shanmugha.edu.in', password: 'newpassword123' })
  });
  let adv4Token = (await res.json()).token;
  res = await fetch(`${BASE_URL}/department/requests`, { headers: { 'Authorization': `Bearer ${adv4Token}` } });
  let adv4Reqs = await res.json();
  console.log(`Year 4 Advisor sees requests count: ${adv4Reqs.count} (Should be 1)`);

  // Approve via Year 4 Advisor
  res = await fetch(`${BASE_URL}/department/requests/${requestId}/department`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adv4Token}` },
    body: JSON.stringify({ status: 'Approved' })
  });
  data = await res.json();
  if(!data.success) {
    console.error('Advisor 4 approve failed:', data);
  } else {
    console.log('Advisor 4 approved outpass.');
    console.log(`Department Approved By: ${data.data.departmentApprovedByName}`);
    console.log(`Role: ${data.data.departmentApprovedByRole}`);
  }

  // 7. Check Warden
  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'warden.a@shanmugha.edu.in', password: 'newpassword123' })
  });
  let wardenToken = (await res.json()).token;
  res = await fetch(`${BASE_URL}/warden/requests`, { headers: { 'Authorization': `Bearer ${wardenToken}` } });
  let wardenReqs = await res.json();
  console.log(`Warden sees requests count: ${wardenReqs.count}`);

  res = await fetch(`${BASE_URL}/warden/requests/${requestId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${wardenToken}` },
    body: JSON.stringify({ status: 'Approved' })
  });
  data = await res.json();
  if(!data.success) {
    console.error('Warden approve failed:', data);
  } else {
    console.log(`Warden approved outpass. Final status: ${data.data.status}`);
  }


  // 8. Test B: Apply Outpass and approve via HOD
  console.log('\n--- TEST B: HOD APPROVES FIRST ---');
  res = await fetch(`${BASE_URL}/student/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
    body: JSON.stringify({
      type: 'Outpass',
      reason: 'Home Town',
      destination: 'Trichy',
      outTime: '06:00',
      expectedReturnTime: '18:00',
      fromDate: new Date().toISOString(),
      toDate: new Date(Date.now() + 86400000).toISOString()
    })
  });
  data = await res.json();
  requestId = data.data._id;
  console.log('Second Outpass created. ID:', requestId);

  // Login as HOD
  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hod.cse@shanmugha.edu.in', password: 'newpassword123' })
  });
  let hodToken = (await res.json()).token;

  // Approve via HOD
  res = await fetch(`${BASE_URL}/department/requests/${requestId}/department`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hodToken}` },
    body: JSON.stringify({ status: 'Approved' })
  });
  data = await res.json();
  if(!data.success) {
    console.error('HOD approve failed:', data);
  } else {
    console.log('HOD approved outpass.');
    console.log(`Department Approved By: ${data.data.departmentApprovedByName}`);
    console.log(`Role: ${data.data.departmentApprovedByRole}`);
  }

  // Warden Approves
  res = await fetch(`${BASE_URL}/warden/requests/${requestId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${wardenToken}` },
    body: JSON.stringify({ status: 'Approved' })
  });
  data = await res.json();
  if(!data.success) {
    console.error('Warden approve failed:', data);
  } else {
    console.log(`Warden approved outpass. Final status: ${data.data.status}`);
  }

  // 9. Test C: Leave Request
  console.log('\n--- TEST C: LEAVE REQUEST ---');
  res = await fetch(`${BASE_URL}/student/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
    body: JSON.stringify({ type: 'Leave', fromDate: '2025-01-01', toDate: '2025-01-05', reason: 'Home' })
  });
  let leaveReq = await res.json();
  let leaveId = leaveReq.data._id;
  console.log(`Leave created. ID: ${leaveId}`);

  // HOD Approves
  res = await fetch(`${BASE_URL}/department/requests/${leaveId}/department`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hodToken}` },
    body: JSON.stringify({ status: 'Approved' })
  });
  data = await res.json();
  console.log('HOD approved leave.');
  
  // Warden Approves
  res = await fetch(`${BASE_URL}/warden/requests/${leaveId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${wardenToken}` },
    body: JSON.stringify({ status: 'Approved' })
  });
  data = await res.json();
  console.log(`Warden approved leave. Final status: ${data.data.status}`);

  console.log('\n--- ALL E2E API VERIFICATIONS COMPLETE ---');
}
runE2E().catch(err => console.error(err));
