'use strict'

const bcrypt = require('bcrypt')
const { createUser, findByEmail } = require('../db/users')
const { issueAccessToken, issueRefreshToken, rotateRefreshToken, revokeToken } = require('../lib/token')
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
}

module.exports = authRoutes