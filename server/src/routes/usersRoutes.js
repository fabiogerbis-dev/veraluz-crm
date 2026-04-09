const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const usersController = require("../controllers/usersController");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireRoles("admin", "manager"), asyncHandler(usersController.listUsers));
router.post("/", requireRoles("admin", "manager"), asyncHandler(usersController.createUser));
router.patch("/:id/toggle-status", requireRoles("admin", "manager"), asyncHandler(usersController.toggleUserStatus));

module.exports = router;
