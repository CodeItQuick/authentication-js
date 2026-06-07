'use strict'

const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')

const ACCESS_TTL_SECONDS = 15 * 60
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000
const RESET_TTL_SECONDS = 60 * 60
const VERIFY_TTL_SECONDS = 24 * 60 * 60

let prisma
function client() {
  if (!prisma) prisma = new PrismaClient()
  return prisma
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function issueAccessToken(fastify, user) {
  return fastify.jwt.sign(
    { sub: user.id, email: user.email, role: user.role ?? 'user' },
    { expiresIn: ACCESS_TTL_SECONDS }
  )
}

async function issueRefreshToken(userId) {
  const raw = crypto.randomUUID()
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)
  await client().refreshToken.create({ data: { tokenHash, userId, expiresAt } })
  return raw
}

async function rotateRefreshToken(fastify, raw) {
  const tokenHash = hashToken(raw)
  const existing = await client().refreshToken.findUnique({ where: { tokenHash } })
  if (!existing || existing.revokedAt != null || existing.expiresAt <= new Date()) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 })
  }

  await client().refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  })

  const { findById } = require('../db/users')
  const user = await findById(existing.userId)
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 401 })

  const accessToken = issueAccessToken(fastify, user)
  const refreshToken = await issueRefreshToken(existing.userId)
  return { accessToken, refreshToken }
}

async function revokeToken(raw) {
  const tokenHash = hashToken(raw)
  await client().refreshToken.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  })
}

async function revokeAllForUser(userId) {
  await client().refreshToken.updateMany({
    where: { userId },
    data: { revokedAt: new Date() },
  })
}

function issuePasswordResetToken(fastify, userId) {
  return fastify.jwt.sign(
    { sub: userId, purpose: 'password-reset' },
    { expiresIn: RESET_TTL_SECONDS }
  )
}

function issueEmailVerifyToken(fastify, userId) {
  return fastify.jwt.sign(
    { sub: userId, purpose: 'email-verify' },
    { expiresIn: VERIFY_TTL_SECONDS }
  )
}

module.exports = {
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeToken,
  revokeAllForUser,
  issuePasswordResetToken,
  issueEmailVerifyToken,
}