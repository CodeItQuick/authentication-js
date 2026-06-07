'use strict'

const bcrypt = require('bcrypt')
const { createUser, findByEmail, findById, updatePassword } = require('../db/users')
const {
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeToken,
  revokeAllForUser,
  issuePasswordResetToken,
} = require('../lib/token')
const { authenticate } = require('../hooks/authenticate')

const BCRYPT_ROUNDS = 12

const DUMMY_HASH = bcrypt.hashSync('dummy', BCRYPT_ROUNDS)

async function authRoutes(fastify) {
  fastify.post('/auth/register', async (request, reply) => {
    const { email, password } = request.body
    if (!email || !password) {
      return reply.code(400).send({ message: 'email and password are required' })
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = await createUser(email, passwordHash)
    if (!user) {
      return reply.code(409).send({ message: 'Email already registered' })
    }
    return reply.code(201).send({ id: user.id, email: user.email })
  })

  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body
    if (!email || !password) {
      return reply.code(400).send({ message: 'email and password are required' })
    }
    const user = await findByEmail(email)
    const hash = user ? user.passwordHash : DUMMY_HASH
    const valid = await bcrypt.compare(password, hash)
    if (!user || !valid) {
      return reply.code(401).send({ message: 'Invalid credentials' })
    }
    const accessToken = issueAccessToken(fastify, user)
    const refreshToken = await issueRefreshToken(user.id)
    return { accessToken, refreshToken }
  })

  fastify.post('/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body ?? {}
    if (!refreshToken) {
      return reply.code(400).send({ message: 'refreshToken is required' })
    }
    try {
      const tokens = await rotateRefreshToken(fastify, refreshToken)
      return tokens
    } catch (err) {
      return reply.code(err.statusCode ?? 500).send({ message: err.message })
    }
  })

  fastify.post('/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    const { refreshToken } = request.body ?? {}
    if (refreshToken) {
      await revokeToken(refreshToken)
    }
    return reply.code(204).send()
  })

  fastify.post('/auth/change-password', { preHandler: authenticate }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body ?? {}
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ message: 'currentPassword and newPassword are required' })
    }
    const user = await findById(request.user.id)
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      return reply.code(401).send({ message: 'Current password is incorrect' })
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await updatePassword(user.id, passwordHash)
    await revokeAllForUser(user.id)
    return { message: 'Password updated' }
  })

  fastify.post('/auth/forgot-password', async (request, reply) => {
    const { email } = request.body ?? {}
    if (!email) {
      return reply.code(400).send({ message: 'email is required' })
    }
    const user = await findByEmail(email)
    const resetToken = user ? issuePasswordResetToken(fastify, user.id) : null
    return { resetToken }
  })

  fastify.post('/auth/reset-password', async (request, reply) => {
    const { token, newPassword } = request.body ?? {}
    if (!token || !newPassword) {
      return reply.code(400).send({ message: 'token and newPassword are required' })
    }
    let payload
    try {
      payload = fastify.jwt.verify(token)
    } catch {
      return reply.code(401).send({ message: 'Invalid or expired reset token' })
    }
    if (payload.purpose !== 'password-reset') {
      return reply.code(401).send({ message: 'Invalid or expired reset token' })
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await updatePassword(payload.sub, passwordHash)
    await revokeAllForUser(payload.sub)
    return { message: 'Password reset' }
  })
}

module.exports = authRoutes