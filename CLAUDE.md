# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

정율사관학원 강사 만족도 조사 — 학생이 강사를 평가하고 관리자가 결과를 분석하는 풀스택 웹앱. **Cloudflare Pages + D1(SQLite)** 위에 **Hono(TypeScript)** 로 서빙. UI 문구는 한국어.

## 자주 쓰는 명령어

```bash
# 개발 서버 (Vite, D1 미연동 — HTML/JS만 빠르게 반복할 때)
npm run dev

# D1 바인딩 포함 개발 서버 (먼저 npm run build 필요)
npm run dev:sandbox          # dist/ 를 :3000 에서 --local D1 로 서빙

# 빌드
npm run build                # vite build → dist/

# DB (로컬, .wrangler/state/v3/d1)
npm run db:migrate:local
npm run db:seed
npm run db:reset             # 로컬 D1 초기화 + 재마이그레이션 + 시드

# DB (운영)
npm run db:migrate:prod
npx wrangler d1 execute jeongyul-survey-production --file=./seed.sql

# 배포
npm run deploy               # build + wrangler pages deploy dist
```

린트/테스트 스크립트는 설정돼 있지 않음. 테스트 프레임워크도 없음.

### 로컬 서버 주의사항

- `ecosystem.config.cjs` 의 `cwd` 가 `/home/user/webapp` 으로 하드코딩돼 있음. pm2 로 돌리려면 그 경로를 수정하거나, 그냥 레포에서 `npm run dev:sandbox` 를 직접 쓸 것.
- `wrangler pages dev` 는 마지막으로 빌드된 `dist/` 만 본다. `src/**` 를 수정하면 반드시 다시 `npm run build` 를 해야 반영됨.

## 아키텍처

### 요청 흐름

1. `src/index.tsx` 가 유일한 Hono 엔트리 (`vite.config.ts` 참조).
   - `GET /` 와 `GET /admin` 은 거대한 인라인 HTML 템플릿 리터럴 (`getSurveyHTML`, `getAdminHTML`) 을 반환.
   - `/api/*` 는 `src/routes/api.ts` 로 위임.
   - `/static/*` 는 `serveStatic` 으로 `public/static/` 에서 서빙.
2. HTML 페이지는 `public/static/js/` 의 바닐라 JS (`main.js`, `admin.js`, `data.js`) 를 로드. UI 로직 전부 여기 있음 — 클라이언트 사이드 프레임워크나 빌드 스텝 없음. 스타일은 `public/static/css/`. HTML 이 `?v=N.NN` 캐시 버스터로 파일을 참조하므로 JS/CSS 를 배포할 때마다 그 숫자를 올려야 함.
3. 브라우저는 모든 작업을 `/api/<table>` 로 호출. 백엔드에는 테이블별 비즈니스 로직이 없음.

### API 는 제네릭 CRUD 셰임 (`src/routes/api.ts`)

API 쪽을 건드리기 전에 반드시 숙지할 것:

- 허용 테이블은 `ALLOWED_TABLES` 에 있는 네 개뿐: `survey_responses`, `survey_settings`, `teacher_master`, `teacher_roster`. 그 외는 403.
- 라우트:
  - `GET /api/:table` — 페이징 목록 (`page`, `limit≤500`, `search`, `sort`). `search` 는 `id`/`deleted` 를 제외한 모든 컬럼에 `LIKE '%...%'`. `sort` 기본값은 `created_at` (없으면 `id`), 항상 `ORDER BY ... DESC`.
  - `GET /api/:table/:id` — 단건 조회.
  - `POST /api/:table` — 삽입. 들어온 `id` 는 버림(AUTOINCREMENT). `created_at`/`updated_at` 을 `Date.now()`(epoch ms) 로, `deleted = 0` 으로 세팅.
  - `PUT /api/:table/:id` — 전체 교체. 기존 `created_at` 은 보존.
  - `PATCH /api/:table/:id` — 부분 수정.
  - `DELETE /api/:table/:id` — **소프트 삭제 전용**: `deleted = 1` 로 설정. 목록 쿼리는 `WHERE deleted IS NULL OR deleted != 1` 로 필터. 하드 삭제 엔드포인트는 없음.
