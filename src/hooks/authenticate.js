'use strict'

async function authenticate(request, reply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.code(401).send({ message: 'Unauthorized' })
  }
  request.user = { id: request.user.sub, email: request.user.email, role: request.user.role }
}

module.exports = { authenticate }