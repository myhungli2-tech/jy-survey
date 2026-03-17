import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const admin = new Hono<{ Bindings: Bindings }>()

// 관리자 메인 페이지
admin.get('/', (c) => {
  return c.html(getAdminHTML())
})

function getAdminHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>관리자 — 정율사관학원</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/css/admin.css">
</head>
<body>
<div class="admin-layout">
    <!-- 사이드바 -->
    <aside class="sidebar">
        <div class="sidebar-header">
            <div class="sidebar-logo">★</div>
            <div>
                <div class="sidebar-title">정율사관학원</div>
                <div class="sidebar-sub">관리자 패널</div>
            </div>
        </div>
        <nav class="sidebar-nav">
            <button class="nav-item active" data-tab="dashboard">
                <span class="nav-icon">📊</span> 대시보드
            </button>
            <button class="nav-item" data-tab="teachers">
                <span class="nav-icon">👨‍🏫</span> 강사 관리
            </button>
            <button class="nav-item" data-tab="periods">
                <span class="nav-icon">📅</span> 평가 기간
            </button>
            <button class="nav-item" data-tab="results">
                <span class="nav-icon">📈</span> 결과 분석
            </button>
            <button class="nav-item" data-tab="comments">
                <span class="nav-icon">💬</span> 주관식 답변
            </button>
        </nav>
        <div class="sidebar-footer">
            <a href="/" class="nav-item" style="text-decoration:none;display:flex;align-items:center;gap:10px;padding:12px 20px;">
                <span class="nav-icon">🏠</span> 설문 페이지
            </a>
        </div>
    </aside>

    <!-- 메인 콘텐츠 -->
    <main class="main-content">
        <div id="toast-admin" class="toast-admin"></div>

        <!-- 대시보드 탭 -->
        <div class="tab-content active" id="tab-dashboard">
            <div class="page-title">대시보드</div>
            <div class="stats-grid" id="dashboardStats">
                <div class="stat-card">
                    <div class="stat-value" id="stat-total">-</div>
                    <div class="stat-label">전체 응답 수</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="stat-teachers">-</div>
                    <div class="stat-label">활성 강사 수</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="stat-avg">-</div>
                    <div class="stat-label">전체 평균 점수</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="stat-period">-</div>
                    <div class="stat-label">현재 평가 기간</div>
                </div>
            </div>
            <div class="card" style="margin-top:24px;">
                <div class="card-header">최근 응답 (최신 20개)</div>
                <div class="card-body">
                    <div class="table-wrap">
                        <table id="recentTable">
                            <thead><tr><th>시간</th><th>학년</th><th>선생님</th><th>과목</th><th>평균</th></tr></thead>
                            <tbody id="recentTbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- 강사 관리 탭 -->
        <div class="tab-content" id="tab-teachers">
            <div class="page-title-row">
                <div class="page-title">강사 관리</div>
                <button class="btn-primary" onclick="openAddTeacher()">+ 강사 추가</button>
            </div>

            <!-- 강사 추가/수정 폼 -->
            <div class="card" id="teacherFormCard" style="display:none;margin-bottom:20px;">
                <div class="card-header" id="teacherFormTitle">강사 추가</div>
                <div class="card-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>이름 <span class="required">*</span></label>
                            <input type="text" id="tf-name" placeholder="강사 이름">
                        </div>
                        <div class="form-group">
                            <label>과목 <span class="required">*</span></label>
                            <input type="text" id="tf-subject" placeholder="예: 국어, 수학, 영어">
                        </div>
                        <div class="form-group">
                            <label>학년 <span class="required">*</span></label>
                            <select id="tf-grade">
                                <option value="0">중학교 3학년</option>
                                <option value="1">고등학교 1학년</option>
                                <option value="2">고등학교 2학년</option>
                                <option value="3">고등학교 3학년</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>질문 유형</label>
                            <select id="tf-qtype">
                                <option value="normal">일반 (14문항)</option>
                                <option value="jang">장진민형 (인스터디 제외)</option>
                                <option value="runtrun">런투런 전용</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>활성화 여부</label>
                            <select id="tf-active">
                                <option value="1">활성</option>
                                <option value="0">비활성</option>
                            </select>
                        </div>
                    </div>
                    <input type="hidden" id="tf-id">
                    <div class="form-actions">
                        <button class="btn-secondary" onclick="closeTeacherForm()">취소</button>
                        <button class="btn-primary" onclick="saveTeacher()">저장</button>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">강사 목록</div>
                <div class="card-body">
                    <div class="filter-row">
                        <select id="filterGrade" onchange="loadTeachers()">
                            <option value="">전체 학년</option>
                            <option value="0">중학교 3학년</option>
                            <option value="1">고등학교 1학년</option>
                            <option value="2">고등학교 2학년</option>
                            <option value="3">고등학교 3학년</option>
                        </select>
                    </div>
                    <div class="table-wrap">
                        <table id="teachersTable">
                            <thead>
                                <tr><th>ID</th><th>이름</th><th>과목</th><th>학년</th><th>질문유형</th><th>상태</th><th>관리</th></tr>
                            </thead>
                            <tbody id="teachersTbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- 평가 기간 탭 -->
        <div class="tab-content" id="tab-periods">
            <div class="page-title-row">
                <div class="page-title">평가 기간 관리</div>
                <button class="btn-primary" onclick="openAddPeriod()">+ 기간 추가</button>
            </div>

            <div class="card" id="periodFormCard" style="display:none;margin-bottom:20px;">
                <div class="card-header" id="periodFormTitle">기간 추가</div>
                <div class="card-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>연도 <span class="required">*</span></label>
                            <input type="number" id="pf-year" placeholder="2025">
                        </div>
                        <div class="form-group">
                            <label>월 <span class="required">*</span></label>
                            <input type="number" id="pf-month" placeholder="3" min="1" max="12">
                        </div>
                        <div class="form-group">
                            <label>표시 레이블 <span class="required">*</span></label>
                            <input type="text" id="pf-label" placeholder="예: 2025년 3월">
                        </div>
                        <div class="form-group">
                            <label>활성화 여부</label>
                            <select id="pf-active">
                                <option value="0">비활성 (마감)</option>
                                <option value="1">활성 (진행 중)</option>
                            </select>
                        </div>
                    </div>
                    <input type="hidden" id="pf-id">
                    <div class="form-actions">
                        <button class="btn-secondary" onclick="closePeriodForm()">취소</button>
                        <button class="btn-primary" onclick="savePeriod()">저장</button>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">평가 기간 목록</div>
                <div class="card-body">
                    <div class="table-wrap">
                        <table id="periodsTable">
                            <thead>
                                <tr><th>ID</th><th>연도</th><th>월</th><th>레이블</th><th>상태</th><th>관리</th></tr>
                            </thead>
                            <tbody id="periodsTbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- 결과 분석 탭 -->
        <div class="tab-content" id="tab-results">
            <div class="page-title">결과 분석</div>
            <div class="card" style="margin-bottom:20px;">
                <div class="card-body">
                    <div class="filter-row">
                        <select id="statsYear" onchange="loadStats()">
                            <option value="">전체 연도</option>
                        </select>
                        <select id="statsMonth" onchange="loadStats()">
                            <option value="">전체 월</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">강사별 평균 점수</div>
                <div class="card-body">
                    <div class="table-wrap">
                        <table id="statsTable">
                            <thead>
                                <tr>
                                    <th>학년</th><th>과목</th><th>선생님</th>
                                    <th>응답 수</th><th>전체 평균</th>
                                    <th>강의전달</th><th>학습관리</th><th>태도분위기</th><th>수업효과</th>
                                </tr>
                            </thead>
                            <tbody id="statsTbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- 주관식 답변 탭 -->
        <div class="tab-content" id="tab-comments">
            <div class="page-title">주관식 답변</div>
            <div class="card" style="margin-bottom:20px;">
                <div class="card-body">
                    <div class="filter-row">
                        <select id="commentYear" onchange="loadComments()">
                            <option value="">전체 연도</option>
                        </select>
                        <select id="commentMonth" onchange="loadComments()">
                            <option value="">전체 월</option>
                        </select>
                        <select id="commentTeacher" onchange="loadComments()">
                            <option value="">전체 선생님</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="commentsContainer"></div>
        </div>
    </main>
</div>

<script src="/static/js/admin.js"></script>
</body>
</html>`
}

export default admin
