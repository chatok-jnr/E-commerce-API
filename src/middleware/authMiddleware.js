import { prisma } from "../config/db.js";
import jwt from "jsonwebtoken";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";

export const protect = catchAsync(async (req, res, next) => {
    const access_token = req.cookies.access_token;

    if (!access_token) {
        throw new AppError('Please login in order to perform this operation', 401);
    }

    let decode;
    try {
        decode = jwt.verify(access_token, process.env.JWT_ACCESS_SECRET);
    } catch (e) {
        throw new AppError('Invalid or expired access token, please log in', 401);
    }

    const user = await prisma.user.findUnique({
        where: { id: decode.id },
        include: { roles: true }
    });

    if (!user || user.deletedAt) {
        throw new AppError('User no longer exists, please log in', 401);
    }

    const { password, ...safeUser } = user;
    req.user = safeUser;

    next();
});

export const requiredRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Please log in to perform this operation', 401));
        }

        const userRoles = req.user.roles.map(r => r.role);
        const hasPermission = allowedRoles.some(role => userRoles.includes(role));

        if (!hasPermission) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }

        next();
    };
};