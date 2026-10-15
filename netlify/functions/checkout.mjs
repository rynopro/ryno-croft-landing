import { randomUUID } from "node:crypto";
import { VOLUMES, ordersStore } from "./lib/volumes.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const form = await req.formData();
  const volume = String(form.get("volume") || "");
  const product = VOLUMES[volume];
  if (!product) return new Response("Unknown volume", { status: 400 });

  const secret = process.env.YOCO_SECRET_KEY;
  if (!secret) return new Response("Payments not configured", { status: 500 });
  const site = (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, "");

  const orderId = randomUUID();
  const res = await fetch("https://payments.yoco.com/api/checkouts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
      "Idempotency-Key": orderId,
    },
    body: JSON.stringify({
      amount: product.amount,
      currency: "ZAR",
      successUrl: `${site}/volume-thank-you.html?order=${orderId}`,
      cancelUrl: `${site}/sa-business`,
      failureUrl: `${site}/sa-business`,
      metadata: { orderId, volume },
    }),
  });
  if (!res.ok) {
    console.error("Yoco checkout failed", res.status, await res.text());
    return new Response("Could not start checkout", { status: 502 });
  }
  const checkout = await res.json();

  const orders = ordersStore();
  await orders.setJSON(`order-${orderId}`, {
    volume,
    amount: product.amount,
    status: "pending",
    checkoutId: checkout.id,
    createdAt: Date.now(),
    downloads: 0,
  });
  await orders.set(`checkout-${checkout.id}`, orderId);

  return Response.redirect(checkout.redirectUrl, 303);
};

export const config = { path: "/api/checkout" };
