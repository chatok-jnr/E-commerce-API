import express from "express";
import { protect, requiredRole } from "../middleware/authMiddleware.js";
import {checkout, getOrder, getOrders, cancelOrder, updateOrderStatus} from "../controllers/orderController.js";
const router = express.Router();

router.post("/checkout", protect, checkout);
router.get("/", protect, getOrders);
router.get("/:id", protect, getOrder);
router.patch("/:id/cancel", protect, cancelOrder);
router.patch("/:id/status", protect,requiredRole("ADMIN"), updateOrderStatus);

export default router;