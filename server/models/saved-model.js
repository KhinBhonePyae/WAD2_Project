const mongoose = require('mongoose');

const savedPlaceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  placeId: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { versionKey: false });

savedPlaceSchema.index(
  { userId: 1, placeId: 1 },
  { unique: true }
);

const SavedPlace = mongoose.model(
  'SavedPlace',
  savedPlaceSchema,
  'savedplaces'
);

let mem = [];

exports.getSavedByUser = async (userId) => {
  if (global.MOCK_MODE) {
    return mem.filter(
      item => item.userId === String(userId)
    );
  }

  return SavedPlace.find({ userId }).sort({
    createdAt: -1
  });
};

exports.findSaved = async (userId, placeId) => {
  if (global.MOCK_MODE) {
    return mem.find(
      item =>
        item.userId === String(userId) &&
        item.placeId === Number(placeId)
    ) || null;
  }

  return SavedPlace.findOne({
    userId,
    placeId
  });
};

exports.addSaved = async (userId, placeId) => {
  if (global.MOCK_MODE) {
    const saved = {
      _id: 's' + (mem.length + 1),
      userId: String(userId),
      placeId: Number(placeId),
      createdAt: new Date()
    };

    mem.push(saved);
    return saved;
  }

  return SavedPlace.create({
    userId,
    placeId
  });
};

exports.removeSaved = async (userId, placeId) => {
  if (global.MOCK_MODE) {
    const index = mem.findIndex(
      item =>
        item.userId === String(userId) &&
        item.placeId === Number(placeId)
    );

    if (index === -1) {
      return null;
    }

    return mem.splice(index, 1)[0];
  }

  return SavedPlace.findOneAndDelete({
    userId,
    placeId
  });
};

exports.deleteAllForUser = async (userId) => {
  if (global.MOCK_MODE) {
    mem = mem.filter(
      item => item.userId !== String(userId)
    );
    return;
  }

  return SavedPlace.deleteMany({ userId });
};

exports.deleteAllForPlace = async (placeId) => {
  if (global.MOCK_MODE) {
    mem = mem.filter(item => item.placeId !== Number(placeId));
    return;
  }

  return SavedPlace.deleteMany({ placeId: Number(placeId) });
};

exports.SavedPlace = SavedPlace;