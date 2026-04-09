const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const dashboardController = require("../controllers/dashboardController");

const router = express.Router();

router.get("/summary", asyncHandler(dashboardController.getSummary));

module.exports = router;
