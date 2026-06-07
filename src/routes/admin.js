'use strict'

const { authenticate } = require('../hooks/authenticate')
const { requireRole } = require('../hooks/requireRole')

async function adminRoutes(fastify) {
  fastify.get('/admin/users', { preHandler: [authenticate, requireRole('admin')] }, async () => {
    const users = await fastify.db.user.findMany({
      select: { id: true, email: true, role: true, emailVerifiedAt: true, createdAt: true },
    })
    return { users }
  })
}

module.exports = adminRoutes