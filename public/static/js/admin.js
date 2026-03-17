// =============================================
//  정율사관학원 관리자 패널 — 메인 로직
// =============================================

const API = '/api';
const gradeNames = { 0: '중3', 1: '고1', 2: '고2', 3: '고3' };
const gradeFullNames = { 0: '중학교 3학년', 1: '고등학교 1학년', 2: '고등학교 2학년', 3: '고등학교 3학년' };

// ── 탭 네비게이션 ──────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        // 탭 전환
        document.querySelectorAll('.nav-item[data-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + tab).classList.add('active');
        // 탭별 데이터 로드
        if (tab === 'dashboard') loadDashboard();
        if (tab === 'teachers')  loadTeachers();
        if (tab === 'periods')   loadPeriods();
        if (tab === 'results')   initStats();
        if (tab === 'comments')  initComments();
    });
});

// 페이지 로드 시 대시보드 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});

// ── 토스트 ──────────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
    const t = document.getElementById('toast-admin');
    t.textContent = msg;
    t.className = `toast-admin ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ── API 헬퍼 ────────────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
    const res = await fetch(API + path, opts);
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
    }
    return res.json();
}

// ── 대시보드 ────────────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const [responses, teachers, settings] = await Promise.all([
            apiFetch('/survey_responses?limit=1000'),
            apiFetch('/teacher_master?limit=500'),
            apiFetch('/survey_settings?limit=100')
        ]);

        // 통계
        document.getElementById('stat-total').textContent = responses.length;
        document.getElementById('stat-teachers').textContent = teachers.filter(t => t.is_active === 1 || t.is_active === true).length;

        const avgAll = responses.length > 0
            ? (responses.reduce((s, r) => s + (r.average || 0), 0) / responses.length).toFixed(2)
            : '-';
        document.getElementById('stat-avg').textContent = avgAll !== '-' ? avgAll + '점' : '-';

        const active = settings.find(s => s.is_active === 1 || s.is_active === true);
        document.getElementById('stat-period').textContent = active ? active.label : '없음';

        // 최근 응답
        const recent = responses.slice(0, 20);
        const tbody = document.getElementById('recentTbody');
        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">응답 데이터가 없습니다</td></tr>';
            return;
        }
        tbody.innerHTML = recent.map(r => `
            <tr>
                <td>${r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '-'}</td>
                <td>${gradeNames[r.grade] ?? r.grade}</td>
                <td><strong>${r.teacher}</strong></td>
                <td>${r.subject}</td>
                <td>${r.average ? '<span class="score-badge score-' + Math.round(r.average) + '">' + r.average + '</span>' : '-'}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('대시보드 로드 오류:', e);
        showToast('대시보드 로드 실패: ' + e.message, 'error');
    }
}

// ── 강사 관리 ───────────────────────────────────────────────────────────────────
async function loadTeachers() {
    const grade = document.getElementById('filterGrade')?.value ?? '';
    const url = '/teacher_master?limit=500' + (grade !== '' ? '&grade=' + grade : '');
    try {
        const data = await apiFetch(url);
        const tbody = document.getElementById('teachersTbody');
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">등록된 강사가 없습니다</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(t => `
            <tr>
                <td>${t.id}</td>
                <td><strong>${t.name}</strong></td>
                <td>${t.subject}</td>
                <td>${gradeFullNames[t.grade] ?? t.grade}</td>
                <td><span class="badge badge-${t.question_type}">${getQTypeLabel(t.question_type)}</span></td>
                <td><span class="badge ${t.is_active === 1 || t.is_active === true ? 'badge-active' : 'badge-inactive'}">${t.is_active === 1 || t.is_active === true ? '활성' : '비활성'}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" onclick="editTeacher(${t.id})">수정</button>
                        <button class="btn-toggle ${t.is_active ? 'deactivate' : ''}" onclick="toggleTeacher(${t.id}, ${t.is_active ? 0 : 1})">
                            ${t.is_active === 1 || t.is_active === true ? '비활성화' : '활성화'}
                        </button>
                        <button class="btn-danger" onclick="deleteTeacher(${t.id})">삭제</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        showToast('강사 목록 로드 실패', 'error');
    }
}

function getQTypeLabel(type) {
    if (type === 'jang')    return '장진민형';
    if (type === 'runtrun') return '런투런';
    return '일반';
}

