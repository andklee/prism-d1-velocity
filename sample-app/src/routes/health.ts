import { Router, Request, Response } from 'express';

const router = Router();

/** Server start time for uptime calculation */
const startTime = Date.now();

/**
 * @route GET /health
 * @returns {object} Health status with uptime and timestamp
 *
 * Health check endpoint that returns service status without database calls.
 * Spec: specs/health-check.md
 */
router.get('/health', (_req: Request, res: Response) => {
  const now = Date.now();
  const uptimeSeconds = Math.floor((now - startTime) / 1000);
  const timestamp = new Date(now).toISOString();

  res.status(200).json({
    status: 'ok',
    uptime: uptimeSeconds,
    timestamp,
  });
});

export default router;
