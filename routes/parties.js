const express = require("express");
const router = express.Router();
const Party = require("../models/Party");

// Get all parties
router.get("/", async (req, res) => {
  try {
    const parties = await Party.find().sort({ name: 1 });
    res.json(parties);
  } catch (error) {
    console.error("Error fetching parties:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get a single party by ID
router.get("/:id", async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }
    res.json(party);
  } catch (error) {
    console.error("Error fetching party:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create a new party
router.post("/", async (req, res) => {
  try {
    const { name, contact, address } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: "Party name is required" });
    }

    const party = new Party({
      name: name.trim(),
      contact: contact?.trim() || "",
      address: address?.trim() || "",
      // createdBy is optional; omit if not needed or set to null
    });

    await party.save();
    res.status(201).json(party);
  } catch (error) {
    console.error("Error creating party:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ message: "Validation failed", errors });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Update a party
router.put("/:id", async (req, res) => {
  try {
    const { name, contact, address } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: "Party name is required" });
    }

    const party = await Party.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        contact: contact?.trim() || "",
        address: address?.trim() || "",
      },
      { new: true, runValidators: true }
    );

    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    res.json(party);
  } catch (error) {
    console.error("Error updating party:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ message: "Validation failed", errors });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a party
router.delete("/:id", async (req, res) => {
  try {
    const party = await Party.findByIdAndDelete(req.params.id);
    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }
    res.json({ message: "Party deleted successfully" });
  } catch (error) {
    console.error("Error deleting party:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;