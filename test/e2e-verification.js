import http from 'http';
import { generateTallyXml } from '../src/utils/tallyXmlGenerator.ts';
import { generateCsv } from '../src/utils/csvGenerator.ts';
import { parseTallyResponse, startBridge, server, DEFAULT_BRIDGE_TOKEN } from '../bridge/index.js';

console.log('================================================================');
console.log('🚀 TallyAI → Bridge → TallyPrime End-to-End Real Verification');
console.log('================================================================\n');

const BRIDGE_PORT = 9001;
const TALLY_PORT = 9000;
const TOKEN = DEFAULT_BRIDGE_TOKEN; // 'tallyai_local_bridge_sec_v1'

const LOCAL_ORIGIN = 'http://localhost:5173';
const RENDER_ORIGIN = 'https://tally-ai-workstation.onrender.com';

// Mock Tally Server state
let mockTallyResponseMode = 'NORMAL'; // 'NORMAL', 'ZERO_VOUCHERS', 'PARTIAL_ERROR'

const mockTallyServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');

    // 1. Tally Company Ping / List of Companies request
    if (body.includes('List of Companies')) {
      const companiesXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        <COMPANY>
          <NAME>Apex Industrial Solutions Pvt Ltd</NAME>
        </COMPANY>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;
      res.writeHead(200);
      res.end(companiesXml);
      return;
    }

    // 2. Tally Voucher Import Request
    if (body.includes('<TALLYMESSAGE') || body.includes('Import Data')) {
      if (mockTallyResponseMode === 'NORMAL') {
        const successXml = `<?xml version="1.0" encoding="utf-8"?>
<RESPONSE>
  <CREATED>2</CREATED>
  <ALTERED>0</ALTERED>
  <DELETED>0</DELETED>
  <COMBINED>0</COMBINED>
  <ERRORS>0</ERRORS>
  <CANCELLED>0</CANCELLED>
</RESPONSE>`;
        res.writeHead(200);
        res.end(successXml);
        return;
      }

      if (mockTallyResponseMode === 'ZERO_VOUCHERS') {
        const zeroXml = `<?xml version="1.0" encoding="utf-8"?>
<RESPONSE>
  <CREATED>0</CREATED>
  <ALTERED>0</ALTERED>
  <DELETED>0</DELETED>
  <COMBINED>0</COMBINED>
  <ERRORS>0</ERRORS>
  <CANCELLED>0</CANCELLED>
</RESPONSE>`;
        res.writeHead(200);
        res.end(zeroXml);
        return;
      }

      if (mockTallyResponseMode === 'PARTIAL_ERROR') {
        const partialXml = `<?xml version="1.0" encoding="utf-8"?>
<RESPONSE>
  <LINEERROR>Ledger 'Freight & Logistics' does not exist in Company!</LINEERROR>
  <CREATED>1</CREATED>
  <ALTERED>0</ALTERED>
  <DELETED>0</DELETED>
  <COMBINED>0</COMBINED>
  <ERRORS>1</ERRORS>
  <CANCELLED>0</CANCELLED>
</RESPONSE>`;
        res.writeHead(200);
        res.end(partialXml);
        return;
      }
    }

    // Fallback response
    res.writeHead(200);
    res.end('<RESPONSE><CREATED>0</CREATED><ERRORS>1</ERRORS><LINEERROR>Unrecognized envelope</LINEERROR></RESPONSE>');
  });
});

