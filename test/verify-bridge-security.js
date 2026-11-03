import http from 'http';
import { parseTallyResponse, startBridge, server } from '../bridge/index.js';

console.log('--- Starting Comprehensive Bridge Security & Hardening Tests ---');

// Test 1: Verified Success Condition in parseTallyResponse
const zeroVouchersResponse = `<RESPONSE><CREATED>0</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS></RESPONSE>`;
const parsedZero = parseTallyResponse(zeroVouchersResponse);
console.assert(parsedZero.success === false, `Expected success === false for 0 vouchers, got ${parsedZero.success}`);
console.assert(parsedZero.status === 'FAILED', `Expected status === 'FAILED' for 0 vouchers, got ${parsedZero.status}`);
console.log('✅ Test 1 (0 Vouchers Never Returns success: true) Passed!');

const createdVouchersResponse = `<RESPONSE><CREATED>2</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS></RESPONSE>`;
const parsedCreated = parseTallyResponse(createdVouchersResponse);
console.assert(parsedCreated.success === true, `Expected success === true for 2 created vouchers, got ${parsedCreated.success}`);
console.assert(parsedCreated.status === 'SUCCESS', `Expected status === 'SUCCESS' for created vouchers, got ${parsedCreated.status}`);
console.log('✅ Test 2 (Created Vouchers Returns success: true) Passed!');

// Start the bridge on a test port
const TEST_PORT = 9876;
const bridgeInstance = startBridge(TEST_PORT);

