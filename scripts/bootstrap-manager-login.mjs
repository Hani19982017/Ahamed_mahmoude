import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const MANAGER_EMAIL = 'info.fr@move-profis.de';
const password = process.env.MANAGER_PASSWORD ?? '';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL missing');
}

if (!password || password.trim().length < 8) {
  throw new Error('MANAGER_PASSWORD missing or too short');
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await connection.execute(
  `SELECT id, openId, name, email, localEmail, role, isLocalUser, isActive
   FROM users
   WHERE role = 'admin'
   ORDER BY isLocalUser ASC, id ASC`
);

const adminUsers = Array.isArray(rows) ? rows : [];
const exactMatch = adminUsers.find((row) => {
  const email = String(row.localEmail ?? row.email ?? '').trim().toLowerCase();
  return email === MANAGER_EMAIL;
});
const target = exactMatch ?? adminUsers.find((row) => Number(row.isActive ?? 1) !== 0) ?? null;
const passwordHash = await bcrypt.hash(password, 12);

if (target) {
  await connection.execute(
    `UPDATE users
     SET email = ?, localEmail = ?, passwordHash = ?, isLocalUser = 1, isActive = 1, loginMethod = 'local_admin', role = 'admin', name = COALESCE(name, 'Geschäftsführung')
     WHERE id = ?`,
    [MANAGER_EMAIL, MANAGER_EMAIL, passwordHash, Number(target.id)]
  );
} else {
  await connection.execute(
    `INSERT INTO users (openId, name, email, localEmail, passwordHash, role, branchId, isLocalUser, loginMethod, isActive, createdAt, updatedAt, lastSignedIn)
     VALUES (?, 'Geschäftsführung', ?, ?, ?, 'admin', NULL, 1, 'local_admin', 1, NOW(), NOW(), NOW())`,
    ['local_manager_primary', MANAGER_EMAIL, MANAGER_EMAIL, passwordHash]
  );
}

const [result] = await connection.execute(
  `SELECT id, openId, name, email, localEmail, role, isLocalUser, loginMethod, isActive
   FROM users
   WHERE (email = ? OR localEmail = ?)
   ORDER BY id ASC
   LIMIT 1`,
  [MANAGER_EMAIL, MANAGER_EMAIL]
);

await connection.end();
console.log(JSON.stringify(result, null, 2));
