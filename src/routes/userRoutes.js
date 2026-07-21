import express from "express";
import {getMe, updateMe, uploadMyProfileImage} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadPorudctImages, uploadProfileImage } from "../middleware/uploadMiddleware.js";
import { handleMulterError } from "../middleware/multerErrorHandler.js";
const router = express.Router();

router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.post("/me/profile-image", 
    protect, 
    uploadProfileImage, 
    handleMulterError,
    uploadMyProfileImage);

export default router;