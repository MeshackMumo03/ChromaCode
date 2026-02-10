const Code = require('../models/Code');
const { PRESET_CODES } = require('../constants/presetCodes');

// @desc    Get all codes for a user
// @route   GET /api/codes
// @access  Private
const getCodes = async (req, res) => {
  // 1. Get user-specific codes from DB
  const userCodes = await Code.find({ user: req.user.id });

  // 2. Create a set of names of codes the user has already customized
  const userCodeNames = new Set(userCodes.map(c => c.name));
  
  // 3. Filter preset codes to only include those the user hasn't customized
  const uniquePresetCodes = PRESET_CODES.filter(pc => !userCodeNames.has(pc.name));

  // 4. Combine the lists
  const allCodes = [...userCodes, ...uniquePresetCodes];

  res.json(allCodes);
};

// @desc    Create a new code
// @route   POST /api/codes
// @access  Private
const createCode = async (req, res) => {
  const { name, color, meaning } = req.body;

  if (!name || !color || !meaning) {
    res.status(400);
    throw new Error('Please provide all fields');
  }

  const code = await Code.create({
    user: req.user.id,
    name,
    color,
    meaning,
  });

  res.status(201).json(code);
};

// @desc    Update a code
// @route   PUT /api/codes/:id
// @access  Private
const updateCode = async (req, res) => {
  const code = await Code.findById(req.params.id);

  if (!code) {
    res.status(404);
    throw new Error('Code not found');
  }

  // Make sure the logged in user matches the code user
  if (code.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error('User not authorized');
  }

  const updatedCode = await Code.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  res.json(updatedCode);
};

// @desc    Delete a code
// @route   DELETE /api/codes/:id
// @access  Private
const deleteCode = async (req, res) => {
  const code = await Code.findById(req.params.id);

  if (!code) {
    res.status(404);
    throw new Error('Code not found');
  }

  // Make sure the logged in user matches the code user
  if (code.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error('User not authorized');
  }

  await code.deleteOne();

  res.json({ id: req.params.id });
};

module.exports = {
  getCodes,
  createCode,
  updateCode,
  deleteCode,
};
