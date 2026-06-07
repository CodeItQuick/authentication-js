'use strict'

function requireRole(role) {
  return async function (request, reply) {
    if (request.user?.role !== role) {
      return reply.code(403).send({ message: 'Forbidden' })
    }
  }
}

module.exports = { requireRole }