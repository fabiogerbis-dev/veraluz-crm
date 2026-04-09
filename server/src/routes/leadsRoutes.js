const express = require("express");
const multer = require("multer");
const path = require("node:path");
const asyncHandler = require("../utils/asyncHandler");
const leadsController = require("../controllers/leadsController");

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "../../uploads"),
  filename(req, file, callback) {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    callback(null, safeName);
  },
});

const ALLOWED_DOCUMENT_MIME_TYPES = new Set(["image/png", "image/jpeg", "application/pdf"]);
const ALLOWED_DOCUMENT_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".pdf"]);

const upload = multer({
  storage,
  fileFilter(req, file, callback) {
    const fileExtension = path.extname(file.originalname || "").toLowerCase();
    const isAcceptedMimeType = ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype);
    const isAcceptedExtension = ALLOWED_DOCUMENT_EXTENSIONS.has(fileExtension);

    if (isAcceptedMimeType || isAcceptedExtension) {
      callback(null, true);
      return;
    }

    const error = new Error("Envie um arquivo PNG, JPG ou PDF.");
    error.status = 400;
    callback(error);
  },
});
const router = express.Router();

router.get("/", asyncHandler(leadsController.listLeads));
router.get("/:id", asyncHandler(leadsController.getLead));
router.post("/", asyncHandler(leadsController.createLead));
router.put("/:id", asyncHandler(leadsController.updateLead));
router.delete("/:id", asyncHandler(leadsController.deleteLead));
router.patch("/:id/stage", asyncHandler(leadsController.moveLeadStage));
router.post("/:id/interactions", asyncHandler(leadsController.addInteraction));
router.post("/:id/tasks", asyncHandler(leadsController.addTask));
router.patch("/:id/tasks/:taskId/complete", asyncHandler(leadsController.completeTask));
router.post("/:id/documents", upload.single("file"), asyncHandler(leadsController.addDocument));

module.exports = router;
