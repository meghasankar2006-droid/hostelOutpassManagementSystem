const BASE_URL = 'http://localhost:5000/api';

async function api(path, method, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  return await res.json();
}

async function run() {
  console.log('--- REJECTION TESTS ---');

  let res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test4@shanmugha.edu.in', password: 'password123' })
  });
  let studentData = await res.json();
  if(!studentData.success) {
    console.error("Student login failed:", studentData);
    process.exit(1);
  }
  let studentToken = studentData.token;

  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adv.cse.y4@shanmugha.edu.in', password: 'password123' })
  });
  let adv4Token = (await res.json()).token;

  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hod.cse@shanmugha.edu.in', password: 'password123' })
  });
  let hodToken = (await res.json()).token;

  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'warden.a@shanmugha.edu.in', password: 'password123' })
  });
  let wardenToken = (await res.json()).token;

  console.log('\n--- TEST A: WARDEN APPROVES ---');
  res = await api('/student/requests', 'POST', studentToken, {
    type: 'Outpass',
    fromDate: '2026-10-10',
    toDate: '2026-10-10',
    outTime: '10:00',
    expectedReturnTime: '18:00',
    destination: 'City Center',
    reason: 'Shopping'
  });
   if(!res.success) { console.error(res); process.exit(1); }
  let outpassId = res.data._id;
  console.log('Outpass created. ID:', outpassId);

  res = await api(`/department/requests/${outpassId}/department`, 'PUT', adv4Token, { status: 'Approved' });
  if(!res.success) { console.error(res); process.exit(1); } console.log('Advisor 4 approved outpass.');
  
  res = await api(`/warden/requests/${outpassId}`, 'PUT', wardenToken, { status: 'Approved' });
  if(!res.success) console.error(res); else if(!res.success) { console.error(res); process.exit(1); } console.log('Warden approved outpass. Final status:', res.data.status);


  console.log('\n--- TEST B: HOD REJECTS ---');
  res = await api('/student/requests', 'POST', studentToken, {
    type: 'Outpass',
    fromDate: '2026-10-11',
    toDate: '2026-10-11',
    outTime: '09:00',
    expectedReturnTime: '17:00',
    destination: 'Home',
    reason: 'Family Event'
  });
  if(!res.success) { console.error(res); process.exit(1); }
  let outpassId2 = res.data._id;
  console.log('Second Outpass created. ID:', outpassId2);

  res = await api(`/department/requests/${outpassId2}/department`, 'PUT', hodToken, { status: 'Rejected', rejectionReason: 'Not allowed by HOD' });
  console.log('HOD rejected outpass.');


  console.log('\n--- TEST C: ADVISOR REJECTS ---');
  res = await api('/student/requests', 'POST', studentToken, {
    type: 'Outpass',
    fromDate: '2026-10-12',
    toDate: '2026-10-12',
    outTime: '08:00',
    expectedReturnTime: '19:00',
    destination: 'Doctor',
    reason: 'Checkup'
  });
  if(!res.success) { console.error(res); process.exit(1); }
  let outpassId3 = res.data._id;
  console.log('Third Outpass created. ID:', outpassId3);

  res = await api(`/department/requests/${outpassId3}/department`, 'PUT', adv4Token, { status: 'Rejected', rejectionReason: 'Too late' });
  console.log('Advisor rejected outpass. Final status:', res.data.status);

  console.log('\n--- TEST D: WARDEN REJECTS ---');
  res = await api('/student/requests', 'POST', studentToken, {
    type: 'Outpass',
    fromDate: '2026-10-13',
    toDate: '2026-10-13',
    outTime: '08:00',
    expectedReturnTime: '19:00',
    destination: 'Doctor',
    reason: 'Checkup'
  });
  if(!res.success) { console.error(res); process.exit(1); }
  let outpassId4 = res.data._id;
  console.log('Fourth Outpass created. ID:', outpassId4);

  await api(`/department/requests/${outpassId4}/department`, 'PUT', adv4Token, { status: 'Approved' });
  console.log('Advisor approved outpass.');

  res = await api(`/warden/requests/${outpassId4}`, 'PUT', wardenToken, { status: 'Rejected', rejectionReason: 'Warden disallowed' });
  console.log('Warden rejected outpass.');

  console.log('\n--- ALL E2E API VERIFICATIONS COMPLETE ---');
}
run();
