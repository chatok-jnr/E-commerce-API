import express from "express";
import {optionalAuth} from "../middleware/optionalAuth.js";
import {resolveCartOwner} from "../middleware/resolveCartOwner.js";
import { addToCart, updateCartItem, removeFromCart, getCart, clearCart } from "../controllers/cartController.js";

const router = express.Router();

router.post("/items", optionalAuth, resolveCartOwner, addToCart);        // body: { productId, quantity }
router.patch("/items/:productId", optionalAuth, resolveCartOwner, updateCartItem);  // change quantity
router.delete("/items/:productId", optionalAuth, resolveCartOwner, removeFromCart);
router.get("/", optionalAuth, resolveCartOwner, getCart);                 // "my cart" — no id needed, derived from req.user
router.delete("/",optionalAuth, resolveCartOwner, clearCart);             // empty the whole cart

export default router;