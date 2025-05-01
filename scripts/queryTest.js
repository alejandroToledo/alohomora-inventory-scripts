const { Client } = require("pg");
const readline = require("readline");

const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "alohomora-inventory",
  password: "atide777",
  port: 5432,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const TYPES = [
  "AKL", "Push to Start", "PTS", "Remote", "Keyed", "FOB", "Remote Head", "Ignition"
];

function extractYear(text) {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function extractType(text) {
  const lower = text.toLowerCase();
  return TYPES.find(t => lower.includes(t.toLowerCase())) || null;
}

async function searchInventory(input) {
  const sanitized = input.trim().toLowerCase();
  const year = extractYear(sanitized);
  const type = extractType(sanitized);

  const rest = sanitized
    .replace(year, "")
    .replace(type ? type.toLowerCase() : "", "")
    .split(" ")
    .filter(Boolean);

  const brand = rest[0];
  const model = rest.slice(1).join(" ");

  if (!brand || !model) {
    console.log("❌ Incomplete query: must include brand and model.");
    return;
  }

  await client.connect();

  try {
    // 1. Buscar exacto
    const values = [year, `%${brand}%`, `%${model}%`];
    let query = `
      SELECT * FROM inventory
      WHERE year = $1
        AND LOWER(brand) ILIKE $2
        AND LOWER(model) ILIKE $3
    `;

    if (type) {
      query += ` AND LOWER(type) ILIKE $4`;
      values.push(`%${type.toLowerCase()}%`);
    }

    query += ` LIMIT 1`;

    const exact = await client.query(query, values);

    if (exact.rows.length > 0) {
      const r = exact.rows[0];
      console.log(
        `✅ FOUND: ${r.brand} ${r.model} ${r.year} (${r.type})\nNotes: ${r.notes}\nEntry: ${r.entry_name}`
      );
    } else {
      // 2. Buscar por marca/modelo ignorando año
      const altValues = [`%${brand}%`, `%${model}%`];
      let altQuery = `
        SELECT * FROM inventory
        WHERE LOWER(brand) ILIKE $1
          AND LOWER(model) ILIKE $2
      `;

      if (type) {
        altQuery += ` AND LOWER(type) ILIKE $3`;
        altValues.push(`%${type.toLowerCase()}%`);
      }

      altQuery += ` ORDER BY year`;

      const alternatives = await client.query(altQuery, altValues);

      if (alternatives.rows.length) {
        console.log("🔁 No exact match. Similar results:");
        alternatives.rows.forEach((row) => {
          console.log(`- ${row.brand} ${row.model} ${row.year} (${row.type})`);
        });
      } else {
        console.log("❌ No matches found.");
      }
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.end();
    rl.close();
  }
}

rl.question("🔎 Enter search (brand model year [type]): ", (input) => {
  searchInventory(input);
});
