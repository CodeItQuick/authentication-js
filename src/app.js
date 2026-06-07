'use strict'

const fastify = require('fastify')

function buildApp(opts = {}) {
  const app = fastify(opts)

  app.register(require('./plugins/env'))
  app.register(require('./plugins/db'))
  app.register(require('./plugins/jwt'))
  app.register(require('./plugins/errorHandler'))

  // Allow POST/PUT routes that intentionally send no body (e.g. logout)
  app.addContentTypeParser('*', (_request, payload, done) => done(null, null))

  app.register(require('./routes/health'))
  app.register(require('./routes/auth'))
  app.register(require('./routes/me'))
  app.register(require('./routes/admin'))

  return app
}

module.exports = buildApp