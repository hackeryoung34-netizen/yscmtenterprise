import { ai, db } from "hatchable";

export const access = "user";
export const methods = ["POST"];

export default async function (req, res) {
  const body = req.body || {};
  const product = String(body.product || "").trim();
  const platform = String(body.platform || "Meta Ads").trim();
  const objective = String(body.objective || "Conversions").trim();
  const audience = String(body.audience || "").trim();
  const tone = String(body.tone || "Confident").trim();
  const offer = String(body.offer || "").trim();
  const keyMessage = String(body.keyMessage || "").trim();

  if (!product || !audience) return res.status(400).json({error:"Product and audience are required."});
  if (product.length > 500 || audience.length > 1000 || keyMessage.length > 1500) {
    return res.status(400).json({error:"Input is too long."});
  }

  const prompt = [
    "Create an advertising creative pack for the product below.",
    "Return ONLY valid JSON with these keys: headline, primaryText, shortText, cta, hooks (array of 5 strings), concepts (array of 3 objects with name, visual, overlayText), imagePrompt, variations (array of 3 objects with headline, primaryText, cta).",
    "Do not claim guaranteed results, fabricate statistics, or use deceptive claims.",
    "Product: " + product,
    "Platform: " + platform,
    "Objective: " + objective,
    "Audience: " + audience,
    "Tone: " + tone,
    "Offer: " + offer,
    "Key message: " + keyMessage
  ].join("\n");

  const r = await ai.generateText({
    model: "sonnet",
    purpose: "ad-creative-generation",
    userId: req.user.id,
    system: "You are an expert performance advertising creative strategist. Produce concise, platform-aware, conversion-focused copy while staying truthful.",
    prompt,
    maxTokens: 5000
  });

  if (r.finishReason === "length") return res.status(502).json({error:"AI response was truncated. Please try again."});

  let result;
  try { result = JSON.parse(r.text); }
  catch { return res.status(502).json({error:"AI returned an invalid creative pack. Please try again."}); }

  await db.query(
    "INSERT INTO creations (user_id, product_name, platform, objective, audience, tone, offer, key_message, result) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [req.user.id, product, platform, objective, audience, tone, offer, keyMessage, JSON.stringify(result)]
  );

  res.json({result});
}