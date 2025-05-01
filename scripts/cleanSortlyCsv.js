const fs = require("fs");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const INPUT_FILE = "./data/database.csv";
const OUTPUT_FILE = "./data/clean_inventory.csv";

const tiposTrabajo = ["AKL", "Keyed", "Push to Start", "PTS", "Remote", "FOB", "Ignition", "Remote Head"];

function extraerAños(palabras) {
  return palabras.filter(p => /^\d{4}$/.test(p));
}

function extraerMarcaYModelo(palabras) {
  const marcaIndex = palabras.findIndex(p => isNaN(p) && /^[A-Z]/.test(p));
  const marca = palabras[marcaIndex];
  const modelo = palabras[marcaIndex + 1] || "";
  return { marca, modelo };
}

function extraerTipoTrabajo(texto) {
  return tiposTrabajo
    .filter(tipo => texto.toUpperCase().includes(tipo.toUpperCase()))
    .join(" ");
}

const resultados = [];
let headersOriginales = [];

fs.createReadStream(INPUT_FILE)
  .pipe(csv())
  .on("headers", (headers) => {
    headersOriginales = headers;
  })
  .on("data", (row) => {
    const entry = row["Entry Name"];
    if (!entry) return;

    const palabras = entry.trim().split(/\s+/);
    const años = extraerAños(palabras);
    const { marca, modelo } = extraerMarcaYModelo(palabras);
    const tipo = extraerTipoTrabajo(entry);

    años.forEach((año) => {
      const newRow = {
        ...row, // incluye todos los datos originales
        year: año,
        brand: marca,
        model: modelo,
        type: tipo,
      };
      resultados.push(newRow);
    });
  })
  .on("end", () => {
    const csvWriter = createCsvWriter({
      path: OUTPUT_FILE,
      header: [
        ...headersOriginales.map(h => ({ id: h, title: h })),
        { id: "year", title: "Year" },
        { id: "brand", title: "Brand" },
        { id: "model", title: "Model" },
        { id: "type", title: "Type" },
      ],
    });

    csvWriter
      .writeRecords(resultados)
      .then(() => console.log("✅ Archivo limpio creado con todos los campos + los nuevos extraídos."));
  });
