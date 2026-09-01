const fetch = require('node-fetch');
fetch('http://localhost:5000/api/auth/login', { 
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' }, 
  body: JSON.stringify({ email: 'test4@shanmugha.edu.in', password: 'password123' }) 
})
.then(res => res.json())
.then(console.log);
