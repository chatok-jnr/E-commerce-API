import multer from "multer";
import { AppError } from "../utils/AppError.js";

export const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer's own errors: file too large, too many files, wrong field name, etc.
        let message = "File upload error";

        switch (err.code) {
            case "LIMIT_FILE_SIZE":
                message = "File too large. Maximum size is 5MB";
                break;

            case "LIMIT_FILE_COUNT":
            case "LIMIT_UNEXPECTED_FILE":
                message = "Too many files, or unexpected field name.";
                break;

            default:
                message = err.message;
        }

        return next(new AppError(message, 400));
    }

    if (err) {
        // Any other upload-related error (e.g. thrown from a custom fileFilter)
        return next(new AppError(err.message || "Invalid file upload", 400));
    }

    next();
};