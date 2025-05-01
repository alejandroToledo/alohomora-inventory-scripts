const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const csv = require("csv-parser");

const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "alohomora-inventory",
  password: "atide777",
  port: 5432,
});

const csvFilePath = path.join(__dirname, "../data/database.csv"); // Ajustá si movés el CSV

async function main() {
  await client.connect();
  console.log("📦 Conectado a PostgreSQL");

  const batchSize = 500;
  let batch = [];

  const insertBatch = async () => {
    if (batch.length === 0) return;

    const values = [];
    const placeholders = [];

    batch.forEach((row, i) => {
      const rowValues = [
        row["Entry Name"],
        row["Entry Type"],
        row["SID"],
        row["Item Group Name"],
        row["Attribute 1 Name"],
        row["Attribute 1 Option"],
        row["Attribute 2 Name"],
        row["Attribute 2 Option"],
        row["Attribute 3 Name"],
        row["Attribute 3 Option"],
        row["Quantity"],
        row["Unit"],
        row["Min Level"],
        row["Price"],
        row["Value"],
        row["Notes"],
        row["Tags"],
        row["Primary Folder"],
        row["Subfolder Level1"],
        row["Subfolder Level2"],
        row["Subfolder Level3"],
        row["Subfolder Level4"],
        row["Photo1"],
        row["Photo2"],
        row["Photo3"],
        row["Photo4"],
        row["Photo5"],
        row["Photo6"],
        row["Photo7"],
        row["Photo8"],
        row["Web Link"],
        row["Web Link.1"],
      ];
      values.push(...rowValues);
      const offset = i * 32;
      placeholders.push(`(${Array.from({ length: 32 }, (_, j) => `$${offset + j + 1}`).join(", ")})`);
    });

    const query = `
      INSERT INTO inventory_items (
        entry_name, entry_type, sid, item_group_name,
        attribute_1_name, attribute_1_option, attribute_2_name, attribute_2_option,
        attribute_3_name, attribute_3_option, quantity, unit,
        min_level, price, value, notes,
        tags, primary_folder, subfolder_level1, subfolder_level2,
        subfolder_level3, subfolder_level4,
        photo1, photo2, photo3, photo4,
        photo5, photo6, photo7, photo8,
        web_link, web_link_2
      ) VALUES ${placeholders.join(", ")}
    `;

    try {
      await client.query("BEGIN");
      await client.query(query, values);
      await client.query("COMMIT");
      console.log(`✅ Insertadas ${batch.length} filas`);
    } catch (err) {
      console.error("❌ Error insertando batch:", err.message);
      await client.query("ROLLBACK");
    }

    batch = [];
  };

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on("data", async (row) => {
      batch.push(row);
      if (batch.length >= batchSize) {
        await insertBatch();
      }
    })
    .on("end", async () => {
      await insertBatch(); // Inserta el último batch
      await client.end();
      console.log("🎉 Importación finalizada.");
    });
}

main().catch((err) => console.error("❌ Error general:", err));