function makeRequest(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Run integration tests against running bridge
async function runIntegrationTests() {
  try {
    // Test 3: Health check returns 200 with 127.0.0.1 binding
    const health = await makeRequest('/health', { headers: { 'Host': '127.0.0.1:9876' } });
    console.assert(health.statusCode === 200, `Health check failed with ${health.statusCode}`);
    console.assert(health.json?.boundHost === '127.0.0.1', `Expected boundHost 127.0.0.1, got ${health.json?.boundHost}`);
    console.log('✅ Test 3 (Health Check & 127.0.0.1 Binding) Passed!');

    // Test 4: Host header validation (DNS Rebinding Guard)
    const badHost = await makeRequest('/health', { headers: { 'Host': 'evil-rebinding-domain.com:9876' } });
    console.assert(badHost.statusCode === 403, `Expected 403 for bad Host header, got ${badHost.statusCode}`);
    console.log('✅ Test 4 (DNS Rebinding Host Header Block) Passed!');

    // Test 5: Origin allowlist - Allowed origins
    const localOrigin = await makeRequest('/health', { 
      headers: { 'Host': '127.0.0.1:9876', 'Origin': 'http://localhost:5173' } 
    });
    console.assert(localOrigin.statusCode === 200, `Expected 200 for local origin`);
    console.assert(localOrigin.headers['access-control-allow-origin'] === 'http://localhost:5173', `Expected CORS header set`);
    console.log('✅ Test 5a (Local Dev Origin Allowed) Passed!');

    const renderOrigin = await makeRequest('/health', { 
      headers: { 'Host': '127.0.0.1:9876', 'Origin': 'https://tally-ai-workstation.onrender.com' } 
    });
    console.assert(renderOrigin.statusCode === 200, `Expected 200 for Render origin`);
    console.assert(renderOrigin.headers['access-control-allow-origin'] === 'https://tally-ai-workstation.onrender.com', `Expected Render CORS header set`);
    console.log('✅ Test 5b (Render Domain Origin Allowed) Passed!');

    // Test 6: Origin allowlist - Disallowed origin blocked
    const evilOrigin = await makeRequest('/health', { 
      headers: { 'Host': '127.0.0.1:9876', 'Origin': 'https://evil-phishing-site.com' } 
    });
    console.assert(evilOrigin.statusCode === 403, `Expected 403 for disallowed origin, got ${evilOrigin.statusCode}`);
    console.log('✅ Test 6 (Disallowed Origin Blocked with 403) Passed!');

    // Test 7: SSRF Protection on /api/tally/test (with valid token)
    const ssrfTest = await makeRequest('/api/tally/test', {
      method: 'POST',
      headers: { 
        'Host': '127.0.0.1:9876', 
        'Content-Type': 'application/json',
        'x-bridge-token': 'tallyai_local_bridge_sec_v1'
      }
    }, JSON.stringify({ tallyHost: 'http://169.254.169.254', tallyPort: 80 }));
    console.assert(ssrfTest.json?.code === 'SECURITY_ERROR', `Expected SECURITY_ERROR for non-loopback host, got ${ssrfTest.json?.code}`);
    console.log('✅ Test 7 (SSRF Remote Host Locked Down) Passed!');

    // Test 8: Malformed XML rejection on /api/tally/push (with valid token)
    const badXml = await makeRequest('/api/tally/push', {
      method: 'POST',
      headers: { 
        'Host': '127.0.0.1:9876', 
        'Content-Type': 'application/json',
        'x-bridge-token': 'tallyai_local_bridge_sec_v1'
      }
    }, JSON.stringify({ xml: 'not-xml-at-all' }));
    console.assert(badXml.statusCode === 400, `Expected 400 for malformed XML, got ${badXml.statusCode}`);
    console.assert(badXml.json?.message?.includes('ENVELOPE'), `Expected message to mention ENVELOPE`);
    console.log('✅ Test 8 (Malformed XML Rejected Early) Passed!');

    // Test 9: Malformed JSON rejection
    const badJson = await makeRequest('/api/tally/push', {
      method: 'POST',
      headers: { 'Host': '127.0.0.1:9876', 'Content-Type': 'application/json' }
    }, '{ broken json: true ');
    console.assert(badJson.statusCode === 400, `Expected 400 for malformed JSON, got ${badJson.statusCode}`);
    console.log('✅ Test 9 (Malformed JSON Rejected Early) Passed!');

    // Test 10: Auth / Token Validation on All 4 Protected Endpoints
    process.env.BRIDGE_TOKEN = 'test-secret-token-abc';

    // 10a: /api/tally/test
    const testNoToken = await makeRequest('/api/tally/test', {
      method: 'POST',
      headers: { 'Host': '127.0.0.1:9876', 'Content-Type': 'application/json' }
    }, JSON.stringify({}));
    console.assert(testNoToken.statusCode === 401, `Expected 401 for /api/tally/test without token, got ${testNoToken.statusCode}`);
    console.assert(testNoToken.json?.error?.includes('Unauthorized'), `Expected error message to mention Unauthorized`);

    const testValidToken = await makeRequest('/api/tally/test', {
      method: 'POST',
      headers: { 
        'Host': '127.0.0.1:9876', 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-secret-token-abc'
      }
    }, JSON.stringify({}));
    console.assert(testValidToken.statusCode === 200, `Expected 200 for /api/tally/test with valid token, got ${testValidToken.statusCode}`);
    console.log('✅ Test 10a (/api/tally/test token validation) Passed!');

    // 10b: /api/tally/push
    const pushNoToken = await makeRequest('/api/tally/push', {
      method: 'POST',
      headers: { 'Host': '127.0.0.1:9876', 'Content-Type': 'application/json' }
    }, JSON.stringify({ xml: '<ENVELOPE></ENVELOPE>' }));
    console.assert(pushNoToken.statusCode === 401, `Expected 401 for /api/tally/push without token, got ${pushNoToken.statusCode}`);

    const pushBadToken = await makeRequest('/api/tally/push', {
      method: 'POST',
      headers: { 
        'Host': '127.0.0.1:9876', 
        'Content-Type': 'application/json',
        'x-bridge-token': 'wrong-token-xyz'
      }
    }, JSON.stringify({ xml: '<ENVELOPE></ENVELOPE>' }));
    console.assert(pushBadToken.statusCode === 401, `Expected 401 for /api/tally/push with bad token, got ${pushBadToken.statusCode}`);
    console.log('✅ Test 10b (/api/tally/push token validation) Passed!');

    // 10c: /api/tally/history
    const historyNoToken = await makeRequest('/api/tally/history', {
      headers: { 'Host': '127.0.0.1:9876' }
    });
    console.assert(historyNoToken.statusCode === 401, `Expected 401 for /api/tally/history without token, got ${historyNoToken.statusCode}`);

    const historyValidToken = await makeRequest('/api/tally/history', {
      headers: { 'Host': '127.0.0.1:9876', 'x-bridge-token': 'test-secret-token-abc' }
    });
    console.assert(historyValidToken.statusCode === 200, `Expected 200 for /api/tally/history with valid token, got ${historyValidToken.statusCode}`);
    console.log('✅ Test 10c (/api/tally/history token validation) Passed!');

    // 10d: /api/tally/history/clear
    const clearNoToken = await makeRequest('/api/tally/history/clear', {
      method: 'POST',
      headers: { 'Host': '127.0.0.1:9876' }
    });
    console.assert(clearNoToken.statusCode === 401, `Expected 401 for /api/tally/history/clear without token, got ${clearNoToken.statusCode}`);

    const clearValidToken = await makeRequest('/api/tally/history/clear', {
      method: 'POST',
      headers: { 'Host': '127.0.0.1:9876', 'x-bridge-token': 'test-secret-token-abc' }
    });
    console.assert(clearValidToken.statusCode === 200, `Expected 200 for /api/tally/history/clear with valid token, got ${clearValidToken.statusCode}`);
    console.log('✅ Test 10d (/api/tally/history/clear token validation) Passed!');

    delete process.env.BRIDGE_TOKEN;
    console.log('✅ Test 10 (All Protected Endpoints Enforce Token Auth) Passed!');

    console.log('\n🎉 ALL SECURITY & HARDENING TESTS PASSED SUCCESFULLY!');
  } finally {
    bridgeInstance.close();
  }
}

runIntegrationTests().catch(err => {
  console.error('Test failed:', err);
  bridgeInstance.close();
  process.exit(1);
});
