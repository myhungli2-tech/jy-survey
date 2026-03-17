import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import apiRoutes from './routes/api'

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

// Admin page
app.get('/admin', (c) => {
  return c.html(getAdminHTML())
})

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
    <link rel="stylesheet" href="/static/css/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
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

            <!-- 현재 진행 월 배너 -->
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

    <script src="/static/js/data.js?v=3.5"></script>
    <script src="/static/js/main.js?v=4.6"></script>
</body>
</html>`
}

function getAdminHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>정율사관학원 — 관리자 페이지</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        /* ── Reset & Base ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            --primary: #4F46E5;
            --primary-light: #6366F1;
            --primary-dark: #3730A3;
            --primary-bg: #EEF2FF;
            --secondary: #0EA5E9;
            --success: #10B981;
            --warning: #F59E0B;
            --danger: #EF4444;
            --text-primary: #1E293B;
            --text-secondary: #64748B;
            --text-muted: #94A3B8;
            --border: #E2E8F0;
            --border-light: #F1F5F9;
            --surface: #FFFFFF;
            --surface-2: #F8FAFC;
            --surface-3: #F1F5F9;
            --sidebar-w: 260px;
            --header-h: 64px;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
            --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
            --shadow-lg: 0 10px 30px rgba(0,0,0,0.1);
            --radius-sm: 8px;
            --radius-md: 12px;
            --radius-lg: 16px;
            --radius-full: 9999px;
            --transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
        }

        html { scroll-behavior: smooth; }

        body {
            font-family: 'Noto Sans KR', sans-serif;
            background: var(--surface-2);
            color: var(--text-primary);
            min-height: 100vh;
        }

        /* ── 로그인 화면 ── */
        #loginScreen {
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6B73FF 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .login-card {
            background: white;
            border-radius: 24px;
            padding: clamp(32px, 5vw, 48px);
            width: 100%;
            max-width: 420px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }

        .login-logo {
            text-align: center;
            margin-bottom: 32px;
        }

        .login-logo .logo-icon {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, var(--primary), var(--primary-light));
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            color: white;
            margin: 0 auto 16px;
            box-shadow: 0 8px 20px rgba(79,70,229,0.3);
        }

        .login-logo h1 {
            font-size: 20px;
            font-weight: 800;
            color: var(--text-primary);
        }

        .login-logo p {
            font-size: 13px;
            color: var(--text-muted);
            margin-top: 4px;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        .form-input {
            width: 100%;
            padding: 12px 16px;
            border: 1.5px solid var(--border);
            border-radius: var(--radius-md);
            font-size: 15px;
            font-family: inherit;
            color: var(--text-primary);
            background: var(--surface);
            transition: var(--transition);
            outline: none;
        }

        .form-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
        }

        .login-error {
            background: #FEF2F2;
            border: 1px solid #FECACA;
            border-radius: var(--radius-sm);
            padding: 10px 14px;
            font-size: 13px;
            color: var(--danger);
            margin-bottom: 16px;
            display: none;
        }

        .btn-login {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, var(--primary), var(--primary-light));
            color: white;
            border: none;
            border-radius: var(--radius-md);
            font-size: 15px;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            transition: var(--transition);
            box-shadow: 0 4px 14px rgba(79,70,229,0.35);
        }

        .btn-login:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(79,70,229,0.4);
        }

        /* ── 어드민 레이아웃 ── */
        #adminApp {
            display: none;
        }

        /* 사이드바 */
        .sidebar {
            position: fixed;
            top: 0; left: 0; bottom: 0;
            width: var(--sidebar-w);
            background: var(--text-primary);
            z-index: 100;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: transform 0.3s ease;
        }

        .sidebar-header {
            padding: 20px 20px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .sidebar-logo {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .sidebar-logo-icon {
            width: 38px;
            height: 38px;
            background: linear-gradient(135deg, var(--primary), var(--primary-light));
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: white;
            flex-shrink: 0;
        }

        .sidebar-logo-text {
            font-size: 14px;
            font-weight: 700;
            color: white;
            line-height: 1.3;
        }

        .sidebar-logo-sub {
            font-size: 11px;
            color: rgba(255,255,255,0.45);
            font-weight: 400;
        }

        .sidebar-nav {
            flex: 1;
            padding: 16px 12px;
            overflow-y: auto;
        }

        .nav-section-title {
            font-size: 10px;
            font-weight: 700;
            color: rgba(255,255,255,0.35);
            letter-spacing: 1.5px;
            text-transform: uppercase;
            padding: 0 8px;
            margin: 12px 0 6px;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: var(--radius-md);
            font-size: 14px;
            font-weight: 500;
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            transition: var(--transition);
            margin-bottom: 2px;
            border: none;
            background: none;
            width: 100%;
            text-align: left;
            font-family: inherit;
        }

        .nav-item:hover {
            background: rgba(255,255,255,0.08);
            color: rgba(255,255,255,0.9);
        }

        .nav-item.active {
            background: linear-gradient(135deg, var(--primary), var(--primary-light));
            color: white;
            box-shadow: 0 4px 12px rgba(79,70,229,0.35);
        }

        .nav-item i {
            width: 18px;
            text-align: center;
            font-size: 14px;
        }

        .sidebar-footer {
            padding: 16px 20px;
            border-top: 1px solid rgba(255,255,255,0.08);
        }

        .btn-logout {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            background: rgba(239,68,68,0.15);
            border: 1px solid rgba(239,68,68,0.3);
            border-radius: var(--radius-md);
            font-size: 13px;
            font-weight: 600;
            color: #FCA5A5;
            cursor: pointer;
            transition: var(--transition);
            font-family: inherit;
        }

        .btn-logout:hover {
            background: rgba(239,68,68,0.25);
            color: #FEE2E2;
        }

        /* 메인 콘텐츠 */
        .main-content {
            margin-left: var(--sidebar-w);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .topbar {
            height: var(--header-h);
            background: white;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 28px;
            position: sticky;
            top: 0;
            z-index: 50;
            box-shadow: var(--shadow-sm);
        }

        .topbar-title {
            font-size: 18px;
            font-weight: 700;
            color: var(--text-primary);
        }

        .topbar-right {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .topbar-date {
            font-size: 13px;
            color: var(--text-muted);
        }

        .menu-toggle {
            display: none;
            background: none;
            border: none;
            cursor: pointer;
            color: var(--text-secondary);
            font-size: 20px;
            padding: 4px;
        }

        .page-content {
            flex: 1;
            padding: 28px;
            max-width: 1400px;
            width: 100%;
        }

        /* ── 섹션 (탭 패널) — JS가 style.display로 직접 제어 ── */
        .tab-panel { display: none; }
        .tab-panel.active { display: block; }

        /* ── 통계 카드 ── */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 28px;
        }

        .stat-card {
            background: white;
            border-radius: var(--radius-lg);
            padding: 20px 22px;
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: var(--transition);
        }

        .stat-card:hover {
            box-shadow: var(--shadow-md);
            transform: translateY(-2px);
        }

        .stat-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .stat-card-label {
            font-size: 12px;
            font-weight: 700;
            color: var(--text-muted);
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        .stat-card-icon {
            width: 36px;
            height: 36px;
            border-radius: var(--radius-sm);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }

        .stat-card-value {
            font-size: 28px;
            font-weight: 800;
            color: var(--text-primary);
            line-height: 1;
        }

        .stat-card-sub {
            font-size: 12px;
            color: var(--text-muted);
        }

        /* ── 차트 카드 ── */
        .card {
            background: white;
            border-radius: var(--radius-lg);
            border: 1px solid var(--border);
            box-shadow: var(--shadow-sm);
            overflow: hidden;
            margin-bottom: 20px;
        }

        .card-header {
            padding: 18px 22px 14px;
            border-bottom: 1px solid var(--border-light);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
        }

        .card-title {
            font-size: 15px;
            font-weight: 700;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .card-title i {
            color: var(--primary);
        }

        .card-body {
            padding: 22px;
        }

        /* ── 필터바 ── */
        .filter-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 20px;
        }

        .filter-select {
            padding: 9px 14px;
            border: 1.5px solid var(--border);
            border-radius: var(--radius-md);
            font-size: 14px;
            font-family: inherit;
            color: var(--text-primary);
            background: white;
            cursor: pointer;
            outline: none;
            transition: var(--transition);
        }

        .filter-select:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
        }

        /* ── 강사 성적표 ── */
        .teacher-ranking {
            display: grid;
            gap: 12px;
        }

        .teacher-rank-card {
            background: white;
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 16px 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            transition: var(--transition);
        }

        .teacher-rank-card:hover {
            box-shadow: var(--shadow-md);
            border-color: rgba(79,70,229,0.3);
            transform: translateX(3px);
        }

        .rank-num {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 800;
            flex-shrink: 0;
        }

        .rank-1 { background: #FEF3C7; color: #D97706; }
        .rank-2 { background: #F1F5F9; color: #64748B; }
        .rank-3 { background: #FEF3C7; color: #B45309; }
        .rank-other { background: var(--surface-3); color: var(--text-muted); }

        .rank-info {
            flex: 1;
            min-width: 0;
        }

        .rank-name {
            font-size: 15px;
            font-weight: 700;
            color: var(--text-primary);
        }

        .rank-subject {
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 2px;
        }

        .rank-bar-wrap {
            flex: 2;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .rank-bar {
            flex: 1;
            height: 8px;
            background: var(--surface-3);
            border-radius: var(--radius-full);
            overflow: hidden;
        }

        .rank-bar-fill {
            height: 100%;
            border-radius: var(--radius-full);
            background: linear-gradient(90deg, var(--primary), var(--primary-light));
            transition: width 0.8s ease;
        }

        .rank-score {
            font-size: 16px;
            font-weight: 800;
            color: var(--primary);
            min-width: 36px;
            text-align: right;
        }

        .rank-count {
            font-size: 12px;
            color: var(--text-muted);
            min-width: 50px;
            text-align: right;
        }

        /* ── 데이터 테이블 ── */
        .table-wrap {
            overflow-x: auto;
            border-radius: var(--radius-md);
            border: 1px solid var(--border);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        thead {
            background: var(--surface-3);
            position: sticky;
            top: 0;
        }

        th {
            padding: 12px 14px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            color: var(--text-muted);
            letter-spacing: 0.5px;
            text-transform: uppercase;
            white-space: nowrap;
            border-bottom: 1px solid var(--border);
        }

        td {
            padding: 12px 14px;
            border-bottom: 1px solid var(--border-light);
            color: var(--text-primary);
            vertical-align: middle;
        }

        tr:last-child td { border-bottom: none; }

        tbody tr:hover { background: var(--surface-2); }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 3px 10px;
            border-radius: var(--radius-full);
            font-size: 11px;
            font-weight: 700;
        }

        .badge-0 { background: #FEF3C7; color: #92400E; }
        .badge-1 { background: #DBEAFE; color: #1D4ED8; }
        .badge-2 { background: #D1FAE5; color: #065F46; }
        .badge-3 { background: #FEE2E2; color: #991B1B; }

        .score-pill {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: var(--radius-full);
            font-size: 12px;
            font-weight: 700;
        }

        .score-high   { background: #D1FAE5; color: #065F46; }
        .score-mid    { background: #FEF3C7; color: #92400E; }
        .score-low    { background: #FEE2E2; color: #991B1B; }

        /* ── 상세보기 모달 ── */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15,23,42,0.5);
            backdrop-filter: blur(4px);
            z-index: 1000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .modal-overlay.open { display: flex; }

        .modal {
            background: white;
            border-radius: var(--radius-xl, 24px);
            width: 100%;
            max-width: 680px;
            max-height: 85vh;
            overflow-y: auto;
            box-shadow: 0 25px 60px rgba(0,0,0,0.2);
            animation: modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }

        @keyframes modalIn {
            from { transform: scale(0.9) translateY(20px); opacity: 0; }
            to   { transform: scale(1) translateY(0); opacity: 1; }
        }

        .modal-header {
            padding: 20px 24px 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            background: white;
            z-index: 1;
        }

        .modal-title {
            font-size: 17px;
            font-weight: 700;
            color: var(--text-primary);
        }

        .modal-close {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: none;
            background: var(--surface-3);
            cursor: pointer;
            font-size: 16px;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: var(--transition);
        }

        .modal-close:hover { background: var(--border); color: var(--text-primary); }

        .modal-body { padding: 20px 24px 24px; }

        /* 모달 내 항목 평점 */
        .modal-score-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid var(--border-light);
        }

        .modal-score-row:last-child { border-bottom: none; }

        .modal-q-text {
            flex: 1;
            font-size: 13px;
            color: var(--text-primary);
            line-height: 1.4;
        }

        .modal-q-score {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 800;
            flex-shrink: 0;
        }

        .q-score-5 { background: #D1FAE5; color: #065F46; }
        .q-score-4 { background: #DBEAFE; color: #1E40AF; }
        .q-score-3 { background: #FEF3C7; color: #92400E; }
        .q-score-2 { background: #FEE2E2; color: #991B1B; }
        .q-score-1 { background: #FEE2E2; color: #7F1D1D; }

        /* ── 페이지네이션 ── */
        .pagination {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 16px;
            border-top: 1px solid var(--border-light);
        }

        .page-btn {
            min-width: 34px;
            height: 34px;
            border-radius: var(--radius-sm);
            border: 1.5px solid var(--border);
            background: white;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-secondary);
            cursor: pointer;
            transition: var(--transition);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 8px;
            font-family: inherit;
        }

        .page-btn:hover { border-color: var(--primary); color: var(--primary); }
        .page-btn.active { background: var(--primary); border-color: var(--primary); color: white; }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── 빈 상태 ── */
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--text-muted);
        }

        .empty-state i { font-size: 40px; margin-bottom: 14px; display: block; opacity: 0.4; }
        .empty-state p { font-size: 15px; }

        /* ── 로딩 ── */
        .loading-spinner {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 48px;
            gap: 12px;
            color: var(--text-muted);
            font-size: 14px;
        }

        .spinner-sm {
            width: 24px; height: 24px;
            border: 3px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── 반응형 ── */
        @media (max-width: 900px) {
            .sidebar {
                transform: translateX(-100%);
            }
            .sidebar.open {
                transform: translateX(0);
            }
            .sidebar-overlay {
                display: block;
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.4);
                z-index: 99;
            }
            .main-content {
                margin-left: 0;
            }
            .menu-toggle {
                display: flex;
            }
            .page-content {
                padding: 16px;
            }
        }

        @media (max-width: 600px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .rank-bar-wrap { display: none; }
        }

        /* ── 섹션별 차트 컨테이너 ── */
        .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .chart-container {
            position: relative;
            height: 300px;
        }

        /* ── 강사별 상세 카테고리 ── */
        .category-scores {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin-top: 12px;
        }

        .cat-score-item {
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 14px;
            text-align: center;
        }

        .cat-score-label {
            font-size: 11px;
            color: var(--text-muted);
            font-weight: 600;
            letter-spacing: 0.3px;
            margin-bottom: 6px;
        }

        .cat-score-value {
            font-size: 22px;
            font-weight: 800;
            color: var(--primary);
        }

        /* 검색창 */
        .search-input {
            padding: 9px 14px 9px 38px;
            border: 1.5px solid var(--border);
            border-radius: var(--radius-md);
            font-size: 14px;
            font-family: inherit;
            outline: none;
            transition: var(--transition);
            background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") no-repeat 12px center;
            min-width: 200px;
        }

        .search-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
        }

        /* 데이터 새로고침 버튼 */
        .btn-refresh {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 9px 16px;
            background: white;
            border: 1.5px solid var(--border);
            border-radius: var(--radius-md);
            font-size: 13px;
            font-weight: 600;
            color: var(--text-secondary);
            cursor: pointer;
            transition: var(--transition);
            font-family: inherit;
        }

        .btn-refresh:hover {
            border-color: var(--primary);
            color: var(--primary);
            background: var(--primary-bg);
        }

        .btn-refresh.spinning i {
            animation: spin 0.8s linear infinite;
        }
    </style>
</head>
<body>

    <!-- ── 로그인 화면 ── -->
    <div id="loginScreen">
        <div class="login-card">
            <div class="login-logo">
                <div class="logo-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                <h1>정율사관학원</h1>
                <p>강사 만족도 관리자 페이지</p>
            </div>
            <div class="login-error" id="loginError">
                아이디 또는 비밀번호가 올바르지 않습니다.
            </div>
            <form id="loginForm" onsubmit="handleLogin(event)">
                <div class="form-group">
                    <label class="form-label" for="username">아이디</label>
                    <input class="form-input" id="username" type="text" placeholder="아이디를 입력하세요" autocomplete="username" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="password">비밀번호</label>
                    <input class="form-input" id="password" type="password" placeholder="비밀번호를 입력하세요" autocomplete="current-password" required>
                </div>
                <button type="submit" class="btn-login">
                    <i class="fa-solid fa-right-to-bracket" style="margin-right:6px;"></i>로그인
                </button>
            </form>
        </div>
    </div>

    <!-- 사이드바 오버레이 (모바일) -->
    <div class="sidebar-overlay" id="sidebarOverlay" style="display:none;" onclick="closeSidebar()"></div>

    <!-- ── 어드민 앱 ── -->
    <div id="adminApp">
        <!-- 사이드바 -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">
                    <div class="sidebar-logo-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                    <div>
                        <div class="sidebar-logo-text">정율사관학원</div>
                        <div class="sidebar-logo-sub">관리자 페이지</div>
                    </div>
                </div>
            </div>

            <nav class="sidebar-nav">
                <div class="nav-section-title">메뉴</div>
                <button id="nav-dashboard" class="nav-item active" data-tab="dashboard" onclick="switchTab('dashboard')">
                    <i class="fa-solid fa-chart-pie"></i> 대시보드
                </button>
                <button id="nav-ranking" class="nav-item" data-tab="ranking" onclick="switchTab('ranking')">
                    <i class="fa-solid fa-trophy"></i> 강사 순위
                </button>
                <button id="nav-detail" class="nav-item" data-tab="detail" onclick="switchTab('detail')">
                    <i class="fa-solid fa-chart-bar"></i> 강사별 상세
                </button>
                <button id="nav-responses" class="nav-item" data-tab="responses" onclick="switchTab('responses')">
                    <i class="fa-solid fa-list-check"></i> 응답 목록
                </button>
                <button id="nav-monthly" class="nav-item" data-tab="monthly" onclick="switchTab('monthly')">
                    <i class="fa-solid fa-chart-column"></i> 월별 통계
                </button>
                <button id="nav-trend" class="nav-item" data-tab="trend" onclick="switchTab('trend')">
                    <i class="fa-solid fa-chart-line"></i> 강사별 추이
                </button>
                <div class="nav-section-title" style="margin-top:16px;">설정</div>
                <button id="nav-months" class="nav-item" data-tab="months" onclick="switchTab('months')">
                    <i class="fa-solid fa-calendar-days"></i> 평가 월 관리
                </button>
                <button id="nav-teachers" class="nav-item" data-tab="teachers" onclick="switchTab('teachers')">
                    <i class="fa-solid fa-chalkboard-user"></i> 강사 관리
                </button>
            </nav>

            <div class="sidebar-footer">
                <button class="btn-logout" onclick="handleLogout()">
                    <i class="fa-solid fa-right-from-bracket"></i> 로그아웃
                </button>
            </div>
        </aside>

        <!-- 메인 콘텐츠 -->
        <div class="main-content">
            <header class="topbar">
                <div style="display:flex;align-items:center;gap:12px;">
                    <button class="menu-toggle" id="menuToggle" onclick="toggleSidebar()">
                        <i class="fa-solid fa-bars"></i>
                    </button>
                    <div class="topbar-title" id="topbarTitle">대시보드</div>
                </div>
                <div class="topbar-right">
                    <span class="topbar-date" id="topbarDate"></span>
                    <button class="btn-refresh" id="refreshBtn" onclick="refreshData()">
                        <i class="fa-solid fa-rotate-right"></i> 새로고침
                    </button>
                </div>
            </header>

            <div class="page-content">

                <!-- ── 탭1: 대시보드 ── -->
                <div class="tab-panel" id="panel-dashboard">
                    <div class="stats-grid" id="statsGrid">
                        <div class="loading-spinner"><div class="spinner-sm"></div> 로딩 중...</div>
                    </div>

                    <div class="chart-grid">
                        <div class="card">
                            <div class="card-header">
                                <div class="card-title"><i class="fa-solid fa-chart-bar"></i> 학년별 응답 수</div>
                            </div>
                            <div class="card-body">
                                <div class="chart-container">
                                    <canvas id="chartGrade"></canvas>
                                </div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <div class="card-title"><i class="fa-solid fa-chart-line"></i> 평가 항목별 전체 평균</div>
                            </div>
                            <div class="card-body">
                                <div class="chart-container">
                                    <canvas id="chartCategory"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <div class="card-title"><i class="fa-solid fa-star"></i> 상위 강사 TOP 5</div>
                        </div>
                        <div class="card-body">
                            <div id="top5Container" class="teacher-ranking">
                                <div class="loading-spinner"><div class="spinner-sm"></div></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── 탭2: 강사 순위 ── -->
                <div class="tab-panel" id="panel-ranking">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title"><i class="fa-solid fa-trophy"></i> 강사 순위 (가중평균)</div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                                <select class="filter-select" id="rankYearFilter" onchange="onRankYearChange()">
                                    <option value="">전체 연도</option>
                                    <option value="2025">2025년</option>
                                    <option value="2026" selected>2026년</option>
                                    <option value="2027">2027년</option>
                                    <option value="2028">2028년</option>
                                </select>
                                <select class="filter-select" id="rankMonthFilter" onchange="renderRanking()">
                                    <option value="">전체 월</option>
                                </select>
                                <select class="filter-select" id="rankGradeFilter" onchange="renderRanking()">
                                    <option value="">전체 학년</option>
                                    <option value="0">중3</option>
                                    <option value="1">고1</option>
                                    <option value="2">고2</option>
                                    <option value="3">고3</option>
                                </select>
                                <select class="filter-select" id="rankSubjectFilter" onchange="renderRanking()">
                                    <option value="">전체 과목</option>
                                </select>
                            </div>
                        </div>
                        <!-- 요약 배지 -->
                        <div id="rankingSummaryBar" style="padding:10px 20px 0;display:flex;gap:10px;flex-wrap:wrap;"></div>
                        <div class="card-body">
                            <!-- 가중평균 안내 -->
                            <div style="margin-bottom:14px;padding:10px 14px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;font-size:12px;color:#166534;line-height:1.7;">
                                <strong>💡 가중평균 산출 방식</strong><br>
                                응답한 학생 × 실평균 + 미응답 학생 × 3 (기준점) ÷ 총 수강생<br>
                                <span style="color:#6B7280;">※ 명단 미등록 강사는 실평균(응답 기준)으로 표시됩니다.</span>
                            </div>
                            <div id="rankingContainer" class="teacher-ranking">
                                <div class="loading-spinner"><div class="spinner-sm"></div></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── 탭3: 강사별 상세 ── -->
                <div class="tab-panel" id="panel-detail">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title"><i class="fa-solid fa-user-tie"></i> 강사별 상세 분석</div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <select class="filter-select" id="detailGradeFilter" onchange="loadDetailTeachers()">
                                    <option value="">전체 학년</option>
                                    <option value="0">중3</option>
                                    <option value="1">고1</option>
                                    <option value="2">고2</option>
                                    <option value="3">고3</option>
                                </select>
                                <select class="filter-select" id="detailTeacherFilter" onchange="renderTeacherDetail()">
                                    <option value="">강사 선택</option>
                                </select>
                            </div>
                        </div>
                        <div class="card-body">
                            <div id="detailContainer">
                                <div class="empty-state">
                                    <i class="fa-solid fa-user-tie"></i>
                                    <p>강사를 선택하면 상세 분석이 표시됩니다.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── 탭4: 응답 목록 ── -->
                <div class="tab-panel" id="panel-responses">
                    <div class="card">
                        <div class="card-header">
                            <div class="card-title"><i class="fa-solid fa-list-check"></i> 전체 응답 목록</div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                                <input class="search-input" type="text" id="responseSearch"
                                       placeholder="선생님 검색..." oninput="filterResponses()">
                                <select class="filter-select" id="responseMonthFilter" onchange="filterResponses()">
                                    <option value="">전체 월</option>
                                </select>
                                <select class="filter-select" id="responseGradeFilter" onchange="filterResponses()">
                                    <option value="">전체 학년</option>
                                    <option value="0">중3</option>
                                    <option value="1">고1</option>
                                    <option value="2">고2</option>
                                    <option value="3">고3</option>
                                </select>
                            </div>
                        </div>
                        <div class="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>평가월</th>
                                        <th>학년</th>
                                        <th>선생님</th>
                                        <th>과목</th>
                                        <th>평균</th>
                                        <th>Q1</th><th>Q2</th><th>Q3</th>
                                        <th>Q4</th><th>Q5</th><th>Q6</th>
                                        <th>Q7</th><th>Q8</th><th>Q9</th>
                                        <th>Q10</th><th>Q11</th><th>Q12</th>
                                        <th>Q13</th><th>Q14</th>
                                        <th>R1</th><th>R2</th><th>R3</th>
                                        <th>제출일시</th>
                                        <th>상세</th>
                                        <th>삭제</th>
                                    </tr>
                                </thead>
                                <tbody id="responseTableBody">
                                    <tr><td colspan="27" class="loading-spinner" style="text-align:center;padding:40px;">
                                        <div class="spinner-sm" style="margin:0 auto 8px;"></div>
                                    </td></tr>
                                </tbody>
                            </table>
                            <div class="pagination" id="responsePagination"></div>
                        </div>
                    </div>
                </div>

                <!-- ── 탭5: 평가 월 관리 ── -->
                <div class="tab-panel" id="panel-months">
                    <div class="card">
                        <div class="card-header">
                            <div>
                                <div class="card-title"><i class="fa-solid fa-calendar-days"></i> 평가 월 관리</div>
                                <div style="font-size:13px;color:#64748B;margin-top:4px;">
                                    활성화된 월만 학생 설문 페이지에서 응답 가능합니다.
                                </div>
                            </div>
                            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                                <select id="monthsYearFilter" onchange="loadMonthSettings()" style="padding:8px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-weight:700;color:#1E293B;background:white;cursor:pointer;font-family:inherit;">
                                    <option value="2026">2026년</option>
                                    <option value="2027">2027년</option>
                                    <option value="2028">2028년</option>
                                </select>
                                <button onclick="addYearMonths()" style="padding:8px 14px;background:#EEF2FF;border:none;border-radius:8px;font-size:13px;font-weight:700;color:#4F46E5;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;">
                                    <i class="fa-solid fa-plus"></i> 해당 연도 월 생성
                                </button>
                                <button onclick="loadMonthSettings()" style="padding:8px 14px;background:#F1F5F9;border:none;border-radius:8px;font-size:13px;font-weight:700;color:#64748B;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;">
                                    <i class="fa-solid fa-rotate-right"></i> 새로고침
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div id="monthSettingsContainer">
                                <div class="loading-spinner"><div class="spinner-sm"></div> 로딩 중...</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── 탭6: 월별 통계 ── -->
                <div class="tab-panel" id="panel-monthly">
                    <div class="card">
                        <div class="card-header">
                            <div>
                                <div class="card-title"><i class="fa-solid fa-chart-column"></i> 월별 통계</div>
                                <div style="font-size:13px;color:#64748B;margin-top:4px;">월을 선택하면 해당 월의 강사별 평균 점수와 통계를 확인할 수 있습니다.</div>
                            </div>
                        </div>
                        <div class="card-body">
                            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
                                <select id="monthlyYearFilter" onchange="initMonthlyTab()" style="padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:inherit;color:#1E293B;background:white;cursor:pointer;">
                                    <option value="2025">2025년</option>
                                    <option value="2026" selected>2026년</option>
                                    <option value="2027">2027년</option>
                                    <option value="2028">2028년</option>
                                </select>
                                <select id="monthlyMonthFilter" onchange="renderMonthlyStats()" style="padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:inherit;color:#1E293B;background:white;cursor:pointer;">
                                    <option value="">월 선택</option>
                                </select>
                                <select id="monthlyGradeFilter" onchange="renderMonthlyStats()" style="padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:inherit;color:#1E293B;background:white;cursor:pointer;">
                                    <option value="">전체 학년</option>
                                    <option value="0">중3</option>
                                    <option value="1">고1</option>
                                    <option value="2">고2</option>
                                    <option value="3">고3</option>
                                </select>
                            </div>
                            <div id="monthlyStatsContainer">
                                <div style="text-align:center;padding:40px;color:#94A3B8;"><i class="fa-solid fa-chart-column" style="font-size:32px;display:block;margin-bottom:12px;"></i>월을 선택해주세요.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── 탭7: 강사별 추이 ── -->
                <div class="tab-panel" id="panel-trend">
                    <div class="card">
                        <div class="card-header">
                            <div>
                                <div class="card-title"><i class="fa-solid fa-chart-line"></i> 강사별 월별 추이</div>
                                <div style="font-size:13px;color:#64748B;margin-top:4px;">강사를 선택하면 월별 평균 점수 변화를 확인할 수 있습니다.</div>
                            </div>
                        </div>
                        <div class="card-body">
                            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
                                <select id="trendGradeFilter" onchange="loadTrendTeachers()" style="padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:inherit;color:#1E293B;background:white;cursor:pointer;">
                                    <option value="">전체 학년</option>
                                    <option value="0">중3</option>
                                    <option value="1">고1</option>
                                    <option value="2">고2</option>
                                    <option value="3">고3</option>
                                </select>
                                <select id="trendTeacherFilter" onchange="renderTrendChart()" style="padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:inherit;color:#1E293B;background:white;cursor:pointer;min-width:200px;">
                                    <option value="">강사 선택</option>
                                </select>
                            </div>
                            <div id="trendContainer">
                                <div style="text-align:center;padding:40px;color:#94A3B8;"><i class="fa-solid fa-chart-line" style="font-size:32px;display:block;margin-bottom:12px;"></i>강사를 선택해주세요.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── 탭8: 강사 관리 ── -->
                <div class="tab-panel" id="panel-teachers">
                    <div class="card">
                        <div class="card-header">
                            <div>
                                <div class="card-title"><i class="fa-solid fa-chalkboard-user"></i> 강사 관리</div>
                                <div style="font-size:13px;color:#64748B;margin-top:4px;">
                                    강사를 추가·삭제하면 설문 페이지에 즉시 반영됩니다.
                                </div>
                            </div>
                            <button onclick="openAddTeacherModal()" style="padding:9px 18px;background:linear-gradient(135deg,#4F46E5,#6366F1);color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:7px;">
                                <i class="fa-solid fa-plus"></i> 강사 추가
                            </button>
                        </div>
                        <div class="card-body">
                            <!-- 필터 -->
                            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
                                <select id="teacherGradeFilter" onchange="loadTeacherMaster()" style="padding:9px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:inherit;color:#1E293B;background:white;cursor:pointer;">
                                    <option value="">전체 학년</option>
                                    <option value="0">중3</option>
                                    <option value="1">고1</option>
                                    <option value="2">고2</option>
                                    <option value="3">고3</option>
                                </select>
                                <select id="teacherSubjectFilter" onchange="loadTeacherMaster()" style="padding:9px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:inherit;color:#1E293B;background:white;cursor:pointer;">
                                    <option value="">전체 과목</option>
                                </select>
                                <button onclick="loadTeacherMaster()" style="padding:9px 14px;background:#F1F5F9;border:none;border-radius:8px;font-size:13px;font-weight:600;color:#64748B;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;">
                                    <i class="fa-solid fa-rotate-right"></i> 새로고침
                                </button>
                            </div>
                            <div id="teacherMasterContainer">
                                <div style="text-align:center;padding:40px;color:#94A3B8;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;display:block;margin-bottom:12px;"></i>로딩 중...</div>
                            </div>
                        </div>
                    </div>
                </div>

            </div><!-- /page-content -->
        </div><!-- /main-content -->
    </div><!-- /adminApp -->

    <!-- 강사 추가 모달 -->
    <div class="modal-overlay" id="addTeacherModal" style="display:none;" onclick="if(event.target===this) closeAddTeacherModal()">
        <div class="modal" style="max-width:460px;">
            <div class="modal-header">
                <div class="modal-title"><i class="fa-solid fa-chalkboard-user" style="color:#4F46E5;margin-right:8px;"></i>강사 추가</div>
                <button class="modal-close" onclick="closeAddTeacherModal()">✕</button>
            </div>
            <div class="modal-body" style="padding:24px;">
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div>
                        <label style="font-size:12px;font-weight:700;color:#64748B;display:block;margin-bottom:6px;">강사 이름 *</label>
                        <input type="text" id="newTeacherName" placeholder="예: 홍길동" maxlength="20"
                            style="width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:border-color 0.15s;"
                            onfocus="this.style.borderColor='#4F46E5'" onblur="this.style.borderColor='#E2E8F0'">
                    </div>
                    <div>
                        <label style="font-size:12px;font-weight:700;color:#64748B;display:block;margin-bottom:6px;">담당 과목 *</label>
                        <input type="text" id="newTeacherSubject" placeholder="예: 수학, 영어, 탐구런투런" maxlength="20"
                            style="width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:border-color 0.15s;"
                            onfocus="this.style.borderColor='#4F46E5'" onblur="this.style.borderColor='#E2E8F0'">
                    </div>
                    <div>
                        <label style="font-size:12px;font-weight:700;color:#64748B;display:block;margin-bottom:8px;">담당 학년 * (복수 선택 가능)</label>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;padding:8px 16px;border:1.5px solid #E2E8F0;border-radius:8px;user-select:none;" id="gradeLabel0">
                                <input type="checkbox" id="newGrade0" value="0" onchange="toggleGradeLabel(0)" style="width:15px;height:15px;accent-color:#4F46E5;"> 중3
                            </label>
                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;padding:8px 16px;border:1.5px solid #E2E8F0;border-radius:8px;user-select:none;" id="gradeLabel1">
                                <input type="checkbox" id="newGrade1" value="1" onchange="toggleGradeLabel(1)" style="width:15px;height:15px;accent-color:#4F46E5;"> 고1
                            </label>
                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;padding:8px 16px;border:1.5px solid #E2E8F0;border-radius:8px;user-select:none;" id="gradeLabel2">
                                <input type="checkbox" id="newGrade2" value="2" onchange="toggleGradeLabel(2)" style="width:15px;height:15px;accent-color:#4F46E5;"> 고2
                            </label>
                            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;padding:8px 16px;border:1.5px solid #E2E8F0;border-radius:8px;user-select:none;" id="gradeLabel3">
                                <input type="checkbox" id="newGrade3" value="3" onchange="toggleGradeLabel(3)" style="width:15px;height:15px;accent-color:#4F46E5;"> 고3
                            </label>
                        </div>
                    </div>
                    <div>
                        <label style="font-size:12px;font-weight:700;color:#64748B;display:block;margin-bottom:8px;">질문 유형 *</label>
                        <select id="newTeacherQType" style="width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;font-family:inherit;color:#1E293B;background:white;cursor:pointer;outline:none;">
                            <option value="normal">일반 (Q1~Q14)</option>
                            <option value="jang">인스터디 미진행 강사 (Q1~Q14, 인스터디 제외)</option>
                            <option value="runtrun">탐구런투런 전용 (R1~R3)</option>
                        </select>
                        <div style="font-size:11px;color:#94A3B8;margin-top:6px;">※ 특수 질문이 필요한 경우에만 변경하세요</div>
                    </div>
                    <div id="addTeacherError" style="display:none;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 14px;font-size:13px;color:#DC2626;"></div>
                </div>
            </div>
            <div style="padding:16px 24px;border-top:1px solid #E2E8F0;display:flex;justify-content:flex-end;gap:10px;">
                <button onclick="closeAddTeacherModal()" style="padding:10px 20px;background:#F1F5F9;border:none;border-radius:8px;font-size:13px;font-weight:700;color:#64748B;cursor:pointer;font-family:inherit;">취소</button>
                <button onclick="submitAddTeacher()" style="padding:10px 20px;background:linear-gradient(135deg,#4F46E5,#6366F1);color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">
                    <i class="fa-solid fa-plus" style="margin-right:6px;"></i>추가하기
                </button>
            </div>
        </div>
    </div>

    <!-- 응답 상세 모달 -->
    <div class="modal-overlay" id="detailModal">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title" id="modalTitle">응답 상세</div>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body" id="modalBody"></div>
        </div>
    </div>

    <script src="/static/js/admin.js?v=7.11"></script>
</body>
</html>`
}

export default app
