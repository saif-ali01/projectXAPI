const express = require("express");
const router = express.Router();
const { getReports } = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", getReports);

module.exports = router;