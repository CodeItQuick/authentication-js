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
    body: JSON.stringify({ email: 'register@test.com', password: 'password1' }),
  })
  assert.equal(res.statusCode, 201)
  const body = res.json()
  assert.ok(body.id)
  assert.equal(body.email, 'register@test.com')
  await app.close()
})

test('POST /auth/register missing fields → 400 with errors array', async () => {
  const app = buildApp()
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'nopass@test.com' }),
  })
  assert.equal(res.statusCode, 400)
  assert.ok(Array.isArray(res.json().errors))
  await app.close()
})

test('POST /auth/register invalid email → 400 with errors array', async () => {
  const app = buildApp()
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: 'longpassword' }),
  })
  assert.equal(res.statusCode, 400)
  assert.ok(Array.isArray(res.json().errors))
  await app.close()
})

test('POST /auth/register short password → 400 with errors array', async () => {
  const app = buildApp()
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'short@test.com', password: 'tiny' }),
  })
  assert.equal(res.statusCode, 400)
  assert.ok(Array.isArray(res.json().errors))
  await app.close()
})

test('POST /auth/register duplicate email → 409', async () => {
  const app = buildApp()
  const payload = JSON.stringify({ email: 'dup@test.com', password: 'password1' })
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
    body: JSON.stringify({ email: 'login@test.com', password: 'secret12' }),
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'login@test.com', password: 'secret12' }),
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
    body: JSON.stringify({ email: 'badpass@test.com', password: 'correct1' }),
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
    body: JSON.stringify({ email: 'me@test.com', password: 'password1' }),
  })
  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'me@test.com', password: 'password1' }),
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
    body: JSON.stringify({ email: 'refresh@test.com', password: 'password1' }),
  })
  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'refresh@test.com', password: 'password1' }),
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
    body: JSON.stringify({ email: 'refresh2@test.com', password: 'password1' }),
  })
  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'refresh2@test.com', password: 'password1' }),
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
    body: JSON.stringify({ email: 'logout@test.com', password: 'password1' }),
  })
  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'logout@test.com', password: 'password1' }),
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

test('POST /auth/change-password → 200, old refresh tokens revoked', async () => {
  const app = buildApp()
  const headers = { 'content-type': 'application/json' }
  await app.inject({
    method: 'POST', url: '/auth/register', headers,
    body: JSON.stringify({ email: 'changepwd@test.com', password: 'oldpass1' }),
  })
  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'changepwd@test.com', password: 'oldpass1' }),
  })
  const { accessToken, refreshToken } = loginRes.json()

  const changeRes = await app.inject({
    method: 'POST', url: '/auth/change-password',
    headers: { ...headers, authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ currentPassword: 'oldpass1', newPassword: 'newpass' }),
  })
  assert.equal(changeRes.statusCode, 200)

  const refreshRes = await app.inject({
    method: 'POST', url: '/auth/refresh', headers,
    body: JSON.stringify({ refreshToken }),
  })
  assert.equal(refreshRes.statusCode, 401)
  await app.close()
})

test('POST /auth/change-password wrong current password → 401', async () => {
  const app = buildApp()
  const headers = { 'content-type': 'application/json' }
  await app.inject({
    method: 'POST', url: '/auth/register', headers,
    body: JSON.stringify({ email: 'changepwd2@test.com', password: 'correct1' }),
  })
  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'changepwd2@test.com', password: 'correct1' }),
  })
  const { accessToken } = loginRes.json()

  const res = await app.inject({
    method: 'POST', url: '/auth/change-password',
    headers: { ...headers, authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'newpass' }),
  })
  assert.equal(res.statusCode, 401)
  await app.close()
})

test('POST /auth/forgot-password → 200 with resetToken', async () => {
  const app = buildApp()
  const headers = { 'content-type': 'application/json' }
  await app.inject({
    method: 'POST', url: '/auth/register', headers,
    body: JSON.stringify({ email: 'forgot@test.com', password: 'password1' }),
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/forgot-password', headers,
    body: JSON.stringify({ email: 'forgot@test.com' }),
  })
  assert.equal(res.statusCode, 200)
  assert.ok(res.json().resetToken)
  await app.close()
})

test('POST /auth/forgot-password unknown email → 200 with null token', async () => {
  const app = buildApp()
  const res = await app.inject({
    method: 'POST', url: '/auth/forgot-password',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@test.com' }),
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().resetToken, null)
  await app.close()
})

test('POST /auth/reset-password → 200, old refresh tokens revoked', async () => {
  const app = buildApp()
  const headers = { 'content-type': 'application/json' }
  await app.inject({
    method: 'POST', url: '/auth/register', headers,
    body: JSON.stringify({ email: 'reset@test.com', password: 'oldpass1' }),
  })
  const loginRes = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'reset@test.com', password: 'oldpass1' }),
  })
  const { refreshToken } = loginRes.json()

  const forgotRes = await app.inject({
    method: 'POST', url: '/auth/forgot-password', headers,
    body: JSON.stringify({ email: 'reset@test.com' }),
  })
  const { resetToken } = forgotRes.json()

  const resetRes = await app.inject({
    method: 'POST', url: '/auth/reset-password', headers,
    body: JSON.stringify({ token: resetToken, newPassword: 'newpass' }),
  })
  assert.equal(resetRes.statusCode, 200)

  const refreshRes = await app.inject({
    method: 'POST', url: '/auth/refresh', headers,
    body: JSON.stringify({ refreshToken }),
  })
  assert.equal(refreshRes.statusCode, 401)

  const loginRes2 = await app.inject({
    method: 'POST', url: '/auth/login', headers,
    body: JSON.stringify({ email: 'reset@test.com', password: 'newpass' }),
  })
  assert.equal(loginRes2.statusCode, 200)
  await app.close()
})

test('POST /auth/reset-password invalid token → 401', async () => {
  const app = buildApp()
  const res = await app.inject({
    method: 'POST', url: '/auth/reset-password',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'not-a-valid-token', newPassword: 'newpass' }),
  })
  assert.equal(res.statusCode, 401)
  await app.close()
})

test('POST /auth/login rate limit → 429 after 5 attempts', async () => {
  const app = buildApp()
  const headers = { 'content-type': 'application/json' }
  const body = JSON.stringify({ email: 'ratelimit@test.com', password: 'wrongpass' })
  let res
  for (let i = 0; i < 6; i++) {
    res = await app.inject({ method: 'POST', url: '/auth/login', headers, body })
  }
  assert.equal(res.statusCode, 429)
  await app.close()
})