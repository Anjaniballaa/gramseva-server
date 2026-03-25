const mongoose = require('mongoose');

const communityPostSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['crop', 'health', 'scheme', 'general'],
    default: 'general'
  },
  village: {
    type: String,
    required: true
  },
  visibility: {
    type: String,
    enum: ['public', 'gramsevak_only'],
    default: 'public'
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, default: '' },
    userRole: { type: String, default: '' },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('CommunityPost', communityPostSchema);