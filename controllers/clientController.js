const Client = require('../models/Client');
const asyncHandler = require('express-async-handler');
const createError = require('http-errors');

// @desc    Create a new client
// @route   POST /api/clients
// @access  Private
const createClient = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;

  const client = await Client.create({
    name,
    email,
    phone,
  });

  res.status(201).json({
    success: true,
    data: {
      _id: client._id,
      name: client.name,
      email: client.email,
      phone: client.phone,
    },
  });
});

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
const getClients = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  const query = {
    $or: [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ],
  };

  const clients = await Client.find(query)
    .select('name email phone')
    .skip((pageNumber - 1) * limitNumber)
    .limit(limitNumber)
    .lean();

  const total = await Client.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      clients: clients.map((client) => ({
        id: client._id,
        name: client.name,
        email: client.email,
        phone: client.phone,
      })),
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
    },
  });
});

// @desc    Update a client
// @route   PUT /api/clients/:id
// @access  Private
const updateClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;

  const client = await Client.findOne({ _id: id});

  if (!client) {
    throw createError(404, 'Client not found');
  }

  client.name = name || client.name;
  client.email = email || client.email;
  client.phone = phone || client.phone;

  await client.save();

  res.status(200).json({
    success: true,
    data: {
      id: client._id,
      name: client.name,
      email: client.email,
      phone: client.phone,
    },
  });
});

// @desc    Delete a client
// @route   DELETE /api/clients/:id
// @access  Private
const deleteClient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await Client.findOneAndDelete({
    _id: id,
  });

  if (!client) {
    throw createError(404, 'Client not found');
  }

  res.status(200).json({
    success: true,
    message: 'Client deleted successfully',
  });
});

module.exports = {
  createClient,
  getClients,
  updateClient,
  deleteClient,
};