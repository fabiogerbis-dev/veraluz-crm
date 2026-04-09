const express = require("express");
const realtimeController = require("../controllers/realtimeController");
const { authenticateStream } = require("../middleware/auth");

const router = express.Router();

router.get("/stream", authenticateStream, realtimeController.stream);

module.exports = router;
