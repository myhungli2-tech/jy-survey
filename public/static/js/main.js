// =============================================
//  정율사관학원 강사 만족도 조사 — 메인 로직
//  API: Cloudflare Workers + D1 (/api/)
// =============================================

const API_BASE = '/api';

let currentPage = 1;
let selectedGrade = null;
let selectedTeachers = [];
let currentEvaluationIndex = 0;
let surveyResults = {
    grade: null,
    timestamp: null,
    evaluations: []
};
let activeMonthSetting = null;

document.addEventListener('DOMContentLoaded', function () {
    initializeGradeSelection();
    updateProgress();
    fetchActiveSetting();
    loadTeachersFromDB();
});

async function loadTeachersFromDB() {
    try {
        const res  = await fetch(API_BASE + '/teacher_master?limit=500');
        const json = await res.json();
        let rows = [];
        if (Array.isArray(json))           rows = json;
        else if (Array.isArray(json.data)) rows = json.data;
        else if (Array.isArray(json.items))rows = json.items;

        rows = rows.filter(r => r.is_active === true || r.is_active === 1 || r.is_active === 'true' || r.is_active === '1');

        const gradeNames = { 0: '중학교 3학년', 1: '고등학교 1학년', 2: '고등학교 2학년', 3: '고등학교 3학년' };
        const built = {};
        rows.forEach(r => {
            const g = (r.grade === 0 || r.grade === '0') ? 0 : (parseInt(r.grade) || 1);
            if (!built[g]) built[g] = { name: gradeNames[g] || ('고' + g), subjects: {} };
            if (!built[g].subjects[r.subject]) built[g].subjects[r.subject] = [];
            const alreadyExists = built[g].subjects[r.subject].some(t => t.name === r.name);
            if (!alreadyExists) {
                built[g].subjects[r.subject].push({
                    name: r.name,
                    questionType: r.question_type || 'normal'
                });
            }
        });
        Object.assign(surveyData, built);
    } catch(e) {
        console.error('강사 목록 로드 실패:', e);
        const container = document.getElementById('subjectTeacherContainer');
        if (container && container.innerHTML === '') {
            container.innerHTML = '<div style="text-align:center;padding:30px;color:#EF4444;"><p>강사 목록을 불러오지 못했습니다.<br>페이지를 새로고침 해주세요.</p></div>';
        }
    }
}

async function fetchActiveSetting() {
    const banner = document.getElementById('monthBanner');
    try {
        const res  = await fetch(API_BASE + '/survey_settings?limit=100');
        const json = await res.json();
        let rows = [];
        if (Array.isArray(json))            rows = json;
        else if (Array.isArray(json.data))  rows = json.data;
        else if (Array.isArray(json.items)) rows = json.items;

        const active = rows.find(s => s.is_active === true || s.is_active === 'true' || s.is_active === 1 || s.is_active === '1');
        activeMonthSetting = active || null;
        renderMonthBanner(activeMonthSetting);
    } catch (e) {
        if (banner) banner.innerHTML = '';
    }
}

function renderMonthBanner(setting) {
    const banner = document.getElementById('monthBanner');
    const gradeBtns = document.querySelectorAll('.grade-btn');
    if (!banner) return;

    if (!setting || !(setting.is_active === true || setting.is_active === 'true' || setting.is_active === 1 || setting.is_active === '1')) {
        banner.innerHTML = `
            <div class="month-banner closed">
                <div class="month-banner-icon">🔒</div>
                <div class="month-banner-body">
                    <div class="month-banner-title">현재 진행 중인 평가가 없습니다</div>
                    <div class="month-banner-sub">관리자가 평가 기간을 열면 응답할 수 있습니다</div>
                </div>
                <div class="month-banner-badge closed">마감</div>
            </div>
        `;
        gradeBtns.forEach(btn => btn.disabled = true);
        return;
    }

    banner.innerHTML = `
        <div class="month-banner active">
            <div class="month-banner-icon">📋</div>
            <div class="month-banner-body">
                <div class="month-banner-title">${setting.label} 강사 만족도 조사</div>
                <div class="month-banner-sub">지금 진행 중인 평가입니다 · 소중한 의견을 남겨주세요</div>
            </div>
            <div class="month-banner-badge open">진행 중</div>
        </div>
    `;
    gradeBtns.forEach(btn => btn.disabled = false);
}

function initializeGradeSelection() {
    document.querySelectorAll('.grade-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
            selectedGrade = parseInt(this.dataset.grade);
            surveyResults.grade = selectedGrade;

            if (!surveyData[selectedGrade]) {
                showLoading(true);
                await loadTeachersFromDB();
                showLoading(false);
            }

            currentEvaluationIndex = 0;
            surveyResults.evaluations = [];
            selectedTeachers = [];

            goToPage(2);
            renderSubjectTeacherSelection();
        });
    });
}

