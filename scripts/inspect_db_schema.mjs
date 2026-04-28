import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const connection = await mysql.createConnection(databaseUrl);

const [moveColumns] = await connection.query('SHOW COLUMNS FROM moves');
const [invoiceColumns] = await connection.query('SHOW COLUMNS FROM invoices');
const [customerCountRows] = await connection.query('SELECT COUNT(*) AS count FROM customers');
const [sampleCustomers] = await connection.query("SELECT id, firstName, lastName, email, phone, createdAt FROM customers ORDER BY id DESC LIMIT 20");

console.log(JSON.stringify({
  moveColumns,
  invoiceColumns,
  customerCount: customerCountRows[0]?.count ?? null,
  sampleCustomers,
}, null, 2));

await connection.end();
