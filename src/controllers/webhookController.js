import Stripe from "stripe";
import { prisma } from "../config/db.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"];

    // Verify this request actually came from Stripe before trusting anything in it
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (e) {
        console.error("Webhook signature verification failed:", e.message);
        return res.status(400).send(`Webhook Error: ${e.message}`);
    }

    try {
        // Idempotency check — Stripe may send the same event more than once
        const existingEvent = await prisma.webHookEvent.findUnique({
            where: { stripeEventId: event.id }
        });

        if (existingEvent) {
            return res.status(200).json({ received: true, note: "already processed" });
        }

        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const orderId = session.metadata.orderId;

            const payment = await prisma.payment.findUnique({
                where: { stripeCheckoutSessionId: session.id },
                include: { order: { include: { items: true } } }
            });

            if (!payment) {
                // Data inconsistency, not something a retry fixes — log and move on
                console.error(`No payment found for session ${session.id}`);
            } else if (payment.status !== "SUCCEEDED") {
                // Verify amount matches what we expect — never trust Stripe's payload blindly
                const expectedAmount = Math.round(Number(payment.amount) * 100);

                if (session.amount_total !== expectedAmount) {
                    console.error(`Amount mismatch for order ${orderId}: expected ${expectedAmount}, got ${session.amount_total}`);
                } else {
                    await prisma.$transaction([
                        prisma.payment.update({
                            where: { id: payment.id },
                            data: {
                                status: "SUCCEEDED",
                                stripePaymentIntentId: session.payment_intent
                            }
                        }),
                        prisma.order.update({
                            where: { id: orderId },
                            data: { status: "PAID" }
                        }),
                        ...payment.order.items.map(item =>
                            prisma.product.update({
                                where: { id: item.productId },
                                data: { stock: { decrement: item.quantity } }
                            })
                        )
                    ]);
                }
            }
        }

        if (event.type === "checkout.session.expired") {
            const session = event.data.object;
            const payment = await prisma.payment.findUnique({
                where: { stripeCheckoutSessionId: session.id }
            });

            if (payment && payment.status === "PENDING") {
                await prisma.$transaction([
                    prisma.payment.update({
                        where: { id: payment.id },
                        data: { status: "FAILED" }
                    }),
                    prisma.order.update({
                        where: { id: payment.orderId },
                        data: { status: "CANCELLED" }
                    })
                ]);
            }
        }

        // Log this event so we never process it twice
        await prisma.webHookEvent.create({
            data: { stripeEventId: event.id, type: event.type }
        });

        return res.status(200).json({ received: true });

    } catch (e) {
        // Only truly unexpected failures land here — a 500 tells Stripe to retry later
        console.error("Webhook handler error:", e);
        return res.status(500).json({ received: false });
    }
};