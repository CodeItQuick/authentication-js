'use strict'

const fastify = require('fastify')

function buildApp(opts = {}) {
  const app = fastify(opts)

  app.register(require('./plugins/env'))

  // Allow POST/PUT routes that intentionally send no body (e.g. logout)
  app.addContentTypeParser('*', (_request, payload, done) => done(null, null))

  app.register(require('./routes/health'))
  app.register(require('./routes/auth'))
  app.register(require('./routes/me'))

  return app
}

module.exports = buildApp