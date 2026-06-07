'use strict'

const TTL_SECONDS = 15 * 60

function issueAccessToken(fastify, user) {
  return fastify.jwt.sign(
    { sub: user.id, email: user.email, role: user.role ?? 'user' },
    { expiresIn: TTL_SECONDS }
  )
}

module.exports = { issueAccessToken }