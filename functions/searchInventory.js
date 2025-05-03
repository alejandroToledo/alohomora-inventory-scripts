const { Client } = require("pg");

const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

client.connect();

const TYPE_SYNONYMS = {
  "pts": ["pts", "push to start"],
  "push to start": ["pts", "push to start"],
  "akl": ["akl"],
  "keyed": ["keyed"],
  "remote": ["remote"],
  "fob": ["fob"],
  "remote head": ["remote head"],
  "ignition": ["ignition"]
};

function extractYear(text) {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function extractTypeKey(text) {
  const lower = text.toLowerCase();
  for (const key in TYPE_SYNONYMS) {
    if (lower.includes(key)) return key;
  }
  return null;
}

async function searchInventory(input) {
  const sanitized = input.trim().toLowerCase();
  const year = extractYear(sanitized);
  const typeKey = extractTypeKey(sanitized);
  const typePatterns = typeKey ? TYPE_SYNONYMS[typeKey] : null;

  // ✅ Eliminar el año y el type key original (para que brand y model queden limpios)
  const rest = sanitized
    .replace(year, "")
    .replace(typeKey || "", "")
    .split(" ")
    .filter(Boolean);

  const brand = rest[0];
  const model = rest.slice(1).join(" ");

  if (!brand || !model) return { exact: [], alternatives: [] };

  try {
    // Caso 1: búsqueda exacta con type
    if (typePatterns && year) {
      const result = await client.query(
        `
        SELECT *
        FROM inventory
        WHERE year = $1
          AND LOWER(brand) ILIKE $2
          AND LOWER(model) ILIKE $3
          AND (${typePatterns.map((_, i) => `LOWER(type) ILIKE $${i + 4}`).join(" OR ")})
        `,
        [year, `%${brand}%`, `%${model}%`, ...typePatterns.map(p => `%${p.toLowerCase()}%`)]
      );

      if (result.rows.length > 0) {
        return { exact: result.rows, alternatives: [] };
      }
    }

    // Caso 2: sin type, buscar todos los matches por año + marca + modelo
    if (year) {
      const result = await client.query(
        `
        SELECT *
        FROM inventory
        WHERE year = $1
          AND LOWER(brand) ILIKE $2
          AND LOWER(model) ILIKE $3
        `,
        [year, `%${brand}%`, `%${model}%`]
      );

      if (result.rows.length > 0) {
        return { exact: result.rows, alternatives: [] };
      }
    }

    // Caso 3: sin match exacto, buscar sugerencias sin año
    const altResult = await client.query(
      `
      SELECT *
      FROM inventory
      WHERE LOWER(brand) ILIKE $1
        AND LOWER(model) ILIKE $2
      ORDER BY year
      LIMIT 5
      `,
      [`%${brand}%`, `%${model}%`]
    );

    return { exact: [], alternatives: altResult.rows };
  } catch (err) {
    console.error("❌ Error in searchInventory:", err.message);
    return { exact: [], alternatives: [] };
  }
}

module.exports = searchInventory;
