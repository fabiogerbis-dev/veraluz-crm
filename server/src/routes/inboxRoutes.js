const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const inboxController = require("../controllers/inboxController");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/conversations", asyncHandler(inboxController.listConversations));
router.get("/conversations/:id", asyncHandler(inboxController.getConversation));
router.post("/conversations/:id/messages", asyncHandler(inboxController.sendMessage));
router.get("/channels", asyncHandler(inboxController.listChannels));
router.post(
  "/webhooks/register",
  requireRoles("admin", "manager"),
  asyncHandler(inboxController.registerWebhooks)
);

module.exports = router;
