/**
 * 정율사관학원 강사 만족도 조사
 * Hono 기반 REST API — 원본 functions/api/[[path]].js 완전 이식
 * INTEGER AUTOINCREMENT ID 지원 (기존 DB 호환)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
}

const api = new Hono<{ Bindings: Bindings }>()

api.use('*', cors())

const ALLOWED_TABLES = [
  'survey_responses',
  'survey_settings',
  'teacher_master',
  'teacher_roster'
]

function errorResponse(c: any, message: string, status: number = 400) {
  return c.json({ error: message }, status)
}

// ── GET 목록 ─────────────────────────────────────────────
api.get('/:table', async (c) => {
  const tableName = c.req.param('table')
  if (!ALLOWED_TABLES.includes(tableName)) {
    return errorResponse(c, `Table '${tableName}' not allowed`, 403)
  }
  if (!c.env.DB) return errorResponse(c, 'DB not bound', 500)

  const params = c.req.query()
  const page   = Math.max(1, parseInt(params.page   || '1'))
  const limit  = Math.min(500, parseInt(params.limit || '100'))
  const search = params.search || ''
  const sort   = params.sort   || 'created_at'
  const offset = (page - 1) * limit

  let colsResult: any
  try {
    colsResult = await c.env.DB.prepare(`PRAGMA table_info(${tableName})`).all()
  } catch {
    return errorResponse(c, `Table ${tableName} not found`, 404)
  }
  const cols = ((colsResult.results || []) as any[]).map((col: any) => col.name)

  const hasDeleted = cols.includes('deleted')
  let whereClause = hasDeleted ? 'WHERE (deleted IS NULL OR deleted != 1)' : 'WHERE 1=1'
  const bindValues: any[] = []

  if (search && cols.length > 0) {
    const searchableCols = cols.filter((col: string) => col !== 'id' && col !== 'deleted')
    const likeClauses = searchableCols.map((col: string) => `${col} LIKE ?`).join(' OR ')
    if (likeClauses) {
      whereClause += ` AND (${likeClauses})`
      searchableCols.forEach(() => bindValues.push(`%${search}%`))
    }
  }

  const safeSort = cols.includes(sort) ? sort : (cols.includes('created_at') ? 'created_at' : 'id')

  const countSql = `SELECT COUNT(*) as cnt FROM ${tableName} ${whereClause}`
  const countResult = await c.env.DB.prepare(countSql).bind(...bindValues).first() as any
  const total = countResult ? countResult.cnt : 0

  const dataSql = `SELECT * FROM ${tableName} ${whereClause} ORDER BY ${safeSort} DESC LIMIT ? OFFSET ?`
  const dataResult = await c.env.DB.prepare(dataSql).bind(...bindValues, limit, offset).all()

  return c.json({
    data:  dataResult.results || [],
    total,
    page,
    limit,
    table: tableName
  })
})

// ── GET 단건 ─────────────────────────────────────────────
api.get('/:table/:id', async (c) => {
  const tableName = c.req.param('table')
  const id = c.req.param('id')
  if (!ALLOWED_TABLES.includes(tableName)) {
    return errorResponse(c, `Table '${tableName}' not allowed`, 403)
  }
  if (!c.env.DB) return errorResponse(c, 'DB not bound', 500)

  const row = await c.env.DB.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).bind(id).first()
  if (!row) return errorResponse(c, 'Record not found', 404)
  return c.json(row)
})

// ── POST 생성 ────────────────────────────────────────────
api.post('/:table', async (c) => {
  const tableName = c.req.param('table')
  if (!ALLOWED_TABLES.includes(tableName)) {
    return errorResponse(c, `Table '${tableName}' not allowed`, 403)
  }
  if (!c.env.DB) return errorResponse(c, 'DB not bound', 500)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return errorResponse(c, 'Invalid JSON body')
  }

  const now = Date.now()
  // ID 없이 데이터 준비 (AUTOINCREMENT 사용)
  const data: any = { ...body, created_at: now, updated_at: now, deleted: 0 }
  // id 필드 제거 (AUTOINCREMENT로 자동 생성)
  delete data.id

  const colsResult = await c.env.DB.prepare(`PRAGMA table_info(${tableName})`).all()
  const cols = ((colsResult.results || []) as any[]).map((col: any) => col.name)

  const filtered: any = {}
  for (const key of Object.keys(data)) {
    if (cols.includes(key)) filtered[key] = data[key]
  }

  // 없는 컬럼 ALTER TABLE로 추가
  for (const key of Object.keys(data)) {
    if (!cols.includes(key)) {
      const colType = typeof data[key] === 'number' ? 'REAL' : 'TEXT'
      try {
        await c.env.DB.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${key} ${colType}`).run()
        filtered[key] = data[key]
        cols.push(key)
      } catch (e) {
        // already exists
      }
    }
  }

  const keys = Object.keys(filtered)
  if (keys.length === 0) return errorResponse(c, 'No valid fields to insert')

  const placeholders = keys.map(() => '?').join(', ')
  const values = keys.map((k: string) => {
    const v = filtered[k]
    return typeof v === 'boolean' ? (v ? 1 : 0) : v
  })

  const result = await c.env.DB.prepare(
    `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`
  ).bind(...values).run()

  const newId = result.meta.last_row_id
  const created = await c.env.DB.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).bind(newId).first()
  return c.json(created || { ...filtered, id: newId }, 201)
})

// ── PUT 전체 수정 ─────────────────────────────────────────
api.put('/:table/:id', async (c) => {
  const tableName = c.req.param('table')
  const id = c.req.param('id')
  if (!ALLOWED_TABLES.includes(tableName)) {
    return errorResponse(c, `Table '${tableName}' not allowed`, 403)
  }
  if (!c.env.DB) return errorResponse(c, 'DB not bound', 500)

  const existing = await c.env.DB.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).bind(id).first() as any
  if (!existing) return errorResponse(c, 'Record not found', 404)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return errorResponse(c, 'Invalid JSON body')
  }

  const now = Date.now()
  const updates: any = { ...body, id, created_at: existing.created_at, updated_at: now, deleted: 0 }

  const colsResult = await c.env.DB.prepare(`PRAGMA table_info(${tableName})`).all()
  const cols: string[] = ((colsResult.results || []) as any[]).map((col: any) => col.name)

  // 없는 컬럼 ALTER TABLE
  for (const key of Object.keys(updates)) {
    if (!cols.includes(key)) {
      const colType = typeof updates[key] === 'number' ? 'REAL' : 'TEXT'
      try {
        await c.env.DB.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${key} ${colType}`).run()
        cols.push(key)
      } catch (e) {}
    }
  }

  const setClauses: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(updates)) {
    if (key === 'id') continue
    if (!cols.includes(key)) continue
    setClauses.push(`${key} = ?`)
    values.push(typeof val === 'boolean' ? (val ? 1 : 0) : val)
  }

  if (setClauses.length === 0) return errorResponse(c, 'No fields to update')

  await c.env.DB.prepare(
    `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values, id).run()

  const updated = await c.env.DB.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).bind(id).first()
  return c.json({ data: updated })
})

// ── PATCH 부분 수정 ───────────────────────────────────────
api.patch('/:table/:id', async (c) => {
  const tableName = c.req.param('table')
  const id = c.req.param('id')
  if (!ALLOWED_TABLES.includes(tableName)) {
    return errorResponse(c, `Table '${tableName}' not allowed`, 403)
  }
  if (!c.env.DB) return errorResponse(c, 'DB not bound', 500)

  const existing = await c.env.DB.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).bind(id).first() as any
  if (!existing) return errorResponse(c, 'Record not found', 404)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return errorResponse(c, 'Invalid JSON body')
  }

  const now = Date.now()
  const updates: any = { ...body, updated_at: now }

  const colsResult = await c.env.DB.prepare(`PRAGMA table_info(${tableName})`).all()
  const cols: string[] = ((colsResult.results || []) as any[]).map((col: any) => col.name)

  for (const key of Object.keys(updates)) {
    if (!cols.includes(key)) {
      const colType = typeof updates[key] === 'number' ? 'REAL' : 'TEXT'
      try {
        await c.env.DB.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${key} ${colType}`).run()
        cols.push(key)
      } catch (e) {}
    }
  }

  const setClauses: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(updates)) {
    if (key === 'id') continue
    if (!cols.includes(key)) continue
    setClauses.push(`${key} = ?`)
    values.push(typeof val === 'boolean' ? (val ? 1 : 0) : val)
  }

  if (setClauses.length === 0) return errorResponse(c, 'No fields to update')

  await c.env.DB.prepare(
    `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ?`
  ).bind(...values, id).run()

  const updated = await c.env.DB.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).bind(id).first()
  return c.json({ data: updated })
})

// ── DELETE 소프트 삭제 ────────────────────────────────────
api.delete('/:table/:id', async (c) => {
  const tableName = c.req.param('table')
  const id = c.req.param('id')
  if (!ALLOWED_TABLES.includes(tableName)) {
    return errorResponse(c, `Table '${tableName}' not allowed`, 403)
  }
  if (!c.env.DB) return errorResponse(c, 'DB not bound', 500)

  const existing = await c.env.DB.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).bind(id).first()
  if (!existing) return errorResponse(c, 'Record not found', 404)

  await c.env.DB.prepare(
    `UPDATE ${tableName} SET deleted = 1, updated_at = ? WHERE id = ?`
  ).bind(Date.now(), id).run()

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
})

export default api
