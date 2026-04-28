import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const connection = await mysql.createConnection(databaseUrl);

const [customers] = await connection.query(
  `SELECT id FROM customers WHERE email LIKE '%@example.com' OR email LIKE '%@test.com'`
);

const customerIds = customers.map((row) => row.id).filter((id) => Number.isInteger(id));

if (customerIds.length === 0) {
  console.log(JSON.stringify({ deletedCustomers: 0, deletedMoves: 0, message: 'No demo customers found' }, null, 2));
  await connection.end();
  process.exit(0);
}

const placeholders = customerIds.map(() => '?').join(',');
const [moves] = await connection.query(
  `SELECT id FROM moves WHERE customerId IN (${placeholders})`,
  customerIds,
);
const moveIds = moves.map((row) => row.id).filter((id) => Number.isInteger(id));

await connection.beginTransaction();
try {
  if (moveIds.length > 0) {
    const movePlaceholders = moveIds.map(() => '?').join(',');
    await connection.query(`DELETE FROM moveImages WHERE moveId IN (${movePlaceholders})`, moveIds);
    await connection.query(`DELETE FROM tasks WHERE moveId IN (${movePlaceholders})`, moveIds);
    await connection.query(`DELETE FROM invoices WHERE moveId IN (${movePlaceholders})`, moveIds);
    await connection.query(`DELETE FROM moves WHERE id IN (${movePlaceholders})`, moveIds);
  }

  await connection.query(`DELETE FROM customers WHERE id IN (${placeholders})`, customerIds);
  await connection.commit();

  console.log(JSON.stringify({
    deletedCustomers: customerIds.length,
    deletedMoves: moveIds.length,
    customerIds,
    moveIds,
  }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
