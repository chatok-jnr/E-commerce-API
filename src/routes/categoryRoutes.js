import express from "express";
import {protect, requiredRole} from "../middleware/authMiddleware.js";
import { createCategory, deleteCategory, getCategories, getCategory, updateCategory } from "../controllers/categoryController.js";
const router = express.Router();

router.post("/", protect, requiredRole("ADMIN"), createCategory);
router.get("/", getCategories);
router.get("/:name", getCategory);
router.patch("/:name", protect, requiredRole("ADMIN"), updateCategory);
router.delete("/:name", protect, requiredRole("ADMIN"), deleteCategory);

export default router;