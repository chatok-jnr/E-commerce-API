import {AppError} from "../utils/AppError.js";

export const errorHandler = (err, req, res, next) => {
    console.error(err);

    // Known, intentional errors (thrown via AppError)
    if(err instanceof AppError) {
        return res.status(err.statusCode).json({
            status:'failed',
            message:err.message
        });
    }

    // Prisma-specific error codes, handles generically in one place
    if(err.code === 'P2002') {
        return res.status(409).json({
            status:'failed',
            message:'A record with this value already exists'
        });
    }

    if(err.code === 'P2025') {
        return res.status(404).json({
            status:'failed',
            message:'Record not found'
        });
    }

    // Anything else is an unexpected bug - don't leak details in production
    return res.status(500).json({
        status: 'failed',
        error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
    });
}