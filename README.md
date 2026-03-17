# 정율사관학원 강사 만족도 조사

## 프로젝트 개요
- **이름**: 정율사관학원 강사 만족도 조사 시스템
- **목표**: 학생들이 강사의 수업을 평가하고 관리자가 결과를 분석할 수 있는 풀스택 웹앱
- **플랫폼**: Cloudflare Pages + D1 Database

## 주요 기능

### 학생용 설문 페이지 (`/`)
- 학년 선택 (중3, 고1, 고2, 고3)
- 과목별 강사 체크박스 선택 (팀티칭 중복 선택 가능)
- 강사별 14문항 객관식 평가 (1~5점 척도)
  - 장진민 선생님 전용: 인스터디 제외 커스텀 문항
  - 런투런 전용 (지성현 선생님): 3문항 별도 평가
- 주관식 의견 입력 (선택사항)
- 평가 기간 활성/마감 배너 표시

### 관리자 패널 (`/admin`)
- **대시보드**: 전체 응답 수, 활성 강사, 평균 점수, 현재 기간
- **강사 관리**: 강사 추가/수정/삭제, 활성화/비활성화, 학년·과목·질문유형 설정
- **평가 기간 관리**: 기간 추가/수정/삭제, 활성화(1개만 진행 중 가능)
- **결과 분석**: 강사별 카테고리 평균 점수 테이블 (연도/월 필터)
- **주관식 답변**: 선생님별 주관식 답변 모아보기

## API 엔드포인트
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/teacher_master` | 강사 목록 |
| POST | `/api/teacher_master` | 강사 추가 |
| PUT | `/api/teacher_master/:id` | 강사 수정 |
| DELETE | `/api/teacher_master/:id` | 강사 삭제 |
| GET | `/api/survey_settings` | 평가 기간 목록 |
| POST | `/api/survey_settings` | 기간 추가 |
| PUT | `/api/survey_settings/:id` | 기간 수정 |
| GET | `/api/survey_responses` | 응답 조회 |
| POST | `/api/survey_responses` | 응답 저장 |
| GET | `/api/survey_responses/stats` | 통계 조회 |

## 데이터 구조
- **teacher_master**: 강사 마스터 (id, name, subject, grade, question_type, is_active)
- **survey_settings**: 평가 기간 (id, year, month, label, is_active)
- **survey_responses**: 설문 응답 (id, year, month, grade, teacher, subject, q1~q14, r1~r3, average, comment1, comment2)

## 배포 방법

### Cloudflare Pages 배포
```bash
# 1. Cloudflare D1 데이터베이스 생성
npx wrangler d1 create jeongyul-survey-production
# → 출력된 database_id를 wrangler.jsonc에 입력

# 2. 프로덕션 DB 마이그레이션
npm run db:migrate:prod

# 3. 시드 데이터 투입 (최초 1회)
npx wrangler d1 execute jeongyul-survey-production --file=./seed.sql

# 4. 빌드 & 배포
npm run deploy
```

### 로컬 개발
```bash
npm run db:migrate:local   # 로컬 DB 마이그레이션
npm run db:seed            # 시드 데이터
npm run build              # 빌드
pm2 start ecosystem.config.cjs  # 서버 시작
```

## 기술 스택
- **Backend**: Hono v4 (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Vanilla JS + Tailwind (CDN)
- **Deploy**: Cloudflare Pages
- **Dev**: Wrangler + PM2

## 배포된 URL
- **설문 페이지**: https://jy-survey.pages.dev/
- **관리자 패널**: https://jy-survey.pages.dev/admin
- **GitHub**: https://github.com/myhungli2-tech/jy-survey

## 업데이트 방법
코드 수정 후 아래 명령어로 재배포:
```bash
npm run build
npx wrangler pages deploy dist --project-name jy-survey
```

또는 GitHub push 후 Cloudflare 대시보드에서 자동배포 설정 가능