function openAddTeacher() {
    document.getElementById('tf-id').value = '';
    document.getElementById('tf-name').value = '';
    document.getElementById('tf-subject').value = '';
    document.getElementById('tf-grade').value = '0';
    document.getElementById('tf-qtype').value = 'normal';
    document.getElementById('tf-active').value = '1';
    document.getElementById('teacherFormTitle').textContent = '강사 추가';
    document.getElementById('teacherFormCard').style.display = 'block';
    document.getElementById('teacherFormCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function editTeacher(id) {
    try {
        const t = await apiFetch('/teacher_master/' + id);
        document.getElementById('tf-id').value = t.id;
        document.getElementById('tf-name').value = t.name;
        document.getElementById('tf-subject').value = t.subject;
        document.getElementById('tf-grade').value = t.grade;
        document.getElementById('tf-qtype').value = t.question_type || 'normal';
        document.getElementById('tf-active').value = t.is_active ? '1' : '0';
        document.getElementById('teacherFormTitle').textContent = '강사 수정';
        document.getElementById('teacherFormCard').style.display = 'block';
        document.getElementById('teacherFormCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
        showToast('강사 정보 로드 실패', 'error');
    }
}

function closeTeacherForm() {
    document.getElementById('teacherFormCard').style.display = 'none';
}

async function saveTeacher() {
    const id      = document.getElementById('tf-id').value;
    const name    = document.getElementById('tf-name').value.trim();
    const subject = document.getElementById('tf-subject').value.trim();
    const grade   = parseInt(document.getElementById('tf-grade').value);
    const qtype   = document.getElementById('tf-qtype').value;
    const active  = parseInt(document.getElementById('tf-active').value);

    if (!name || !subject) { showToast('이름과 과목을 입력해주세요', 'error'); return; }

    try {
        if (id) {
            await apiFetch('/teacher_master/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, subject, grade, question_type: qtype, is_active: active })
            });
            showToast('강사 정보가 수정되었습니다', 'success');
        } else {
            await apiFetch('/teacher_master', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, subject, grade, question_type: qtype, is_active: active })
            });
            showToast('강사가 추가되었습니다', 'success');
        }
        closeTeacherForm();
        loadTeachers();
    } catch (e) {
        showToast('저장 실패: ' + e.message, 'error');
    }
}

async function toggleTeacher(id, newActive) {
    try {
        await apiFetch('/teacher_master/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: newActive })
        });
        showToast(newActive ? '강사가 활성화되었습니다' : '강사가 비활성화되었습니다', 'success');
        loadTeachers();
    } catch (e) {
        showToast('상태 변경 실패', 'error');
    }
}

async function deleteTeacher(id) {
    if (!confirm('이 강사를 삭제하시겠습니까?\n관련 응답 데이터는 유지됩니다.')) return;
    try {
        await apiFetch('/teacher_master/' + id, { method: 'DELETE' });
        showToast('강사가 삭제되었습니다', 'success');
        loadTeachers();
    } catch (e) {
        showToast('삭제 실패', 'error');
    }
}

// ── 평가 기간 관리 ───────────────────────────────────────────────────────────────
async function loadPeriods() {
    try {
        const data = await apiFetch('/survey_settings?limit=100');
        const tbody = document.getElementById('periodsTbody');
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">등록된 기간이 없습니다</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.id}</td>
                <td>${p.year}</td>
                <td>${p.month}월</td>
                <td><strong>${p.label}</strong></td>
                <td>
                    <span class="badge ${p.is_active === 1 || p.is_active === true ? 'badge-open' : 'badge-closed'}">
                        ${p.is_active === 1 || p.is_active === true ? '🟢 진행 중' : '⏸ 마감'}
                    </span>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" onclick="editPeriod(${p.id})">수정</button>
                        <button class="btn-toggle ${p.is_active ? 'deactivate' : ''}" onclick="togglePeriod(${p.id}, ${p.is_active ? 0 : 1})">
                            ${p.is_active === 1 || p.is_active === true ? '마감' : '활성화'}
                        </button>
                        <button class="btn-danger" onclick="deletePeriod(${p.id})">삭제</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        showToast('기간 목록 로드 실패', 'error');
    }
}

