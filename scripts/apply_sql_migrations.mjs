import fs from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const url = new URL(databaseUrl);
const sslParam = url.searchParams.get('ssl');
let ssl;
if (sslParam) {
  try {
    ssl = JSON.parse(sslParam);
  } catch {
    ssl = undefined;
  }
}

const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ''),
  ssl,
  multipleStatements: true,
});

const migrationsDir = path.resolve('drizzle');
const files = (await fs.readdir(migrationsDir))
  .filter((file) => file.endsWith('.sql'))
  .sort();

const ignorableCodes = new Set([
  'ER_TABLE_EXISTS_ERROR',
  'ER_DUP_FIELDNAME',
  'ER_DUP_KEYNAME',
  'ER_CANT_DROP_FIELD_OR_KEY',
  'ER_DUP_ENTRY',
]);

for (const file of files) {
  const fullPath = path.join(migrationsDir, file);
  const raw = await fs.readFile(fullPath, 'utf8');
  const statements = raw
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);

  console.log(`Applying ${file} (${statements.length} statements)`);

  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (ignorableCodes.has(error.code)) {
        console.log(`Skipping safe duplicate for ${file}: ${error.code}`);
        continue;
      }
      console.error(`Failed in ${file}:`);
      console.error(statement);
      throw error;
    }
  }
}

const [tables] = await connection.query('SHOW TABLES');
console.log('Current tables:', JSON.stringify(tables, null, 2));

await connection.end();
