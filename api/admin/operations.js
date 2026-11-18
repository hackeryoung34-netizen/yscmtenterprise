function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

const installationStatuses = new Set(["requested", "reviewing", "in_progress", "completed", "cancelled"]);

module.exports = async function handler(req, res) {
  if (!["GET", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, PATCH");
    return send(res, 405, { error: "Method not allowed" });
  }

  const root = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!root || !anonKey || !serviceKey) {
    return send(res, 503, { error: "Order administration is not configured. Check the server-side Supabase service key." });
  }

  const authorization = req.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) return send(res, 401, { error: "Administrator sign-in is required." });

  try {
    const authResponse = await fetch(root + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: "Bearer " + accessToken }
    });
    if (!authResponse.ok) return send(res, 401, { error: "Your session is invalid or expired." });
    const user = await authResponse.json();
    if (!user.app_metadata || user.app_metadata.role !== "store_admin") {
      return send(res, 403, { error: "Store administrator permission is required." });
    }

    const adminHeaders = {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json"
    };

    if (req.method === "GET") {
      const ordersUrl = new URL(root + "/rest/v1/store_orders");
      ordersUrl.searchParams.set("select", "id,user_id,product_id,purchase_type,amount_ngn,currency,status,payment_provider,provider_reference,created_at,paid_at,store_products(name,slug)");
      ordersUrl.searchParams.set("order", "created_at.desc");
      ordersUrl.searchParams.set("limit", "200");

      const installationsUrl = new URL(root + "/rest/v1/store_installations");
      installationsUrl.searchParams.set("select", "id,order_id,user_id,requirements,status,admin_notes,created_at,updated_at,store_orders(amount_ngn,currency,status,purchase_type,store_products(name,slug))");
      installationsUrl.searchParams.set("order", "created_at.desc");
      installationsUrl.searchParams.set("limit", "200");

      const [ordersResponse, installationsResponse] = await Promise.all([
        fetch(ordersUrl, { headers: adminHeaders }),
        fetch(installationsUrl, { headers: adminHeaders })
      ]);
      if (!ordersResponse.ok || !installationsResponse.ok) {
        return send(res, 502, { error: "Unable to load orders and installation requests." });
      }
      const [orders, installations] = await Promise.all([ordersResponse.json(), installationsResponse.json()]);
      return send(res, 200, { orders, installations });
    }

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const id = typeof body.id === "string" ? body.id : "";
    const status = typeof body.status === "string" ? body.status : "";
    if (Object.prototype.hasOwnProperty.call(body, "admin_notes") && typeof body.admin_notes !== "string") {
      return send(res, 400, { error: "Admin notes must be text." });
    }
    const adminNotes = typeof body.admin_notes === "string" ? body.admin_notes : undefined;

    if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: "A valid installation request ID is required." });
    if (!installationStatuses.has(status)) return send(res, 400, { error: "Invalid installation status." });
    if (adminNotes !== undefined && adminNotes.length > 5000) {
      return send(res, 400, { error: "Admin notes must be 5,000 characters or fewer." });
    }

    const updateUrl = new URL(root + "/rest/v1/store_installations");
    updateUrl.searchParams.set("id", "eq." + id);
    const payload = { status };
    if (adminNotes !== undefined) payload.admin_notes = adminNotes;
    const updateResponse = await fetch(updateUrl, {
      method: "PATCH",
      headers: { ...adminHeaders, Prefer: "return=representation" },
      body: JSON.stringify(payload)
    });
    if (!updateResponse.ok) return send(res, 502, { error: "Unable to update the installation request." });
    const updated = await updateResponse.json();
    if (!updated[0]) return send(res, 404, { error: "Installation request not found." });

    const auditResponse = await fetch(root + "/rest/v1/store_audit_logs", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        actor_user_id: user.id,
        action: "installation_updated",
        entity_type: "store_installation",
        entity_id: updated[0].id,
        details: { status: updated[0].status }
      })
    });
    return send(res, 200, {
      installation: updated[0],
      warning: auditResponse.ok ? undefined : "Installation updated, but the audit event could not be recorded."
    });
  } catch {
    return send(res, 502, { error: "Order administration is temporarily unavailable." });
  }
};
