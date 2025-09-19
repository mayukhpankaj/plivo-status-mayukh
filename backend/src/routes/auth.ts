import { Router } from 'express';
import { authenticateUser, requireAuth } from '../middleware/auth';

const router = Router();

// Get current user profile
router.get('/profile', authenticateUser, requireAuth, (req, res) => {
  try {
    const user = req.user;
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get user profile' 
    });
  }
});

// Verify token endpoint
router.post('/verify', authenticateUser, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Token is valid',
    user: req.user 
  });
});

export default router;
