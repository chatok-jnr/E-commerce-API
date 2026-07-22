import multer, { diskStorage } from "multer";
import path from "path";
import fs from "fs";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

const createUploader = ({ folder, prefix }) => {
    const uploadDir = `uploads/${folder}`;

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = `${prefix(req)}-${Date.now()}${path.extname(file.originalname)}`;
            cb(null, uniqueSuffix);
        }
    });

    const fileFilter = (req, file, cb) => {
        if (ALLOWED_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            // Multer forwards this as `err` to the next error-handling middleware (handleMulterError)
            cb(new Error("Only JPEG, PNG, and WEBP images are allowed"), false);
        }
    };

    return multer({
        storage,
        fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 }
    });
};

export const uploadProfileImage = createUploader({
    folder: "profile-images",
    prefix: (req) => req.user.id
}).single("profileImage");

export const uploadProductImages = createUploader({
    folder: "product-images",
    prefix: (req) => req.params.productId || "product"
}).array("images", 5); // Up to 5 images per request