function openAddPeriod() {
    const now = new Date();
    document.getElementById('pf-id').value = '';
    document.getElementById('pf-year').value = now.getFullYear();
    document.getElementById('pf-month').value = now.getMonth() + 1;
    document.getElementById('pf-label').value = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
    document.getElementById('pf-active').value = '0';
    document.getElementById('periodFormTitle').textContent = '기간 추가';
    document.getElementById('periodFormCard').style.display = 'block';
    document.getElementById('periodFormCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function editPeriod(id) {
    try {
        const data = await apiFetch('/survey_settings?limit=100');
        const p = data.find(x => x.id === id);
        if (!p) { showToast('데이터를 찾을 수 없습니다', 'error'); return; }
        document.getElementById('pf-id').value = p.id;
        document.getElementById('pf-year').value = p.year;
        document.getElementById('pf-month').value = p.month;
        document.getElementById('pf-label').value = p.label;
        document.getElementById('pf-active').value = p.is_active ? '1' : '0';
        document.getElementById('periodFormTitle').textContent = '기간 수정';
        document.getElementById('periodFormCard').style.display = 'block';
        document.getElementById('periodFormCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
        showToast('데이터 로드 실패', 'error');
    }
}

function closePeriodForm() {
    document.getElementById('periodFormCard').style.display = 'none';
}

async function savePeriod() {
    const id    = document.getElementById('pf-id').value;
    const year  = parseInt(document.getElementById('pf-year').value);
    const month = parseInt(document.getElementById('pf-month').value);
    const label = document.getElementById('pf-label').value.trim();
    const is_active = parseInt(document.getElementById('pf-active').value);

    if (!year || !month || !label) { showToast('연도, 월, 레이블을 모두 입력해주세요', 'error'); return; }

    try {
        if (id) {
            await apiFetch('/survey_settings/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year, month, label, is_active })
            });
            showToast('기간이 수정되었습니다', 'success');
        } else {
            await apiFetch('/survey_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year, month, label, is_active })
            });
            showToast('기간이 추가되었습니다', 'success');
        }
        closePeriodForm();
        loadPeriods();
    } catch (e) {
        showToast('저장 실패: ' + e.message, 'error');
    }
}

async function togglePeriod(id, newActive) {
    try {
        await apiFetch('/survey_settings/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: newActive })
        });
        showToast(newActive ? '평가 기간이 활성화되었습니다' : '평가 기간이 마감되었습니다', 'success');
        loadPeriods();
    } catch (e) {
        showToast('상태 변경 실패', 'error');
    }
}

async function deletePeriod(id) {
    if (!confirm('이 평가 기간을 삭제하시겠습니까?')) return;
    try {
        await apiFetch('/survey_settings/' + id, { method: 'DELETE' });
        showToast('기간이 삭제되었습니다', 'success');
        loadPeriods();
    } catch (e) {
        showToast('삭제 실패', 'error');
    }
}

// ── 결과 분석 ───────────────────────────────────────────────────────────────────
async function initStats() {
    // 연도/월 필터 옵션 채우기
    try {
        const settings = await apiFetch('/survey_settings?limit=100');
        const yearSel  = document.getElementById('statsYear');
        const monthSel = document.getElementById('statsMonth');

        const years  = [...new Set(settings.map(s => s.year))].sort((a,b) => b-a);
        const months = [1,2,3,4,5,6,7,8,9,10,11,12];

        yearSel.innerHTML  = '<option value="">전체 연도</option>' + years.map(y => `<option value="${y}">${y}년</option>`).join('');
        monthSel.innerHTML = '<option value="">전체 월</option>' + months.map(m => `<option value="${m}">${m}월</option>`).join('');

        // 가장 최근 활성/최신 기간 선택
        const active = settings.find(s => s.is_active === 1 || s.is_active === true);
        if (active) {
            yearSel.value  = active.year;
            monthSel.value = active.month;
        }
    } catch (e) {}
    loadStats();
}

