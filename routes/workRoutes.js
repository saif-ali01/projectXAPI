const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const workController = require("../controllers/workController");

// Validation middleware
const validateWork = [
  check("particulars").notEmpty().withMessage("Particulars are required"),
  check("party").notEmpty().withMessage("Party name is required"),
  check("partyId").notEmpty().withMessage("Party ID is required"),
  check("dateAndTime").isISO8601().withMessage("Invalid date format"),
  check("quantity").isFloat({ min: 1 }).withMessage("Quantity must be a positive number"),
  check("rate").isFloat({ min: 0.01 }).withMessage("Rate must be a positive number"),
  check("paid").optional().isBoolean().withMessage("Paid must be a boolean"),
];

router.post("/", validateWork, workController.createWork);
router.get("/", workController.getAllWorks);
router.get("/:id", workController.getWork);
router.patch("/:id", validateWork, workController.updateWork);
router.delete("/:id", workController.deleteWork);

module.exports = router;