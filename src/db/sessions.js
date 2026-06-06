'use strict'

const { randomUUID } = require('crypto')
const { PrismaClient } = require('@prisma/client')

let prisma

function client() {
  if (!prisma) prisma = new PrismaClient()
  return prisma
}

async function createSession(userId) {
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await client().session.create({ data: { token, userId, expiresAt } })
  return token
}

async function findSession(token) {
  const session = await client().session.findUnique({ where: { token } })
  return session ? session.userId : null
}

async function deleteSession(token) {
  await client().session.delete({ where: { token } }).catch(() => {})
}

module.exports = { createSession, findSession, deleteSession }