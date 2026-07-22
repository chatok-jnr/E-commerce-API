import express from "express";
import {protect, requiredRole} from "../middleware/authMiddleware.js";
import {createProduct, getProducts, getProduct, updateProduct, deleteProduct, uploadImageForProduct} from "../controllers/productController.js";
import { uploadProductImages } from "../middleware/uploadMiddleware.js";
import { handleMulterError } from "../middleware/multerErrorHandler.js";
const router = express.Router();

router.post("/", protect, requiredRole("ADMIN"), createProduct);
router.get("/:id", getProduct);
router.get("/", getProducts);
router.patch("/:id", protect, requiredRole("ADMIN"), updateProduct);
router.delete("/:id", protect, requiredRole("ADMIN"), deleteProduct);
router.post("/:productId/images", protect, requiredRole("ADMIN"), uploadProductImages, handleMulterError, uploadImageForProduct);

export default router;