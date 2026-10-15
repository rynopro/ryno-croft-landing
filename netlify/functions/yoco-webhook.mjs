import { createHmac, timingSafeEqual } from "node:crypto";
import { ACCESS_DAYS, ordersStore } from "./lib/volumes.mjs";

function verify(headers, rawBody, secret) {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 180) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest();
  return sigHeader.split(" ").some((entry) => {
    const sig = entry.split(",")[1];
    if (!sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const raw = await req.text();
  const secret = process.env.YOCO_WEBHOOK_SECRET;
  if (!secret || !verify(req.headers, raw, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event;
  try { event = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (event.type !== "payment.succeeded") return new Response("Ignored", { status: 200 });

  const payment = event.payload || {};
  const checkoutId = payment.metadata?.checkoutId;
  if (!checkoutId) return new Response("No checkout id", { status: 200 });

  const orders = ordersStore();
  const orderId = await orders.get(`checkout-${checkoutId}`);
  if (!orderId) return new Response("Not one of ours", { status: 200 }); // other site/product on the same Yoco account

  const order = await orders.get(`order-${orderId}`, { type: "json" });
  if (!order) return new Response("Order missing", { status: 200 });

  if (payment.status !== "succeeded" || payment.currency !== "ZAR" || payment.amount !== order.amount) {
    console.error("Payment mismatch", { orderId, amount: payment.amount, status: payment.status });
    return new Response("Mismatch", { status: 200 });
  }

  if (order.status !== "paid") {
    order.status = "paid";
    order.paidAt = Date.now();
    order.expiresAt = Date.now() + ACCESS_DAYS * 24 * 60 * 60 * 1000;
    await orders.setJSON(`order-${orderId}`, order);
  }
  return new Response("OK", { status: 200 });
};

export const config = { path: "/api/yoco-webhook" };
