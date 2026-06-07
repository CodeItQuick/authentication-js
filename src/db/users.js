'use strict'

const { PrismaClient } = require('@prisma/client')

let prisma

function client() {
  if (!prisma) prisma = new PrismaClient()
  return prisma
}

async function createUser(email, passwordHash) {
  try {
    return await client().user.create({ data: { email, passwordHash } })
  } catch (err) {
    if (err.code === 'P2002') return null
    throw err
  }
}

async function findByEmail(email) {
  return client().user.findUnique({ where: { email } })
}

async function findById(id) {
  return client().user.findUnique({ where: { id } })
}

async function updatePassword(id, passwordHash) {
  return client().user.update({ where: { id }, data: { passwordHash } })
}

async function verifyEmail(id) {
  return client().user.update({ where: { id }, data: { emailVerifiedAt: new Date() } })
}

module.exports = { createUser, findByEmail, findById, updatePassword, verifyEmail }