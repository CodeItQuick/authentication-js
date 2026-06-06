'use strict'

const { randomUUID } = require('crypto')

// Map<sessionToken, userId>
const sessions = new Map()

function createSession(userId) {
  const token = randomUUID()
  sessions.set(token, userId)
  return token
}

function findSession(token) {
  return sessions.get(token) ?? null
}

function deleteSession(token) {
  sessions.delete(token)
}

module.exports = { createSession, findSession, deleteSession }