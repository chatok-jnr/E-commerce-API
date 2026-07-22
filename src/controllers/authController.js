import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { genAccessToken, genRefreshToken } from "../utils/jwtService.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";

// Sets access & refresh token cookies with consistent options
const setAuthCookies = (res, accessToken, refreshToken) => {
    res.cookie("access_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: "strict",
        maxAge: 15 * 60 * 1000
    });

    res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
};

// Hashes and stores a refresh token, valid for 7 days
const issueRefreshToken = async (userId, refreshToken) => {
    const hashedRefreshToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
        data: { userId, token: hashedRefreshToken, expiresAt }
    });
};

export const register = catchAsync(async (req, res) => {
    const { name, email, password, profileImage, bio, dob } = req.body;

    if (!name || !email || !password) {
        throw new AppError('name, email, password required', 400);
    }

    const isExist = await prisma.user.findUnique({ where: { email } });
    if (isExist) {
        throw new AppError('User with this email already exists', 409);
    }

    // Hash password before saving
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
        data: {
            name, email, profileImage, bio, dob,
            password: hashPassword,
            roles: { create: { role: "CUSTOMER" } }
        },
        include: { roles: true }
    });

    const { password: _, roles, ...safeUser } = user;

    const access_token = genAccessToken(user.id);
    const refresh_token = genRefreshToken(user.id);
    await issueRefreshToken(user.id, refresh_token);
    setAuthCookies(res, access_token, refresh_token);

    return res.status(201).json({
        status: 'success',
        message: 'Profile created successfully',
        user: { ...safeUser, role: roles.map(r => r.role) }
    });
});

export const login = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new AppError('email and password required', 400);
    }

    const user = await prisma.user.findUnique({
        where: { email },
        include: { roles: true }
    });

    if (!user) {
        // Dummy compare to keep response timing consistent (timing-attack mitigation)
        await bcrypt.compare(password, "$2b$10$CwTycUXWue0Thq9StjUM0uJ8Z6r4z6q6z9b0.f8g0G8p4kX5q5q5q");
        throw new AppError('wrong credential', 400);
    }

    if (user.deletedAt !== null) {
        throw new AppError('This account no longer exists.', 403);
    }

    const isPassValid = await bcrypt.compare(password, user.password);
    if (!isPassValid) {
        throw new AppError('wrong credential', 400);
    }

    // Merge guest cart (if any) into the user's cart on login
    const guestSessionId = req.cookies.cart_session;
    if (guestSessionId) {
        const guestCart = await prisma.cart.findFirst({
            where: { sessionId: guestSessionId },
            include: { items: true }
        });

        if (guestCart && guestCart.items.length > 0) {
            let userCart = await prisma.cart.findFirst({ where: { userId: user.id } });

            if (!userCart) {
                // No existing cart — just reassign the guest cart to this user
                userCart = await prisma.cart.update({
                    where: { id: guestCart.id },
                    data: { userId: user.id, sessionId: null }
                });
            } else {
                // Merge guest items into existing cart, then discard the guest cart
                for (const guestItem of guestCart.items) {
                    const existingItem = await prisma.cartItem.findUnique({
                        where: {
                            cartId_productId: { cartId: userCart.id, productId: guestItem.productId }
                        }
                    });

                    if (existingItem) {
                        await prisma.cartItem.update({
                            where: { id: existingItem.id },
                            data: { quantity: existingItem.quantity + guestItem.quantity }
                        });
                    } else {
                        await prisma.cartItem.create({
                            data: { cartId: userCart.id, productId: guestItem.productId, quantity: guestItem.quantity }
                        });
                    }
                }
                await prisma.cart.delete({ where: { id: guestCart.id } });
            }
        }
        res.clearCookie("cart_session");
    }

    const access_token = genAccessToken(user.id);
    const refresh_token = genRefreshToken(user.id);
    await issueRefreshToken(user.id, refresh_token);
    setAuthCookies(res, access_token, refresh_token);

    return res.status(200).json({
        status: 'success',
        message: 'Login successfull',
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            bio: user.bio,
            profileImage: user.profileImage,
            dob: user.dob,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            role: user.roles.map(r => r.role)
        }
    });
});

export const logout = catchAsync(async (req, res) => {
    const refresh_token = req.cookies.refresh_token;

    if (refresh_token) {
        const hashedToken = crypto.createHash("sha256").update(refresh_token).digest("hex");
        await prisma.refreshToken.updateMany({
            where: { token: hashedToken, revoked: false },
            data: { revoked: true }
        });
    }

    res.clearCookie("access_token");
    res.clearCookie("refresh_token");

    return res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

export const refresh = catchAsync(async (req, res) => {
    const incomingToken = req.cookies.refresh_token;
    if (!incomingToken) {
        throw new AppError('Refresh token missing, please log in', 401);
    }

    let decoded;
    try {
        decoded = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
    } catch (e) {
        throw new AppError('Invalid or expired refresh token, please log in', 401);
    }

    const hashedIncoming = crypto.createHash("sha256").update(incomingToken).digest("hex");
    const storedToken = await prisma.refreshToken.findUnique({ where: { token: hashedIncoming } });

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
        // Possible token reuse/theft — revoke all sessions for this user
        if (storedToken) {
            await prisma.refreshToken.updateMany({
                where: { userId: storedToken.userId },
                data: { revoked: true }
            });
        }
        throw new AppError('Invalid session, please login in again', 401);
    }

    // Rotate: revoke old token, issue a new one
    const newAccessToken = genAccessToken(decoded.id);
    const newRefreshToken = genRefreshToken(decoded.id);
    const hashedNewToken = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    await prisma.$transaction([
        prisma.refreshToken.update({ where: { id: storedToken.id }, data: { revoked: true } }),
        prisma.refreshToken.create({
            data: { userId: decoded.id, token: hashedNewToken, expiresAt: newExpiresAt }
        })
    ]);

    setAuthCookies(res, newAccessToken, newRefreshToken);

    return res.status(200).json({ status: 'success', message: 'Token refreshed' });
});