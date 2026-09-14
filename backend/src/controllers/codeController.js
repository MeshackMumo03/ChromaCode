const Code = require('../models/Code');
const { PRESET_CODES } = require('../constants/presetCodes');

// @desc    Get all codes for a user
// @route   GET /api/codes
// @access  Private
const getCodes = async (req, res) => {
  try {
    // 1. Get codes owned by this user OR shared with this user
    const userCodes = await Code.find({
      $or: [
        { user: req.user._id },
        { sharedWith: req.user._id }
      ]
    });

    // 2. Create a set of names of codes the user already has (prevents preset duplicates)
    const userCodeNames = new Set(userCodes.map(c => c.name));
    
    // 3. Filter preset codes to only include those the user doesn't already have a custom/propagated version of
    const uniquePresetCodes = PRESET_CODES.filter(pc => !userCodeNames.has(pc.name));

    // 4. Combine the lists
    // We add a virtual _id or mock _id for preset codes that aren't in DB yet
    const formattedPresets = uniquePresetCodes.map((pc, index) => ({
      ...pc,
      _id: `preset-${index}`
    }));

    const allCodes = [...userCodes, ...formattedPresets];
    console.log(`Returning ${allCodes.length} codes for user ${req.user.id} (${userCodes.length} custom/propagated)`);

    res.json(allCodes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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
  const body = req.body;
  const allowedFields = ['name', 'color', 'meaning'];
  if (typeof req.params.id !== 'string' || !/^[a-fA-F0-9]{24}$/.test(req.params.id)
    || !body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length === 0
    || Object.keys(body).some((key) => !allowedFields.includes(key))
    || Object.values(body).some((value) => typeof value !== 'string' || !value.trim() || value.length > 2000)) {
    return res.status(400).json({ message: 'Provide a valid code ID and editable text fields only' });
  }
  const updates = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.color !== undefined) updates.color = body.color.trim();
  if (body.meaning !== undefined) updates.meaning = body.meaning.trim();
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

  const updatedCode = await Code.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $set: updates },
    { new: true, runValidators: true },
  );
  if (!updatedCode) return res.status(404).json({ message: 'Code not found' });

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
