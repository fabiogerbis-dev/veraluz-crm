const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/login", asyncHandler(authController.login));
router.get("/me", authenticate, asyncHandler(authController.me));

module.exports = router;
