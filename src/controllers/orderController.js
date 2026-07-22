import Stripe from "stripe";
import { prisma } from "../config/db.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const VALID_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export const checkout = catchAsync(async (req, res) => {
    const cart = await prisma.cart.findFirst({
        where: { userId: req.user.id },
        include: { items: { include: { product: true } } }
    });

    if (!cart || cart.items.length === 0) {
        throw new AppError('Cart is empty', 400);
    }

    // Validate stock for every item before creating anything
    for (const item of cart.items) {
        if (item.product.deletedAt) {
            throw new AppError(`"${item.product.name}" is no longer available`, 409);
        }
        if (item.product.stock < item.quantity) {
            throw new AppError(`Only ${item.product.stock} unit(s) of "${item.product.name}" in stock`, 409);
        }
    }

    // Compute total server-side — never trust a client-sent amount
    const totalAmount = cart.items.reduce(
        (sum, item) => sum + (Number(item.product.price) * item.quantity),
        0
    );

    // Create Order + OrderItems atomically, snapshotting current prices
    const order = await prisma.order.create({
        data: {
            customerId: req.user.id,
            totalAmount,
            status: 'PENDING',
            items: {
                create: cart.items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.product.price
                }))
            }
        },
        include: { items: true }
    });

    // Build Stripe line items from the order (not the live cart —
    // order is now the frozen source of truth)
    const line_items = order.items.map((item, index) => ({
        price_data: {
            currency: "usd",
            product_data: { name: cart.items[index].product.name },
            unit_amount: Math.round(Number(item.price) * 100) // Stripe wants cents
        },
        quantity: item.quantity
    }));

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items,
        success_url: `${process.env.CLIENT_URL}/order/success?orderId=${order.id}`,
        cancel_url: `${process.env.CLIENT_URL}/order/cancel?orderId=${order.id}`,
        metadata: { orderId: order.id }
    });

    // Save the Payment row now, so the webhook has something to find by sessionId
    await prisma.payment.create({
        data: {
            orderId: order.id,
            stripeCheckoutSessionId: session.id,
            amount: totalAmount,
            status: 'PENDING'
        }
    });

    // Clear the cart now that the order has "captured" it
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    return res.status(201).json({
        status: 'success',
        message: 'Checkout session created',
        checkoutUrl: session.url,
        orderId: order.id
    });
});

export const getOrders = catchAsync(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
        throw new AppError('page and limit must be positive numbers', 400);
    }

    const where = { customerId: req.user.id };
    if (status) where.status = status;

    const skip = (pageNum - 1) * limitNum;

    const [orders, totalCount] = await prisma.$transaction([
        prisma.order.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { createdAt: 'desc' },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                images: { orderBy: { serialNo: 'asc' }, take: 1 }
                            }
                        }
                    }
                },
                payment: { select: { status: true } }
            }
        }),
        prisma.order.count({ where })
    ]);

    return res.status(200).json({
        status: 'success',
        orders,
        pagination: {
            page: pageNum,
            limit: limitNum,
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum)
        }
    });
});

export const getOrder = catchAsync(async (req, res) => {
    const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            images: { orderBy: { serialNo: 'asc' }, take: 1 }
                        }
                    }
                }
            },
            payment: true
        }
    });

    if (!order) {
        throw new AppError('Order not found', 404);
    }

    // Ownership check — customers can only view their own orders
    const isOwner = order.customerId === req.user.id;
    const isAdmin = req.user.roles.some(r => r.role === 'ADMIN');

    if (!isOwner && !isAdmin) {
        throw new AppError('You do not have permission to view this order', 403);
    }

    return res.status(200).json({
        status: 'success',
        order
    });
});

export const cancelOrder = catchAsync(async (req, res) => {
    const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: true, payment: true }
    });

    if (!order) {
        throw new AppError('Order not found', 404);
    }

    const isOwner = order.customerId === req.user.id;
    const isAdmin = req.user.roles.some(r => r.role === 'ADMIN');

    if (!isOwner && !isAdmin) {
        throw new AppError('You do not have permission to cancel this order', 403);
    }

    if (order.status === 'CANCELLED') {
        throw new AppError('Order is already cancelled', 409);
    }

    if (!['PENDING', 'PAID'].includes(order.status)) {
        throw new AppError(`Cannot cancel an order that has already been ${order.status.toLowerCase()}`, 409);
    }

    // Case 1: never paid — just cancel, nothing to refund
    if (order.status === 'PENDING') {
        await prisma.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' }
        });

        return res.status(200).json({
            status: 'success',
            message: 'Order cancelled'
        });
    }

    // Case 2: already paid — refund via Stripe, restore stock, update records
    if (!order.payment || !order.payment.stripePaymentIntentId) {
        // Data integrity issue, not a normal user-facing error — log it regardless of env
        console.error(`Order ${order.id} is PAID but has no paymentIntentId — cannot refund`);
        throw new AppError('Unable to process refund — please contact support', 500);
    }

    const refund = await stripe.refunds.create({
        payment_intent: order.payment.stripePaymentIntentId
    });

    await prisma.$transaction([
        prisma.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' }
        }),
        prisma.payment.update({
            where: { id: order.payment.id },
            data: { status: 'REFUNDED' }
        }),
        ...order.items.map(item =>
            prisma.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } }
            })
        )
    ]);

    return res.status(200).json({
        status: 'success',
        message: 'Order cancelled and refund issued',
        refundId: refund.id
    });
});

export const updateOrderStatus = catchAsync(async (req, res) => {
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
        throw new AppError(`status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });

    if (!order) {
        throw new AppError('Order not found', 404);
    }

    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
        throw new AppError(`Cannot change status of an order that is already ${order.status.toLowerCase()}`, 409);
    }

    if (status === 'CANCELLED') {
        throw new AppError('Use the order cancellation endpoint to cancel and process refunds', 400);
    }

    const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { status }
    });

    return res.status(200).json({
        status: 'success',
        message: 'Order status updated',
        order: updatedOrder
    });
});