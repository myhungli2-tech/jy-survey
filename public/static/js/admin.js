// =================================================
//  정율사관학원 어드민 — admin.js v7.8
//  강사 관리 탭 추가, 연도 선택 기능 추가, teacherMasterCache loadAllData 연동, 월별통계 월선택자 동적 생성, trendCatChart 인스턴스 관리
//  API: Cloudflare Workers + D1 (/api/)
// =================================================

// API 기본 경로
var API_BASE = '/api';

var ADMIN_ID  = 'jungyoul';
var ADMIN_PWD = 'jungyoul';

// ── 전역 상태 ──
var allResponses        = [];
var filteredResps       = [];
var currentResponsePage = 1;
var RESP_PAGE_SIZE      = 20;
var currentTab          = 'dashboard';
var monthSettingsCache  = [];
var rosterCache         = [];
var teacherMasterCache  = [];

// 차트 인스턴스
var gradeChartInst      = null;
var categoryChartInst   = null;
var detailChartInst     = null;
var monthlyChartInst    = null;
var trendChartInst      = null;
var trendCatChartInst   = null;

// ── 평가 항목 ──
var Q_LABELS = {
    q1:'수업 전문성', q2:'난이도/속도 적절성', q3:'판서/수업자료 유용성',
    q4:'과제·복습 피드백', q5:'질문 응대', q6:'인스터디 관리',
    q7:'수업시간 엄수·열정', q8:'수업 분위기 통제', q9:'수업 추천 의향',
    q10:'실력 향상 도움', q11:'성적 목표 관심', q12:'학생 존중·따뜻함',
    q13:'공부 의욕 자극', q14:'내신/수능 연결',
    r1:'탐구 루틴 도움', r2:'탐구 성적 향상', r3:'탐구 자신감'
};

// ── 질문 유형별 카테고리 맵 ──
var CATEGORY_BY_TYPE = {
    // 일반 (q1~q14, 인스터디 포함)
    normal: {
        '📣 강의 및 전달력':   ['q1','q2','q3'],
        '📋 학습 관리·피드백': ['q4','q5','q6'],
        '🌟 태도 및 분위기':   ['q7','q8','q9'],
        '📈 수업 효과·성장':   ['q10','q11','q12','q13','q14']
    },
    // 인스터디 미진행 (q4, q6 제외)
    jang: {
        '📣 강의 및 전달력':   ['q1','q2','q3'],
        '📋 학습 관리·피드백': ['q5'],
        '🌟 태도 및 분위기':   ['q7','q8','q9'],
        '📈 수업 효과·성장':   ['q10','q11','q12','q13','q14']
    },
    // 런투런 (r1~r3만)
    runtrun: {
        '🔬 런투런 관리': ['r1','r2','r3']
    }
};

// 하위 호환용 (기존 코드가 CATEGORY_LABELS를 참조하는 곳 — 일반 기준으로 유지)
var CATEGORY_LABELS = {
    '강의 및 전달력':   ['q1','q2','q3'],
    '학습 관리·피드백': ['q4','q5','q6'],
    '태도 및 분위기':   ['q7','q8','q9'],
    '수업 효과·성장':   ['q10','q11','q12','q13','q14'],
    '런투런 관리':      ['r1','r2','r3']
};

// ── 강사의 question_type 조회 헬퍼 ──
// teacherMasterCache 에서 찾고, 없으면 응답 데이터에서 추측
function getQTypeForTeacher(teacherName, subject, grade) {
    // 1) teacherMasterCache에서 직접 조회
    for (var i = 0; i < teacherMasterCache.length; i++) {
        var t = teacherMasterCache[i];
        if (t.name === teacherName && t.subject === subject && String(t.grade) === String(grade)) {
            return t.question_type || 'normal';
        }
    }
    // 2) 캐시 없으면 allResponses 에서 r1 값이 있으면 runtrun 추측
    for (var j = 0; j < allResponses.length; j++) {
        var r = allResponses[j];
        if (r.teacher === teacherName && r.subject === subject && String(r.grade) === String(grade)) {
            if (r.r1 != null) return 'runtrun';
            if (r.q4 == null && r.q6 == null && r.q1 != null) return 'jang';
            return 'normal';
        }
    }
    return 'normal';
}

// ── question_type → CATEGORY_BY_TYPE 반환 ──
function getCategoriesByType(qType) {
    return CATEGORY_BY_TYPE[qType] || CATEGORY_BY_TYPE['normal'];
}

function gradeLabel(g) {
    return String(g) === '0' ? '중3' : '고' + g;
}



var TAB_TITLES = {
    dashboard: '대시보드',
    ranking:   '강사 순위',
    detail:    '강사별 상세 분석',
    responses: '응답 목록',
    months:    '평가 월 관리',
    monthly:   '월별 통계',
    trend:     '강사별 추이',
    teachers:  '강사 관리'
};

// =================================================
//  초기화
// =================================================
document.addEventListener('DOMContentLoaded', function() {
    updateTopbarDate();
    setInterval(updateTopbarDate, 60000);
    var modal = document.getElementById('detailModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModal();
        });
    }
});

function updateTopbarDate() {
    var el = document.getElementById('topbarDate');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('ko-KR', {
        year:'numeric', month:'long', day:'numeric', weekday:'short'
    });
}

// =================================================
//  로그인 / 로그아웃
// =================================================
function handleLogin(e) {
    e.preventDefault();
    var id  = document.getElementById('username').value.trim();
    var pwd = document.getElementById('password').value;
    if (id === ADMIN_ID && pwd === ADMIN_PWD) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminApp').style.display   = 'block';
        setTimeout(function() {
            switchTab('dashboard');
            loadAllData();
        }, 80);
    } else {
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('password').value = '';
    }
}

function handleLogout() {
    document.getElementById('adminApp').style.display   = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('username').value  = '';
    document.getElementById('password').value  = '';
    document.getElementById('loginError').style.display = 'none';
    allResponses  = [];
    filteredResps = [];
    monthSettingsCache = [];
    rosterCache = [];
}

// =================================================
//  탭 전환
// =================================================
function switchTab(tab) {
    currentTab = tab;
    var tabs = ['dashboard','ranking','detail','responses','months','monthly','trend','teachers'];

    // 모든 패널 숨김 / nav 비활성
    tabs.forEach(function(t) {
        var panel = document.getElementById('panel-' + t);
        var nav   = document.getElementById('nav-' + t);
        if (panel) panel.style.display = 'none';
        if (nav)   nav.classList.remove('active');
    });

    // 선택 패널 보이기 / nav 활성
    var selPanel = document.getElementById('panel-' + tab);
    var selNav   = document.getElementById('nav-' + tab);
    if (selPanel) selPanel.style.display = 'block';
    if (selNav)   selNav.classList.add('active');

    var titleEl = document.getElementById('topbarTitle');
    if (titleEl) titleEl.textContent = TAB_TITLES[tab] || tab;

    closeSidebar();

    setTimeout(function() {
        if (tab === 'ranking') {
            populateRankMonthFilter();
            renderRanking();
        }
        if (tab === 'detail')    loadDetailTeachers();
        if (tab === 'responses') {
            filteredResps = allResponses.slice();
            currentResponsePage = 1;
            populateMonthFilter();
            renderResponseTable();
        }
        if (tab === 'months')    loadMonthSettings();
        if (tab === 'monthly')   initMonthlyTab();
        if (tab === 'trend')     initTrendTab();
        if (tab === 'teachers')  loadTeacherMaster();
    }, 80);
}

function toggleSidebar() {
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('sidebarOverlay');
    var isOpen = sb.classList.toggle('open');
    if (ov) ov.style.display = isOpen ? 'block' : 'none';
}

function closeSidebar() {
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('sidebarOverlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.style.display = 'none';
}

// =================================================
//  데이터 로드
// =================================================
function extractRows(json) {
    if (Array.isArray(json))             return json;
    if (json && Array.isArray(json.data))  return json.data;
    if (json && Array.isArray(json.items)) return json.items;
    return [];
}

async function loadAllData() {
    try {
        // survey_responses 전체 로드
        var page = 1, collected = [];
        while (true) {
            var res  = await fetch(API_BASE + '/survey_responses?page=' + page + '&limit=100');
            var json = await res.json();
            var rows = extractRows(json);
            if (rows.length === 0) break;
            collected = collected.concat(rows);
            var total = json.total || json.count || 0;
            if (!total || collected.length >= total) break;
            page++;
        }
        allResponses  = collected;
        filteredResps = collected.slice();

        // teacher_roster 로드
        var rRes  = await fetch(API_BASE + '/teacher_roster?limit=500');
        var rJson = await rRes.json();
        rosterCache = extractRows(rJson);

        // teacher_master 로드 (강사 유형 판별용)
        var tmRes  = await fetch(API_BASE + '/teacher_master?limit=500');
        var tmJson = await tmRes.json();
        teacherMasterCache = extractRows(tmJson);

        renderDashboard();
    } catch(err) {
        console.error('데이터 로드 실패:', err);
    }
}

async function refreshData() {
    var btn = document.getElementById('refreshBtn');
    if (btn) btn.classList.add('spinning');
    await loadAllData();
    if (currentTab === 'ranking') {
        populateRankMonthFilter();
        renderRanking();
    }
    if (currentTab === 'detail')    {} // 유지
    if (currentTab === 'responses') {
        filteredResps = allResponses.slice();
        currentResponsePage = 1;
        populateMonthFilter();
        renderResponseTable();
    }
    if (btn) btn.classList.remove('spinning');
}

// =================================================
//  대시보드
// =================================================
function renderDashboard() {
    renderStats();
    renderGradeChart();
    renderCategoryChart();
    renderTop5();
}

function renderStats() {
    var total    = allResponses.length;
    var teachers = [];
    allResponses.forEach(function(r) {
        var k = r.teacher + '|' + r.subject;
        if (teachers.indexOf(k) === -1) teachers.push(k);
    });
    var avgs = allResponses.map(function(r){ return parseFloat(r.average); }).filter(function(v){ return !isNaN(v) && v > 0; });
    var globalAvg = avgs.length ? (avgs.reduce(function(a,b){return a+b;},0)/avgs.length).toFixed(2) : '-';
    var today = new Date().toISOString().split('T')[0];
    var todayCount = allResponses.filter(function(r){
        return r.timestamp && r.timestamp.toString().startsWith(today);
    }).length;

    var el = document.getElementById('statsGrid');
    if (!el) return;
    el.innerHTML =
        '<div class="stat-card">' +
            '<div class="stat-card-header"><div class="stat-card-label">총 응답 수</div>' +
            '<div class="stat-card-icon" style="background:#EEF2FF;color:#4F46E5;"><i class="fa-solid fa-clipboard-list"></i></div></div>' +
            '<div class="stat-card-value">' + total.toLocaleString() + '</div>' +
            '<div class="stat-card-sub">누적 평가 건수</div>' +
        '</div>' +
        '<div class="stat-card">' +
            '<div class="stat-card-header"><div class="stat-card-label">평가된 강사 수</div>' +
            '<div class="stat-card-icon" style="background:#D1FAE5;color:#059669;"><i class="fa-solid fa-chalkboard-teacher"></i></div></div>' +
            '<div class="stat-card-value">' + teachers.length + '</div>' +
            '<div class="stat-card-sub">고유 강사 수</div>' +
        '</div>' +
        '<div class="stat-card">' +
            '<div class="stat-card-header"><div class="stat-card-label">전체 평균</div>' +
            '<div class="stat-card-icon" style="background:#FEF3C7;color:#D97706;"><i class="fa-solid fa-star"></i></div></div>' +
            '<div class="stat-card-value">' + globalAvg + '</div>' +
            '<div class="stat-card-sub">5점 만점</div>' +
        '</div>' +
        '<div class="stat-card">' +
            '<div class="stat-card-header"><div class="stat-card-label">오늘 응답</div>' +
            '<div class="stat-card-icon" style="background:#FCE7F3;color:#DB2777;"><i class="fa-solid fa-calendar-day"></i></div></div>' +
            '<div class="stat-card-value">' + todayCount + '</div>' +
            '<div class="stat-card-sub">금일 제출 건수</div>' +
        '</div>';
}

function renderGradeChart() {
    var counts = {0:0, 1:0, 2:0, 3:0};
    allResponses.forEach(function(r) {
        var g = (r.grade === 0 || r.grade === '0') ? 0 : parseInt(r.grade);
        if (counts[g] !== undefined) counts[g]++;
    });
    var canvas = document.getElementById('chartGrade');
    if (!canvas) return;
    if (gradeChartInst) { gradeChartInst.destroy(); gradeChartInst = null; }
    gradeChartInst = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['중3','고1','고2','고3'],
            datasets: [{ data: [counts[0],counts[1],counts[2],counts[3]], backgroundColor: ['#F59E0B','#6366F1','#0EA5E9','#10B981'], borderWidth:0, hoverOffset:6 }]
        },
        options: { responsive:true, maintainAspectRatio:false, cutout:'65%',
            plugins:{ legend:{ position:'bottom', labels:{ font:{ family:'Noto Sans KR', size:13 }, padding:16 } } }
        }
    });
}

