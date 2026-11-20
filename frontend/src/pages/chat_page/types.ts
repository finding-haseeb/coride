export type User = {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "offline" | "away";
  lastSeen?: string;
  verified?: boolean;
};

export type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  status: "sent" | "delivered" | "read";
  type: "text" | "image" | "file";
  clientTimestamp?: string;
  /** Set by the gateway when a delivered message looks like a scam. */
  flag?: string | null;
};

export type Chat = {
  id: string;
  user: User;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  isTyping?: boolean;
  isGroup?: boolean;
};

export type GroupMember = {
  userId: string;
  user: { id: string; name: string; username: string; profile_image?: string | null };
};

export type Group = {
  id: string;
  name: string;
  createdById: string;
  createdAt: string;
  members: GroupMember[];
  lastMessage: { message: string; createdAt: string; senderId: string } | null;
};

export type LiveLocation = {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: string;
};
