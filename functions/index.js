const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const cors = require("cors")({ origin: true });

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

exports.identifySpecies = onRequest(
  { secrets: [ANTHROPIC_API_KEY], cors: true, region: "southamerica-east1" },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({ error: "método não permitido" });
        }

        const { imageBase64, mediaType, category } = req.body;
        if (!imageBase64 || !category) {
          return res.status(400).json({ error: "imageBase64 e category são obrigatórios" });
        }

        const categoryLabel = category === "flora" ? "planta" : "animal";

        const prompt = `Você está identificando um ${categoryLabel} a partir de uma foto tirada por um usuário comum, provavelmente no Brasil.

Responda SOMENTE em formato JSON puro, sem markdown, sem texto antes ou depois, seguindo exatamente este formato:
{"common_name": "nome popular em português", "scientific_name": "nome científico ou null se não for possível identificar", "confidence": "alta|média|baixa", "notes": "uma frase curta com uma curiosidade ou característica marcante"}

Se a foto não mostrar claramente um ${categoryLabel}, ou não for possível identificar, retorne common_name como null.`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY.value(),
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 300,
            messages: [
              {
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } },
                  { type: "text", text: prompt }
                ]
              }
            ]
          })
        });

        const data = await response.json();

        if (data.error) {
          console.error("erro da API Anthropic:", data.error);
          return res.status(502).json({ error: "erro ao identificar imagem" });
        }

        const textBlock = (data.content || []).find(b => b.type === "text");
        if (!textBlock) {
          return res.status(502).json({ error: "resposta inesperada da IA" });
        }

        let parsed;
        try {
          const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
          parsed = JSON.parse(cleaned);
        } catch (e) {
          console.error("falha ao parsear JSON:", textBlock.text);
          return res.status(502).json({ error: "não consegui interpretar a resposta da IA" });
        }

        return res.status(200).json(parsed);
      } catch (err) {
        console.error("erro geral:", err);
        return res.status(500).json({ error: "erro interno" });
      }
    });
  }
);
