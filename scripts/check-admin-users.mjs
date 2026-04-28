import mysql from 'mysql2/promise';

if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ error: 'DATABASE_URL missing' }));
  process.exit(0);
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await connection.execute(`
  SELECT id, openId, name, email, localEmail, username, role, isLocalUser, loginMethod, isActive
  FROM users
  WHERE role = 'admin'
  ORDER BY id ASC
`);
await connection.end();
console.log(JSON.stringify(rows, null, 2));