function goToPage(pageNum) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page${pageNum}`);
    if (target) {
        target.classList.add('active');
        currentPage = pageNum;
        updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (pageNum === 2) {
        currentEvaluationIndex = 0;
        surveyResults.evaluations = [];
    }
}

function updateProgress() {
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    fill.style.width = `${(currentPage / 4) * 100}%`;
    text.textContent = `${currentPage} / 4`;
}

function renderSubjectTeacherSelection() {
    const container = document.getElementById('subjectTeacherContainer');
    const gradeData = surveyData[selectedGrade];
    if (!gradeData) { container.innerHTML = '<p>학년 정보를 찾을 수 없습니다.</p>'; return; }

    let html = '';
    Object.keys(gradeData.subjects).forEach(subject => {
        const teachers = gradeData.subjects[subject];
        html += `
            <div class="subject-group">
                <div class="subject-title">${subject}</div>
                <div class="teacher-grid">
        `;
        teachers.forEach((teacher, idx) => {
            const safeId = `teacher-${selectedGrade}-${Object.keys(gradeData.subjects).indexOf(subject)}-${idx}`;
            const tName  = teacher.name || teacher;
            const tQType = teacher.questionType || 'normal';
            html += `
                <div>
                    <input type="checkbox"
                           id="${safeId}"
                           class="teacher-checkbox"
                           data-subject="${subject}"
                           data-teacher="${tName}"
                           data-question-type="${tQType}">
                    <label for="${safeId}" class="teacher-label">${tName}</label>
                </div>
            `;
        });
        html += `</div></div>`;
    });
    container.innerHTML = html;
}

function validateAndGoToEvaluation() {
    selectedTeachers = [];
    const checked = document.querySelectorAll('.teacher-checkbox:checked');
    if (checked.length === 0) {
        showToast('최소 한 명 이상의 선생님을 선택해주세요.', 'error');
        return;
    }
    checked.forEach(cb => {
        selectedTeachers.push({
            subject: cb.dataset.subject,
            teacher: cb.dataset.teacher,
            questionType: cb.dataset.questionType || 'normal',
            subjectDisplay: cb.dataset.subject
        });
    });
    currentEvaluationIndex = 0;
    surveyResults.evaluations = [];
    goToPage(3);
    renderEvaluation();
}

function renderEvaluation() {
    const container  = document.getElementById('evaluationContainer');
    const subtitle   = document.getElementById('evaluationSubtitle');
    const nextBtn    = document.getElementById('nextEvalBtn');

    if (currentEvaluationIndex >= selectedTeachers.length) {
        goToPage(4);
        renderCompletion();
        return;
    }

    const cur   = selectedTeachers[currentEvaluationIndex];
    const total = selectedTeachers.length;

    subtitle.textContent = `${currentEvaluationIndex + 1} / ${total} 선생님 평가 중`;
    nextBtn.textContent  = currentEvaluationIndex === total - 1 ? '✓ 제출하기' : '다음 선생님 ›';

    const questions     = getQuestionsForTeacher(cur.teacher, cur.subject, cur.questionType);
    const openQuestions = getOpenQuestionsForTeacher(cur.teacher, cur.subject, cur.questionType);

    let html = `
        <div class="evaluation-form">
            <div class="teacher-name-header">
                <h3>${cur.teacher} 선생님</h3>
                <p>${cur.subjectDisplay}</p>
            </div>
    `;

    Object.keys(questions).forEach(section => {
        html += `<div class="question-section">
            <div class="section-title">${section}</div>`;

        questions[section].forEach(q => {
            html += `
                <div class="question-item">
                    <div class="question-text">${q.text}</div>
                    <div class="rating-options">
            `;
            ratingOptions.forEach(opt => {
                const inputId = `eval-${currentEvaluationIndex}-${q.id}-${opt.value}`;
                html += `
                    <input type="radio"
                           name="${currentEvaluationIndex}-${q.id}"
                           value="${opt.value}"
                           class="rating-input"
                           id="${inputId}"
                           data-question="${q.id}">
                    <label class="rating-label" for="${inputId}">
                        <div class="rating-button">
                            <div class="rating-number">${opt.value}</div>
                            <div class="rating-text">${opt.label.replace(/\n/g, '<br>')}</div>
                        </div>
                    </label>
                `;
            });
            html += `</div></div>`;
        });
        html += `</div>`;
    });

    html += `<div class="question-section">
        <div class="section-title">💬 주관식 의견</div>`;
    openQuestions.forEach(q => {
        html += `
            <div class="question-item">
                <div class="question-text">${q.text}
                    <span style="font-size:11px;color:#94A3B8;font-weight:400;margin-left:6px;">(선택)</span>
                </div>
                <div class="textarea-question">
                    <textarea id="${currentEvaluationIndex}-${q.id}"
                              placeholder="${q.placeholder}"
                              rows="4"></textarea>
                </div>
            </div>
        `;
    });
    html += `</div></div>`;

    container.innerHTML = html;
}

function nextEvaluation() {
    const cur = selectedTeachers[currentEvaluationIndex];
    const questions     = getQuestionsForTeacher(cur.teacher, cur.subject, cur.questionType);
    const openQuestions = getOpenQuestionsForTeacher(cur.teacher, cur.subject, cur.questionType);

    const evaluation = {
        teacher: cur.teacher,
        subject: cur.subject,
        ratings: {},
        openEnded: {}
    };

    let allAnswered = true;
    const allQs = [];
    Object.values(questions).forEach(list => allQs.push(...list));

    allQs.forEach(q => {
        const sel = document.querySelector(`input[name="${currentEvaluationIndex}-${q.id}"]:checked`);
        if (!sel) {
            allAnswered = false;
        } else {
            evaluation.ratings[q.id] = parseInt(sel.value);
        }
    });

    if (!allAnswered) {
        showToast('모든 항목에 답변해주세요.', 'error');
        const firstUnanswered = allQs.find(q =>
            !document.querySelector(`input[name="${currentEvaluationIndex}-${q.id}"]:checked`)
        );
        if (firstUnanswered) {
            const el = document.querySelector(`input[data-question="${firstUnanswered.id}"]`);
            if (el) el.closest('.question-item').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    openQuestions.forEach(q => {
        const ta = document.getElementById(`${currentEvaluationIndex}-${q.id}`);
        if (ta) evaluation.openEnded[q.id] = ta.value.trim();
    });

    surveyResults.evaluations.push(evaluation);
    currentEvaluationIndex++;

    if (currentEvaluationIndex >= selectedTeachers.length) {
        submitSurvey();
    } else {
        renderEvaluation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function submitSurvey() {
    showLoading(true);
    surveyResults.timestamp = new Date().toISOString();

    try {
        const failedTeachers = [];

        for (const ev of surveyResults.evaluations) {
            const ratingValues = Object.values(ev.ratings);
            const avg = ratingValues.length > 0
                ? parseFloat((ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(2))
                : 0;

            const record = {
                month:    activeMonthSetting ? activeMonthSetting.month : null,
                year:     activeMonthSetting ? activeMonthSetting.year  : null,
                grade:    surveyResults.grade,
                teacher:  ev.teacher,
                subject:  ev.subject,
                q1: ev.ratings.q1  || null, q2: ev.ratings.q2  || null,
                q3: ev.ratings.q3  || null, q4: ev.ratings.q4  || null,
                q5: ev.ratings.q5  || null, q6: ev.ratings.q6  || null,
                q7: ev.ratings.q7  || null, q8: ev.ratings.q8  || null,
                q9: ev.ratings.q9  || null, q10: ev.ratings.q10 || null,
                q11: ev.ratings.q11 || null, q12: ev.ratings.q12 || null,
                q13: ev.ratings.q13 || null, q14: ev.ratings.q14 || null,
                r1: ev.ratings.r1  || null, r2: ev.ratings.r2  || null, r3: ev.ratings.r3 || null,
                average:  avg,
                comment1: ev.openEnded?.open1 || '',
                comment2: ev.openEnded?.open2 || '',
                timestamp: surveyResults.timestamp
            };

            try {
                const res = await fetch(API_BASE + '/survey_responses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(record)
                });
                if (!res.ok) {
                    console.error(`저장 실패 [${ev.teacher}]: HTTP ${res.status}`);
                    failedTeachers.push(ev.teacher);
                }
            } catch (fetchErr) {
                console.error(`네트워크 오류 [${ev.teacher}]:`, fetchErr);
                failedTeachers.push(ev.teacher);
            }
        }

        showLoading(false);

        if (failedTeachers.length > 0) {
            showToast(`⚠️ 일부 저장 실패: ${failedTeachers.join(', ')}`, 'error');
            await new Promise(r => setTimeout(r, 2000));
        }

        goToPage(4);
        renderCompletion();
    } catch (err) {
        console.error('제출 오류:', err);
        showLoading(false);
        showToast('제출에 실패했습니다. 다시 시도해주세요.', 'error');
    }
}

function renderCompletion() {
    const container = document.getElementById('completionDetails');
    const gradeData = surveyData[surveyResults.grade];
    container.innerHTML = `
        <p><strong>학년:</strong> ${gradeData ? gradeData.name : '-'}</p>
        <p><strong>평가한 선생님 수:</strong> ${surveyResults.evaluations.length}명</p>
        <p style="margin-top:10px;font-size:13px;color:#64748B;">
            평가 결과가 서버에 안전하게 저장되었습니다.<br>소중한 의견 감사합니다! 🙏
        </p>
    `;
}

function restartSurvey() {
    currentPage = 1;
    selectedGrade = null;
    selectedTeachers = [];
    currentEvaluationIndex = 0;
    surveyResults = { grade: null, timestamp: null, evaluations: [] };
    renderMonthBanner(activeMonthSetting);
    goToPage(1);
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
