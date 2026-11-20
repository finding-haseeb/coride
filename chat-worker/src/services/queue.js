import { queueClient } from '../config/redis.js';
import { prisma } from '../config/db.js';
import { commandOptions } from 'redis';

import crypto from 'crypto';

export async function pollQueue() {
  const streamKey = 'chat_stream';
  const groupName = 'chat_workers';
  // process.pid is 1 for all Docker containers. We must use a UUID so each worker is unique
  // otherwise they share the same PEL and process the same messages multiple times.
  const consumerName = `worker_${crypto.randomUUID()}`;

  console.log(`Started Redis Stream consumer ${consumerName} for chat_stream...`);

  // Try to create the consumer group, ignore if it already exists
  try {
    await queueClient.xGroupCreate(streamKey, groupName, '0', { MKSTREAM: true });
  } catch (err) {
    if (!err.message.includes('BUSYGROUP')) {
      console.error("Failed to create consumer group:", err);
    }
  }

  while (true) {
    try {
      // 1. Read Pending Entries (PEL) first to recover stuck messages
      let response = await queueClient.xReadGroup(
        commandOptions({ isolated: true }),
        groupName,
        consumerName,
        [
          { key: streamKey, id: '0' }
        ],
        {
          COUNT: 5000
        }
      );

      // 2. If no pending messages, block and wait for new messages
      if (!response || response.length === 0 || response[0].messages.length === 0) {
        response = await queueClient.xReadGroup(
          commandOptions({ isolated: true }),
          groupName,
          consumerName,
          [
            { key: streamKey, id: '>' }
          ],
          {
            COUNT: 5000,
            BLOCK: 2000
          }
        );
      }

      if (response && response.length > 0) {
        const entries = [];
        for (const stream of response) {
          for (const message of stream.messages) {
            let data = null;
            try {
              data = JSON.parse(message.message.payload);
            } catch {
              console.error('Skipping unreadable stream entry', message.id);
            }
            entries.push({ id: message.id, data });
          }
        }
        // Process in chunks so a huge backlog does not exhaust memory or CPU.
        const chunkSize = 1000;
        for (let i = 0; i < entries.length; i += chunkSize) {
          await processEntries(entries.slice(i, i + chunkSize));
          await queueClient.xAck(streamKey, groupName, entries.slice(i, i + chunkSize).map((e) => e.id));
        }
        if (entries.length > 0) console.log(`Processed ${entries.length} chat stream entries.`);
      }
    } catch (err) {
      console.error("Error processing stream:", err);
      if (err.message && err.message.includes('NOGROUP')) {
        console.log("Consumer group missing (NOGROUP). Attempting to recreate...");
        try {
          await queueClient.xGroupCreate(streamKey, groupName, '0', { MKSTREAM: true });
        } catch (e) {
          console.error("Failed to recreate consumer group in loop:", e);
        }
      }
      // Basic backoff on error
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Stream entries come in three kinds:
 *  - direct (default): a 1:1 chat message
 *  - group: a message in a ride group
 *  - read: the reader has seen every message the other person sent up to `timestamp`
 */
export async function processEntries(entries) {
  const direct = [];
  const group = [];
  const reads = [];
  for (const { data } of entries) {
    if (!data) continue;
    const createdAt = data.timestamp ? new Date(data.timestamp) : undefined;
    const clientTimestamp = data.clientTimestamp ? BigInt(data.clientTimestamp) : null;
    if (data.type === 'read') reads.push(data);
    else if (data.type === 'group') {
      group.push({ groupId: data.groupId, senderId: data.senderId, message: data.message, clientTimestamp, createdAt });
    } else {
      direct.push({ senderId: data.senderId, receiverId: data.receiverId, message: data.message, clientTimestamp, createdAt });
    }
  }

  if (direct.length) await prisma.chatMessage.createMany({ data: direct, skipDuplicates: true });
  if (group.length) {
    // A group may be deleted while its messages wait in the stream; drop those.
    const ids = [...new Set(group.map((g) => g.groupId))];
    const existing = new Set(
      (await prisma.rideGroup.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((g) => g.id),
    );
    const valid = group.filter((g) => existing.has(g.groupId));
    if (valid.length) await prisma.groupMessage.createMany({ data: valid, skipDuplicates: true });
  }
  for (const r of reads) {
    await prisma.chatMessage.updateMany({
      where: { senderId: r.otherUserId, receiverId: r.readerId, readAt: null, createdAt: { lte: new Date(r.timestamp) } },
      data: { readAt: new Date(r.timestamp) },
    });
  }
}
