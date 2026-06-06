'use strict'

const { findSession } = require('../store/sessions')
const { findById } = require('../db/users')

async function authenticate(request, reply) {
  const auth = request.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return reply.code(401).send({ message: 'Unauthorized' })
  }
  const token = auth.slice(7)
  const userId = findSession(token)
  if (!userId) {
    return reply.code(401).send({ message: 'Unauthorized' })
  }
  const user = await findById(userId)
  if (!user) {
    return reply.code(401).send({ message: 'Unauthorized' })
  }
  request.user = { id: user.id, email: user.email }
  request.sessionToken = token
}

module.exports = { authenticate }