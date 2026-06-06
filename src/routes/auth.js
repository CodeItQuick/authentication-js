'use strict'

const { createUser, findByEmail } = require('../store/users')
const { createSession, deleteSession } = require('../store/sessions')
const { authenticate } = require('../hooks/authenticate')

async function authRoutes(fastify) {
  fastify.post('/auth/register', async (request, reply) => {
    const { email, password } = request.body
    if (!email || !password) {
      return reply.code(400).send({ message: 'email and password are required' })
    }
    const user = createUser(email, password)
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
    const user = findByEmail(email)
    if (!user || user.password !== password) {
      return reply.code(401).send({ message: 'Invalid credentials' })
    }
    const sessionToken = createSession(user.id)
    return { sessionToken }
  })

  fastify.post('/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    deleteSession(request.sessionToken)
    return reply.code(204).send()
  })
}

module.exports = authRoutes