async function loadStats() {
    const year  = document.getElementById('statsYear')?.value  ?? '';
    const month = document.getElementById('statsMonth')?.value ?? '';
    let url = '/survey_responses/stats';
    const params = [];
    if (year)  params.push('year='  + year);
    if (month) params.push('month=' + month);
    if (params.length) url += '?' + params.join('&');

    try {
        const data = await apiFetch(url);
        const tbody = document.getElementById('statsTbody');
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state">데이터가 없습니다</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(r => {
            const lecture = avg3(r.avg_q1, r.avg_q2, r.avg_q3);
            const manage  = avg3(r.avg_q4, r.avg_q5, r.avg_q6);
            const attitude = avg3(r.avg_q7, r.avg_q8, r.avg_q9);
            const effect  = avg5(r.avg_q10, r.avg_q11, r.avg_q12, r.avg_q13, r.avg_q14);

            return `
                <tr>
                    <td>${gradeFullNames[r.grade] ?? r.grade}</td>
                    <td>${r.subject}</td>
                    <td><strong>${r.teacher}</strong></td>
                    <td><span style="font-weight:700;">${r.response_count}</span></td>
                    <td>${scoreCell(r.avg_score)}</td>
                    <td>${scoreCell(lecture)}</td>
                    <td>${scoreCell(manage)}</td>
                    <td>${scoreCell(attitude)}</td>
                    <td>${scoreCell(effect)}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        showToast('통계 로드 실패', 'error');
    }
}

function avg3(a, b, c) {
    const vals = [a,b,c].filter(v => v !== null && v !== undefined);
    if (!vals.length) return null;
    return parseFloat((vals.reduce((s,v) => s+v, 0) / vals.length).toFixed(2));
}

function avg5(a,b,c,d,e) {
    const vals = [a,b,c,d,e].filter(v => v !== null && v !== undefined);
    if (!vals.length) return null;
    return parseFloat((vals.reduce((s,v) => s+v, 0) / vals.length).toFixed(2));
}

function scoreCell(val) {
    if (val === null || val === undefined) return '<span style="color:#94A3B8">-</span>';
    const cls = val >= 4.5 ? 'score-5' : val >= 3.5 ? 'score-4' : val >= 2.5 ? 'score-3' : 'score-2';
    return `<span class="score-badge ${cls}">${val}</span>`;
}

// ── 주관식 답변 ─────────────────────────────────────────────────────────────────
async function initComments() {
    try {
        const [settings, teachers] = await Promise.all([
            apiFetch('/survey_settings?limit=100'),
            apiFetch('/teacher_master?limit=500')
        ]);

        const yearSel     = document.getElementById('commentYear');
        const monthSel    = document.getElementById('commentMonth');
        const teacherSel  = document.getElementById('commentTeacher');

        const years  = [...new Set(settings.map(s => s.year))].sort((a,b) => b-a);
        yearSel.innerHTML  = '<option value="">전체 연도</option>' + years.map(y => `<option value="${y}">${y}년</option>`).join('');
        monthSel.innerHTML = '<option value="">전체 월</option>' + [1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}">${m}월</option>`).join('');

        const uniqueTeachers = [...new Set(teachers.map(t => t.name))].sort();
        teacherSel.innerHTML = '<option value="">전체 선생님</option>' + uniqueTeachers.map(n => `<option value="${n}">${n}</option>`).join('');

        // 활성 기간으로 초기 설정
        const active = settings.find(s => s.is_active === 1 || s.is_active === true);
        if (active) {
            yearSel.value  = active.year;
            monthSel.value = active.month;
        }
    } catch (e) {}
    loadComments();
}

async function loadComments() {
    const year    = document.getElementById('commentYear')?.value    ?? '';
    const month   = document.getElementById('commentMonth')?.value   ?? '';
    const teacher = document.getElementById('commentTeacher')?.value ?? '';
    let url = '/survey_responses?limit=500';
    if (year)    url += '&year='    + year;
    if (month)   url += '&month='   + month;
    if (teacher) url += '&teacher=' + encodeURIComponent(teacher);

    try {
        const data = await apiFetch(url);
        const container = document.getElementById('commentsContainer');

        // 댓글 있는 것만 필터
        const withComments = data.filter(r => (r.comment1 && r.comment1.trim()) || (r.comment2 && r.comment2.trim()));

        if (withComments.length === 0) {
            container.innerHTML = '<div class="card"><div class="card-body empty-state">주관식 답변이 없습니다</div></div>';
            return;
        }

        container.innerHTML = withComments.map(r => `
            <div class="comment-card">
                <div class="comment-card-header">
                    <strong class="comment-teacher-name">${r.teacher} 선생님</strong>
                    <span class="badge badge-normal">${r.subject}</span>
                    <span class="badge badge-inactive">${gradeFullNames[r.grade] ?? r.grade}</span>
                    <span class="comment-meta" style="margin-left:auto;">${r.created_at ? r.created_at.slice(0,16).replace('T',' ') : ''}</span>
                </div>
                <div class="comment-body">
                    ${r.comment1 ? `
                        <div class="comment-item">
                            <div class="comment-label">개선 사항 / 의견</div>
                            <div class="comment-text">${escHtml(r.comment1)}</div>
                        </div>` : ''}
                    ${r.comment2 ? `
                        <div class="comment-item">
                            <div class="comment-label">좋았던 점</div>
                            <div class="comment-text">${escHtml(r.comment2)}</div>
                        </div>` : ''}
                </div>
            </div>
        `).join('');
    } catch (e) {
        showToast('주관식 답변 로드 실패', 'error');
    }
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
}
