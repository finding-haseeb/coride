import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { pubClient, subClient } from '../redis.js';
import {
  handleGetOnlineUsers,
  handleSendMessage,
  handleTyping,
  handleMarkRead,
  handleLocationUpdate,
  handleLocationStop,
  handleJoinGroup,
  handleLeaveGroup,
  handleSendGroupMessage,
  handleDisconnect
} from './handlers.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. The gateway must use the same secret as the backend.');
}

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:8000,http://localhost:5173,https://alaska-69fq.vercel.app')
  .split(',')
  .map((o) => o.trim());

export const setupSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
    adapter: createAdapter(pubClient, subClient)
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error: No token provided'));
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error: Invalid token'));
      socket.userId = String(decoded.userId || decoded.id);
      socket.token = token;
      next();
    });
  });

  io.on('connection', async (socket) => {
    console.log(`User ${socket.userId} connected to Gateway on socket ${socket.id}`);
    
    // Auto join room based on authenticated userId
    socket.join(socket.userId);
    console.log(`User ${socket.userId} joined their room`);
    
    try {
      await pubClient.sAdd('online_users', socket.userId);
      io.emit('user_status', { userId: socket.userId, status: 'online' });
    } catch (err) {
      console.error("Error setting online status:", err);
    }
    socket.on('get_online_users', handleGetOnlineUsers(pubClient));
    socket.on('send_message', handleSendMessage(io, socket));
    socket.on('typing', handleTyping(io, socket));
    socket.on('mark_read', handleMarkRead(io, socket));
    socket.on('location_update', handleLocationUpdate(io, socket));
    socket.on('location_stop', handleLocationStop(io, socket));
    socket.on('join_group', handleJoinGroup(socket));
    socket.on('leave_group', handleLeaveGroup(socket));
    socket.on('send_group_message', handleSendGroupMessage(io, socket));
    socket.on('disconnect', handleDisconnect(io, socket));
  });

  return io;
};
