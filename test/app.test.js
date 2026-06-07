'use strict'

require('dotenv').config({ path: '.env.test', override: true })

const { test, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')
const { PrismaClient } = require('@prisma/client')
const buildApp = require('../src/app')

const prisma = new PrismaClient()

beforeEach(async () => {
  await prisma.refreshToken.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('GET /health → 200 ok', async () => {
  const app = buildApp()
  const res = await app.inject({ method: 'GET', url: '/health' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { status: 'ok' })
  await app.close()
})

test('POST /auth/register → 201 with user', async () => {
  const app = buildApp()
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'register@test.com', password: 'pass' }),
  })
  assert.equal(res.statusCode, 201)
  const body = res.json()
  assert.ok(body.id)
  assert.equal(body.email, 'register@test.com')
  await app.close()
})

test('POST /auth/register missing fields → 400', async () => {
  const app = buildApp()
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'nopass@test.com' }),
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('POST /auth/register duplicate email → 409', async () => {
  const app = buildApp()
  const payload = JSON.stringify({ email: 'dup@test.com', password: 'pass' })
  const headers = { 'content-type': 'application/json' }
  await app.inject({ method: 'POST', url: '/auth/register', headers, body: payload })
  const res = await app.inject({ method: 'POST', url: '/auth/register', headers, body: payload })
  assert.equal(res.statusCode, 409)
  await app.close()
})

test('POST /auth/login → 200 with accessToken and refreshToken', async () => {
  const app = buildApp()
  const headers = { 'content-type': 'application/json' }
  await app.inject({
    method: 'POST', url: '/auth/register', headers,
    body: JSON.stringify({ email: 'login@test.com', password: 'secret' }),
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'login@test.com', password: 'secret' }),
  })
  assert.equal(res.statusCode, 200)
  assert.ok(res.json().accessToken)
  assert.ok(res.json().refreshToken)
  await app.close()
})

test('POST /auth/login wrong password → 401', async () => {
  const app = buildApp()
  const headers = { 'content-type': 'application/json' }
  await app.inject({
    method: 'POST', url: '/auth/register', headers,
    body: JSON.stringify({ email: 'badpass@test.com', password: 'correct' }),
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'badpass@test.com', password: 'wrong' }),
  })
  assert.equal(res.statusCode, 401)
  await app.close()
})

test('GET /me without token → 401', async () => {
  const app = buildApp()
  const res = await app.inject({ method: 'GET', url: '/me' })
  assert.equal(res.statusCode, 401)
  await app.close()
})

test('GET /me with valid token → 200 with user', async () => {
  const app = buildApp()
  const headers = { 'content-type': 'application/json' }
  await app.inject({
    method: 'POST', url: '/auth/register', headers,
    body: JSON.stringify({ email: 'me@test.com', password: 'pass' }),
  })
  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'me@test.com', password: 'pass' }),
  })
  const { accessToken } = loginRes.json()
  const res = await app.inject({
    method: 'GET', url: '/me',
    headers: { authorization: `Bearer ${accessToken}` },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().user.email, 'me@test.com')
  await app.close()
})

test('POST /auth/refresh → 200 with new tokens', async () => {
  const app = buildApp()
  const headers = { 'content-type': 'application/json' }
  await app.inject({
    method: 'POST', url: '/auth/register', headers,
    body: JSON.stringify({ email: 'refresh@test.com', password: 'pass' }),
  })
  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'refresh@test.com', password: 'pass' }),
  })
  const { refreshToken } = loginRes.json()
  const res = await app.inject({
    method: 'POST', url: '/auth/refresh', headers,
    body: JSON.stringify({ refreshToken }),
  })
  assert.equal(res.statusCode, 200)
  assert.ok(res.json().accessToken)
  assert.ok(res.json().refreshToken)
  assert.notEqual(res.json().refreshToken, refreshToken)
  await app.close()
})

test('POST /auth/refresh with used token → 401', async () => {
  const app = buildApp()
  const headers = { 'content-type': 'application/json' }
  await app.inject({
    method: 'POST', url: '/auth/register', headers,
    body: JSON.stringify({ email: 'refresh2@test.com', password: 'pass' }),
  })
  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'refresh2@test.com', password: 'pass' }),
  })
  const { refreshToken } = loginRes.json()
  await app.inject({
    method: 'POST', url: '/auth/refresh', headers,
    body: JSON.stringify({ refreshToken }),
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/refresh', headers,
    body: JSON.stringify({ refreshToken }),
  })
  assert.equal(res.statusCode, 401)
  await app.close()
})

test('POST /auth/logout → 204, refresh token revoked', async () => {
  const app = buildApp()
  const headers = { 'content-type': 'application/json' }
  await app.inject({
    method: 'POST', url: '/auth/register', headers,
    body: JSON.stringify({ email: 'logout@test.com', password: 'pass' }),
  })
  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'logout@test.com', password: 'pass' }),
  })
  const { accessToken, refreshToken } = loginRes.json()

  const logoutRes = await app.inject({
    method: 'POST', url: '/auth/logout',
    headers: { ...headers, authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ refreshToken }),
  })
  assert.equal(logoutRes.statusCode, 204)

  const refreshRes = await app.inject({
    method: 'POST', url: '/auth/refresh', headers,
    body: JSON.stringify({ refreshToken }),
  })
  assert.equal(refreshRes.statusCode, 401)
  await app.close()
})