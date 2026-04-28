import mysql from 'mysql2/promise';
const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname, port: url.port || 3306,
  user: url.username, password: url.password,
  database: url.pathname.slice(1), ssl: { rejectUnauthorized: false }
});

try {
  // Check if column exists
  const [cols] = await conn.execute("SHOW COLUMNS FROM users LIKE 'username'");
  if (cols.length > 0) {
    console.log('✅ username column already exists');
  } else {
    await conn.execute("ALTER TABLE users ADD COLUMN username VARCHAR(100) NULL UNIQUE AFTER name");
    console.log('✅ username column added successfully');
  }
  
  // Verify
  const [allCols] = await conn.execute("SHOW COLUMNS FROM users");
  const colNames = allCols.map(c => c.Field);
  console.log('Current columns:', colNames.join(', '));
} catch(e) {
  console.log('❌ Error:', e.message);
}
await conn.end();
