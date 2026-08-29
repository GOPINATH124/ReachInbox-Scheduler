import { Router } from 'express';
import { SlackController } from '../controllers/slack';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/connect', authMiddleware as any, SlackController.connectSlack as any);
router.post('/connect-manual', authMiddleware as any, SlackController.connectSlackManual as any);
router.get('/callback', SlackController.handleSlackCallback);
router.delete('/disconnect', authMiddleware as any, SlackController.disconnectSlack as any);


export default router;
