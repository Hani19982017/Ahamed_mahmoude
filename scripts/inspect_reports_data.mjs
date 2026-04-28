import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const connection = await mysql.createConnection(databaseUrl);

const targetYear = 2026;

const [moveOverview] = await connection.query(`
  SELECT
    COUNT(*) AS totalMoves,
    SUM(CASE WHEN YEAR(createdAt) = ? THEN 1 ELSE 0 END) AS createdInTargetYear,
    SUM(CASE WHEN YEAR(pickupDate) = ? THEN 1 ELSE 0 END) AS pickupInTargetYear,
    SUM(CASE WHEN schaden_description IS NOT NULL AND schaden_description != '' THEN 1 ELSE 0 END) AS schadenCount,
    SUM(CASE WHEN beschwerde_description IS NOT NULL AND beschwerde_description != '' THEN 1 ELSE 0 END) AS beschwerdeCount,
    SUM(COALESCE(grossPrice, 0)) AS grossPriceTotal
  FROM moves
`, [targetYear, targetYear]);

const [monthlyByCreatedAt] = await connection.query(`
  SELECT YEAR(createdAt) AS year, MONTH(createdAt) AS month, COUNT(*) AS totalMoves, SUM(COALESCE(grossPrice, 0)) AS totalRevenue
  FROM moves
  GROUP BY YEAR(createdAt), MONTH(createdAt)
  ORDER BY YEAR(createdAt) DESC, MONTH(createdAt) DESC
  LIMIT 24
`);

const [monthlyByPickupDate] = await connection.query(`
  SELECT YEAR(pickupDate) AS year, MONTH(pickupDate) AS month, COUNT(*) AS totalMoves, SUM(COALESCE(grossPrice, 0)) AS totalRevenue
  FROM moves
  WHERE pickupDate IS NOT NULL
  GROUP BY YEAR(pickupDate), MONTH(pickupDate)
  ORDER BY YEAR(pickupDate) DESC, MONTH(pickupDate) DESC
  LIMIT 24
`);

const [recentSchaden] = await connection.query(`
  SELECT id, moveCode, customerId, schaden_description, schadenstatus, schadenkosten, createdAt, pickupDate
  FROM moves
  WHERE schaden_description IS NOT NULL AND schaden_description != ''
  ORDER BY id DESC
  LIMIT 10
`);

const [recentBeschwerden] = await connection.query(`
  SELECT id, moveCode, customerId, beschwerde_description, beschwerdeschweregrad, createdAt, pickupDate
  FROM moves
  WHERE beschwerde_description IS NOT NULL AND beschwerde_description != ''
  ORDER BY id DESC
  LIMIT 10
`);

console.log(JSON.stringify({
  targetYear,
  moveOverview: moveOverview[0] ?? null,
  monthlyByCreatedAt,
  monthlyByPickupDate,
  recentSchaden,
  recentBeschwerden,
}, null, 2));

await connection.end();
