'use strict'

const { randomUUID } = require('crypto')

const byEmail = new Map()
const byId = new Map()

function createUser(email, passwordHash) {
  if (byEmail.has(email)) return null
  const user = { id: randomUUID(), email, passwordHash }
  byEmail.set(email, user)
  byId.set(user.id, user)
  return user
}

function findByEmail(email) {
  return byEmail.get(email) ?? null
}

function findById(id) {
  return byId.get(id) ?? null
}

module.exports = { createUser, findByEmail, findById }