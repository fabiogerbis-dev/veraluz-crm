const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const settingsController = require("../controllers/settingsController");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", asyncHandler(settingsController.getSettings));
router.put("/", requireRoles("admin", "manager"), asyncHandler(settingsController.updateSettings));

module.exports = router;