- **스키마가 쓰기 시점에 자동 진화함.** POST/PUT/PATCH 시 테이블에 없는 필드는 `ALTER TABLE ... ADD COLUMN` 을 트리거함. 값이 숫자면 `REAL`, 아니면 `TEXT`. 결과:
  - 운영 DB 스키마가 `migrations/0001_initial_schema.sql` 보다 더 많이 자라 있을 수 있음. 마이그레이션 파일만 믿지 말고, 컬럼이 안 보이면 `PRAGMA table_info(...)` 로 실제 테이블을 확인할 것.
  - `teacher_roster` 는 `ALLOWED_TABLES` 에 있지만 마이그레이션이 없음 — 암묵적으로 생성/확장됨.
  - 컬럼 집합이 고정이라고 가정한 서버사이드 검증을 추가하지 말 것. 클라이언트가 새 필드를 자유롭게 추가하는 게 정상 동작임.
- bool→int 강제 변환: boolean 필드는 자동으로 `1`/`0` 으로 저장됨.

### 데이터 모델 (`migrations/0001_initial_schema.sql` 참조)

- `teacher_master(id, name, subject, grade, question_type, is_active, ...)` — 강사 × 학년 조합당 한 행. `grade`: `0`=중3, `1`=고1, `2`=고2, `3`=고3. `question_type ∈ {normal, jang, runtrun}` 가 학생에게 보여줄 질문 세트를 결정.
- `survey_settings(id, year, month, label, is_active, ...)` — 평가 기간. 컨벤션: 동시에 `is_active=1` 인 행은 하나뿐이어야 함. 활성 기간이 설문 배너의 "진행 중" vs "마감" 표시를 결정.
- `survey_responses(id, year, month, grade, teacher, subject, q1..q14, r1..r3, average, comment1, comment2, timestamp, ...)` — (학생, 강사) 평가당 한 행. 해당 없는 컬럼은 NULL. `average` 는 POST 전에 `main.js` 에서 클라이언트 사이드로 계산됨.

### 질문 세트 (`public/static/js/data.js`)

`getQuestionsForTeacher(teacher, subject, questionType)` 가 다음 셋 중 하나를 반환:
- `normal` — 4개 카테고리 × 객관식 14문항 (`q1`..`q14`) 전부.
- `jang` — 인스터디 관련 문항(`q4`, `q6`) 제외; `q*` id 는 그대로 재사용.
- `runtrun` — `r1`..`r3` 만 (탐구런투런 강좌용).

레거시 데이터를 위한 이름/과목 폴백(`teacher === "장진민"`, `teacher === "지성현"`)이 남아 있지만, 새 코드는 DB 의 `question_type` 을 기준으로 동작시킬 것.

### 중요한 함정 두 가지

1. **`src/routes/admin.ts` 는 죽은 코드**. `getAdminHTML` 을 가진 Hono 라우터를 export 하지만, `src/index.tsx` 는 절대 import 하지 않음 — `index.tsx` 가 자체 `getAdminHTML` 을 인라인으로 정의함. 관리자 HTML 을 수정하려면 `src/index.tsx` 내부(대략 line ~160 / 하단의 `<script src="/static/js/admin.js?v=...">`)에서 수정해야 함. `src/routes/admin.ts` 를 고쳐도 아무 효과 없음에 속지 말 것.
2. **관리자 "인증" 은 인증이 아님**. `public/static/js/admin.js` 가 `ADMIN_ID = ADMIN_PWD = 'jungyoul'` 을 하드코딩해 클라이언트 사이드로만 UI 를 가림. API 자체에는 인증이 전혀 없음 — 누구든 `/api/*` 를 직접 때릴 수 있음. "관리자 패널이 보호된다" 고 가정하지 말 것, 그리고 진짜 인증을 먼저 붙이지 않고는 서버사이드 신원을 전제로 한 기능을 도입하지 말 것.

## 컨벤션

- TypeScript: `strict: true`, JSX 는 `hono/jsx` (타이핑 용도로만 — 실제 페이지는 JSX 가 아니라 HTML 문자열을 반환함).
- Cloudflare 바인딩은 인라인으로 `type Bindings = { DB: D1Database }` 로 타이핑. `wrangler.jsonc` 에서 D1 을 `DB` 로 바인딩.
- `compatibility_flags: ["nodejs_compat"]` 설정돼 있음. 필요하면 `node:` 모듈 사용 가능.
- API 가 쓰는 타임스탬프는 ISO 문자열이 아니라 **epoch ms** (`Date.now()`). `survey_responses` 의 `timestamp` 컬럼은 클라이언트가 직접 채우는 `TEXT` 라 `created_at`/`updated_at` 과는 별개 컨벤션.
- 코드, 주석, UI 전반에 한국어가 정상적으로 섞여 있음. 그대로 유지할 것.
