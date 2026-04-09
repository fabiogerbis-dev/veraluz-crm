const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const integrationsController = require("../controllers/integrationsController");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();

router.get(
	"/",
	requireRoles("admin", "manager"),
	asyncHandler(integrationsController.listIntegrations)
);
router.get(
	"/form-submissions",
	requireRoles("admin", "manager"),
	asyncHandler(integrationsController.listFormSubmissions)
);
router.post(
	"/form-submissions/:id/import",
	requireRoles("admin", "manager"),
	asyncHandler(integrationsController.importSubmission)
);

module.exports = router;
