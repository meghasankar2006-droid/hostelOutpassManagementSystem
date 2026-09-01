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
  console.log('--- STARTING E2E TEST ---');
  
  // 1. Create a student by registering directly
  console.log('Registering student...');
  const regResp = await makeReq('POST', '/api/auth/register', {
    name: 'E23cs021', email: 'e23cs021@shanmugha.edu.in', password: 'password123',
    role: 'Student', departmentName: 'CSE', year: 4, roomNumber: 'A-101', hostelName: 'Boys Hostel A'
  });
  console.log('Student Registration:', regResp.success ? 'Success' : regResp.message);

  // 2. Login Student
  const stuLogin = await makeReq('POST', '/api/auth/login', { email: 'e23cs021@shanmugha.edu.in', password: 'password123' });
  const stuToken = stuLogin.token;

  // 3. Apply Outpass
  console.log('\\nApplying for Outpass...');
  const reqResp = await makeReq('POST', '/api/student/requests', {
    type: 'Outpass', reason: 'Home', destination: 'Chennai', outTime: '10:00', expectedReturnTime: '18:00',
    fromDate: '2026-10-10', toDate: '2026-10-12'
  }, stuToken);
  
  if (!reqResp.success) {
    console.log('Failed to create outpass:', reqResp);
    return;
  }
  const reqId = reqResp.data._id;
  console.log('Outpass created. ID:', reqId);

  // 4. Advisor Login & Approve
  console.log('\\nAdvisor Login...');
  const advLogin = await makeReq('POST', '/api/auth/login', { email: 'adv.cse.y4@shanmugha.edu.in', password: 'password123' });
  const advToken = advLogin.token;
  
  console.log('Advisor checking requests...');
  const advReqs = await makeReq('GET', '/api/department/requests', null, advToken);
  const foundByAdv = advReqs.data.find(r => r._id === reqId);
  console.log('Visible to Advisor?', foundByAdv ? 'Yes (Status: ' + foundByAdv.status + ')' : 'No');
  
  console.log('Advisor Approving...');
  const advApprove = await makeReq('PUT', '/api/department/requests/' + reqId + '/department', { status: 'Approved' }, advToken);
  console.log('Advisor Approval:', advApprove.success ? 'Success' : advApprove.message);

  // 5. HOD Login & Approve
  console.log('\\nHOD Login...');
  const hodLogin = await makeReq('POST', '/api/auth/login', { email: 'hod.cse@shanmugha.edu.in', password: 'password123' });
  const hodToken = hodLogin.token;

  console.log('HOD checking requests...');
  const hodReqs = await makeReq('GET', '/api/department/requests', null, hodToken);
  const foundByHod = hodReqs.data.find(r => r._id === reqId);
  console.log('Visible to HOD?', foundByHod ? 'Yes (Status: ' + foundByHod.status + ')' : 'No');

  console.log('HOD Approving...');
  const hodApprove = await makeReq('PUT', '/api/department/requests/' + reqId + '/department', { status: 'Approved' }, hodToken);
  console.log('HOD Approval:', hodApprove.success ? 'Success' : hodApprove.message);

  // 6. Warden Login & Approve
  console.log('\\nWarden Login...');
  const warLogin = await makeReq('POST', '/api/auth/login', { email: 'warden.a@shanmugha.edu.in', password: 'password123' });
  const warToken = warLogin.token;

  console.log('Warden checking requests...');
  const warReqs = await makeReq('GET', '/api/warden/requests', null, warToken);
  const foundByWar = warReqs.data.find(r => r._id === reqId);
  console.log('Visible to Warden?', foundByWar ? 'Yes (Status: ' + foundByWar.status + ')' : 'No');

  console.log('Warden Approving...');
  const warApprove = await makeReq('PUT', '/api/warden/requests/' + reqId, { status: 'Approved' }, warToken);
  console.log('Warden Approval:', warApprove.success ? 'Success' : warApprove.message);

  // 7. Check final status
  console.log('\\nChecking final Student status...');
  const finalCheck = await makeReq('GET', '/api/student/requests', null, stuToken);
  const finalReq = finalCheck.data.find(r => r._id === reqId);
  console.log('Final Status:', finalReq.status);

  console.log('\\n--- TEST COMPLETED SUCCESSFULLY ---');
}
runTest();
