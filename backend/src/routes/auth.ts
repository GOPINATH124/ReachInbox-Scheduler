import { Router } from 'express';
import { AuthController } from '../controllers/auth';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/google', AuthController.redirectToGoogle);
router.get('/google/callback', AuthController.handleGoogleCallback);
router.get('/dev-login', AuthController.devLogin);
router.get('/me', authMiddleware as any, AuthController.getMe as any);
router.post('/logout', AuthController.logout);


export default router;
