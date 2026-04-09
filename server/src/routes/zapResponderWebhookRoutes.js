const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const webhookController = require("../controllers/zapResponderWebhookController");

const router = express.Router();

router.get("/:departmentId", asyncHandler(webhookController.pingWebhook));
router.post("/:departmentId", asyncHandler(webhookController.receiveWebhook));

module.exports = router;
