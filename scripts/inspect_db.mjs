import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const url = new URL(databaseUrl);
const sslParam = url.searchParams.get('ssl');
let ssl = undefined;

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
});

const [tables] = await connection.query('SHOW TABLES');
console.log('TABLES');
console.log(JSON.stringify(tables, null, 2));

const [migrations] = await connection.query('SELECT * FROM __drizzle_migrations ORDER BY created_at');
console.log('MIGRATIONS');
console.log(JSON.stringify(migrations, null, 2));

const [userColumns] = await connection.query('SHOW COLUMNS FROM users');
console.log('USERS_COLUMNS');
console.log(JSON.stringify(userColumns, null, 2));

await connection.end();
