'use strict'

const fp = require('fastify-plugin')

module.exports = fp(function errorHandlerPlugin(fastify, _opts, done) {
  fastify.setErrorHandler((err, _request, reply) => {
    if (err.validation) {
      const errors = err.validation.map((v) => ({
        field: v.instancePath.replace(/^\//, '') || v.params?.missingProperty || 'unknown',
        message: v.message,
      }))
      return reply.code(400).send({ errors })
    }
    reply.code(err.statusCode ?? 500).send({ message: err.message })
  })
  done()
})