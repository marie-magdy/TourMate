import express from 'express';
import {
  upgradeUserToPro,
  getUserFeatures,
  PRO_PRICE_EGP,
} from '../services/userFeatures.js';

const router = express.Router();

// GET /api/subscription/plan
router.get('/plan', (_req, res) => {
  res.json({
    success: true,
    data: {
      id: 'tourmate_pro',
      name: 'TourMate Pro',
      price_egp: PRO_PRICE_EGP,
      currency: 'EGP',
      benefits: [
        'Unlimited AI chat',
        'Voice chat mode',
        'Landmark photo recognition (CV)',
        'Smart glasses / AR mode',
        'Unlimited plan coach edits',
      ],
    },
  });
});

// POST /api/subscription/upgrade — simulated payment
router.post('/upgrade', async (req, res) => {
  try {
    const { user_id: userId, card_number: cardNumber, expiry, cvv } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'user_id is required' });
    }

    const result = await upgradeUserToPro(Number(userId), { cardNumber, expiry, cvv });
    if (!result.success) {
      return res.status(result.status ?? 400).json({
        success: false,
        message: result.message,
      });
    }

    res.json({
      success: true,
      message: result.message,
      data: { features: result.features },
    });
  } catch (err) {
    console.error('Subscription upgrade error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/subscription/status/:userId
router.get('/status/:userId', async (req, res) => {
  try {
    const features = await getUserFeatures(Number(req.params.userId));
    if (!features) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: features });
  } catch (err) {
    console.error('Subscription status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
