import { FastifyRequest, FastifyReply } from 'fastify';

export interface UserContext {
  id: string;
  role: 'kid' | 'viewer_servant' | 'admin_servant';
  groupId?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserContext;
  }
}

/**
 * Temporary Identity Middleware while Auth Review is in progress.
 * Simulates user identity from headers:
 * - X-User-Id: UUID
 * - X-User-Role: 'kid' | 'viewer_servant' | 'admin_servant' (default: 'kid')
 * - X-Group-Id: Integer
 */
export async function identityMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.headers['x-user-id'] as string;
  const userRole = (request.headers['x-user-role'] as 'kid' | 'viewer_servant' | 'admin_servant') || 'kid';
  const rawGroupId = request.headers['x-group-id'] as string;
  const groupId = rawGroupId ? parseInt(rawGroupId, 10) : undefined;

  if (userId) {
    request.user = {
      id: userId,
      role: userRole,
      groupId
    };
  }
}
