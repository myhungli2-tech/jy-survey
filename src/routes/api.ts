import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const api = new Hono<{ Bindings: Bindings }>()

// ─── teacher_master ──────────────────────────────────────────────────────────

// GET /api/teacher_master?limit=500
api.get('/teacher_master', async (c) => {
  const limit = parseInt(c.req.query('limit') || '500')
  const grade = c.req.query('grade')
  const DB = c.env.DB

  let query = 'SELECT * FROM teacher_master'
  const params: (string | number)[] = []
  if (grade !== undefined) {
    query += ' WHERE grade = ?'
    params.push(parseInt(grade))
  }
  query += ' ORDER BY grade, subject, name LIMIT ?'
  params.push(limit)

  const { results } = await DB.prepare(query).bind(...params).all()
  return c.json(results)
})

// GET /api/teacher_master/:id
api.get('/teacher_master/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT * FROM teacher_master WHERE id = ?').bind(id).first()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

// POST /api/teacher_master
api.post('/teacher_master', async (c) => {
  const body = await c.req.json<{
    name: string; subject: string; grade: number
    question_type?: string; is_active?: number
  }>()
  const { name, subject, grade, question_type = 'normal', is_active = 1 } = body
  if (!name || subject === undefined || grade === undefined) {
    return c.json({ error: 'name, subject, grade are required' }, 400)
  }
  const result = await c.env.DB.prepare(
    'INSERT INTO teacher_master (name, subject, grade, question_type, is_active) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, subject, grade, question_type, is_active).run()
  return c.json({ id: result.meta.last_row_id, name, subject, grade, question_type, is_active }, 201)
})

// PUT /api/teacher_master/:id
api.put('/teacher_master/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json<{
    name?: string; subject?: string; grade?: number
    question_type?: string; is_active?: number
  }>()

  const existing = await c.env.DB.prepare('SELECT * FROM teacher_master WHERE id = ?').bind(id).first() as any
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const name = body.name ?? existing.name
  const subject = body.subject ?? existing.subject
  const grade = body.grade ?? existing.grade
  const question_type = body.question_type ?? existing.question_type
  const is_active = body.is_active ?? existing.is_active

  await c.env.DB.prepare(
    'UPDATE teacher_master SET name=?, subject=?, grade=?, question_type=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(name, subject, grade, question_type, is_active, id).run()

  return c.json({ id, name, subject, grade, question_type, is_active })
})

// DELETE /api/teacher_master/:id
api.delete('/teacher_master/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM teacher_master WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ─── survey_settings ─────────────────────────────────────────────────────────

// GET /api/survey_settings
api.get('/survey_settings', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM survey_settings ORDER BY year DESC, month DESC LIMIT 100'
  ).all()
  return c.json(results)
})

// POST /api/survey_settings
api.post('/survey_settings', async (c) => {
  const body = await c.req.json<{ year: number; month: number; label: string; is_active?: number }>()
  const { year, month, label, is_active = 0 } = body
  if (!year || !month || !label) {
    return c.json({ error: 'year, month, label are required' }, 400)
  }

  // 활성화하는 경우 기존 활성 설정 모두 비활성화
  if (is_active === 1) {
    await c.env.DB.prepare('UPDATE survey_settings SET is_active=0, updated_at=CURRENT_TIMESTAMP').run()
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO survey_settings (year, month, label, is_active) VALUES (?, ?, ?, ?)'
  ).bind(year, month, label, is_active).run()

  return c.json({ id: result.meta.last_row_id, year, month, label, is_active }, 201)
})

// PUT /api/survey_settings/:id
api.put('/survey_settings/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json<{ year?: number; month?: number; label?: string; is_active?: number }>()

  const existing = await c.env.DB.prepare('SELECT * FROM survey_settings WHERE id = ?').bind(id).first() as any
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const year = body.year ?? existing.year
  const month = body.month ?? existing.month
  const label = body.label ?? existing.label
  const is_active = body.is_active ?? existing.is_active

  // 활성화하는 경우 기존 활성 설정 모두 비활성화
  if (is_active === 1) {
    await c.env.DB.prepare('UPDATE survey_settings SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id != ?').bind(id).run()
  }

  await c.env.DB.prepare(
    'UPDATE survey_settings SET year=?, month=?, label=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(year, month, label, is_active, id).run()

  return c.json({ id, year, month, label, is_active })
})

