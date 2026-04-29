import { Router } from 'express';
import { login, me } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/login', asyncHandler(login));
router.get('/me', authMiddleware, asyncHandler(me));

export default router;
