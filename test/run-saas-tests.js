import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { tests } from './saas.test.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('==================================================');
console.log('      Running SaaS Multi-Tenancy E2E Test Suite   ');
console.log('==================================================\n');

let passedCount = 0;
let failedCount = 0;
const results = [];

for (const test of tests) {
  try {
    const { pass, message } = test.testFn();
    if (pass) {
      passedCount++;
      results.push({ ...test, pass, message, status: 'PASS' });
      console.log(`[PASS] [Tier ${test.tier}] [Feature F${test.feature}] Test #${test.id}: ${test.name}`);
    } else {
      failedCount++;
      results.push({ ...test, pass, message, status: 'FAIL' });
      console.log(`[FAIL] [Tier ${test.tier}] [Feature F${test.feature}] Test #${test.id}: ${test.name}`);
      console.log(`       Reason: ${message}`);
    }
  } catch (error) {
    failedCount++;
    results.push({ ...test, pass: false, message: error.message, status: 'ERROR' });
    console.log(`[ERR!] [Tier ${test.tier}] [Feature F${test.feature}] Test #${test.id}: ${test.name}`);
    console.log(`       Error: ${error.message}`);
  }
}

console.log('\n==================================================');
console.log('                  Test Summary                    ');
console.log('==================================================');
console.log(`Total Test Cases : ${tests.length}`);
console.log(`Passed           : ${passedCount}`);
console.log(`Failed           : ${failedCount}`);
console.log(`Pass Rate        : ${tests.length > 0 ? ((passedCount / tests.length) * 100).toFixed(2) : 0}%`);
console.log('==================================================\n');

console.log('Breakdown by Tier:');
const tiers = [1, 2, 3, 4];
tiers.forEach(t => {
  const tierTests = results.filter(r => r.tier === t);
  const tierPassed = tierTests.filter(r => r.pass).length;
  console.log(`  Tier ${t}: ${tierPassed}/${tierTests.length} passed`);
});

console.log('\nBreakdown by Feature:');
const features = [1, 2, 3, 4, 5];
features.forEach(f => {
  const featTests = results.filter(r => r.feature === f);
  const featPassed = featTests.filter(r => r.pass).length;
  const featName = f === 1 ? 'F1: Database Isolation' : 
                   f === 2 ? 'F2: Storage Privacy' : 
                   f === 3 ? 'F3: Signed URLs' : 
                   f === 4 ? 'F4: Onboarding' : 
                   'F5: Verification Script';
  console.log(`  Feature ${featName}: ${featPassed}/${featTests.length} passed`);
});
console.log('==================================================\n');

if (failedCount > 0) {
  console.log('SaaS E2E tests failed on the current unmigrated codebase.');
  process.exit(1);
} else {
  console.log('All SaaS E2E tests passed successfully!');
  process.exit(0);
}