function renderCategoryChart() {
    // 강사 유형별로 올바른 카테고리 항목만 집계
    var catAccum = {}; // { catName: { sum, count } }
    allResponses.forEach(function(r) {
        var qType  = getQTypeForTeacher(r.teacher, r.subject, r.grade);
        var catMap = getCategoriesByType(qType);
        Object.keys(catMap).forEach(function(cat) {
            if (!catAccum[cat]) catAccum[cat] = { sum: 0, count: 0 };
            catMap[cat].forEach(function(qId) {
                var v = parseFloat(r[qId]);
                if (!isNaN(v) && v > 0) { catAccum[cat].sum += v; catAccum[cat].count++; }
            });
        });
    });
    // 표시할 카테고리 순서 (일반·jang·runtrun 통합)
    var catOrder = ['📣 강의 및 전달력','📋 학습 관리·피드백','🌟 태도 및 분위기','📈 수업 효과·성장','🔬 런투런 관리'];
    var catAvgs = {};
    catOrder.forEach(function(cat) {
        if (catAccum[cat] && catAccum[cat].count > 0)
            catAvgs[cat] = parseFloat((catAccum[cat].sum / catAccum[cat].count).toFixed(2));
    });
    var canvas = document.getElementById('chartCategory');
    if (!canvas) return;
    if (categoryChartInst) { categoryChartInst.destroy(); categoryChartInst = null; }
    categoryChartInst = new Chart(canvas.getContext('2d'), {
        type: 'radar',
        data: {
            labels: Object.keys(catAvgs),
            datasets: [{ label:'전체 평균', data: Object.values(catAvgs),
                backgroundColor:'rgba(79,70,229,0.15)', borderColor:'#4F46E5', borderWidth:2,
                pointBackgroundColor:'#4F46E5', pointRadius:5 }]
        },
        options: { responsive:true, maintainAspectRatio:false,
            scales:{ r:{ min:1, max:5, ticks:{ stepSize:1, backdropColor:'transparent' },
                grid:{ color:'rgba(0,0,0,0.06)' }, pointLabels:{ font:{ family:'Noto Sans KR', size:12 } } } },
            plugins:{ legend:{ display:false } }
        }
    });
}

function buildTeacherAverages(data) {
    var map = {};
    data.forEach(function(r) {
        var key = r.teacher + '__' + r.subject + '__' + r.grade;
        if (!map[key]) map[key] = { teacher:r.teacher, subject:r.subject, grade:r.grade, scores:[], count:0 };
        var avg = parseFloat(r.average);
        if (!isNaN(avg) && avg > 0) { map[key].scores.push(avg); map[key].count++; }
    });
    Object.values(map).forEach(function(t) {
        t.avg = t.scores.length ? parseFloat((t.scores.reduce(function(a,b){return a+b;},0)/t.scores.length).toFixed(2)) : 0;
    });
    return map;
}

function renderTop5() {
    // 가중평균 기반 TOP5
    var map = {};
    allResponses.forEach(function(r) {
        var key = r.teacher + '__' + r.subject + '__' + r.grade;
        if (!map[key]) map[key] = { teacher:r.teacher, subject:r.subject, grade:r.grade, scores:[], count:0, monthSet:{} };
        var avg = parseFloat(r.average);
        if (!isNaN(avg) && avg > 0) { map[key].scores.push(avg); map[key].count++; }
        var mKey = (r.year||'?')+'-'+(r.month||'?');
        if (!map[key].monthSet[mKey]) map[key].monthSet[mKey] = { month:r.month, year:r.year, scores:[], count:0 };
        if (!isNaN(avg) && avg > 0) { map[key].monthSet[mKey].scores.push(avg); map[key].monthSet[mKey].count++; }
    });
    var list = Object.values(map).map(function(t) {
        var rawAvg = t.scores.length ? parseFloat((t.scores.reduce(function(a,b){return a+b;},0)/t.scores.length).toFixed(2)) : 0;
        var mEntries = Object.values(t.monthSet).filter(function(m){ return m.scores.length>0; });
        var wAvg;
        if (mEntries.length === 0) {
            wAvg = rawAvg;
        } else {
            var wSum = 0;
            mEntries.forEach(function(m) {
                var mRaw = parseFloat((m.scores.reduce(function(a,b){return a+b;},0)/m.scores.length).toFixed(2));
                wSum += getWeightedAvg(t.teacher, t.subject, t.grade, parseInt(m.month), parseInt(m.year||2026), mRaw, m.count);
            });
            wAvg = parseFloat((wSum/mEntries.length).toFixed(2));
        }
        return { teacher:t.teacher, subject:t.subject, grade:t.grade, avg:rawAvg, wAvg:wAvg, count:t.count, hasRoster:_hasRosterEntry(t.teacher, t.subject, t.grade) };
    }).sort(function(a,b){ return b.wAvg - a.wAvg; }).slice(0,5);

    var el = document.getElementById('top5Container');
    if (!el) return;
    if (list.length === 0) {
        el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-trophy"></i><p>응답 데이터가 없습니다.</p></div>'; return;
    }
    el.innerHTML = list.map(function(t,i){ return buildRankCard(t, i+1); }).join('');
}

function buildRankCard(t, rank) {
    var displayScore = (t.wAvg !== undefined) ? t.wAvg : t.avg;
    var rawScore     = t.avg;
    var barPct       = ((displayScore / 5) * 100).toFixed(1);
    var scoreColor   = displayScore >= 4.5 ? '#059669' : displayScore >= 3.5 ? '#4F46E5' : '#DC2626';
    var hasRoster    = t.hasRoster;

    // 가중평균 vs 실평균이 다를 때만 2줄 표시
    var scoreHtml;
    if (hasRoster && t.wAvg !== undefined && Math.abs(t.wAvg - t.avg) >= 0.01) {
        scoreHtml =
            '<div style="text-align:right;">' +
                '<div class="rank-score" style="color:' + scoreColor + '">' + displayScore + '</div>' +
                '<div style="font-size:10px;color:#94A3B8;margin-top:1px;">실 ' + rawScore + '</div>' +
            '</div>';
    } else {
        scoreHtml = '<div class="rank-score" style="color:' + scoreColor + '">' + displayScore + '</div>';
    }

    var rosterBadge = hasRoster
        ? ''
        : '<span style="font-size:9px;padding:1px 6px;background:#FEF3C7;color:#92400E;border-radius:9999px;font-weight:700;margin-left:4px;">명단없음</span>';

    return '<div class="teacher-rank-card">' +
        '<div class="rank-num ' + (rank <= 3 ? 'rank-' + rank : 'rank-other') + '">' + rank + '</div>' +
        '<div class="rank-info">' +
            '<div class="rank-name">' + t.teacher + ' 선생님' + rosterBadge + '</div>' +
            '<div class="rank-subject">' + t.subject + ' · ' + gradeLabel(t.grade) + '</div>' +
        '</div>' +
        '<div class="rank-bar-wrap"><div class="rank-bar"><div class="rank-bar-fill" style="width:' + barPct + '%"></div></div></div>' +
        scoreHtml +
        '<div class="rank-count">' + t.count + '명</div>' +
    '</div>';
}

// =================================================
//  강사 순위
// =================================================

/* 연도 변경 시 → 월 필터 재구성 후 순위 렌더 */
function onRankYearChange() {
    populateRankMonthFilter();
    renderRanking();
}

/* 선택된 연도 기준으로 월 필터 옵션 동적 생성 */
function populateRankMonthFilter() {
    var yearF = (document.getElementById('rankYearFilter') || {}).value || '';
    var sel   = document.getElementById('rankMonthFilter');
    if (!sel) return;
    var cur   = sel.value;
    var months = [];
    allResponses.forEach(function(r) {
        var ry = String(r.year || '');
        if (yearF && ry !== yearF) return;
        if (r.month && months.indexOf(r.month) === -1) months.push(r.month);
    });
    months.sort(function(a, b) { return a - b; });
    sel.innerHTML = '<option value="">전체 월</option>' +
        months.map(function(m) {
            return '<option value="' + m + '"' + (String(m) === cur ? ' selected' : '') + '>' + m + '월</option>';
        }).join('');
}

