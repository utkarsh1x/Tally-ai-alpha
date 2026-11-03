import assert from 'node:assert/strict';
import http from 'http';
import { startBridge } from '../bridge/index.js';

console.log('================================================================');
console.log('🧪 TallyPrime Company Detection & Connection Verification Tests');
console.log('================================================================\n');

const BRIDGE_PORT = 9977;
const MOCK_TALLY_PORT = 9978;
const TOKEN = 'tallyai_local_bridge_sec_v1';

let currentMockHandler = () => '<RESPONSE>Default</RESPONSE>';
let lastReceivedXml = '';

const mockTally = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    lastReceivedXml = body;
    const responseData = currentMockHandler(body, req);
    if (typeof responseData === 'object' && responseData.statusCode) {
      res.writeHead(responseData.statusCode, { 'Content-Type': 'text/xml; charset=utf-8' });
      res.end(responseData.body);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
      res.end(responseData);
    }
  });
});

function callBridgeTest(payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: BRIDGE_PORT,
      path: '/api/tally/test',
      method: 'POST',
      headers: {
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'Content-Type': 'application/json',
        'x-bridge-token': TOKEN,
        ...headers
      }
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
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function runTests() {
  let bridgeServer;

  try {
    // Start Bridge & Mock Tally
    bridgeServer = startBridge(BRIDGE_PORT);
    await new Promise(resolve => mockTally.listen(MOCK_TALLY_PORT, '127.0.0.1', resolve));

    // -------------------------------------------------------------------------
    // Test 1: Valid Tally XML response with exact requested company
    // -------------------------------------------------------------------------
    currentMockHandler = (body) => {
      if (body.includes('<ID>List of Companies</ID>')) {
        return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        <COMPANY NAME="Apex Industrial Solutions Pvt Ltd">
          <NAME TYPE="String">Apex Industrial Solutions Pvt Ltd</NAME>
        </COMPANY>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;
      }
      if (body.includes('<ID>List of Ledgers</ID>') && body.includes('Apex Industrial Solutions Pvt Ltd')) {
        return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
  <BODY>
    <DATA>
      <COLLECTION ISMSTDEPTYPE="Yes" MSTDEPTYPE="8">
        <LEDGER NAME="Cash"><LANGUAGENAME.LIST><NAME.LIST><NAME>Cash</NAME></NAME.LIST></LANGUAGENAME.LIST></LEDGER>
        <LEDGER NAME="Bank Current A/c"><LANGUAGENAME.LIST><NAME.LIST><NAME>Bank Current A/c</NAME></NAME.LIST></LANGUAGENAME.LIST></LEDGER>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;
      }
      return '<RESPONSE>Unrecognized</RESPONSE>';
    };

    const res1 = await callBridgeTest({
      tallyHost: 'http://127.0.0.1',
      tallyPort: MOCK_TALLY_PORT,
      companyName: 'Apex Industrial Solutions Pvt Ltd'
    });

    assert.equal(res1.statusCode, 200, 'Test 1 HTTP status must be 200');
    assert.equal(res1.json?.bridgeOnline, true, 'Bridge must be online');
    assert.equal(res1.json?.tallyReachable, true, 'Tally must be reachable');
    assert.equal(res1.json?.companyVerified, true, 'Company must be verified');
    assert.equal(res1.json?.connected, true, 'Overall connected status must be true');
    assert.equal(res1.json?.activeCompany, 'Apex Industrial Solutions Pvt Ltd', 'Active company must match');
    assert.equal(res1.json?.ledgersCount, 2, 'Must have verified 2 ledgers');
    console.log('✅ Test 1 Passed: Valid Tally XML response correctly verifies requested company');

    // -------------------------------------------------------------------------
    // Test 2: Invalid report / LINEERROR response (e.g. legacy List of Companies error)
    // -------------------------------------------------------------------------
    currentMockHandler = () => {
      return `<RESPONSE>
  <LINEERROR>Could not find Report 'List of Companies'!</LINEERROR>
</RESPONSE>`;
    };

    const res2 = await callBridgeTest({
      tallyHost: 'http://127.0.0.1',
      tallyPort: MOCK_TALLY_PORT,
      companyName: 'Apex Industrial Solutions Pvt Ltd'
    });

    assert.equal(res2.json?.connected, false, 'Must NOT be connected when LINEERROR returned');
    assert.equal(res2.json?.companyVerified, false, 'Company must NOT be verified on LINEERROR');
    assert.equal(res2.json?.activeCompany, '', 'activeCompany must NOT be fabricated');
    assert.match(res2.json?.error, /List of Companies/, 'Error must reflect the LINEERROR');
    console.log('✅ Test 2 Passed: LINEERROR response cleanly caught and company not verified');

    // -------------------------------------------------------------------------
    // Test 3: STATUS 0 failure
    // -------------------------------------------------------------------------
    currentMockHandler = () => {
      return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><STATUS>0</STATUS></HEADER>
  <BODY><DATA></DATA></BODY>
</ENVELOPE>`;
    };

    const res3 = await callBridgeTest({
      tallyHost: 'http://127.0.0.1',
      tallyPort: MOCK_TALLY_PORT,
      companyName: 'Apex Industrial Solutions Pvt Ltd'
    });

    assert.equal(res3.json?.connected, false, 'STATUS 0 must fail connection');
    assert.equal(res3.json?.companyVerified, false, 'STATUS 0 must fail company verification');
    assert.equal(res3.json?.activeCompany, '', 'No active company on STATUS 0');
    console.log('✅ Test 3 Passed: STATUS 0 failure correctly rejected');

    // -------------------------------------------------------------------------
    // Test 4: HTTP 200 with XML error message
    // -------------------------------------------------------------------------
    currentMockHandler = () => {
      return `<ERRORMSG>Unknown Request, cannot be processed</ERRORMSG>`;
    };

    const res4 = await callBridgeTest({
      tallyHost: 'http://127.0.0.1',
      tallyPort: MOCK_TALLY_PORT,
      companyName: 'Apex Industrial Solutions Pvt Ltd'
    });

    assert.equal(res4.json?.tallyReachable, true, 'Tally was reached');
    assert.equal(res4.json?.connected, false, 'Must not claim connected on XML error message');
    assert.equal(res4.json?.companyVerified, false, 'Company not verified');
    assert.equal(res4.json?.activeCompany, '', 'activeCompany empty on error message');
    console.log('✅ Test 4 Passed: HTTP 200 with XML error message rejected');

    // -------------------------------------------------------------------------
    // Test 5: Empty or malformed XML
    // -------------------------------------------------------------------------
    currentMockHandler = () => '';

    const res5 = await callBridgeTest({
      tallyHost: 'http://127.0.0.1',
      tallyPort: MOCK_TALLY_PORT,
      companyName: 'Apex Industrial Solutions Pvt Ltd'
    });

    assert.equal(res5.json?.connected, false, 'Empty XML must not connect');
    assert.equal(res5.json?.companyVerified, false, 'Empty XML cannot verify company');
    assert.match(res5.json?.error, /empty response/i, 'Reports empty response');
    console.log('✅ Test 5 Passed: Empty XML response rejected');

    // -------------------------------------------------------------------------
    // Test 6: Incorrect or unavailable company requested (ABC loaded, Apex requested)
    // -------------------------------------------------------------------------
    currentMockHandler = (body) => {
      if (body.includes('<ID>List of Companies</ID>')) {
        return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        <COMPANY NAME="ABC">
          <NAME TYPE="String">ABC</NAME>
        </COMPANY>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;
      }
      if (body.includes('Apex Industrial Solutions Pvt Ltd')) {
        // Tally returns empty collection because Apex is not currently loaded
        return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
  <BODY>
    <DATA>
      <COLLECTION ISMSTDEPTYPE="Yes" MSTDEPTYPE="8">   </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;
      }
      return '<RESPONSE>Unrecognized</RESPONSE>';
    };

    const res6 = await callBridgeTest({
      tallyHost: 'http://127.0.0.1',
      tallyPort: MOCK_TALLY_PORT,
      companyName: 'Apex Industrial Solutions Pvt Ltd'
    });

    assert.equal(res6.json?.tallyReachable, true, 'Tally is reachable');
    assert.equal(res6.json?.connected, false, 'Connected must be false when company is not open');
    assert.equal(res6.json?.companyVerified, false, 'companyVerified must be false');
    assert.equal(res6.json?.activeCompany, '', 'activeCompany must NEVER be fabricated');
    assert.deepEqual(res6.json?.loadedCompanies, ['ABC'], 'Identifies that ABC is open instead');
    assert.match(res6.json?.error, /ABC/, 'Error explains that ABC is currently open');
    assert.match(res6.json?.message, /TallyPrime reachable, company not verified/i, 'Exact requirement message returned');
    console.log('✅ Test 6 Passed: Unavailable company correctly rejected without inventing activeCompany');

    // -------------------------------------------------------------------------
    // Test 7: TallyPrime offline (port not listening)
    // -------------------------------------------------------------------------
    const res7 = await callBridgeTest({
      tallyHost: 'http://127.0.0.1',
      tallyPort: 44444, // offline port
      companyName: 'Apex Industrial Solutions Pvt Ltd'
    });

    assert.equal(res7.json?.bridgeOnline, true, 'Bridge is running');
    assert.equal(res7.json?.tallyReachable, false, 'Tally unreachable');
    assert.equal(res7.json?.connected, false, 'Not connected');
    assert.equal(res7.json?.companyVerified, false, 'Company not verified');
    assert.match(res7.json?.error, /Connection refused|ECONNREFUSED/i, 'Connection refused diagnostic');
    console.log('✅ Test 7 Passed: Offline TallyPrime detected with actionable troubleshooting');

    // -------------------------------------------------------------------------
    // Test 8: Invalid bridge token
    // -------------------------------------------------------------------------
    const res8 = await callBridgeTest({
      tallyHost: 'http://127.0.0.1',
      tallyPort: MOCK_TALLY_PORT,
      companyName: 'Apex Industrial Solutions Pvt Ltd'
    }, { 'x-bridge-token': 'wrong-token' });

    assert.equal(res8.statusCode, 401, 'Invalid token must return 401');
    assert.match(res8.json?.error, /Unauthorized/i, 'Returns clear unauthorized message');
    console.log('✅ Test 8 Passed: Invalid bridge token rejected with 401');

    console.log('\n================================================================');
    console.log('🎉 ALL 8 AUTOMATED TESTS PASSED WITH STRICT FAILING ASSERTIONS!');
    console.log('================================================================\n');

  } finally {
    if (bridgeServer) bridgeServer.close();
    mockTally.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Automated Test Suite Failed:', err);
  process.exit(1);
});
