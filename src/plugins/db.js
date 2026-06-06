'use strict'

const fp = require('fastify-plugin')
const { PrismaClient } = require('@prisma/client')

module.exports = fp(async function dbPlugin(fastify) {
  const prisma = new PrismaClient()
  await prisma.$connect()
  fastify.decorate('db', prisma)
  fastify.addHook('onClose', () => prisma.$disconnect())
})