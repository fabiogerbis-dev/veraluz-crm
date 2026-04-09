const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const reportsController = require("../controllers/reportsController");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();

router.get(
	"/leads/export",
	requireRoles("admin", "manager"),
	asyncHandler(reportsController.exportLeads)
);

module.exports = router;