function renderRanking() {
    var yearF    = (document.getElementById('rankYearFilter')    || {}).value || '';
    var monthF   = (document.getElementById('rankMonthFilter')   || {}).value || '';
    var gradeF   = (document.getElementById('rankGradeFilter')   || {}).value || '';
    var subjectF = (document.getElementById('rankSubjectFilter') || {}).value || '';

    // 필터링
    var data = allResponses.filter(function(r) {
        var my = !yearF    || String(r.year  || '') === yearF;
        var mm = !monthF   || String(r.month || '') === monthF;
        var mg = !gradeF   || String(r.grade)        === gradeF;
        var ms = !subjectF || r.subject               === subjectF;
        return my && mm && mg && ms;
    });

    // 과목 필터 동적 업데이트
    updateSubjectFilter('rankSubjectFilter', allResponses.filter(function(r) {
        var my = !yearF  || String(r.year  || '') === yearF;
        var mm = !monthF || String(r.month || '') === monthF;
        var mg = !gradeF || String(r.grade)        === gradeF;
        return my && mm && mg;
    }), '');

    // 강사별 집계 (가중평균 포함)
    var map = {};
    data.forEach(function(r) {
        var key = r.teacher + '__' + r.subject + '__' + r.grade;
        if (!map[key]) map[key] = {
            teacher: r.teacher, subject: r.subject, grade: r.grade,
            scores: [], count: 0,
            monthSet: {}
        };
        var avg = parseFloat(r.average);
        if (!isNaN(avg) && avg > 0) {
            map[key].scores.push(avg);
            map[key].count++;
        }
        var mKey = (r.year || '?') + '-' + (r.month || '?');
        if (!map[key].monthSet[mKey]) map[key].monthSet[mKey] = { month: r.month, year: r.year, scores: [], count: 0 };
        if (!isNaN(avg) && avg > 0) {
            map[key].monthSet[mKey].scores.push(avg);
            map[key].monthSet[mKey].count++;
        }
    });

    // 가중평균 계산
    var list = Object.values(map).map(function(t) {
        var rawAvg = t.scores.length
            ? parseFloat((t.scores.reduce(function(a, b) { return a + b; }, 0) / t.scores.length).toFixed(2))
            : 0;

        var wAvg;
        if (monthF) {
            // 단일 월 필터: 해당 월 가중평균
            wAvg = getWeightedAvg(t.teacher, t.subject, t.grade, parseInt(monthF), parseInt(yearF || 2026), rawAvg, t.count);
        } else {
            // 전체/연도 필터: 월별 가중평균의 단순평균
            var mEntries = Object.values(t.monthSet).filter(function(m) { return m.scores.length > 0; });
            if (mEntries.length === 0) {
                wAvg = rawAvg;
            } else {
                var wSum = 0;
                mEntries.forEach(function(m) {
                    var mRaw = parseFloat((m.scores.reduce(function(a, b) { return a + b; }, 0) / m.scores.length).toFixed(2));
                    wSum += getWeightedAvg(t.teacher, t.subject, t.grade, parseInt(m.month), parseInt(m.year || 2026), mRaw, m.count);
                });
                wAvg = parseFloat((wSum / mEntries.length).toFixed(2));
            }
        }

        return {
            teacher: t.teacher, subject: t.subject, grade: t.grade,
            avg: rawAvg, wAvg: wAvg, count: t.count,
            hasRoster: _hasRosterEntry(t.teacher, t.subject, t.grade)
        };
    }).sort(function(a, b) { return b.wAvg - a.wAvg; });

    // 요약 배지
    var summaryBar = document.getElementById('rankingSummaryBar');
    if (summaryBar) {
        var label = (yearF ? yearF + '년 ' : '전체 ') + (monthF ? monthF + '월 ' : '');
        var overallWAvg = list.length
            ? parseFloat((list.reduce(function(s, t) { return s + t.wAvg; }, 0) / list.length).toFixed(2))
            : '-';
        summaryBar.innerHTML =
            '<span style="padding:4px 12px;background:#EEF2FF;border-radius:9999px;font-size:12px;font-weight:700;color:#4F46E5;">' +
                (label || '전체 ') + '· 강사 ' + list.length + '명' +
            '</span>' +
            '<span style="padding:4px 12px;background:#D1FAE5;border-radius:9999px;font-size:12px;font-weight:700;color:#059669;">' +
                '가중평균 ' + overallWAvg +
            '</span>' +
            '<span style="padding:4px 12px;background:#F1F5F9;border-radius:9999px;font-size:12px;color:#64748B;">' +
                '응답 ' + data.length + '건' +
            '</span>';
    }

    var el = document.getElementById('rankingContainer');
    if (!el) return;
    if (list.length === 0) {
        el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>해당 조건에 맞는 데이터가 없습니다.</p></div>';
        return;
    }
    el.innerHTML = list.map(function(t, i) { return buildRankCard(t, i + 1); }).join('');
}

/* roster 등록 여부 확인 헬퍼 */
function _hasRosterEntry(teacher, subject, grade) {
    for (var i = 0; i < rosterCache.length; i++) {
        var rv = rosterCache[i];
        if (rv.teacher === teacher && rv.subject === subject && String(rv.grade) === String(grade)) return true;
    }
    return false;
}

function updateSubjectFilter(selectId, data, gradeF) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    var cur = sel.value;
    // gradeF가 있는 경우만 필터, 빈 문자열이면 전체
    var filtered = (gradeF && gradeF !== '') ? data.filter(function(r){ return String(r.grade)===gradeF; }) : data;
    var subjects = [];
    filtered.forEach(function(r){ if (r.subject && subjects.indexOf(r.subject)===-1) subjects.push(r.subject); });
    subjects.sort();
    sel.innerHTML = '<option value="">전체 과목</option>' +
        subjects.map(function(s){ return '<option value="'+s+'"'+(s===cur?' selected':'')+'>'+s+'</option>'; }).join('');
}

// =================================================
//  강사별 상세
// =================================================
function loadDetailTeachers() {
    var gradeF = document.getElementById('detailGradeFilter').value;
    var data   = gradeF ? allResponses.filter(function(r){ return String(r.grade)===gradeF; }) : allResponses;
    var tSet = [];
    data.forEach(function(r) {
        var key = r.teacher+'|'+r.subject+'|'+r.grade;
        if (tSet.indexOf(key)===-1) tSet.push(key);
    });
    tSet.sort();
    var sel = document.getElementById('detailTeacherFilter');
    if (!sel) return;
    sel.innerHTML = '<option value="">강사 선택</option>' +
        tSet.map(function(t){
            var p = t.split('|');
            return '<option value="'+t+'">'+p[0]+' ('+p[1]+' · '+gradeLabel(p[2])+')</option>';
        }).join('');
    var dc = document.getElementById('detailContainer');
    if (dc) dc.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-tie"></i><p>강사를 선택하면 상세 분석이 표시됩니다.</p></div>';
}

