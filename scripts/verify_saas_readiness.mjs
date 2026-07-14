import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function runVerification() {
  console.log('==================================================');
  console.log('    Verifying SaaS Multi-Tenancy Readiness        ');
  console.log('==================================================\n');

  let client;
  try {
    client = await pool.connect();
    console.log('Successfully connected to the database.');
  } catch (err) {
    console.error('Failed to connect to the database:', err.message);
    process.exit(1);
  }

  let passed = true;

  // 1. Check indexes on organization_id columns
  try {
    const indexQuery = `
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexdef LIKE '% USING btree %organization_id%';
    `;
    const res = await client.query(indexQuery);
    console.log(`\n1. Checking B-tree indexes on organization_id columns:`);
    console.log(`Found ${res.rows.length} indexes:`);
    res.rows.forEach(r => {
      console.log(`   - Table: ${r.tablename}, Index: ${r.indexname}`);
    });

    if (res.rows.length >= 25) {
      console.log(`✅ SUCCESS: Found ${res.rows.length} B-tree indexes on organization_id (Required: >= 25).`);
    } else {
      console.log(`❌ FAILURE: Found only ${res.rows.length} B-tree indexes on organization_id (Required: >= 25).`);
      passed = false;
    }
  } catch (err) {
    console.error('Error checking B-tree indexes:', err.message);
    passed = false;
  }

  // 2. Check tables planes, suscripciones, limites_uso
  try {
    const tablesQuery = `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('planes', 'suscripciones', 'limites_uso');
    `;
    const res = await client.query(tablesQuery);
    const foundTables = res.rows.map(r => r.tablename);
    console.log(`\n2. Checking subscriptions tables ('planes', 'suscripciones', 'limites_uso'):`);
    console.log(`Found tables: ${foundTables.join(', ')}`);

    const requiredTables = ['planes', 'suscripciones', 'limites_uso'];
    const missingTables = requiredTables.filter(t => !foundTables.includes(t));

    if (missingTables.length === 0) {
      console.log(`✅ SUCCESS: All required subscription tables exist.`);
    } else {
      console.log(`❌ FAILURE: Missing subscription tables: ${missingTables.join(', ')}`);
      passed = false;
    }
  } catch (err) {
    console.error('Error checking subscription tables:', err.message);
    passed = false;
  }

  // 3. Check get_user_org_id function
  try {
    const funcQuery = `
      SELECT proname, provolatile, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'get_user_org_id';
    `;
    const res = await client.query(funcQuery);
    console.log(`\n3. Checking get_user_org_id() helper function:`);
    if (res.rows.length > 0) {
      const func = res.rows[0];
      const volatility = func.provolatile === 's' ? 'STABLE' : func.provolatile === 'i' ? 'IMMUTABLE' : 'VOLATILE';
      console.log(`Function get_user_org_id exists with volatility: ${volatility}`);

      if (func.provolatile === 's') {
        console.log(`✅ SUCCESS: Function get_user_org_id() exists and is STABLE.`);
      } else {
        console.log(`❌ FAILURE: Function get_user_org_id() exists but is not STABLE (found: ${volatility}).`);
        passed = false;
      }
    } else {
      console.log(`❌ FAILURE: Function get_user_org_id() does not exist.`);
      passed = false;
    }
  } catch (err) {
    console.error('Error checking get_user_org_id() function:', err.message);
    passed = false;
  }

  client.release();
  await pool.end();

  console.log('\n==================================================');
  if (passed) {
    console.log('✅ SaaS Readiness Check: PASSED');
    console.log('==================================================');
    process.exit(0);
  } else {
    console.log('❌ SaaS Readiness Check: FAILED');
    console.log('==================================================');
    process.exit(1);
  }
}

runVerification();
