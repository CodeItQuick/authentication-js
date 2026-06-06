'use strict'

const { authenticate } = require('../hooks/authenticate')

async function meRoutes(fastify) {
  fastify.get('/me', { preHandler: authenticate }, async (request) => {
    return { user: request.user }
  })
}

module.exports = meRoutes