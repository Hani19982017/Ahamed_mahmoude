// ─────────────────────────────────────────────────────────────────────
// fix-manager-password.mjs
//
// Generates a fresh bcrypt hash for "Admin12345!" using the SAME
// bcryptjs library the server uses, then prints a ready-to-paste
// SQL UPDATE statement.
//
// USAGE:
//   1. Place this file in the project root (next to package.json)
//   2. Run: node fix-manager-password.mjs
//   3. Copy the SQL block it prints
//   4. Paste it in phpMyAdmin → umzug → SQL → Go
//   5. Log in with info.fr@move-profis.de / Admin12345!
// ─────────────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';

const PASSWORD = 'Admin12345!';
const ROUNDS = 12;

console.log('');
console.log('Generating bcrypt hash for password:', PASSWORD);
console.log('');

const hash = bcrypt.hashSync(PASSWORD, ROUNDS);

// Sanity check: verify the hash actually matches the password
const verified = bcrypt.compareSync(PASSWORD, hash);

if (!verified) {
  console.error('❌ FATAL: hash verification failed. Something is wrong with bcryptjs install.');
  process.exit(1);
}

console.log('Generated hash:', hash);
console.log('Verification:  ✓ PASS');
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  COPY EVERYTHING BELOW INTO phpMyAdmin → umzug → SQL → Go');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('USE `umzug`;');
console.log('');
console.log('UPDATE `users`');
console.log('SET');
console.log("  `localEmail`   = 'info.fr@move-profis.de',");
console.log("  `role`         = 'admin',");
console.log("  `isLocalUser`  = 1,");
console.log("  `loginMethod`  = 'local_admin',");
console.log("  `isActive`     = 1,");
console.log("  `passwordHash` = '" + hash + "'");
console.log("WHERE `email` = 'info.fr@move-profis.de';");
console.log('');
console.log('SELECT id, email, localEmail, role, isLocalUser, loginMethod, isActive,');
console.log('       LEFT(passwordHash, 7) AS hash_prefix, LENGTH(passwordHash) AS hash_len');
console.log("FROM users WHERE email = 'info.fr@move-profis.de';");
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  AFTER RUNNING THE SQL, LOG IN WITH:');
console.log('     Email:    info.fr@move-profis.de');
console.log('     Password: ' + PASSWORD);
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('The SELECT at the end shows you the row after the update.');
console.log('Verify that:');
console.log('  - role         = admin');
console.log('  - isLocalUser  = 1');
console.log('  - loginMethod  = local_admin');
console.log('  - hash_prefix  starts with $2a$ or $2b$');
console.log('  - hash_len     = 60');
console.log('');
