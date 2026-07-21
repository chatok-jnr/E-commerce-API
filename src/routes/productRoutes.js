import express from "express";
import {protect, requiredRole} from "../middleware/authMiddleware.js";
import {createProduct} from "../controllers/productController.js";
const router = express.Router();


router.post("/", protect, requiredRole("ADMIN"), createProduct);
// router.get("/:id");


export default router;