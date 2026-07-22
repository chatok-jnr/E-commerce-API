import { prisma } from "../config/db.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";

// Resolves the cart filter based on whether the request is from a logged-in user or a guest
const getCartWhere = (req) => (
    req.cartOwner.userId
        ? { userId: req.cartOwner.userId }
        : { sessionId: req.cartOwner.sessionId }
);

export const addToCart = catchAsync(async (req, res) => {
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
        throw new AppError('productId and quantity are required', 400);
    }

    if (typeof quantity !== 'number' || quantity < 1) {
        throw new AppError('quantity must be a positive number', 400);
    }

    const product = await prisma.product.findUnique({
        where: { id: productId, deletedAt: null }
    });

    if (!product) {
        throw new AppError('Product not found', 404);
    }

    if (product.stock < quantity) {
        throw new AppError(`Only ${product.stock} unit(s) in stock`, 409);
    }

    const cartWhere = getCartWhere(req);

    // find-or-create the cart
    let cart = await prisma.cart.findFirst({ where: cartWhere });
    if (!cart) {
        cart = await prisma.cart.create({ data: cartWhere });
    }

    // check if this product is already in the cart
    const existingItem = await prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } }
    });

    let cartItem;
    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;

        if (product.stock < newQuantity) {
            throw new AppError(
                `Only ${product.stock} unit(s) in stock, you already have ${existingItem.quantity} in your cart`,
                409
            );
        }

        cartItem = await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQuantity }
        });
    } else {
        cartItem = await prisma.cartItem.create({
            data: { cartId: cart.id, productId, quantity }
        });
    }

    return res.status(200).json({
        status: 'success',
        message: 'Item added to cart',
        cartItem
    });
});

export const updateCartItem = catchAsync(async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || typeof quantity !== 'number' || quantity < 1) {
        throw new AppError('quantity must be a positive number', 400);
    }

    const cartWhere = getCartWhere(req);
    const cart = await prisma.cart.findFirst({ where: cartWhere });

    if (!cart) {
        throw new AppError('Cart not found', 404);
    }

    const cartItem = await prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } },
        include: { product: true }
    });

    if (!cartItem) {
        throw new AppError('Item not found in cart', 404);
    }

    if (cartItem.product.stock < quantity) {
        throw new AppError(`Only ${cartItem.product.stock} unit(s) in stock`, 409);
    }

    const updatedItem = await prisma.cartItem.update({
        where: { id: cartItem.id },
        data: { quantity }
    });

    return res.status(200).json({
        status: 'success',
        message: 'Cart item updated',
        cartItem: updatedItem
    });
});

export const removeFromCart = catchAsync(async (req, res) => {
    const { productId } = req.params;

    const cartWhere = getCartWhere(req);
    const cart = await prisma.cart.findFirst({ where: cartWhere });

    if (!cart) {
        throw new AppError('Cart not found', 404);
    }

    const cartItem = await prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } }
    });

    if (!cartItem) {
        throw new AppError('Item not found in cart', 404);
    }

    await prisma.cartItem.delete({ where: { id: cartItem.id } });

    return res.status(200).json({
        status: 'success',
        message: 'Item removed from cart'
    });
});

export const getCart = catchAsync(async (req, res) => {
    const cartWhere = getCartWhere(req);

    const cart = await prisma.cart.findFirst({
        where: cartWhere,
        include: {
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            stock: true,
                            images: {
                                orderBy: { serialNo: 'asc' },
                                take: 1
                            }
                        }
                    }
                }
            }
        }
    });

    if (!cart || cart.items.length === 0) {
        return res.status(200).json({
            status: 'success',
            cart: { items: [] },
            totalAmount: 0
        });
    }

    const totalAmount = cart.items.reduce(
        (sum, item) => sum + (Number(item.product.price) * item.quantity),
        0
    );

    return res.status(200).json({
        status: 'success',
        cart,
        totalAmount
    });
});

export const clearCart = catchAsync(async (req, res) => {
    const cartWhere = getCartWhere(req);
    const cart = await prisma.cart.findFirst({ where: cartWhere });

    if (!cart) {
        throw new AppError('Cart not found', 404);
    }

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    return res.status(200).json({
        status: 'success',
        message: 'Cart cleared'
    });
});