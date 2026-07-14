const { tests } = require('./security.test');

console.log('==================================================');
console.log('      Running Static Security Verification Suite  ');
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
      console.log(`[PASS] [Tier ${test.tier}] [Category: ${test.category}] Test #${test.id}: ${test.name}`);
    } else {
      failedCount++;
      results.push({ ...test, pass, message, status: 'FAIL' });
      console.log(`[FAIL] [Tier ${test.tier}] [Category: ${test.category}] Test #${test.id}: ${test.name}`);
      console.log(`       Reason: ${message}`);
    }
  } catch (error) {
    failedCount++;
    results.push({ ...test, pass: false, message: error.message, status: 'ERROR' });
    console.log(`[ERR!] [Tier ${test.tier}] [Category: ${test.category}] Test #${test.id}: ${test.name}`);
    console.log(`       Error: ${error.message}`);
  }
}

console.log('\n==================================================');
console.log('                  Test Summary                    ');
console.log('==================================================');
console.log(`Total Test Cases : ${tests.length}`);
console.log(`Passed           : ${passedCount}`);
console.log(`Failed           : ${failedCount}`);
console.log(`Pass Rate        : ${((passedCount / tests.length) * 100).toFixed(2)}%`);
console.log('==================================================\n');

console.log('Breakdown by Tier:');
const tiers = [1, 2, 3, 4];
tiers.forEach(t => {
  const tierTests = results.filter(r => r.tier === t);
  const tierPassed = tierTests.filter(r => r.pass).length;
  console.log(`  Tier ${t}: ${tierPassed}/${tierTests.length} passed`);
});

console.log('\nBreakdown by Category:');
const categories = ["CREDENTIALS", "AUTH", "RLS", "SANITIZATION", "CROSS_FEATURE", "REAL_WORLD"];
categories.forEach(c => {
  const catTests = results.filter(r => r.category === c);
  const catPassed = catTests.filter(r => r.pass).length;
  console.log(`  Category ${c}: ${catPassed}/${catTests.length} passed`);
});
console.log('==================================================\n');

if (failedCount > 0) {
  console.log('Security verification failed. Please check the credentials and policies above.');
  process.exit(1);
} else {
  console.log('All security checks passed successfully!');
  process.exit(0);
}
