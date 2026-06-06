'use strict'

const buildApp = require('./app')

const app = buildApp({ logger: true })

app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
})