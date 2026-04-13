const express = require("express");
const multer = require("multer");
const path = require("node:path");
const asyncHandler = require("../utils/asyncHandler");
const inboxController = require("../controllers/inboxController");
const { requireRoles } = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "../../uploads"),
  filename(req, file, callback) {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    callback(null, safeName);
  },
});

const ALLOWED_INBOX_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_INBOX_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".pdf", ".xlsx", ".docx"]);

const inboxUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ALLOWED_INBOX_MIME_TYPES.has(file.mimetype) || ALLOWED_INBOX_EXTENSIONS.has(ext)) {
      callback(null, true);
      return;
    }
    const error = new Error("Envie um arquivo PNG, JPG, PDF, XLSX ou DOCX.");
    error.status = 400;
    callback(error);
  },
});

const router = express.Router();

router.get("/conversations", asyncHandler(inboxController.listConversations));
router.get("/conversations/:id", asyncHandler(inboxController.getConversation));
router.post(
  "/conversations/:id/messages",
  inboxUpload.single("file"),
  asyncHandler(inboxController.sendMessage)
);
router.post(
  "/conversations/:id/whatsapp-reply",
  asyncHandler(inboxController.startWhatsAppReply)
);
router.get("/channels", asyncHandler(inboxController.listChannels));
router.post(
  "/webhooks/register",
  requireRoles("admin", "manager"),
  asyncHandler(inboxController.registerWebhooks)
);

module.exports = router;
