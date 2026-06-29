import { Router } from 'express';
import { predictPasses } from '../passPrediction';

const router = Router();

router.post('/pass-prediction', async (req, res) => {
  const { latitude, longitude } = req.body as { latitude: unknown; longitude: unknown };

  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    res.status(400).json({ error: '`latitude` must be a number between -90 and 90' });
    return;
  }
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    res.status(400).json({ error: '`longitude` must be a number between -180 and 180' });
    return;
  }

  try {
    const passes = await predictPasses(latitude, longitude);
    res.json({
      observer: { latitude, longitude },
      generatedAt: new Date().toISOString(),
      hoursSearched: 48,
      visibilityThresholds: {
        minElevationDeg: 10,
        civilTwilightDeg: -6,
      },
      passes,
    });
  } catch (err) {
    console.error('[POST /api/pass-prediction]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
