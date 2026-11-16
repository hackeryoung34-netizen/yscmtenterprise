const crypto = require("crypto");

function config() {
  return {
    paystackSecret: process.env.PAYSTACK_SECRET_KEY || "",
    supabaseUrl: (process.env.SUPABASE_URL || "").replace(/\/$/, ""),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  };
}

async function verifyTransaction(reference) {
  const { paystackSecret } = config();
  if (!paystackSecret) throw new Error("Paystack is not configured.");
  const response = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), {
    headers: { Authorization: "Bearer " + paystackSecret, Accept: "application/json" }
  });
  if (!response.ok) throw new Error("Paystack verification request failed.");
  const result = await response.json();
  if (!result.status || !result.data) throw new Error("Paystack did not confirm this transaction.");
  const data = result.data;
  if (data.reference !== reference || data.status !== "success" || data.currency !== "NGN") throw new Error("Payment is not successful or does not match this order.");
  if (!Number.isSafeInteger(data.amount) || data.amount <= 0) throw new Error("Paystack returned an invalid amount.");
  return data;
}

async function confirmPaidOrder(reference) {
  const { supabaseUrl, serviceKey } = config();
  if (!supabaseUrl || !serviceKey) throw new Error("Secure payment confirmation is not configured.");
  const payment = await verifyTransaction(reference);
  const response = await fetch(supabaseUrl + "/rest/v1/rpc/store_confirm_paystack_payment", {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" },
    body: JSON.stringify({ p_reference: reference, p_amount_ngn: Math.round(payment.amount / 100), p_currency: payment.currency })
  });
  if (!response.ok) throw new Error("The verified payment could not be applied to the order.");
  const confirmed = await response.json();
  if (confirmed !== true) throw new Error("The payment does not match a pending YSCMT order.");
  return payment;
}

function validWebhookSignature(rawBody, headers) {
  const secret = process.env.PAYSTACK_SECRET_KEY || "";
  const legacy = headers["x-paystack-signature"];
  if (secret && typeof legacy === "string" && /^[a-f0-9]{128}$/i.test(legacy)) {
    const expected = crypto.createHmac("sha512", secret).update(rawBody).digest();
    const supplied = Buffer.from(legacy, "hex");
    if (supplied.length === expected.length && crypto.timingSafeEqual(expected, supplied)) return true;
  }
  const signingSecret = process.env.PAYSTACK_WEBHOOK_SECRET || "";
  const modern = headers["paystack-signature"];
  if (signingSecret && typeof modern === "string") {
    const fields = modern.split(",");
    const timestampField = fields.find(part => part.startsWith("t="));
    const timestamp = timestampField ? Number(timestampField.slice(2)) : NaN;
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
    const expected = crypto.createHmac("sha512", signingSecret).update(String(timestamp) + ".").update(rawBody).digest();
    for (const field of fields.filter(part => part.startsWith("v1="))) {
      const signature = field.slice(3).split(":").pop();
      if (!/^[a-f0-9]{128}$/i.test(signature)) continue;
      const supplied = Buffer.from(signature, "hex");
      if (supplied.length === expected.length && crypto.timingSafeEqual(expected, supplied)) return true;
    }
  }
  return false;
}

module.exports = { verifyTransaction, confirmPaidOrder, validWebhookSignature };