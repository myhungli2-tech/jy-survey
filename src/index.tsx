import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import apiRoutes from './routes/api'
import adminRoutes from './routes/admin'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS
app.use('/api/*', cors())

// Static files
app.use('/static/*', serveStatic({ root: './' }))

// API routes
app.route('/api', apiRoutes)

// Admin routes
app.route('/admin', adminRoutes)

// Main survey page
app.get('/', (c) => {
  return c.html(getSurveyHTML())
})

function getSurveyHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <title>정율사관학원 — 강사 만족도 조사</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <div class="container">
        <!-- 진행 상황 표시 -->
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="progress-text" id="progressText">1 / 4</div>
        </div>

        <!-- 페이지 1: 학년 선택 -->
        <div class="page active" id="page1">
            <div class="page-header">
                <div class="academy-header">
                    <span class="academy-badge">정율사관학원</span>
                    <h1>강사 만족도 조사</h1>
                    <p class="subtitle">선생님의 수업에 대한 소중한 의견을 들려주세요</p>
                </div>
            </div>
            <div id="monthBanner"></div>
            <div class="content-box" id="surveyContentBox">
                <div class="section-label">학년 선택</div>
                <div class="grade-selection">
                    <button class="grade-btn" data-grade="0">
                        <span class="grade-icon">📒</span>
                        <span class="grade-btn-text">중학교 3학년</span>
                        <span class="grade-btn-arrow">›</span>
                    </button>
                    <button class="grade-btn" data-grade="1">
                        <span class="grade-icon">📗</span>
                        <span class="grade-btn-text">고등학교 1학년</span>
                        <span class="grade-btn-arrow">›</span>
                    </button>
                    <button class="grade-btn" data-grade="2">
                        <span class="grade-icon">📘</span>
                        <span class="grade-btn-text">고등학교 2학년</span>
                        <span class="grade-btn-arrow">›</span>
                    </button>
                    <button class="grade-btn" data-grade="3">
                        <span class="grade-icon">📕</span>
                        <span class="grade-btn-text">고등학교 3학년</span>
                        <span class="grade-btn-arrow">›</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- 페이지 2: 수강과목 및 담당선생님 선택 -->
        <div class="page" id="page2">
            <div class="page-header">
                <h1>수강 정보 입력</h1>
                <p class="subtitle">수강하는 과목과 담당 선생님을 선택해주세요</p>
            </div>
            <div class="content-box">
                <div class="info-notice">
                    <span class="notice-icon">💡</span>
                    <span>팀티칭의 경우 여러 선생님을 <strong>중복 선택</strong>할 수 있습니다</span>
                </div>
                <div id="subjectTeacherContainer"></div>
                <div class="button-group">
                    <button class="btn btn-secondary" onclick="goToPage(1)">‹ 이전</button>
                    <button class="btn btn-primary" onclick="validateAndGoToEvaluation()">다음 ›</button>
                </div>
            </div>
        </div>

        <!-- 페이지 3: 선생님별 만족도 평가 -->
        <div class="page" id="page3">
            <div class="page-header">
                <h1>선생님 평가</h1>
                <p class="subtitle" id="evaluationSubtitle"></p>
            </div>
            <div class="content-box">
                <div id="evaluationContainer"></div>
                <div class="button-group">
                    <button class="btn btn-secondary" onclick="goToPage(2)">‹ 이전</button>
                    <button class="btn btn-primary" id="nextEvalBtn" onclick="nextEvaluation()">다음 선생님 ›</button>
                </div>
            </div>
        </div>

        <!-- 페이지 4: 완료 -->
        <div class="page" id="page4">
            <div class="page-header">
                <h1>설문 완료</h1>
            </div>
            <div class="content-box completion-box">
                <div class="completion-icon">✓</div>
                <h2>소중한 의견 감사합니다!</h2>
                <p class="completion-message">
                    학생 여러분이 작성해주신 평가는<br>
                    더 나은 수업 환경을 만드는 데 큰 도움이 됩니다.
                </p>
                <div class="completion-details" id="completionDetails"></div>
                <button class="btn btn-primary" onclick="restartSurvey()">새로운 설문 작성하기</button>
            </div>
        </div>
    </div>

    <!-- 로딩 오버레이 -->
    <div class="loading-overlay" id="loadingOverlay" style="display:none;">
        <div class="spinner"></div>
        <div class="loading-text">제출 중입니다...</div>
    </div>

    <!-- 토스트 알림 -->
    <div class="toast" id="toast"></div>

    <script src="/static/js/data.js"></script>
    <script src="/static/js/main.js"></script>
</body>
</html>`
}

export default app
