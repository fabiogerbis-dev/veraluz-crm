const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const publicFormsController = require("../controllers/publicFormsController");

const router = express.Router();

router.post("/veraluz", asyncHandler(publicFormsController.receiveVeraluzLead));

module.exports = router;
