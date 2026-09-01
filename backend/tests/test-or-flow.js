const http = require('http');

async function makeReq(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port: 5000, path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log('--- STARTING OR-FLOW E2E TEST ---');
  
  const regResp = await makeReq('POST', '/api/auth/register', { name: 'E23cs021', email: 'e23cs021@shanmugha.edu.in', password: 'password123', role: 'Student', departmentName: 'CSE', year: 4, roomNumber: 'A-101', hostelName: 'Boys Hostel A' });
  if (!regResp.success) console.log('regResp:', regResp); const stuLogin = await makeReq('POST', '/api/auth/login', { email: 'e23cs021@shanmugha.edu.in', password: 'password123' });
  const stuToken = stuLogin.token;

  const advLogin = await makeReq('POST', '/api/auth/login', { email: 'adv.cse.y4@shanmugha.edu.in', password: 'password123' });
  const advToken = advLogin.token;

  const hodLogin = await makeReq('POST', '/api/auth/login', { email: 'hod.cse@shanmugha.edu.in', password: 'password123' });
  const hodToken = hodLogin.token;

  const warLogin = await makeReq('POST', '/api/auth/login', { email: 'warden.a@shanmugha.edu.in', password: 'password123' });
  const warToken = warLogin.token;

  async function createOutpass(reason) {
    const reqResp = await makeReq('POST', '/api/student/requests', {
      type: 'Outpass', reason, destination: 'Chennai', outTime: '10:00', expectedReturnTime: '18:00',
      fromDate: '2026-10-10', toDate: '2026-10-12'
    }, stuToken);
    if (!reqResp.success) { console.log(reqResp); } return reqResp.data._id;
  }

  // TEST 1: Advisor Approves -> Warden
  console.log('\\nTEST 1: Advisor Approves');
  let r1 = await createOutpass('T1');
  const t1Adv = await makeReq('PUT', '/api/department/requests/' + r1 + '/department', { status: 'Approved' }, advToken);
  console.log('Advisor Approval:', t1Adv.success);
  const t1WarCheck = await makeReq('GET', '/api/warden/requests', null, warToken);
  console.log('t1WarCheck:', t1WarCheck);
  const t1WarHasIt = t1WarCheck.data && t1WarCheck.data.find(r => r._id === r1);
  console.log('Warden receives it immediately?', !!t1WarHasIt);
  const t1WarApp = await makeReq('PUT', '/api/warden/requests/' + r1, { status: 'Approved' }, warToken);
  console.log('Warden Approval:', t1WarApp.success);
  
  // TEST 2: HOD Approves -> Warden
  console.log('\\nTEST 2: HOD Approves');
  let r2 = await createOutpass('T2');
  const t2Hod = await makeReq('PUT', '/api/department/requests/' + r2 + '/department', { status: 'Approved' }, hodToken);
  console.log('HOD Approval:', t2Hod.success);
  const t2WarCheck = await makeReq('GET', '/api/warden/requests', null, warToken);
  const t2WarHasIt = t2WarCheck.data.find(r => r._id === r2);
  console.log('Warden receives it immediately?', !!t2WarHasIt);

  // TEST 3: Advisor Rejects
  console.log('\\nTEST 3: Advisor Rejects');
  let r3 = await createOutpass('T3');
  const t3Adv = await makeReq('PUT', '/api/department/requests/' + r3 + '/department', { status: 'Rejected' }, advToken);
  console.log('Advisor Rejection:', t3Adv.success);
  const t3WarCheck = await makeReq('GET', '/api/warden/requests', null, warToken);
  const t3WarHasIt = t3WarCheck.data.find(r => r._id === r3);
  console.log('Warden receives it?', !!t3WarHasIt);

  // TEST 4: HOD Rejects
  console.log('\\nTEST 4: HOD Rejects');
  let r4 = await createOutpass('T4');
  const t4Hod = await makeReq('PUT', '/api/department/requests/' + r4 + '/department', { status: 'Rejected' }, hodToken);
  console.log('HOD Rejection:', t4Hod.success);

  // TEST 5: Advisor approves, HOD cannot
  console.log('\\nTEST 5: Advisor approves, HOD cannot duplicate');
  let r5 = await createOutpass('T5');
  await makeReq('PUT', '/api/department/requests/' + r5 + '/department', { status: 'Approved' }, advToken);
  const t5Hod = await makeReq('PUT', '/api/department/requests/' + r5 + '/department', { status: 'Approved' }, hodToken);
  console.log('HOD duplicate approval blocked?', !t5Hod.success);

  // TEST 6: HOD approves, Advisor cannot
  console.log('\\nTEST 6: HOD approves, Advisor cannot duplicate');
  let r6 = await createOutpass('T6');
  await makeReq('PUT', '/api/department/requests/' + r6 + '/department', { status: 'Approved' }, hodToken);
  const t6Adv = await makeReq('PUT', '/api/department/requests/' + r6 + '/department', { status: 'Approved' }, advToken);
  console.log('Advisor duplicate approval blocked?', !t6Adv.success);

  console.log('\\n--- TESTS COMPLETED ---');
}
runTest();
