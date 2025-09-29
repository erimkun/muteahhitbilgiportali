const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/file-manager.html',
  method: 'GET',
  headers: {
    'Accept': 'text/html'
  }
};

const req = http.request(options, res => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', res.headers);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('BODY SNIPPET:\n', data.slice(0, 600));
  });
});

req.on('error', err => console.error('REQUEST ERROR:', err));
req.end();
