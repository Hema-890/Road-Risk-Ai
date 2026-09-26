// Script to apply 20260919000000_roadrisk_core_schema.sql to Supabase
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Load .env
const envPath = path.join(rootDir, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const idx = trimmed.indexOf('=');
  if (idx > -1) {
    env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
  }
});

const projectUrl = env.VITE_SUPABASE_URL || '';
const projectRefMatch = projectUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
const projectRef = projectRefMatch ? projectRefMatch[1] : '';
const dbPassword = env.DATABASE_PASSWORD || process.env.DATABASE_PASSWORD || '';

console.log('============================================================');
console.log('   ROADRISK AI — SUPABASE CORE MIGRATION RUNNER            ');
console.log('============================================================\n');
console.log(`Project Ref: ${projectRef}`);
console.log(`Database Password provided in .env: ${dbPassword ? 'YES (configured)' : 'NO'}`);

const migrationFile = path.join(rootDir, 'supabase', 'migrations', '20260919000000_roadrisk_core_schema.sql');
if (!fs.existsSync(migrationFile)) {
  console.error(`❌ Migration file not found at: ${migrationFile}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
console.log(`Migration SQL file loaded: ${migrationFile} (${sqlContent.length} bytes, ~${sqlContent.split('\n').length} lines)\n`);

if (!dbPassword) {
  console.log('⚠️ Notice: Direct Postgres migration requires DATABASE_PASSWORD in .env.');
  console.log('To apply the migration immediately, you have two simple options:');
  console.log('\nOPTION 1 (Recommended & Fast):');
  console.log('1. Open your Supabase SQL Editor:');
  console.log(`   👉 https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('2. Paste the contents of:');
  console.log(`   supabase/migrations/20260919000000_roadrisk_core_schema.sql`);
  console.log('3. Click "RUN".');
  console.log('\nOPTION 2:');
  console.log('Add DATABASE_PASSWORD=your_db_password to .env and re-run:');
  console.log('node scripts/apply-supabase-migration.mjs\n');
  process.exit(0);
}

async function runDirectPostgresMigration() {
  const { Client } = await import('pg');

  // Attempt direct connection to db.[projectRef].supabase.co:5432 or pooler
  const hosts = [
    { host: `db.${projectRef}.supabase.co`, port: 5432 },
    { host: `aws-0-ap-south-1.pooler.supabase.com`, port: 6543, user: `postgres.${projectRef}` },
    { host: `aws-0-ap-southeast-1.pooler.supabase.com`, port: 6543, user: `postgres.${projectRef}` },
  ];

  let connectedClient = null;

  for (const target of hosts) {
    console.log(`Attempting connection to ${target.host}:${target.port}...`);
    const client = new Client({
      host: target.host,
      port: target.port,
      user: target.user || 'postgres',
      password: dbPassword,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });

    try {
      await client.connect();
      console.log(`✅ Connected successfully to ${target.host}:${target.port}!`);
      connectedClient = client;
      break;
    } catch (err) {
      console.warn(`Could not connect to ${target.host}:${target.port} (${err.message}). Trying next...`);
      try { await client.end(); } catch (e) {}
    }
  }

  if (!connectedClient) {
    console.error('❌ Could not establish PostgreSQL connection with the provided password.');
    console.log('Please execute the migration in Supabase Dashboard SQL Editor:');
    console.log(`👉 https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    process.exit(1);
  }

  try {
    console.log('Applying migration SQL script...');
    await connectedClient.query(sqlContent);
    console.log('✅ Migration executed successfully!');

    // Verify tables
    const res = await connectedClient.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(`\nVerified public tables in database (${res.rows.length} tables):`);
    res.rows.forEach((r) => console.log(`  - ${r.table_name}`));

    await connectedClient.end();
    console.log('\n🎉 ALL TABLES, RLS POLICIES & REALTIME PUBLICATIONS APPLIED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Error executing migration SQL:', err.message);
    try { await connectedClient.end(); } catch (e) {}
    process.exit(1);
  }
}

runDirectPostgresMigration();
