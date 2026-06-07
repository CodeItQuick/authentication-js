'use strict'

const crypto = require('crypto')
const { authenticate, hashKey } = require('../hooks/authenticate')

async function apiKeyRoutes(fastify) {
  fastify.post('/api-keys', { preHandler: authenticate }, async (request, reply) => {
    const { name } = request.body ?? {}
    if (!name) {
      return reply.code(400).send({ message: 'name is required' })
    }
    const raw = crypto.randomUUID()
    const keyHash = hashKey(raw)
    const apiKey = await fastify.db.apiKey.create({
      data: { keyHash, userId: request.user.id, name },
    })
    return reply.code(201).send({ id: apiKey.id, name: apiKey.name, key: raw })
  })

  fastify.delete('/api-keys/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params
    const apiKey = await fastify.db.apiKey.findUnique({ where: { id } })
    if (!apiKey || apiKey.userId !== request.user.id) {
      return reply.code(404).send({ message: 'API key not found' })
    }
    await fastify.db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
    return reply.code(204).send()
  })
}

module.exports = apiKeyRoutes