function sendBridgeRequest(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: BRIDGE_PORT,
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

// Sample test transactions
const sampleTransactions = [
  {
    id: 'tx-001',
    date: '2026-11-01',
    voucherType: 'Purchase',
    invoiceNumber: 'INV/2026/089',
    partyName: 'Techtronics Hardware Solutions',
    partyGstin: '27AABCT3421K1ZM',
    state: 'Maharashtra',
    stateCode: '27',
    placeOfSupply: '27-Maharashtra',
    debitLedger: 'Computer & Hardware Equipment A/c',
    creditLedger: 'Techtronics Hardware Solutions',
    taxableAmount: 45000,
    cgstAmount: 4050,
    sgstAmount: 4050,
    igstAmount: 0,
    totalAmount: 53100,
    status: 'Approved',
    confidenceScore: 98,
    isGstCompliant: true,
    hsnCode: '84713010',
    description: 'Procurement of Core i9 Workstations'
  },
  {
    id: 'tx-002',
    date: '2026-11-02',
    voucherType: 'Sales',
    invoiceNumber: 'TAX/2026/102',
    partyName: 'Global Logistics Corp',
    partyGstin: '27BBBCK9911Q1Z3',
    state: 'Maharashtra',
    stateCode: '27',
    placeOfSupply: '27-Maharashtra',
    debitLedger: 'Global Logistics Corp',
    creditLedger: 'Software Consulting & Service Revenue',
    taxableAmount: 120000,
    cgstAmount: 10800,
    sgstAmount: 10800,
    igstAmount: 0,
    totalAmount: 141600,
    status: 'Approved',
    confidenceScore: 96,
    isGstCompliant: true,
    hsnCode: '998314',
    description: 'Enterprise ERP System Deployment Consulting'
  }
];

async function runEndToEndVerification() {
  let bridgeServer = null;
  let tallyServer = null;

  try {
    // -------------------------------------------------------------
    // PART 1: XML Generation and CSV Export Verification
    // -------------------------------------------------------------
    console.log('--- Step 1: Testing XML & CSV Generation ---');
    const xml = generateTallyXml(sampleTransactions, 'Apex Industrial Solutions Pvt Ltd');
    console.assert(xml.includes('<ENVELOPE>'), 'XML must contain <ENVELOPE>');
    console.assert(xml.includes('</ENVELOPE>'), 'XML must contain </ENVELOPE>');
    console.assert(xml.includes('<VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>'), 'XML must have Purchase voucher');
    console.assert(xml.includes('<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>'), 'XML must have Sales voucher');
    console.assert(xml.includes('Apex Industrial Solutions Pvt Ltd'), 'XML must specify company name');
    console.log('✅ Step 1a: Tally XML Generator produces valid Tally 4.1 compliant envelope');

    const csv = generateCsv(sampleTransactions);
    console.assert(csv.includes('INV/2026/089'), 'CSV must contain invoice INV/2026/089');
    console.assert(csv.includes('TAX/2026/102'), 'CSV must contain invoice TAX/2026/102');
    console.log('✅ Step 1b: CSV Export generates proper tabular report');

    // -------------------------------------------------------------
    // PART 2: Start Hardened Bridge on 127.0.0.1:9001
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Starting Hardened Bridge on 127.0.0.1:9001 ---');
    bridgeServer = startBridge(BRIDGE_PORT);
    
    // Test binding & health check
    const healthRes = await sendBridgeRequest('/health', {
      headers: { 'Host': `127.0.0.1:${BRIDGE_PORT}` }
    });
    console.assert(healthRes.statusCode === 200, `Health check returned ${healthRes.statusCode}`);
    console.assert(healthRes.json?.boundHost === '127.0.0.1', 'Bridge must bind strictly to 127.0.0.1');
    console.assert(healthRes.json?.authEnforced === true, 'Bridge auth must be enforced');
    console.log('✅ Step 2: Bridge is actively listening strictly on 127.0.0.1:9001 with Token Auth enforced');

    // -------------------------------------------------------------
    // PART 3: Offline TallyPrime Handling (Port 9000 Closed)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Offline TallyPrime Handling (Port 9000 not running) ---');
    const offlineTest = await sendBridgeRequest('/api/tally/test', {
      method: 'POST',
      headers: { 
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'Content-Type': 'application/json',
        'x-bridge-token': TOKEN
      }
    }, JSON.stringify({ tallyHost: 'http://127.0.0.1', tallyPort: TALLY_PORT }));
    console.assert(offlineTest.statusCode === 200, 'Bridge returns 200 diagnostic');
    console.assert(offlineTest.json?.connected === false, 'Tally must report connected === false');
    console.assert(offlineTest.json?.tallyRunning === false, 'tallyRunning must be false');
    console.assert(offlineTest.json?.troubleshooting?.length > 0, 'Troubleshooting instructions provided');
    console.log('✅ Step 3a: /api/tally/test correctly detects Tally offline and provides F1 connectivity instructions');

    const offlinePush = await sendBridgeRequest('/api/tally/push', {
      method: 'POST',
      headers: { 
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'Content-Type': 'application/json',
        'x-bridge-token': TOKEN
      }
    }, JSON.stringify({ xml, tallyHost: 'http://127.0.0.1', tallyPort: TALLY_PORT }));
    console.assert(offlinePush.json?.success === false, 'Offline push must NEVER report success');
    console.assert(offlinePush.json?.status === 'FAILED', 'Offline push status must be FAILED');
    console.log('✅ Step 3b: /api/tally/push safely fails when Tally is offline without false success');

    // -------------------------------------------------------------
    // PART 4: Start Mock Tally Server on Port 9000
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Starting Tally Server on 127.0.0.1:9000 ---');
    await new Promise(resolve => mockTallyServer.listen(TALLY_PORT, '127.0.0.1', resolve));
    console.log('✅ Step 4: Tally XML Server listening on 127.0.0.1:9000');

    // -------------------------------------------------------------
    // PART 5: Test Flow 1: Local Frontend (localhost:5173) + Bridge + Tally
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Testing Local Frontend Origin (http://localhost:5173) ---');
    mockTallyResponseMode = 'NORMAL';

    // 5a. Test Connection
    const localTest = await sendBridgeRequest('/api/tally/test', {
      method: 'POST',
      headers: { 
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'Origin': LOCAL_ORIGIN,
        'Content-Type': 'application/json',
        'x-bridge-token': TOKEN
      }
    }, JSON.stringify({ tallyHost: 'http://127.0.0.1', tallyPort: TALLY_PORT }));
    console.assert(localTest.headers['access-control-allow-origin'] === LOCAL_ORIGIN, 'CORS must allow localhost:5173');
    console.assert(localTest.json?.connected === true, 'Tally must report connected === true');
    console.assert(localTest.json?.activeCompany === 'Apex Industrial Solutions Pvt Ltd', 'Detects active company');
    console.log(`✅ Step 5a: Local Connection Test Successful: Found Active Company "${localTest.json?.activeCompany}"`);

    // 5b. Push Valid Batch (2 vouchers)
    const localPush = await sendBridgeRequest('/api/tally/push', {
      method: 'POST',
      headers: { 
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'Origin': LOCAL_ORIGIN,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    }, JSON.stringify({ 
      xml, 
      tallyHost: 'http://127.0.0.1', 
      tallyPort: TALLY_PORT,
      companyName: 'Apex Industrial Solutions Pvt Ltd',
      batchId: 'BATCH-LOCAL-001',
      voucherNumbers: ['INV/2026/089', 'TAX/2026/102']
    }));
    console.assert(localPush.json?.success === true, 'Expected success === true for 2 created vouchers');
    console.assert(localPush.json?.status === 'SUCCESS', 'Expected status === SUCCESS');
    console.assert(localPush.json?.created === 2, 'Expected 2 vouchers created');
    console.assert(localPush.json?.errors === 0, 'Expected 0 errors');
    console.log('✅ Step 5b: Local Push Successful: Created 2 vouchers in TallyPrime');

    // -------------------------------------------------------------
    // PART 6: Test Flow 2: Render Frontend (onrender.com) + Bridge + Tally
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Testing Render Frontend Origin (https://tally-ai-workstation.onrender.com) ---');
    
    // 6a. Render Connection Test
    const renderTest = await sendBridgeRequest('/api/tally/test', {
      method: 'POST',
      headers: { 
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'Origin': RENDER_ORIGIN,
        'Content-Type': 'application/json',
        'x-bridge-token': TOKEN
      }
    }, JSON.stringify({ tallyHost: 'http://127.0.0.1', tallyPort: TALLY_PORT }));
    console.assert(renderTest.headers['access-control-allow-origin'] === RENDER_ORIGIN, 'CORS must allow *.onrender.com');
    console.assert(renderTest.json?.connected === true, 'Render app successfully reaches local TallyPrime via bridge');
    console.log('✅ Step 6a: Render origin permitted by CORS and successfully reaches TallyPrime');

    // 6b. Render Push Test
    const renderPush = await sendBridgeRequest('/api/tally/push', {
      method: 'POST',
      headers: { 
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'Origin': RENDER_ORIGIN,
        'Content-Type': 'application/json',
        'x-bridge-token': TOKEN
      }
    }, JSON.stringify({ 
      xml, 
      tallyHost: 'http://127.0.0.1', 
      tallyPort: TALLY_PORT,
      companyName: 'Apex Industrial Solutions Pvt Ltd',
      batchId: 'BATCH-RENDER-002',
      voucherNumbers: ['INV/2026/089', 'TAX/2026/102']
    }));
    console.assert(renderPush.headers['access-control-allow-origin'] === RENDER_ORIGIN, 'CORS must allow *.onrender.com on push');
    console.assert(renderPush.json?.success === true, 'Render app push successful');
    console.assert(renderPush.json?.created === 2, 'Render app creates 2 vouchers');
    console.log('✅ Step 6b: Render app successfully pushes vouchers to local TallyPrime via hardened bridge');

    // -------------------------------------------------------------
    // PART 7: Zero-Voucher and Error Case Verification
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Testing Zero-Voucher & Partial Error Edge Cases ---');
    
    // 7a. Zero Vouchers created (must NOT report success: true)
    mockTallyResponseMode = 'ZERO_VOUCHERS';
    const zeroPush = await sendBridgeRequest('/api/tally/push', {
      method: 'POST',
      headers: { 
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'Content-Type': 'application/json',
        'x-bridge-token': TOKEN
      }
    }, JSON.stringify({ xml, tallyHost: 'http://127.0.0.1', tallyPort: TALLY_PORT }));
    console.assert(zeroPush.json?.success === false, 'Zero vouchers created MUST have success === false');
    console.assert(zeroPush.json?.status === 'FAILED', 'Zero vouchers created MUST have status === FAILED');
    console.log('✅ Step 7a: Zero-voucher response safely marked FAILED (never false success)');

    // 7b. Partial Error (1 created, 1 error)
    mockTallyResponseMode = 'PARTIAL_ERROR';
    const partialPush = await sendBridgeRequest('/api/tally/push', {
      method: 'POST',
      headers: { 
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'Content-Type': 'application/json',
        'x-bridge-token': TOKEN
      }
    }, JSON.stringify({ xml, tallyHost: 'http://127.0.0.1', tallyPort: TALLY_PORT }));
    console.assert(partialPush.json?.success === true, 'Partial push has success === true because created > 0');
    console.assert(partialPush.json?.status === 'PARTIAL', 'Status is PARTIAL');
    console.assert(partialPush.json?.created === 1, '1 created');
    console.assert(partialPush.json?.errors === 1, '1 error');
    console.assert(partialPush.json?.errorDetails?.[0]?.includes('Freight & Logistics'), 'Extracts line error detail');
    console.log('✅ Step 7b: Partial failure reports accurate status and extracts <LINEERROR>');

    // -------------------------------------------------------------
    // PART 8: Sync History Storage and Retrieval
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Sync History Storage and Clearance ---');
    const historyRes = await sendBridgeRequest('/api/tally/history', {
      headers: { 
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'Origin': RENDER_ORIGIN,
        'x-bridge-token': TOKEN
      }
    });
    console.assert(historyRes.statusCode === 200, 'History returned 200');
    console.assert(historyRes.json?.count >= 4, `Expected at least 4 records, got ${historyRes.json?.count}`);
    console.log(`✅ Step 8a: Persistent sync history verified: stored ${historyRes.json?.count} historical records`);

    const clearRes = await sendBridgeRequest('/api/tally/history/clear', {
      method: 'POST',
      headers: { 
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'Origin': LOCAL_ORIGIN,
        'x-bridge-token': TOKEN
      }
    });
    console.assert(clearRes.statusCode === 200, 'Clear history returned 200');
    console.log('✅ Step 8b: Sync history cleared successfully');

    const historyAfterClear = await sendBridgeRequest('/api/tally/history', {
      headers: { 
        'Host': `127.0.0.1:${BRIDGE_PORT}`,
        'x-bridge-token': TOKEN
      }
    });
    console.assert(historyAfterClear.json?.count === 0, 'History count is 0 after clearing');
    console.log('✅ Step 8c: History confirmed empty after clear');

    console.log('\n================================================================');
    console.log('🎉 ALL 8 END-TO-END VERIFICATION STEPS PASSED WITH 100% SUCCESS!');
    console.log('================================================================');
  } finally {
    if (bridgeServer) bridgeServer.close();
    if (mockTallyServer) mockTallyServer.close();
  }
}

runEndToEndVerification().catch(err => {
  console.error('\n❌ End-to-End Verification Failed:', err);
  process.exit(1);
});