function renderTeacherDetail() {
    var val = document.getElementById('detailTeacherFilter').value;
    if (!val) return;
    var parts = val.split('|'), name = parts[0], subject = parts[1], grade = parts[2];
    var data  = allResponses.filter(function(r){
        return r.teacher===name && r.subject===subject && String(r.grade)===grade;
    });
    if (data.length === 0) {
        document.getElementById('detailContainer').innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>응답 데이터가 없습니다.</p></div>';
        return;
    }

    // ── 강사 유형 파악 → 해당 유형의 카테고리만 사용 ──
    var qType   = getQTypeForTeacher(name, subject, grade);
    var catMap  = getCategoriesByType(qType);
    var allQIds = [];
    Object.values(catMap).forEach(function(ids){ allQIds = allQIds.concat(ids); });

    // 항목별 평균 계산
    var qAvgs = {};
    allQIds.forEach(function(qId) {
        var vals = data.map(function(r){ return parseFloat(r[qId]); }).filter(function(v){ return !isNaN(v) && v > 0; });
        qAvgs[qId] = vals.length ? (vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(2) : null;
    });

    // 카테고리별 평균 (해당 유형 항목만)
    var catAvgs = {};
    Object.keys(catMap).forEach(function(cat) {
        var vals = catMap[cat].map(function(q){ return parseFloat(qAvgs[q]); }).filter(function(v){ return !isNaN(v); });
        catAvgs[cat] = vals.length ? (vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(2) : '-';
    });

    var avgs    = data.map(function(r){ return parseFloat(r.average); }).filter(function(v){ return !isNaN(v) && v > 0; });
    var overall = avgs.length ? (avgs.reduce(function(a,b){return a+b;},0)/avgs.length).toFixed(2) : '-';
    var comments1 = data.map(function(r){ return r.comment1; }).filter(function(c){ return c&&c.trim(); });
    var comments2 = data.map(function(r){ return r.comment2; }).filter(function(c){ return c&&c.trim(); });

    // 유형 뱃지
    var qtypeBadge = qType === 'runtrun'
        ? '<span style="padding:3px 10px;background:#ECFDF5;color:#059669;border-radius:9999px;font-size:11px;font-weight:700;margin-left:8px;">🔬 런투런</span>'
        : qType === 'jang'
        ? '<span style="padding:3px 10px;background:#FFFBEB;color:#D97706;border-radius:9999px;font-size:11px;font-weight:700;margin-left:8px;">📋 인스터디 미진행</span>'
        : '<span style="padding:3px 10px;background:#EEF2FF;color:#4F46E5;border-radius:9999px;font-size:11px;font-weight:700;margin-left:8px;">📝 일반</span>';

    var headerBg = qType === 'runtrun' ? '#ECFDF5' : qType === 'jang' ? '#FFFBEB' : '#EEF2FF';
    var headerColor = qType === 'runtrun' ? '#059669' : qType === 'jang' ? '#D97706' : '#4F46E5';

    var html = '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:18px;background:'+headerBg+';border-radius:12px;">' +
        '<div style="flex:1;">' +
            '<div style="font-size:20px;font-weight:800;color:#1E293B;">'+name+' 선생님'+qtypeBadge+'</div>' +
            '<div style="font-size:13px;color:#64748B;margin-top:4px;">'+subject+' · '+gradeLabel(grade)+' · '+data.length+'명 평가</div>' +
        '</div>' +
        '<div style="text-align:center;">' +
            '<div style="font-size:32px;font-weight:800;color:'+headerColor+';">'+overall+'</div>' +
            '<div style="font-size:11px;color:#94A3B8;">종합 평균</div>' +
        '</div></div>';

    // 카테고리 카드 (해당 유형만)
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px;">';
    Object.keys(catAvgs).forEach(function(cat) {
        var v = parseFloat(catAvgs[cat]);
        var c = isNaN(v) ? '#94A3B8' : v>=4.5 ? '#059669' : v>=3.5 ? '#4F46E5' : '#DC2626';
        html += '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px;text-align:center;">' +
            '<div style="font-size:11px;color:#64748B;font-weight:600;margin-bottom:6px;">'+cat+'</div>' +
            '<div style="font-size:22px;font-weight:800;color:'+c+';">'+catAvgs[cat]+'</div></div>';
    });
    html += '</div>';

    // 항목별 차트 (해당 유형 항목만, 응답이 있는 것만)
    var validQs = allQIds.filter(function(q){ return qAvgs[q] != null; });
    html += '<div style="margin-bottom:20px;">' +
        '<div style="font-size:13px;font-weight:700;color:#64748B;margin-bottom:10px;">항목별 점수</div>' +
        (validQs.length > 0
            ? '<div style="position:relative;height:' + Math.max(200, validQs.length * 34) + 'px;"><canvas id="detailChart"></canvas></div>'
            : '<div style="text-align:center;padding:20px;color:#94A3B8;">응답 데이터가 없습니다.</div>') +
        '</div>';

    // 주관식 의견
    if (comments1.length || comments2.length) {
        html += '<div style="font-size:13px;font-weight:700;color:#64748B;margin-bottom:10px;">💬 주관식 의견</div>';
        if (comments1.length) {
            html += '<div style="margin-bottom:12px;"><div style="font-size:11px;color:#94A3B8;font-weight:600;margin-bottom:6px;">개선 사항</div>';
            comments1.forEach(function(c){ html += '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:6px;">'+c+'</div>'; });
            html += '</div>';
        }
        if (comments2.length) {
            html += '<div><div style="font-size:11px;color:#94A3B8;font-weight:600;margin-bottom:6px;">좋았던 점</div>';
            comments2.forEach(function(c){ html += '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:6px;">'+c+'</div>'; });
            html += '</div>';
        }
    }

    document.getElementById('detailContainer').innerHTML = html;

    // 차트 렌더링
    if (detailChartInst) { detailChartInst.destroy(); detailChartInst = null; }
    if (validQs.length > 0) {
        var dcCanvas = document.getElementById('detailChart');
        if (dcCanvas) {
            detailChartInst = new Chart(dcCanvas.getContext('2d'), {
                type:'bar',
                data:{
                    labels: validQs.map(function(q){ return Q_LABELS[q] || q; }),
                    datasets:[{ label:'평균 점수', data: validQs.map(function(q){ return parseFloat(qAvgs[q]); }),
                        backgroundColor: validQs.map(function(q){
                            var v=parseFloat(qAvgs[q]);
                            return v>=4.5?'rgba(16,185,129,0.75)':v>=3.5?'rgba(79,70,229,0.75)':'rgba(245,158,11,0.75)';
                        }), borderRadius:6, borderWidth:0 }]
                },
                options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
                    scales:{ x:{min:1,max:5,ticks:{stepSize:1}}, y:{ticks:{font:{family:'Noto Sans KR',size:11}}} },
                    plugins:{ legend:{display:false} }
                }
            });
        }
    }
}

// =================================================
//  응답 목록
// =================================================
function filterResponses() {
    var search = (document.getElementById('responseSearch').value||'').trim().toLowerCase();
    var gradeF = document.getElementById('responseGradeFilter').value;
    var monthF = document.getElementById('responseMonthFilter').value;
    filteredResps = allResponses.filter(function(r) {
        var mg = !gradeF  || String(r.grade)===gradeF;
        var mm = !monthF  || String(r.month)===monthF;
        var ms = !search  || (r.teacher||'').toLowerCase().indexOf(search)!==-1 || (r.subject||'').toLowerCase().indexOf(search)!==-1;
        return mg && mm && ms;
    });
    currentResponsePage = 1;
    renderResponseTable();
}

function populateMonthFilter() {
    var sel = document.getElementById('responseMonthFilter');
    if (!sel) return;
    var cur = sel.value, months = [];
    allResponses.forEach(function(r){ if (r.month && months.indexOf(r.month)===-1) months.push(r.month); });
    months.sort(function(a,b){ return a-b; });
    sel.innerHTML = '<option value="">전체 월</option>' +
        months.map(function(m){ return '<option value="'+m+'"'+(String(m)===cur?' selected':'')+'>'+m+'월</option>'; }).join('');
}

function renderResponseTable() {
    var start    = (currentResponsePage-1)*RESP_PAGE_SIZE;
    var pageData = filteredResps.slice(start, start+RESP_PAGE_SIZE);
    var tbody    = document.getElementById('responseTableBody');
    if (!tbody) return;
    if (pageData.length===0) {
        tbody.innerHTML = '<tr><td colspan="27"><div class="empty-state"><i class="fa-solid fa-inbox"></i><p>응답이 없습니다.</p></div></td></tr>';
    } else {
        tbody.innerHTML = pageData.map(function(r,i) {
            var rowNum   = start+i+1;
            var badgeCls = r.grade==1?'badge-1':r.grade==2?'badge-2':r.grade==3?'badge-3':'badge-0';
            var avg      = r.average||'-';
            var scoreCls = r.average>=4.5?'score-high':r.average>=3.5?'score-mid':'score-low';
            var dt       = r.timestamp ? new Date(r.timestamp).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-';
            var monthLbl = r.month ? '<span style="padding:3px 8px;background:#EEF2FF;border-radius:9999px;font-size:11px;font-weight:700;color:#4F46E5;">'+r.month+'월</span>' : '-';
            function cell(v){ return v!=null ? '<td>'+v+'</td>' : '<td style="color:#CBD5E1">-</td>'; }
            return '<tr>' +
                '<td style="color:#94A3B8;font-weight:600;">'+rowNum+'</td>' +
                '<td>'+monthLbl+'</td>' +
                '<td><span class="badge '+badgeCls+'">' + gradeLabel(r.grade) + '</span></td>' +
                '<td style="font-weight:700;">'+r.teacher+'</td>' +
                '<td>'+r.subject+'</td>' +
                '<td><span class="score-pill '+scoreCls+'">'+avg+'</span></td>' +
                cell(r.q1)+cell(r.q2)+cell(r.q3)+cell(r.q4)+cell(r.q5)+cell(r.q6)+cell(r.q7)+
                cell(r.q8)+cell(r.q9)+cell(r.q10)+cell(r.q11)+cell(r.q12)+cell(r.q13)+cell(r.q14)+
                cell(r.r1)+cell(r.r2)+cell(r.r3)+
                '<td style="font-size:11px;color:#94A3B8;">'+dt+'</td>' +
                '<td><div style="display:flex;gap:5px;">' +
                    '<button onclick="openDetailModal(\''+r.id+'\')" style="padding:5px 10px;background:#EEF2FF;border:none;border-radius:6px;font-size:12px;color:#4F46E5;font-weight:700;cursor:pointer;font-family:inherit;">상세</button>' +
                    '<button onclick="confirmDelete(\''+r.id+'\')" style="padding:5px 10px;background:#FEE2E2;border:none;border-radius:6px;font-size:12px;color:#DC2626;font-weight:700;cursor:pointer;font-family:inherit;">삭제</button>' +
                '</div></td>' +
            '</tr>';
        }).join('');
    }
    renderPagination();
}

function renderPagination() {
    var totalPages = Math.ceil(filteredResps.length/RESP_PAGE_SIZE);
    var pag = document.getElementById('responsePagination');
    if (!pag) return;
    if (totalPages<=1) { pag.innerHTML=''; return; }
    var html = '<button class="page-btn" onclick="changeResponsePage('+(currentResponsePage-1)+')"'+(currentResponsePage===1?' disabled':'')+'>‹</button>';
    for (var p=1; p<=totalPages; p++) {
        if (p===1||p===totalPages||Math.abs(p-currentResponsePage)<=2)
            html += '<button class="page-btn'+(p===currentResponsePage?' active':'')+'" onclick="changeResponsePage('+p+')">'+p+'</button>';
        else if (Math.abs(p-currentResponsePage)===3)
            html += '<span style="padding:0 4px;color:#94A3B8;">…</span>';
    }
    html += '<button class="page-btn" onclick="changeResponsePage('+(currentResponsePage+1)+')"'+(currentResponsePage===totalPages?' disabled':'')+'>›</button>';
    pag.innerHTML = html;
}

function changeResponsePage(page) {
    var totalPages = Math.ceil(filteredResps.length/RESP_PAGE_SIZE);
    if (page<1||page>totalPages) return;
    currentResponsePage = page;
    renderResponseTable();
}

// =================================================
//  상세 모달
// =================================================
function openDetailModal(id) {
    var r = null;
    for (var i=0; i<allResponses.length; i++) { if (allResponses[i].id===id){r=allResponses[i];break;} }
    if (!r) return;
    document.getElementById('modalTitle').textContent = r.teacher+' 선생님 · '+r.subject+' · '+gradeLabel(r.grade);
    var dt = r.timestamp ? new Date(r.timestamp).toLocaleString('ko-KR') : '-';

    // 강사 유형 파악 → 해당 유형 카테고리만 표시
    var qType  = getQTypeForTeacher(r.teacher, r.subject, r.grade);
    var catMap = getCategoriesByType(qType);

    var headerColor = qType === 'runtrun' ? '#0EA5E9' : '#4F46E5';
    var headerBg    = qType === 'runtrun' ? '#E0F2FE' : qType === 'jang' ? '#FFFBEB' : '#EEF2FF';

    var html = '<div style="display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap;">' +
        '<div style="background:'+headerBg+';border-radius:8px;padding:10px 16px;text-align:center;flex:1;min-width:80px;">' +
            '<div style="font-size:22px;font-weight:800;color:'+headerColor+';">'+(r.average||'-')+'</div>' +
            '<div style="font-size:11px;color:#94A3B8;">종합 평균</div></div>' +
        '<div style="background:#F1F5F9;border-radius:8px;padding:10px 16px;flex:3;font-size:12px;color:#64748B;line-height:1.7;">' +
            '<b>제출일시:</b> '+dt+'</div></div>';

    // 해당 유형 카테고리의 항목만 렌더링 (점수가 있는 항목만)
    Object.keys(catMap).forEach(function(cat) {
        var catColor = qType === 'runtrun' ? '#0EA5E9' : qType === 'jang' ? '#D97706' : '#4F46E5';
        var catBg    = qType === 'runtrun' ? '#E0F2FE' : qType === 'jang' ? '#FFFBEB' : '#EEF2FF';
        var hasScore = catMap[cat].some(function(qId){ return r[qId] != null; });
        if (!hasScore) return;
        html += '<div style="font-size:12px;font-weight:700;color:'+catColor+';background:'+catBg+';padding:8px 12px;border-radius:6px;margin:12px 0 4px;">'+cat+'</div>';
        catMap[cat].forEach(function(qId) {
            var score = r[qId];
            if (score == null) return;
            html += '<div class="modal-score-row">' +
                '<div class="modal-q-text">'+(Q_LABELS[qId]||qId)+'</div>' +
                '<div class="modal-q-score q-score-'+Math.round(score)+'">'+score+'</div></div>';
        });
    });

    if (r.comment1||r.comment2) {
        html += '<div style="font-size:12px;font-weight:700;color:#64748B;background:#F1F5F9;padding:8px 12px;border-radius:6px;margin:12px 0 8px;">💬 주관식 의견</div>';
        if (r.comment1) html += '<div style="margin-bottom:8px;"><div style="font-size:11px;color:#94A3B8;font-weight:600;margin-bottom:4px;">개선 사항</div><div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 14px;font-size:13px;">'+r.comment1+'</div></div>';
        if (r.comment2) html += '<div><div style="font-size:11px;color:#94A3B8;font-weight:600;margin-bottom:4px;">좋았던 점</div><div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 14px;font-size:13px;">'+r.comment2+'</div></div>';
    }
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('detailModal').classList.add('open');
}

function closeModal() {
    var m = document.getElementById('detailModal');
    if (m) m.classList.remove('open');
}

// =================================================
//  응답 삭제
// =================================================
function confirmDelete(id) {
    var r = null;
    for (var i=0;i<allResponses.length;i++){ if(allResponses[i].id===id){r=allResponses[i];break;} }
    if (!r) return;
    if (confirm('['+r.teacher+' 선생님 · '+r.subject+' · '+gradeLabel(r.grade)+'] 응답을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) deleteResponse(id);
}

async function deleteResponse(id) {
    try {
        var res = await fetch(API_BASE + '/survey_responses/'+id, { method:'DELETE' });
        if (res.ok || res.status===204) {
            allResponses  = allResponses.filter(function(r){ return r.id!==id; });
            filteredResps = filteredResps.filter(function(r){ return r.id!==id; });
            var totalPages = Math.ceil(filteredResps.length/RESP_PAGE_SIZE);
            if (currentResponsePage>totalPages && totalPages>0) currentResponsePage=totalPages;
            renderResponseTable(); renderStats();
        } else { alert('삭제에 실패했습니다.'); }
    } catch(err) { alert('오류가 발생했습니다.'); }
}

// =================================================
//  평가 월 관리
// =================================================
async function loadMonthSettings() {
    var container = document.getElementById('monthSettingsContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#64748B;"><i class="fa-solid fa-spinner fa-spin" style="font-size:20px;margin-bottom:8px;display:block;"></i>로딩 중...</div>';

    // 연도 선택 드롭다운에서 연도 읽기 (없으면 2026)
    var yearSel = document.getElementById('monthsYearFilter');
    var selectedYear = yearSel ? parseInt(yearSel.value) : 2026;

    try {
        var res  = await fetch(API_BASE + '/survey_settings?limit=200');
        var json = await res.json();
        var rows = extractRows(json);
        // 선택된 연도 필터링
        monthSettingsCache = rows.filter(function(s){
            return s && s.id && String(s.year) === String(selectedYear);
        }).sort(function(a,b){
            return (parseInt(a.month)||0)-(parseInt(b.month)||0);
        });
        renderMonthSettings();
    } catch(err) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:#EF4444;">데이터를 불러오지 못했습니다.<br><small>'+err.message+'</small></div>';
    }
}

function renderMonthSettings() {
    var container = document.getElementById('monthSettingsContainer');
    if (!container) return;
    if (!monthSettingsCache.length) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;">등록된 월 설정이 없습니다.</div>';
        return;
    }
    var monthCounts = {};
    allResponses.forEach(function(r) {
        if (r.month) { var k=(r.year||'?')+'-'+r.month; monthCounts[k]=(monthCounts[k]||0)+1; }
    });

    var html = '<div style="display:flex;flex-direction:column;gap:12px;">';
    monthSettingsCache.forEach(function(s) {
        var isActive = !!(s.is_active===true||s.is_active==='true'||s.is_active===1||s.is_active==='1');
        var isLocked = !!(s.is_locked===true||s.is_locked==='true'||s.is_locked===1||s.is_locked==='1');
        var count    = monthCounts[(s.year||'')+'-'+s.month] || 0;
        var badge, borderStyle;
        if (isActive) {
            badge = '<span style="padding:4px 12px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:9999px;font-size:12px;font-weight:700;color:#059669;">● 진행 중</span>';
            borderStyle = 'border:1px solid rgba(79,70,229,0.4);box-shadow:0 4px 12px rgba(79,70,229,0.1);';
        } else if (isLocked) {
            badge = '<span style="padding:4px 12px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:9999px;font-size:12px;font-weight:700;color:#94A3B8;">🔒 잠금</span>';
            borderStyle = 'border:1px solid #E2E8F0;';
        } else {
            badge = '<span style="padding:4px 12px;background:#FEF3C7;border:1px solid #FDE68A;border-radius:9999px;font-size:12px;font-weight:700;color:#92400E;">대기</span>';
            borderStyle = 'border:1px solid #E2E8F0;';
        }
        var sid = s.id;
        html += '<div style="display:flex;align-items:center;gap:16px;padding:16px 20px;background:white;border-radius:12px;'+borderStyle+'">' +
            '<div style="font-size:24px;flex-shrink:0;">'+(isActive?'📋':isLocked?'🔒':'📅')+'</div>' +
            '<div style="flex:1;">' +
                '<div style="font-size:16px;font-weight:800;color:#1E293B;">'+s.label+'</div>' +
                '<div style="font-size:12px;color:#94A3B8;margin-top:3px;">응답 수: <strong style="color:#4F46E5;">'+count+'건</strong></div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'+badge+
            '<div style="display:flex;gap:6px;">';
        if (!isActive && !isLocked)
            html += '<button onclick="setActiveMonth(\''+sid+'\')" style="padding:7px 14px;background:linear-gradient(135deg,#4F46E5,#6366F1);color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">▶ 활성화</button>';
        if (isActive)
            html += '<button onclick="deactivateMonth(\''+sid+'\')" style="padding:7px 14px;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">■ 비활성화</button>';
        if (!isLocked)
            html += '<button onclick="toggleLock(\''+sid+'\',true)" style="padding:7px 14px;background:#F1F5F9;color:#64748B;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">🔒 잠금</button>';
        else
            html += '<button onclick="toggleLock(\''+sid+'\',false)" style="padding:7px 14px;background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">🔓 잠금해제</button>';
        html += '</div></div></div>';
    });
    html += '</div>';
    html += '<div style="margin-top:16px;padding:14px 16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;font-size:12px;color:#64748B;line-height:1.8;">' +
        '<strong style="color:#1E293B;">💡 사용법</strong><br>' +
        '• <b>활성화</b>: 해당 월 설문 허용 · 설문 페이지 배너 표시<br>' +
        '• <b>비활성화</b>: 설문 마감 (배너 사라짐)<br>' +
        '• <b>잠금</b>: 완료된 월 실수 활성화 방지<br>' +
        '• 한 번에 <b>하나의 월</b>만 활성화하세요.</div>';
    container.innerHTML = html;
}

// ── PUT 헬퍼 ──
async function putSetting(id, fields) {
    // 캐시에서 찾기
    var cur = null;
    for (var i=0; i<monthSettingsCache.length; i++) {
        if (String(monthSettingsCache[i].id)===String(id)) { cur=monthSettingsCache[i]; break; }
    }
    if (!cur) throw new Error('ID='+id+' 를 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.');

    // is_active/is_locked 반드시 실제 boolean으로
    var payload = {
        month:     parseInt(cur.month),
        year:      parseInt(cur.year),
        label:     cur.label || (cur.year+'년 '+cur.month+'월'),
        is_active: fields.is_active !== undefined ? !!fields.is_active : !!(cur.is_active===true||cur.is_active==='true'||cur.is_active===1||cur.is_active==='1'),
        is_locked: fields.is_locked !== undefined ? !!fields.is_locked : !!(cur.is_locked===true||cur.is_locked==='true'||cur.is_locked===1||cur.is_locked==='1')
    };

    var res = await fetch(API_BASE + '/survey_settings/'+id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        var txt=''; try{ txt=await res.text(); }catch(e){}
        throw new Error('저장 실패 (HTTP '+res.status+'): '+txt);
    }
    var result = await res.json();
    return (result&&result.data&&result.data.id) ? result.data : result;
}

async function setActiveMonth(id) {
    if (!id) { alert('오류: 월 ID가 없습니다.'); return; }
    if (!confirm('이 월을 활성화하시겠습니까?\n현재 활성화된 월은 자동으로 비활성화됩니다.')) return;

    var container = document.getElementById('monthSettingsContainer');
    if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748B;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;display:block;margin-bottom:12px;"></i>처리 중...</div>';

    try {
        // 기존 활성 월 비활성화
        for (var i=0; i<monthSettingsCache.length; i++) {
            var s = monthSettingsCache[i];
            if ((s.is_active===true||s.is_active==='true'||s.is_active===1||s.is_active==='1') && String(s.id)!==String(id)) {
                await putSetting(s.id, { is_active: false });
            }
        }
        // 선택 월 활성화
        await putSetting(id, { is_active: true, is_locked: false });
        // 서버에서 최신 데이터로 다시 로드
        await loadMonthSettings();
        alert('✅ 활성화 완료! 설문 페이지에 배너가 표시됩니다.');
    } catch(err) {
        alert('❌ 오류: '+err.message);
        await loadMonthSettings();
    }
}

async function deactivateMonth(id) {
    if (!id) { alert('오류: 월 ID가 없습니다.'); return; }
    if (!confirm('이 월을 비활성화하시겠습니까?')) return;
    var container = document.getElementById('monthSettingsContainer');
    if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748B;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;display:block;margin-bottom:12px;"></i>처리 중...</div>';
    try {
        await putSetting(id, { is_active: false });
        await loadMonthSettings();
        alert('✅ 비활성화 완료.');
    } catch(err) {
        alert('❌ 오류: '+err.message);
        await loadMonthSettings();
    }
}

async function toggleLock(id, lockState) {
    if (!id) { alert('오류: 월 ID가 없습니다.'); return; }
    if (!confirm(lockState ? '이 월을 잠금하시겠습니까?' : '잠금을 해제하시겠습니까?')) return;
    var container = document.getElementById('monthSettingsContainer');
    if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748B;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;display:block;margin-bottom:12px;"></i>처리 중...</div>';
    try {
        await putSetting(id, { is_locked: lockState });
        await loadMonthSettings();
        alert(lockState ? '🔒 잠금 완료.' : '🔓 잠금 해제 완료.');
    } catch(err) {
        alert('❌ 오류: '+err.message);
        await loadMonthSettings();
    }
}

// =================================================
//  가중 평균
//  = (투표수 × 실평균 + 미투표수 × 3) / 총수강생
// =================================================
function getWeightedAvg(teacher, subject, grade, month, year, rawAvg, voteCount) {
    var roster = null;
    for (var i=0; i<rosterCache.length; i++) {
        var rv = rosterCache[i];
        if (rv.teacher===teacher && rv.subject===subject &&
            String(rv.grade)===String(grade) &&
            String(rv.month)===String(month) &&
            String(rv.year) ===String(year)) { roster=rv; break; }
    }
    if (!roster || !roster.total_students || parseInt(roster.total_students)<=0) return rawAvg;
    var total    = parseInt(roster.total_students);
    var voted    = Math.min(voteCount, total);
    var notVoted = Math.max(0, total-voted);
    return parseFloat(((voted*rawAvg + notVoted*3) / total).toFixed(2));
}

// =================================================
//  월별 통계
// =================================================
function initMonthlyTab() {
    // 월 선택자를 실제 응답 데이터 기준으로 동적 생성
    var yearSel = document.getElementById('monthlyYearFilter');
    var yearVal = yearSel ? yearSel.value : '2026';
    var sel = document.getElementById('monthlyMonthFilter');
    if (sel) {
        var cur = sel.value;
        var months = [];
        allResponses.forEach(function(r) {
            if (String(r.year || 2026) === String(yearVal) && r.month && months.indexOf(r.month) === -1) months.push(r.month);
        });
        months.sort(function(a,b){ return a-b; });
        sel.innerHTML = '<option value="">\uc6d4 \uc120\ud0dd</option>' +
            months.map(function(m){ return '<option value="'+m+'"'+(String(m)===cur?' selected':'')+'>'+m+'\uc6d4</option>'; }).join('');
    }
    if (sel && sel.value) renderMonthlyStats();
    else {
        var c = document.getElementById('monthlyStatsContainer');
        if (c) c.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;"><i class="fa-solid fa-chart-column" style="font-size:32px;display:block;margin-bottom:12px;"></i>\uc6d4\uc744 \uc120\ud0dd\ud574\uc8fc\uc138\uc694.</div>';
    }
}

function renderMonthlyStats() {
    var monthVal = (document.getElementById('monthlyMonthFilter')||{}).value;
    var gradeVal = (document.getElementById('monthlyGradeFilter')||{}).value;
    var container = document.getElementById('monthlyStatsContainer');
    if (!container) return;
    if (!monthVal) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;"><i class="fa-solid fa-chart-column" style="font-size:32px;display:block;margin-bottom:12px;"></i>월을 선택해주세요.</div>';
        return;
    }
    var month = parseInt(monthVal);
    var yearSel2 = document.getElementById('monthlyYearFilter');
    var year = yearSel2 ? parseInt(yearSel2.value) || 2026 : 2026;
    var data = allResponses.filter(function(r) {
        return String(r.month)===String(month) && String(r.year||2026)===String(year) && (!gradeVal || String(r.grade)===gradeVal);
    });
    if (data.length===0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;"><i class="fa-solid fa-inbox" style="font-size:32px;display:block;margin-bottom:12px;"></i>'+month+'월 응답 데이터가 없습니다.</div>';
        return;
    }
    var teacherMap = {};
    data.forEach(function(r) {
        var key = r.teacher+'|'+r.subject+'|'+r.grade;
        if (!teacherMap[key]) teacherMap[key]={teacher:r.teacher,subject:r.subject,grade:r.grade,scores:[],count:0};
        var avg = parseFloat(r.average);
        if (!isNaN(avg)&&avg>0) { teacherMap[key].scores.push(avg); teacherMap[key].count++; }
    });
    var teachers = Object.values(teacherMap).map(function(t) {
        var rawAvg = t.scores.length ? parseFloat((t.scores.reduce(function(a,b){return a+b;},0)/t.scores.length).toFixed(2)) : 0;
        var wAvg   = getWeightedAvg(t.teacher, t.subject, t.grade, month, year, rawAvg, t.count);
        return { teacher:t.teacher, subject:t.subject, grade:t.grade, rawAvg:rawAvg, wAvg:wAvg, count:t.count };
    }).sort(function(a,b){ return b.wAvg-a.wAvg; });

    var overallAvg = teachers.length ? (teachers.map(function(t){return t.wAvg;}).reduce(function(a,b){return a+b;},0)/teachers.length).toFixed(2) : '-';

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:24px;">' +
        '<div style="background:#EEF2FF;border-radius:12px;padding:16px 20px;"><div style="font-size:12px;color:#6366F1;font-weight:700;margin-bottom:6px;">총 응답 수</div><div style="font-size:28px;font-weight:800;color:#4F46E5;">'+data.length+'</div></div>' +
        '<div style="background:#D1FAE5;border-radius:12px;padding:16px 20px;"><div style="font-size:12px;color:#059669;font-weight:700;margin-bottom:6px;">평가된 강사 수</div><div style="font-size:28px;font-weight:800;color:#059669;">'+teachers.length+'</div></div>' +
        '<div style="background:#FEF3C7;border-radius:12px;padding:16px 20px;"><div style="font-size:12px;color:#D97706;font-weight:700;margin-bottom:6px;">전체 가중 평균</div><div style="font-size:28px;font-weight:800;color:#D97706;">'+overallAvg+'</div></div>' +
    '</div>';

    html += '<div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:700;color:#1E293B;margin-bottom:12px;">'+month+'월 강사별 평균 <span style="font-size:12px;color:#94A3B8;font-weight:400;">(수강생 수 입력 시 가중평균 적용)</span></div>';
    html += '<div style="position:relative;height:'+Math.max(300,teachers.length*44)+'px;"><canvas id="monthlyBarChart"></canvas></div></div>';

    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="background:#F8FAFC;">' +
        '<th style="padding:10px 12px;text-align:left;font-weight:700;color:#64748B;border-bottom:2px solid #E2E8F0;white-space:nowrap;">순위</th>' +
        '<th style="padding:10px 12px;text-align:left;font-weight:700;color:#64748B;border-bottom:2px solid #E2E8F0;white-space:nowrap;">강사</th>' +
        '<th style="padding:10px 12px;text-align:left;font-weight:700;color:#64748B;border-bottom:2px solid #E2E8F0;white-space:nowrap;">과목·학년</th>' +
        '<th style="padding:10px 12px;text-align:center;font-weight:700;color:#64748B;border-bottom:2px solid #E2E8F0;white-space:nowrap;">응답 수</th>' +
        '<th style="padding:10px 12px;text-align:center;font-weight:700;color:#64748B;border-bottom:2px solid #E2E8F0;white-space:nowrap;">수강생 수</th>' +
        '<th style="padding:10px 12px;text-align:center;font-weight:700;color:#64748B;border-bottom:2px solid #E2E8F0;white-space:nowrap;">일반 평균</th>' +
        '<th style="padding:10px 12px;text-align:center;font-weight:700;color:#64748B;border-bottom:2px solid #E2E8F0;white-space:nowrap;">가중 평균</th>' +
        '<th style="padding:10px 12px;text-align:center;font-weight:700;color:#64748B;border-bottom:2px solid #E2E8F0;white-space:nowrap;">수강생 수 입력</th>' +
        '</tr></thead><tbody>';

    teachers.forEach(function(t, i) {
        var rosterEntry = null;
        for (var ri=0; ri<rosterCache.length; ri++) {
            var rv=rosterCache[ri];
            if (rv.teacher===t.teacher&&rv.subject===t.subject&&String(rv.grade)===String(t.grade)&&String(rv.month)===String(month)&&String(rv.year)===String(year)) { rosterEntry=rv; break; }
        }
        var totalStu = rosterEntry ? rosterEntry.total_students : '-';
        var scoreColor = t.wAvg>=4.5?'#059669':t.wAvg>=3.5?'#4F46E5':'#DC2626';
        html += '<tr style="background:'+(i%2===0?'white':'#F8FAFC')+';border-bottom:1px solid #F1F5F9;">' +
            '<td style="padding:10px 12px;font-weight:700;color:#94A3B8;">'+(i+1)+'</td>' +
            '<td style="padding:10px 12px;font-weight:700;color:#1E293B;">'+t.teacher+' 선생님</td>' +
            '<td style="padding:10px 12px;color:#64748B;">'+t.subject+' · '+gradeLabel(t.grade)+'</td>' +
            '<td style="padding:10px 12px;text-align:center;">'+t.count+'명</td>' +
            '<td style="padding:10px 12px;text-align:center;" id="stuCell-'+i+'">'+totalStu+'명</td>' +
            '<td style="padding:10px 12px;text-align:center;color:#64748B;">'+t.rawAvg+'</td>' +
            '<td style="padding:10px 12px;text-align:center;font-weight:700;color:'+scoreColor+';">'+t.wAvg+'</td>' +
            '<td style="padding:10px 12px;">' +
                '<div style="display:flex;gap:6px;align-items:center;justify-content:center;">' +
                    '<input type="number" min="1" max="999" placeholder="명수 입력" ' +
                    'id="rosterInput-'+i+'" '+
                    (rosterEntry?'data-roster-id="'+rosterEntry.id+'"':'')+' '+
                    'data-teacher="'+t.teacher+'" data-subject="'+t.subject+'" data-grade="'+t.grade+'" ' +
                    'data-month="'+month+'" data-year="'+year+'" ' +
                    'value="'+(rosterEntry?rosterEntry.total_students:'')+'" '+
                    'style="width:90px;padding:6px 8px;border:1.5px solid #E2E8F0;border-radius:6px;font-size:13px;font-family:inherit;text-align:center;">' +
                    '<button onclick="saveRoster('+i+')" style="padding:6px 12px;background:#4F46E5;color:white;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">저장</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;

    setTimeout(function() {
        var canvas = document.getElementById('monthlyBarChart');
        if (!canvas) return;
        if (monthlyChartInst) { monthlyChartInst.destroy(); monthlyChartInst = null; }
        monthlyChartInst = new Chart(canvas.getContext('2d'), {
            type:'bar',
            data:{
                labels: teachers.map(function(t){ return t.teacher+'('+t.subject+')'; }),
                datasets:[
                    { label:'가중 평균', data:teachers.map(function(t){return t.wAvg;}),
                      backgroundColor:teachers.map(function(t){ return t.wAvg>=4.5?'rgba(16,185,129,0.8)':t.wAvg>=3.5?'rgba(79,70,229,0.8)':'rgba(239,68,68,0.8)'; }),
                      borderRadius:5, borderWidth:0 },
                    { label:'일반 평균', data:teachers.map(function(t){return t.rawAvg;}),
                      backgroundColor:'rgba(148,163,184,0.4)', borderRadius:5, borderWidth:0 }
                ]
            },
            options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
                scales:{ x:{min:1,max:5,ticks:{stepSize:1}}, y:{ticks:{font:{family:'Noto Sans KR',size:12}}} },
                plugins:{ legend:{position:'top',labels:{font:{family:'Noto Sans KR',size:12}}} }
            }
        });
    }, 100);
}

async function saveRoster(idx) {
    var input = document.getElementById('rosterInput-'+idx);
    if (!input) return;
    var val = parseInt(input.value);
    if (!val||val<1) { alert('올바른 수강생 수를 입력해주세요.'); return; }
    var teacher  = input.getAttribute('data-teacher');
    var subject  = input.getAttribute('data-subject');
    var grade    = parseInt(input.getAttribute('data-grade'));
    var month    = parseInt(input.getAttribute('data-month'));
    var year     = parseInt(input.getAttribute('data-year'));
    var rosterId = input.getAttribute('data-roster-id');
    try {
        var payload = { teacher:teacher, subject:subject, grade:grade, month:month, year:year, total_students:val };
        var res;
        if (rosterId) {
            res = await fetch(API_BASE + '/teacher_roster/'+rosterId, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
        } else {
            res = await fetch(API_BASE + '/teacher_roster', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
        }
        if (!res.ok) throw new Error('저장 실패 ('+res.status+')');
        var json = await res.json();
        var saved = (json&&json.data&&json.data.id) ? json.data : json;
        if (rosterId) {
            for (var i=0;i<rosterCache.length;i++){ if(String(rosterCache[i].id)===String(rosterId)){rosterCache[i]=saved;break;} }
        } else {
            rosterCache.push(saved);
            if (saved&&saved.id) input.setAttribute('data-roster-id', saved.id);
        }
        alert('✅ 수강생 수 ('+val+'명) 저장 완료!');
        renderMonthlyStats();
    } catch(err) { alert('❌ 저장 오류: '+err.message); }
}

// =================================================
//  강사별 추이
// =================================================
function initTrendTab() {
    loadTrendTeachers();
}

function loadTrendTeachers() {
    var gradeF = (document.getElementById('trendGradeFilter')||{}).value;
    var data   = gradeF ? allResponses.filter(function(r){ return String(r.grade)===gradeF; }) : allResponses;
    var tSet   = [];
    data.forEach(function(r) {
        var key = r.teacher+'|'+r.subject+'|'+r.grade;
        if (tSet.indexOf(key)===-1) tSet.push(key);
    });
    tSet.sort();
    var sel = document.getElementById('trendTeacherFilter');
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML = '<option value="">강사 선택</option>' +
        tSet.map(function(t){ var p=t.split('|'); return '<option value="'+t+'"'+(t===prev?' selected':'')+'>'+p[0]+' ('+p[1]+' · '+gradeLabel(p[2])+')</option>'; }).join('');
    if (prev && tSet.indexOf(prev)!==-1) renderTrendChart();
    else {
        var tc = document.getElementById('trendContainer');
        if (tc) tc.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;"><i class="fa-solid fa-chart-line" style="font-size:32px;display:block;margin-bottom:12px;"></i>강사를 선택해주세요.</div>';
    }
}

function renderTrendChart() {
    var val = (document.getElementById('trendTeacherFilter')||{}).value;
    var tc  = document.getElementById('trendContainer');
    if (!tc) return;
    if (!val) {
        tc.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;"><i class="fa-solid fa-chart-line" style="font-size:32px;display:block;margin-bottom:12px;"></i>강사를 선택해주세요.</div>';
        return;
    }
    var parts   = val.split('|'), teacher=parts[0], subject=parts[1], grade=parts[2];
    var data    = allResponses.filter(function(r){ return r.teacher===teacher&&r.subject===subject&&String(r.grade)===grade&&r.month; });
    if (data.length===0) {
        tc.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;"><i class="fa-solid fa-inbox" style="font-size:32px;display:block;margin-bottom:12px;"></i>응답 데이터가 없습니다.</div>';
        return;
    }
    // 강사 유형 파악 → 해당 유형의 카테고리/항목만 집계
    var qType  = getQTypeForTeacher(teacher, subject, grade);
    var catMap = getCategoriesByType(qType);

    var monthMap = {};
    data.forEach(function(r) {
        var m = parseInt(r.month);
        if (!monthMap[m]) monthMap[m]={scores:[],count:0,catScores:{}};
        var avg = parseFloat(r.average);
        if (!isNaN(avg)&&avg>0) { monthMap[m].scores.push(avg); monthMap[m].count++; }
        // 해당 강사 유형의 카테고리 항목만 집계
        Object.keys(catMap).forEach(function(cat) {
            if (!monthMap[m].catScores[cat]) monthMap[m].catScores[cat]=[];
            catMap[cat].forEach(function(qId) {
                var v=parseFloat(r[qId]); if(!isNaN(v)&&v>0) monthMap[m].catScores[cat].push(v);
            });
        });
    });
    var months  = Object.keys(monthMap).map(Number).sort(function(a,b){return a-b;});
    // 해당 강사의 응답 데이터에서 연도 추출 (없으면 2026)
    var yearSet = {};
    data.forEach(function(r){ if(r.year) yearSet[r.year]=true; });
    var yearKeys = Object.keys(yearSet).map(Number).sort();
    var year = yearKeys.length === 1 ? yearKeys[0] : 2026;
    var labels  = months.map(function(m){ return m+'월'; });
    var rawData = months.map(function(m) {
        var mm=monthMap[m];
        return mm.scores.length ? parseFloat((mm.scores.reduce(function(a,b){return a+b;},0)/mm.scores.length).toFixed(2)) : 0;
    });
    var avgData = months.map(function(m,mi) {
        return getWeightedAvg(teacher, subject, parseInt(grade), m, year, rawData[mi], monthMap[m].count);
    });
    var catColors = ['#4F46E5','#10B981','#F59E0B','#EF4444','#0EA5E9'];
    var catDatasets = Object.keys(catMap).map(function(cat,ci) {
        return {
            label:cat, data: months.map(function(m){ var vals=monthMap[m].catScores[cat]||[]; return vals.length?parseFloat((vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(2)):null; }),
            borderColor:catColors[ci%catColors.length], backgroundColor:catColors[ci%catColors.length]+'22',
            borderWidth:1.5, pointRadius:4, fill:false, borderDash:[4,3]
        };
    });

    // 강사 유형 뱃지
    var trendQtypeBadge = qType === 'runtrun'
        ? '<span style="padding:3px 10px;background:#ECFDF5;color:#059669;border-radius:9999px;font-size:11px;font-weight:700;margin-left:8px;">🔬 런투런</span>'
        : qType === 'jang'
        ? '<span style="padding:3px 10px;background:#FFFBEB;color:#D97706;border-radius:9999px;font-size:11px;font-weight:700;margin-left:8px;">📋 인스터디 미진행</span>'
        : '';
    var trendHeaderBg = qType === 'runtrun' ? '#ECFDF5' : qType === 'jang' ? '#FFFBEB' : '#EEF2FF';

    var html = '<div style="background:'+trendHeaderBg+';border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;">' +
        '<div style="font-size:18px;font-weight:800;color:#1E293B;">'+teacher+' 선생님'+trendQtypeBadge+'</div>' +
        '<div style="font-size:13px;color:#64748B;">'+subject+' · '+gradeLabel(grade)+'</div>' +
        '<div style="margin-left:auto;font-size:12px;color:#6366F1;background:white;padding:6px 12px;border-radius:8px;font-weight:700;">📊 '+months.length+'개월 데이터</div>' +
    '</div>';

    html += '<div style="display:flex;gap:10px;overflow-x:auto;margin-bottom:20px;padding-bottom:4px;">';
    months.forEach(function(m,mi) {
        var prev=mi>0?avgData[mi-1]:null, curr=avgData[mi];
        var diff=prev!==null?(curr-prev).toFixed(2):null;
        var arrow=diff===null?'':parseFloat(diff)>0?'<span style="color:#10B981;">▲ '+diff+'</span>':parseFloat(diff)<0?'<span style="color:#EF4444;">▼ '+Math.abs(diff)+'</span>':'<span style="color:#94A3B8;">—</span>';
        var bg=curr>=4.5?'#D1FAE5':curr>=3.5?'#EEF2FF':'#FEE2E2';
        var fc=curr>=4.5?'#059669':curr>=3.5?'#4F46E5':'#DC2626';
        html += '<div style="min-width:100px;background:'+bg+';border-radius:10px;padding:12px 14px;text-align:center;flex-shrink:0;">' +
            '<div style="font-size:12px;color:#64748B;font-weight:600;margin-bottom:4px;">'+m+'월</div>' +
            '<div style="font-size:22px;font-weight:800;color:'+fc+';">'+curr+'</div>' +
            '<div style="font-size:11px;margin-top:4px;">'+(arrow||'')+'</div>' +
            '<div style="font-size:10px;color:#94A3B8;margin-top:2px;">'+monthMap[m].count+'명</div>' +
        '</div>';
    });
    html += '</div>';
    html += '<div style="margin-bottom:24px;"><div style="font-size:13px;font-weight:700;color:#64748B;margin-bottom:10px;">📈 월별 종합 평균 추이 (가중평균)</div><div style="position:relative;height:280px;"><canvas id="trendLineChart"></canvas></div></div>';
    html += '<div><div style="font-size:13px;font-weight:700;color:#64748B;margin-bottom:10px;">📊 카테고리별 월별 추이</div><div style="position:relative;height:280px;"><canvas id="trendCatChart"></canvas></div></div>';
    tc.innerHTML = html;

    setTimeout(function() {
        var c1 = document.getElementById('trendLineChart');
        if (c1) {
            if (trendChartInst) { trendChartInst.destroy(); trendChartInst=null; }
            trendChartInst = new Chart(c1.getContext('2d'), {
                type:'line',
                data:{ labels:labels, datasets:[
                    { label:'가중 평균', data:avgData, borderColor:'#4F46E5', backgroundColor:'rgba(79,70,229,0.1)', borderWidth:3, pointRadius:6, fill:true, tension:0.3 },
                    { label:'일반 평균', data:rawData, borderColor:'#94A3B8', backgroundColor:'transparent', borderWidth:1.5, pointRadius:4, fill:false, tension:0.3, borderDash:[5,4] }
                ]},
                options:{ responsive:true, maintainAspectRatio:false,
                    scales:{ y:{min:1,max:5,ticks:{stepSize:0.5}}, x:{grid:{display:false}} },
                    plugins:{ legend:{position:'top',labels:{font:{family:'Noto Sans KR',size:12}}} }
                }
            });
        }
        var c2 = document.getElementById('trendCatChart');
        if (c2) {
            if (trendCatChartInst) { trendCatChartInst.destroy(); trendCatChartInst = null; }
            trendCatChartInst = new Chart(c2.getContext('2d'), {
                type:'line',
                data:{ labels:labels, datasets:catDatasets },
                options:{ responsive:true, maintainAspectRatio:false,
                    scales:{ y:{min:1,max:5,ticks:{stepSize:0.5}}, x:{grid:{display:false}} },
                    plugins:{ legend:{position:'top',labels:{font:{family:'Noto Sans KR',size:11},boxWidth:20}} }
                }
            });
        }
    }, 100);
}

// =================================================
//  연도별 월 일괄 생성
// =================================================
async function addYearMonths() {
    var yearSel = document.getElementById('monthsYearFilter');
    var year = yearSel ? parseInt(yearSel.value) : 2026;
    if (!confirm(year + '년 1~12월 설정을 생성하시겠습니까?\n이미 있는 월은 건너뜁니다.')) return;

    var container = document.getElementById('monthSettingsContainer');
    if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748B;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;display:block;margin-bottom:12px;"></i>생성 중...</div>';

    try {
        var res  = await fetch(API_BASE + '/survey_settings?limit=200');
        var json = await res.json();
        var rows = extractRows(json);
        var existMap = {};
        rows.forEach(function(r){ if (String(r.year)===String(year)) existMap[String(r.month)] = true; });

        var created = 0, skipped = 0;
        for (var m = 1; m <= 12; m++) {
            if (existMap[String(m)]) { skipped++; continue; }
            var r2 = await fetch(API_BASE + '/survey_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month: m, year: year, label: year+'년 '+m+'월', is_active: false, is_locked: false })
            });
            if (r2.ok) created++;
        }
        alert('✅ ' + year + '년 월 생성 완료\n생성: ' + created + '개 / 건너뜀: ' + skipped + '개');
        await loadMonthSettings();
    } catch(err) {
        alert('❌ 오류: ' + err.message);
        await loadMonthSettings();
    }
}

// =================================================
//  강사 관리
// =================================================
// teacherMasterCache는 상단 전역 변수로 이동됨

async function loadTeacherMaster() {
    var container = document.getElementById('teacherMasterContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#64748B;"><i class="fa-solid fa-spinner fa-spin" style="font-size:20px;display:block;margin-bottom:8px;"></i>로딩 중...</div>';

    var gradeF   = (document.getElementById('teacherGradeFilter')  || {}).value || '';
    var subjectF = (document.getElementById('teacherSubjectFilter') || {}).value || '';

    try {
        var res  = await fetch(API_BASE + '/teacher_master?limit=500');
        var json = await res.json();
        var rows = extractRows(json);
        teacherMasterCache = rows;

        // 과목 필터 옵션 동적 생성
        var subSel = document.getElementById('teacherSubjectFilter');
        if (subSel) {
            var curSub = subSel.value;
            var subjects = [];
            rows.forEach(function(r){ if (r.subject && subjects.indexOf(r.subject)===-1) subjects.push(r.subject); });
            subjects.sort();
            subSel.innerHTML = '<option value="">전체 과목</option>' +
                subjects.map(function(s){ return '<option value="'+s+'"'+(s===curSub?' selected':'')+'>'+s+'</option>'; }).join('');
        }

        var filtered = rows.filter(function(r) {
            var mg = !gradeF   || String(r.grade) === gradeF;
            var ms = !subjectF || r.subject === subjectF;
            return mg && ms;
        });
        renderTeacherMasterTable(filtered);
    } catch(err) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:#EF4444;">데이터를 불러오지 못했습니다.<br><small>'+err.message+'</small></div>';
    }
}

function renderTeacherMasterTable(list) {
    var container = document.getElementById('teacherMasterContainer');
    if (!container) return;
    if (!list || list.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;"><i class="fa-solid fa-user-slash" style="font-size:32px;display:block;margin-bottom:12px;"></i>등록된 강사가 없습니다.<br><small style="margin-top:8px;display:block;">상단 [+ 강사 추가] 버튼으로 추가하세요.</small></div>';
        return;
    }
    var byGrade = {};
    list.forEach(function(r){ var g = (r.grade === 0 || r.grade === '0') ? 0 : (parseInt(r.grade) || '?'); if(!byGrade[g]) byGrade[g]=[]; byGrade[g].push(r); });
    var qTypeLabel = { normal:'일반', jang:'인스터디 미진행', runtrun:'런투런' };
    var html = '';
    [1,2,3,0].forEach(function(g) {
        if (!byGrade[g] || byGrade[g].length===0) return;
        var gt = byGrade[g].sort(function(a,b){ return (a.subject||'').localeCompare(b.subject||''); });
        var gradeLabel = g===0 ? '중3' : '고'+g;
        var gradeFull  = g===0 ? '중학교 3학년' : '고등학교 '+g+'학년';
        html += '<div style="margin-bottom:28px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
            '<div style="width:32px;height:32px;background:linear-gradient(135deg,#4F46E5,#6366F1);border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:13px;">'+gradeLabel+'</div>' +
            '<div style="font-size:15px;font-weight:800;color:#1E293B;">'+gradeFull+'</div>' +
            '<div style="font-size:12px;color:#94A3B8;">'+gt.length+'명</div></div>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">';
        gt.forEach(function(t) {
            var act = t.is_active===true||t.is_active===1||t.is_active==='true'||t.is_active==='1';
            var ql  = qTypeLabel[t.question_type]||'일반';
            var qc  = t.question_type==='runtrun'?'#059669':t.question_type==='jang'?'#D97706':'#4F46E5';
            var qb  = t.question_type==='runtrun'?'#ECFDF5':t.question_type==='jang'?'#FFFBEB':'#EEF2FF';
            html += '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:'+(act?'white':'#F8FAFC')+';border:1px solid #E2E8F0;border-radius:10px;">' +
                '<div style="width:40px;height:40px;background:'+(act?'#EEF2FF':'#F1F5F9')+';border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">'+(act?'👨‍🏫':'👤')+'</div>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:14px;font-weight:800;color:'+(act?'#1E293B':'#94A3B8')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+t.name+' 선생님</div>' +
                    '<div style="font-size:12px;color:#64748B;margin-top:2px;">'+t.subject+'</div>' +
                    '<div style="margin-top:5px;display:flex;align-items:center;gap:6px;">' +
                        '<span style="font-size:10px;font-weight:700;padding:2px 8px;background:'+qb+';color:'+qc+';border-radius:9999px;">'+ql+'</span>' +
                        (!act?'<span style="font-size:10px;font-weight:700;padding:2px 8px;background:#FEE2E2;color:#DC2626;border-radius:9999px;">비활성</span>':'') +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:5px;">' +
                    '<button onclick="toggleTeacherActive(\''+t.id+'\','+(act?'false':'true')+')" style="padding:5px 10px;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;background:'+(act?'#FEE2E2':'#ECFDF5')+';color:'+(act?'#DC2626':'#059669')+';">'+(act?'비활성화':'활성화')+'</button>' +
                    '<button onclick="confirmDeleteTeacher(\''+t.id+'\',\''+t.name+'\',\''+t.subject+'\')" style="padding:5px 10px;background:#FEE2E2;color:#DC2626;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">삭제</button>' +
                '</div>' +
            '</div>';
        });
        html += '</div></div>';
    });
    container.innerHTML = html;
}

function openAddTeacherModal() {
    document.getElementById('newTeacherName').value    = '';
    document.getElementById('newTeacherSubject').value = '';
    document.getElementById('newGrade0').checked = false;
    document.getElementById('newGrade1').checked = false;
    document.getElementById('newGrade2').checked = false;
    document.getElementById('newGrade3').checked = false;
    document.getElementById('newTeacherQType').value = 'normal';
    document.getElementById('addTeacherError').style.display = 'none';
    [0,1,2,3].forEach(function(g){ toggleGradeLabel(g); });
    document.getElementById('addTeacherModal').style.display = 'flex';
}

function closeAddTeacherModal() {
    document.getElementById('addTeacherModal').style.display = 'none';
}

function toggleGradeLabel(g) {
    var cb    = document.getElementById('newGrade' + g);
    var label = document.getElementById('gradeLabel' + g);
    if (!cb || !label) return;
    if (cb.checked) {
        label.style.borderColor = '#4F46E5';
        label.style.background  = '#EEF2FF';
        label.style.color       = '#4F46E5';
    } else {
        label.style.borderColor = '#E2E8F0';
        label.style.background  = 'white';
        label.style.color       = '#1E293B';
    }
}

async function submitAddTeacher() {
    var name    = (document.getElementById('newTeacherName').value    || '').trim();
    var subject = (document.getElementById('newTeacherSubject').value || '').trim();
    var qType   = document.getElementById('newTeacherQType').value;
    var errEl   = document.getElementById('addTeacherError');
    var grades  = [0,1,2,3].filter(function(g){ return document.getElementById('newGrade'+g) && document.getElementById('newGrade'+g).checked; });

    if (!name)           { errEl.textContent='강사 이름을 입력하세요.';          errEl.style.display='block'; return; }
    if (!subject)        { errEl.textContent='담당 과목을 입력하세요.';          errEl.style.display='block'; return; }
    if (!grades.length)  { errEl.textContent='담당 학년을 하나 이상 선택하세요.'; errEl.style.display='block'; return; }
    errEl.style.display = 'none';

    var btn = document.querySelector('#addTeacherModal [onclick="submitAddTeacher()"]');
    if (btn) { btn.textContent='저장 중...'; btn.disabled=true; }

    try {
        // 순차 저장 (동시 요청 시 D1 충돌 방지)
        var savedGrades = [];
        for (var i = 0; i < grades.length; i++) {
            var g = grades[i];
            var res = await fetch(API_BASE + '/teacher_master', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ name:name, subject:subject, grade:g, question_type:qType, is_active:1, year:new Date().getFullYear() })
            });
            if (res.ok || res.status === 201) {
                savedGrades.push(g===0?'중3':'고'+g);
            }
        }
        if (savedGrades.length === grades.length) {
            closeAddTeacherModal();
            alert('✅ '+name+' 선생님 추가 완료! ('+savedGrades.join('/')+')');
            await loadTeacherMaster();
        } else {
            errEl.textContent='일부 학년 저장에 실패했습니다. 다시 시도해주세요.'; errEl.style.display='block';
        }
    } catch(err) {
        errEl.textContent='오류: '+err.message; errEl.style.display='block';
    } finally {
        if (btn) { btn.innerHTML='<i class="fa-solid fa-plus" style="margin-right:6px;"></i>추가하기'; btn.disabled=false; }
    }
}

async function toggleTeacherActive(id, newState) {
    if (!id) return;
    var active = (newState===true||newState==='true');
    var label  = active ? '활성화' : '비활성화';
    if (!confirm('이 강사를 '+label+'하시겠습니까?')) return;
    try {
        var cur = null;
        for (var i=0;i<teacherMasterCache.length;i++) { if(String(teacherMasterCache[i].id)===String(id)){cur=teacherMasterCache[i];break;} }
        if (!cur) { alert('데이터를 찾을 수 없습니다.'); return; }
        var payload = { name:cur.name, subject:cur.subject, grade:parseInt(cur.grade), question_type:cur.question_type||'normal', is_active:active, year:parseInt(cur.year)||2026 };
        var res = await fetch(API_BASE + '/teacher_master/'+id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
        if (!res.ok) throw new Error('HTTP '+res.status);
        alert('✅ '+label+' 완료!');
        await loadTeacherMaster();
    } catch(err) { alert('❌ 오류: '+err.message); }
}

async function confirmDeleteTeacher(id, name, subject) {
    if (!id) return;
    if (!confirm('⚠️ '+name+' 선생님 ('+subject+')을 삭제하시겠습니까?\n삭제 후에는 설문 페이지에서 해당 강사가 사라집니다.\n기존 응답 데이터는 유지됩니다.')) return;
    try {
        var res = await fetch(API_BASE + '/teacher_master/'+id, { method:'DELETE' });
        if (!res.ok && res.status!==204) throw new Error('HTTP '+res.status);
        alert('✅ 삭제 완료.');
        await loadTeacherMaster();
    } catch(err) { alert('❌ 삭제 오류: '+err.message); }
}
