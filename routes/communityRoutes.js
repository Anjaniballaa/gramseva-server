const express = require('express');
const router = express.Router();
const CommunityPost = require('../models/CommunityPost');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const AUTHORITY_ROLES = ['gramsevak', 'doctor', 'healthworker'];

// @route GET /api/community/feed
router.get('/feed', protect, async (req, res) => {
  try {
    const { village } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    const currentUser = await User.findById(userId);

    // Use village from query (live location) first, then DB village
    const targetVillage = village || currentUser?.village;

    console.log(`Feed request: role=${userRole}, village=${targetVillage}`);

    if (!targetVillage || targetVillage === 'Unknown') {
      return res.json({ success: true, count: 0, data: [] });
    }

    let query = {
      village: { $regex: new RegExp(`^${targetVillage}$`, 'i') }
    };

    // Farmer + Villager: public posts + own posts
    if (!AUTHORITY_ROLES.includes(userRole)) {
      query.$or = [
        { visibility: 'public' },
        { userId: userId }
      ];
    }
    // GramSevak + Doctor: all posts in that village

    const posts = await CommunityPost.find(query)
      .populate('userId', 'name role')
      .sort({ createdAt: -1 })
      .limit(100);

    console.log(`Found ${posts.length} posts in ${targetVillage} for ${userRole}`);

    res.json({ success: true, count: posts.length, data: posts });

  } catch (error) {
    console.log('Feed error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route POST /api/community/post
router.post('/post', protect, async (req, res) => {
  try {
    const { content, category, village, imageUrl, visibility } = req.body;

    // Get user village from DB as fallback
    const currentUser = await User.findById(req.user.id);
    const postVillage = village || currentUser?.village;

    console.log('Creating post in village:', postVillage);
    console.log('Visibility:', visibility || 'public');
    console.log('Category:', category || 'general');

    const post = await CommunityPost.create({
      userId: req.user.id,
      content,
      category: category || 'general',
      village: postVillage,
      imageUrl: imageUrl || '',
      visibility: visibility || 'public'
    });

    const populated = await CommunityPost.findById(post._id)
      .populate('userId', 'name role');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.log('Post error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route POST /api/community/post/:id/like
router.post('/post/:id/like', protect, async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const alreadyLiked = post.likes.map(id => id.toString()).includes(req.user.id);

    if (alreadyLiked) {
      post.likes = post.likes.filter(id => id.toString() !== req.user.id);
    } else {
      post.likes.push(req.user.id);
    }

    await post.save();

    res.json({ success: true, likes: post.likes.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route POST /api/community/post/:id/comment
router.post('/post/:id/comment', protect, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ message: 'Comment text required' });
    }

    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const commenter = await User.findById(req.user.id);

    post.comments.push({
      userId: req.user.id,
      userName: commenter.name,
      userRole: commenter.role,
      text,
      createdAt: new Date()
    });

    await post.save();

    const updated = await CommunityPost.findById(req.params.id)
      .populate('userId', 'name role');

    res.json({ success: true, message: 'Comment added', data: updated });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;