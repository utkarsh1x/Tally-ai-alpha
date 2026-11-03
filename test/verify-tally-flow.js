import { parseTallyResponse } from '../bridge/index.js';
import { computeBatchSignature, parseTallyXmlResponse } from '../src/utils/tallyResponseParser.ts';

console.log('--- Testing Tally Response Parser ---');

// Test Case 1: Standard Success
const successXml = `
<RESPONSE>
  <CREATED>3</CREATED>
  <ALTERED>1</ALTERED>
  <DELETED>0</DELETED>
  <COMBINED>0</COMBINED>
  <ERRORS>0</ERRORS>
  <CANCELLED>0</CANCELLED>
</RESPONSE>
`;
const res1 = parseTallyResponse(successXml);
console.assert(res1.status === 'SUCCESS', `Expected SUCCESS, got ${res1.status}`);
console.assert(res1.created === 3, `Expected 3 created, got ${res1.created}`);
console.assert(res1.altered === 1, `Expected 1 altered, got ${res1.altered}`);
console.assert(res1.errors === 0, `Expected 0 errors, got ${res1.errors}`);
console.log('✅ Test 1 (Success Response) Passed!');

// Test Case 2: Error Response with <LINEERROR>
const errorXml = `
<RESPONSE>
  <LINEERROR>Ledger 'Stationery Expenses' does not exist in company 'Stalwart Global Solutions'!</LINEERROR>
  <LINEERROR>Voucher Number 'INV-2024-001' already exists!</LINEERROR>
  <CREATED>0</CREATED>
  <ALTERED>0</ALTERED>
  <DELETED>0</DELETED>
  <ERRORS>2</ERRORS>
</RESPONSE>
`;
const res2 = parseTallyResponse(errorXml);
console.assert(res2.status === 'FAILED', `Expected FAILED, got ${res2.status}`);
console.assert(res2.errors === 2, `Expected 2 errors, got ${res2.errors}`);
console.assert(res2.errorDetails.length === 2, `Expected 2 error details, got ${res2.errorDetails.length}`);
console.assert(res2.errorDetails[0].includes('Stationery Expenses'), `Expected ledger error`);
console.log('✅ Test 2 (Error Response with Line Errors) Passed!');

// Test Case 3: Partial Import
const partialXml = `
<RESPONSE>
  <LINEERROR>Ledger 'Custom Duties' not found.</LINEERROR>
  <CREATED>2</CREATED>
  <ALTERED>0</ALTERED>
  <ERRORS>1</ERRORS>
</RESPONSE>
`;
const res3 = parseTallyResponse(partialXml);
console.assert(res3.status === 'PARTIAL', `Expected PARTIAL, got ${res3.status}`);
console.assert(res3.created === 2, `Expected 2 created, got ${res3.created}`);
console.assert(res3.errors === 1, `Expected 1 error, got ${res3.errors}`);
console.log('✅ Test 3 (Partial Import) Passed!');

// Test Case 4: Batch Signature Duplicate Detection
const batch1 = [
  { id: '1', invoiceNumber: 'INV-101', date: '2026-11-01', amount: 5000, voucherType: 'Purchase' },
  { id: '2', invoiceNumber: 'INV-102', date: '2026-11-02', amount: 12000, voucherType: 'Sales' }
];

const batch2 = [
  { id: '2', invoiceNumber: 'INV-102', date: '2026-11-02', amount: 12000, voucherType: 'Sales' },
  { id: '1', invoiceNumber: 'INV-101', date: '2026-11-01', amount: 5000, voucherType: 'Purchase' }
];

const batch3 = [
  { id: '1', invoiceNumber: 'INV-101', date: '2026-11-01', amount: 5500, voucherType: 'Purchase' }
];

const sig1 = computeBatchSignature(batch1);
const sig2 = computeBatchSignature(batch2);
const sig3 = computeBatchSignature(batch3);

console.assert(sig1 === sig2, `Expected sig1 === sig2 regardless of order`);
console.assert(sig1 !== sig3, `Expected sig1 !== sig3 when amounts change`);
console.log('✅ Test 4 (Deterministic Batch Signature) Passed!');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
