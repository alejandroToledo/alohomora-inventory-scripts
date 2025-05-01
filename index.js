const express = require("express");
const { MessagingResponse } = require("twilio").twiml;
const searchInventory = require("./functions/searchInventory");

const app = express();
app.use(express.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3000;

app.post("/whatsapp", async (req, res) => {
  const twiml = new MessagingResponse();
  const raw = req.body.Body || "";

  console.log(`↪ Received WhatsApp message: "${raw}"`);

  try {
    const result = await searchInventory(raw);
    console.log("   • searchInventory result:", result);

    // Si hay resultados exactos (pueden ser varios cuando no especifica type)
    if (result.exact.length > 0) {
      const replies = result.exact.map(r =>
        `🔍 *${r.brand} ${r.model} ${r.year}*\n` +
        `- Type: ${r.type}\n` +
        `- Notes: ${r.notes || "None"}\n` +
        `- Entry: ${r.entry_name}`
      );
      twiml.message(replies.join("\n\n"));

    // Si no hay exactos pero sí alternativas
    } else if (result.alternatives.length > 0) {
      let msg = `❌ No exact match for "${raw}".\n🔁 Similar results:\n`;
      result.alternatives.forEach(a => {
        msg += `\n- ${a.brand} ${a.model} ${a.year} (${a.type})`;
      });
      twiml.message(msg);

    // Fallback si no hay nada
    } else {
      twiml.message(
        `❌ I couldn't find any info for "${raw}".\n` +
        `Please send in the format: <Brand> <Model> <Year> [Type].`
      );
    }

  } catch (err) {
    console.error("❌ Exception in /whatsapp handler:", err);
    twiml.message("❌ Oops, something went wrong. Please try again.");
  }

  // Siempre se responde a Twilio
  res.set("Content-Type", "text/xml");
  
  // después de armar twiml:
  console.log("↪ TwiML response:\n", twiml.toString());

  res.send(twiml.toString());
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
