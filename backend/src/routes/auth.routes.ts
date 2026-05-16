import { Router } from 'express';
import { changePassword, login, me } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/login', asyncHandler(login));
router.get('/me', authMiddleware, asyncHandler(me));
router.put('/password', authMiddleware, asyncHandler(changePassword));

export default router;
