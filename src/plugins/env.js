'use strict'

const fp = require('fastify-plugin')
const { config } = require('dotenv')

module.exports = fp(async function envPlugin(fastify) {
  config()
})