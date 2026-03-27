import { Response } from "express";

// Keep track of connected clients by their user ID
const clients = new Map<string, Set<Response>>();

export function addClient(userId: string, res: Response) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(res);
}

export function removeClient(userId: string, res: Response) {
  const userClients = clients.get(userId);
  if (userClients) {
    userClients.delete(res);
    if (userClients.size === 0) {
      clients.delete(userId);
    }
  }
}

/**
 * Broadcast an event to a specific user
 */
export function broadcastToUser(userId: string, event: string, data: any) {
  const userClients = clients.get(userId);
  if (userClients) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of userClients) {
      // res.write can fail if connection is unexpectedly dropped, though Express usually handles it
      try {
        res.write(payload);
      } catch (e) {
        console.error(`[SSE] Error writing to client for user ${userId}`, e);
      }
    }
  }
}

/**
 * Broadcast an event to all connected users
 */
export function broadcastToAll(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [userId, userClients] of clients.entries()) {
    for (const res of userClients) {
      try {
        res.write(payload);
      } catch (e) {
        console.error(`[SSE] Error writing to client for user ${userId}`, e);
      }
    }
  }
}
