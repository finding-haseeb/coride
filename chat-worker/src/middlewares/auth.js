import jwt from 'jsonwebtoken';
import { INTERNAL_API_KEY, JWT_SECRET } from '../config/env.js';

export function internalAuthMiddleware(req, res, next) {
  const secret = req.header('x-internal-secret');
  if (secret !== INTERNAL_API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Service Secret' });
  }
  next();
}

/** Verifies the user's JWT (same secret as the backend) and sets req.userId. */
export function userAuthMiddleware(req, res, next) {
  const token = req.header('authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Access token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = String(decoded.userId || decoded.id);
    next();
  } catch {
    return res.status(403).json({ success: false, error: 'Invalid token' });
  }
}

/** Only the two people in a conversation may read or clear it. */
export function participantOnly(req, res, next) {
  const { senderId, receiverId } = req.params;
  if (req.userId !== senderId && req.userId !== receiverId) {
    return res.status(403).json({ success: false, error: 'You can only access your own chats' });
  }
  next();
}
