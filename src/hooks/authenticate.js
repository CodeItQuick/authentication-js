'use strict'

const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')

let prisma
function client() {
  if (!prisma) prisma = new PrismaClient()
  return prisma
}

function hashKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

async function authenticate(request, reply) {
  const authHeader = request.headers.authorization ?? ''

  if (authHeader.startsWith('ApiKey ')) {
    const raw = authHeader.slice(7)
    const keyHash = hashKey(raw)
    const apiKey = await client().apiKey.findUnique({ where: { keyHash } })
    if (!apiKey || apiKey.revokedAt != null) {
      return reply.code(401).send({ message: 'Unauthorized' })
    }
    const user = await client().user.findUnique({ where: { id: apiKey.userId } })
    if (!user) return reply.code(401).send({ message: 'Unauthorized' })
    request.user = { id: user.id, email: user.email, role: user.role }
    return
  }

  try {
    await request.jwtVerify()
  } catch {
    return reply.code(401).send({ message: 'Unauthorized' })
  }
  request.user = { id: request.user.sub, email: request.user.email, role: request.user.role }
}

module.exports = { authenticate, hashKey }