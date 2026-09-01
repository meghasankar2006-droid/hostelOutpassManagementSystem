const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const loginResp = JSON.parse(data);
    if (!loginResp.token) {
      console.error('Login failed', loginResp);
      return;
    }
    
    // Now fetch requests
    const reqOpts = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/department/requests',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginResp.token}`
      }
    };
    
    http.get(reqOpts, (resp) => {
      let rData = '';
      resp.on('data', chunk => rData += chunk);
      resp.on('end', () => {
        console.log('Requests Response:', rData);
      });
    });
    
    // Fetch analytics
    const anOpts = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/department/analytics',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginResp.token}`
      }
    };
    
    http.get(anOpts, (resp) => {
      let rData = '';
      resp.on('data', chunk => rData += chunk);
      resp.on('end', () => {
        console.log('Analytics Response:', rData);
      });
    });
  });
});

req.write(JSON.stringify({ email: 'hod.cse@shanmugha.edu.in', password: 'password123' }));
req.end();