// DELETE /api/survey_settings/:id
api.delete('/survey_settings/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM survey_settings WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ─── survey_responses ────────────────────────────────────────────────────────

// GET /api/survey_responses?year=&month=&grade=&teacher=
api.get('/survey_responses', async (c) => {
  const year = c.req.query('year')
  const month = c.req.query('month')
  const grade = c.req.query('grade')
  const teacher = c.req.query('teacher')
  const limit = parseInt(c.req.query('limit') || '1000')

  let query = 'SELECT * FROM survey_responses WHERE 1=1'
  const params: (string | number)[] = []

  if (year) { query += ' AND year=?'; params.push(parseInt(year)) }
  if (month) { query += ' AND month=?'; params.push(parseInt(month)) }
  if (grade) { query += ' AND grade=?'; params.push(parseInt(grade)) }
  if (teacher) { query += ' AND teacher=?'; params.push(teacher) }

  query += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results)
})

// POST /api/survey_responses
api.post('/survey_responses', async (c) => {
  const body = await c.req.json<any>()
  const {
    year, month, grade, teacher, subject,
    q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14,
    r1, r2, r3,
    average, comment1, comment2, timestamp
  } = body

  if (grade === undefined || !teacher || !subject) {
    return c.json({ error: 'grade, teacher, subject are required' }, 400)
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO survey_responses
      (year, month, grade, teacher, subject,
       q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11,q12,q13,q14,
       r1,r2,r3, average, comment1, comment2, timestamp)
    VALUES (?,?,?,?,?, ?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?,?,?, ?,?,?,?)
  `).bind(
    year ?? null, month ?? null, grade, teacher, subject,
    q1 ?? null, q2 ?? null, q3 ?? null, q4 ?? null,
    q5 ?? null, q6 ?? null, q7 ?? null, q8 ?? null,
    q9 ?? null, q10 ?? null, q11 ?? null, q12 ?? null,
    q13 ?? null, q14 ?? null,
    r1 ?? null, r2 ?? null, r3 ?? null,
    average ?? null,
    comment1 ?? '', comment2 ?? '',
    timestamp ?? new Date().toISOString()
  ).run()

  return c.json({ id: result.meta.last_row_id, success: true }, 201)
})

// GET /api/survey_responses/stats — 통계 API
api.get('/survey_responses/stats', async (c) => {
  const year = c.req.query('year')
  const month = c.req.query('month')

  let whereClause = 'WHERE 1=1'
  const params: (string | number)[] = []
  if (year) { whereClause += ' AND year=?'; params.push(parseInt(year)) }
  if (month) { whereClause += ' AND month=?'; params.push(parseInt(month)) }

  const { results } = await c.env.DB.prepare(`
    SELECT
      teacher, subject, grade,
      COUNT(*) as response_count,
      ROUND(AVG(average), 2) as avg_score,
      ROUND(AVG(q1), 2) as avg_q1,
      ROUND(AVG(q2), 2) as avg_q2,
      ROUND(AVG(q3), 2) as avg_q3,
      ROUND(AVG(q4), 2) as avg_q4,
      ROUND(AVG(q5), 2) as avg_q5,
      ROUND(AVG(q6), 2) as avg_q6,
      ROUND(AVG(q7), 2) as avg_q7,
      ROUND(AVG(q8), 2) as avg_q8,
      ROUND(AVG(q9), 2) as avg_q9,
      ROUND(AVG(q10), 2) as avg_q10,
      ROUND(AVG(q11), 2) as avg_q11,
      ROUND(AVG(q12), 2) as avg_q12,
      ROUND(AVG(q13), 2) as avg_q13,
      ROUND(AVG(q14), 2) as avg_q14,
      ROUND(AVG(r1), 2) as avg_r1,
      ROUND(AVG(r2), 2) as avg_r2,
      ROUND(AVG(r3), 2) as avg_r3
    FROM survey_responses
    ${whereClause}
    GROUP BY teacher, subject, grade
    ORDER BY grade, subject, teacher
  `).bind(...params).all()

  return c.json(results)
})

export default api
