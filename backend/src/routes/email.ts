import { Router } from 'express';
import { EmailController } from '../controllers/email';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.post('/schedule', authMiddleware as any, upload.single('file'), EmailController.scheduleEmails as any);
router.get('/scheduled', authMiddleware as any, EmailController.getScheduledEmails as any);
router.get('/sent', authMiddleware as any, EmailController.getSentEmails as any);
router.get('/search', authMiddleware as any, EmailController.searchEmails as any);
router.get('/stats', authMiddleware as any, EmailController.getStats as any);

export default router;
