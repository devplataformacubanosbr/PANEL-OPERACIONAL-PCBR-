const { tests } = require('./e2e.test');

console.log('==================================================');
console.log('      Running UI/UX Refactoring E2E Test Suite    ');
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
      console.log(`[PASS] [Tier ${test.tier}] [Feature ${test.feature}] Test #${test.id}: ${test.name}`);
    } else {
      failedCount++;
      results.push({ ...test, pass, message, status: 'FAIL' });
      console.log(`[FAIL] [Tier ${test.tier}] [Feature ${test.feature}] Test #${test.id}: ${test.name}`);
      console.log(`       Reason: ${message}`);
    }
  } catch (error) {
    failedCount++;
    results.push({ ...test, pass: false, message: error.message, status: 'ERROR' });
    console.log(`[ERR!] [Tier ${test.tier}] [Feature ${test.feature}] Test #${test.id}: ${test.name}`);
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

console.log('\nBreakdown by Feature:');
const features = [1, 2, 3, 4, 5, 6, 7, 8, 9];
features.forEach(f => {
  const featTests = results.filter(r => r.feature === f);
  const featPassed = featTests.filter(r => r.pass).length;
  console.log(`  Feature ${f}: ${featPassed}/${featTests.length} passed`);
});
console.log('==================================================\n');

// Since some tests failing on the current codebase is expected before refactoring,
// we exit with 0 if we successfully executed the suite, or we exit with 1 if there are failures.
// Let's print a message about the expected failures.
if (failedCount > 0) {
  console.log('Note: Some tests failed. This is EXPECTED because the codebase has not been refactored yet.');
  process.exit(1);
} else {
  console.log('All tests passed successfully!');
  process.exit(0);
}
