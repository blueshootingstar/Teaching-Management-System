import { Router } from 'express';
import * as mailbox from '../controllers/mailbox.controller';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authMiddleware);

router.get('/unread-count', asyncHandler(mailbox.unreadCount));
router.get('/', asyncHandler(mailbox.listMailbox));
router.put('/:recipientId/read', asyncHandler(mailbox.markRead));

export default router;
