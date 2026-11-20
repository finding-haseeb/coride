import { Router } from 'express';
import { createMessage } from '../controllers/messagesController.js';
import { getChatsBetween, deleteChatsBetween, getUnreadCounts } from '../controllers/chatsController.js';
import { internalAuthMiddleware, userAuthMiddleware, participantOnly } from '../middlewares/auth.js';

const router = Router();

router.get('/chats/unread', userAuthMiddleware, getUnreadCounts);
router.get('/chats/between/:senderId/:receiverId', userAuthMiddleware, participantOnly, getChatsBetween);
router.delete('/chats/between/:senderId/:receiverId', userAuthMiddleware, participantOnly, deleteChatsBetween);

// POST /messages (service-to-service only)
router.post('/messages', internalAuthMiddleware, createMessage);

export default router;
