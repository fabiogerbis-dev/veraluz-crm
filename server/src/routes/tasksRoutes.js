const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const tasksController = require("../controllers/tasksController");

const router = express.Router();

router.get("/", asyncHandler(tasksController.listTasks));

module.exports = router;
