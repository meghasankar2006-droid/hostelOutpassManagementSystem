

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
    body: JSON.stringify({ email: 'test4@shanmugha.edu.in', password: 'newpassword123' })
  });
  let studentToken = (await res.json()).token;

  res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adv.cse4@shanmugha.edu.in', password: 'password123' })
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

  console.log('\n--- TEST A: ADVISOR REJECTS FIRST ---');
  res = await api('/student/requests', 'POST', studentToken, {
    type: 'Outpass',
    fromDate: '2026-10-10',
    toDate: '2026-10-10',
    outTime: '10:00',
    inTime: '18:00',
    destination: 'City Center',
    reason: 'Shopping'
  });
  let outpassId = res.data._id;
  console.log('Outpass created. ID:', outpassId);

  res = await api(`/department/requests/${outpassId}/department`, 'PUT', adv4Token, { status: 'Rejected', rejectionReason: 'Not allowed by advisor' });
  console.log('Advisor 4 rejected outpass.');
  console.log('Final status:', res.data.status);


  console.log('\n--- TEST B: HOD REJECTS FIRST ---');
  res = await api('/student/requests', 'POST', studentToken, {
    type: 'Outpass',
    fromDate: '2026-10-11',
    toDate: '2026-10-11',
    outTime: '09:00',
    inTime: '17:00',
    destination: 'Home',
    reason: 'Family Event'
  });
  let outpassId2 = res.data._id;
  console.log('Second Outpass created. ID:', outpassId2);

  res = await api(`/department/requests/${outpassId2}/department`, 'PUT', hodToken, { status: 'Rejected', rejectionReason: 'Not allowed by HOD' });
  console.log('HOD rejected outpass.');
  console.log('Final status:', res.data.status);


  console.log('\n--- TEST C: WARDEN REJECTS ---');
  res = await api('/student/requests', 'POST', studentToken, {
    type: 'Outpass',
    fromDate: '2026-10-12',
    toDate: '2026-10-12',
    outTime: '08:00',
    inTime: '19:00',
    destination: 'Doctor',
    reason: 'Checkup'
  });
  let outpassId3 = res.data._id;
  console.log('Third Outpass created. ID:', outpassId3);

  await api(`/department/requests/${outpassId3}/department`, 'PUT', hodToken, { status: 'Approved' });
  console.log('HOD approved outpass to send to warden.');

  res = await api(`/warden/requests/${outpassId3}`, 'PUT', wardenToken, { status: 'Rejected', rejectionReason: 'Too late' });
  console.log('Warden rejected outpass. Final status:', res.data.status);

  console.log('\n--- ALL REJECTION TESTS COMPLETE ---');
}
run();
