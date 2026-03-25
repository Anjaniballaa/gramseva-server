const mongoose = require('mongoose');

const familyCardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  memberName: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Female' },
  bloodGroup: { type: String, default: 'Unknown' },
  conditions: [{ type: String }],
  medications: [{ type: String }],
  vaccinations: [{
    name: String,
    date: String,
    done: Boolean
  }],
  emergencyContact: { type: String, default: '' },
  emergencyName: { type: String, default: '' },
  notes: { type: String, default: '' },
  sharedWith: {
    type: String,
    enum: ['private', 'healthworker', 'village'],
    default: 'private'
  }
}, { timestamps: true });

module.exports = mongoose.model('FamilyCard', familyCardSchema);