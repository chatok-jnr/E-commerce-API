import {prisma} from "../config/db.js";

export const addToCart = async(req, res) => {
    try{
        const { productId, quantity } = req.body;

        if (!productId || !quantity) {
            return res.status(400).json({
                status: 'failed',
                message: 'productId and quantity are required'
            });
        }

        if(typeof quantity !== 'number' || quantity < 1) {
            return res.status(400).json({
                status:'failed',
                message:'quantity must be a positive number'
            });
        }

        const product = await prisma.product.findUnique({
            where: { id: productId, deletedAt: null }
        });

        if(!product) {
            return res.status(404).json({
                status:'failed',
                message:'Product not found'
            });
        }

        if(product.stock < quantity) {
            return res.status(409).json({
                status:'failed',
                message:`Only ${product.stock} unit(s) in stock`
            });
        }

        const cartWhere = req.cartOwner.userId
            ? {userId: req.cartOwner.userId}
            : {sessionId: req.cartOwner.sessionId};

         // find-or-create the cart
        let cart = await prisma.cart.findFirst({ where: cartWhere });

        if (!cart) {
            cart = await prisma.cart.create({ data: cartWhere });
        }

        // check if this product is already in the cart
        const existingItem = await prisma.cartItem.findUnique({
            where: {
                cartId_productId: {
                    cartId: cart.id,
                    productId
                }
            }
        });

        let cartItem;
        if(existingItem) {
            const newQuantity = existingItem.quantity + quantity;

            if(product.stock < newQuantity) {
                return res.status(409).json({
                    status:'failed',
                    message:`Only ${product.stock} unit(s) in stock, you already have ${existingItem.quantity} in your cart`

                });
            }

            cartItem = await prisma.cartItem.update({
                where: {id: existingItem.id},
                data: {quantity: newQuantity}
            });
        } else {
            cartItem = await prisma.cartItem.create({
                data:{
                    cartId: cart.id,
                    productId,
                    quantity
                }
            });
        }

        return res.status(200).json({
            status:'success',
            message:'Item added to cart',
            cartItem
        });

    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:"failed",
            error: process.env.NODE_ENV === 'production'
                ? "Internal server error"
                : e.message
        });
    }
}

export const updateCartItem = async (req, res) => {
    try{
        const { productId } = req.params;
        const { quantity } = req.body;

        if (quantity === undefined || typeof quantity !== 'number' || quantity < 1) {
            return res.status(400).json({
                status: 'failed',
                message: 'quantity must be a positive number'
            });
        }

        const cartWhere = req.cartOwner.userId
            ? { userId: req.cartOwner.userId }
            : { sessionId: req.cartOwner.sessionId };

        const cart = await prisma.cart.findFirst({ where: cartWhere });

        if (!cart) {
            return res.status(404).json({
                status: 'failed',
                message: 'Cart not found'
            });
        }

        const cartItem = await prisma.cartItem.findUnique({
            where: {
                cartId_productId: {
                    cartId: cart.id,
                    productId
                }
            },
            include: { product: true }
        });

        if (!cartItem) {
            return res.status(404).json({
                status: 'failed',
                message: 'Item not found in cart'
            });
        }

        if (cartItem.product.stock < quantity) {
            return res.status(409).json({
                status: 'failed',
                message: `Only ${cartItem.product.stock} unit(s) in stock`
            });
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
    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:'failed',
            message:process.env.NODE_ENV === 'production'
            ?"Internal server error"
            :e.message
        }); 
    }
}

export const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.params;

        const cartWhere = req.cartOwner.userId
            ? { userId: req.cartOwner.userId }
            : { sessionId: req.cartOwner.sessionId };

        const cart = await prisma.cart.findFirst({ where: cartWhere });

        if (!cart) {
            return res.status(404).json({
                status: 'failed',
                message: 'Cart not found'
            });
        }

        const cartItem = await prisma.cartItem.findUnique({
            where: {
                cartId_productId: {
                    cartId: cart.id,
                    productId
                }
            }
        });

        if (!cartItem) {
            return res.status(404).json({
                status: 'failed',
                message: 'Item not found in cart'
            });
        }

        await prisma.cartItem.delete({
            where: { id: cartItem.id }
        });

        return res.status(200).json({
            status: 'success',
            message: 'Item removed from cart'
        });

    } catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 'failed',
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : e.message
        });
    }
};

export const getCart = async (req, res) => {
    try{
        const cartWhere = req.cartOwner.userId
            ? { userId: req.cartOwner.userId }
            : { sessionId: req.cartOwner.sessionId };

        const cart = await prisma.cart.findFirst({
            where: cartWhere,
            include: {
                items: {
    include: {
        product: {          // ← this level was missing
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

        if(!cart || cart.items.length === 0) {
            return res.status(200).json({
                status:'success',
                cart: {items: []},
                totalAmount: 0
            });
        }

        const totalAmount = cart.items.reduce((sum, item) => {
            return sum + (Number(item.product.price) * item.quantity);
        }, 0);

        return res.status(200).json({
            status: 'success',
            cart,
            totalAmount
        });
    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:'failed',
            message:process.env.NODE_ENV === 'production'
            ?"Internal server error"
            :e.message
        }); 
    }
}

export const clearCart = async (req, res) => {
    try {
        const cartWhere = req.cartOwner.userId
            ? { userId: req.cartOwner.userId }
            : { sessionId: req.cartOwner.sessionId };

        const cart = await prisma.cart.findFirst({ where: cartWhere });

        if (!cart) {
            return res.status(404).json({
                status: 'failed',
                message: 'Cart not found'
            });
        }

        await prisma.cartItem.deleteMany({
            where: { cartId: cart.id }
        });

        return res.status(200).json({
            status: 'success',
            message: 'Cart cleared'
        });

    } catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 'failed',
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : e.message
        });
    }
};