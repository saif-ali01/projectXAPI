const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const clientController = require('../controllers/clientController');

const router = express.Router();

// Validation middleware
const validateClient = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().withMessage('Invalid email format'),
  body('phone').isMobilePhone('any').withMessage('Invalid phone number'),
];

const validateId = [
  param('id').isMongoId().withMessage('Invalid client ID'),
];

const validateQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim().isString().withMessage('Search must be a string'),
];

// Handle validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }
  next();
};

// Routes
router.post('/', authMiddleware, validateClient, validate, clientController.createClient);
router.get('/', authMiddleware, validateQuery, validate, clientController.getClients);
router.put('/:id', authMiddleware, validateId, validateClient, validate, clientController.updateClient);
router.delete('/:id', authMiddleware, validateId, validate, clientController.deleteClient);

module.exports = router;