import express from "express";
import {protect, requiredRole} from "../middleware/authMiddleware.js";

const router = express.Router();satisfies

router.get("/", );
router.get("/:id");


export default router;