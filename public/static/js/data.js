// =============================================
//  정율사관학원 강사 만족도 조사 — 데이터 v3.0
// =============================================

let surveyData = {};

const evaluationQuestions = {
    "📣 강의 및 전달력": [
        { id: "q1",  text: "선생님의 수업은 전문적이다" },
        { id: "q2",  text: "수업의 난이도와 속도가 나에게 적절하다" },
        { id: "q3",  text: "판서나 수업 자료(콘티, 과제 등)가 학습에 도움이 된다" }
    ],
    "📋 학습 관리 및 피드백": [
        { id: "q4",  text: "과제 검사 및 복습검사에 대한 피드백이 꼼꼼하게 이루어진다" },
        { id: "q5",  text: "선생님에게 질문했을 때 성실하고 명확하게 답변해 준다" },
        { id: "q6",  text: "선생님의 인스터디 시간은 체계적으로 관리된다" }
    ],
    "🌟 태도 및 분위기": [
        { id: "q7",  text: "수업 시간을 엄수하며 수업 시간 내내 열정적으로 강의한다" },
        { id: "q8",  text: "수업 분위기가 집중할 수 있도록 잘 통제된다" },
        { id: "q9",  text: "이 선생님의 수업을 친구에게 추천하겠다" }
    ],
    "📈 수업 효과 및 성장": [
        { id: "q10", text: "선생님의 수업이 실력 향상에 도움이 된다" },
        { id: "q11", text: "선생님이 나의 성적 향상과 목표에 관심을 가져주신다" },
        { id: "q12", text: "선생님이 학생을 존중하고 따뜻하게 대해주신다" },
        { id: "q13", text: "선생님의 수업을 들으면 공부 의욕이 생긴다" },
        { id: "q14", text: "수업 내용이 내신/수능 시험과 잘 연결된다" }
    ]
};

const jangJinMinQuestions = {
    "📣 강의 및 전달력": [
        { id: "q1",  text: "선생님의 수업은 전문적이다" },
        { id: "q2",  text: "수업의 난이도와 속도가 나에게 적절하다" },
        { id: "q3",  text: "판서나 수업 자료(콘티, 과제 등)가 학습에 도움이 된다" }
    ],
    "📋 학습 관리 및 피드백": [
        { id: "q5",  text: "선생님에게 질문했을 때 성실하고 명확하게 답변해 준다" }
    ],
    "🌟 태도 및 분위기": [
        { id: "q7",  text: "수업 시간을 엄수하며 수업 시간 내내 열정적으로 강의한다" },
        { id: "q8",  text: "수업 분위기가 집중할 수 있도록 잘 통제된다" },
        { id: "q9",  text: "이 선생님의 수업을 친구에게 추천하겠다" }
    ],
    "📈 수업 효과 및 성장": [
        { id: "q10", text: "선생님의 수업이 실력 향상에 도움이 된다" },
        { id: "q11", text: "선생님이 나의 성적 향상과 목표에 관심을 가져주신다" },
        { id: "q12", text: "선생님이 학생을 존중하고 따뜻하게 대해주신다" },
        { id: "q13", text: "선생님의 수업을 들으면 공부 의욕이 생긴다" },
        { id: "q14", text: "수업 내용이 내신/수능 시험과 잘 연결된다" }
    ]
};

const runToRunQuestions = {
    "🔬 런투런 관리": [
        { id: "r1", text: "담당 선생님의 런투런 관리는 탐구 루틴에 도움이 되었다" },
        { id: "r2", text: "담당 선생님의 런투런 관리는 탐구 성적 향상에 도움이 되었다" },
        { id: "r3", text: "런투런은 탐구 자신감을 길러주었다" }
    ]
};

const openEndedQuestions = [
    {
        id: "open1",
        text: "선생님께 전하고 싶은 의견이나 개선 사항이 있다면 자유롭게 작성해주세요.",
        placeholder: "선택사항입니다. 개선이 필요한 점이나 건의사항을 자유롭게 작성해주세요."
    },
    {
        id: "open2",
        text: "수업에서 가장 좋았던 점은 무엇인가요?",
        placeholder: "선택사항입니다. 선생님의 수업에서 좋았던 점을 자유롭게 작성해주세요."
    }
];

const runToRunOpenQuestions = [
    {
        id: "open1",
        text: "선생님께 전하고 싶은 의견이나 개선 사항이 있다면 자유롭게 작성해주세요.",
        placeholder: "선택사항입니다. 개선이 필요한 점이나 건의사항을 자유롭게 작성해주세요."
    },
    {
        id: "open2",
        text: "런투런 관리에서 가장 좋았던 점은 무엇인가요?",
        placeholder: "선택사항입니다. 런투런 관리에서 좋았던 점을 자유롭게 작성해주세요."
    }
];

const ratingOptions = [
    { value: 1, label: "매우\n그렇지\n않다" },
    { value: 2, label: "그렇지\n않다" },
    { value: 3, label: "보통\n이다" },
    { value: 4, label: "그렇다" },
    { value: 5, label: "매우\n그렇다" }
];

function getQuestionsForTeacher(teacher, subject, questionType) {
    if (questionType === 'jang')    return jangJinMinQuestions;
    if (questionType === 'runtrun') return runToRunQuestions;
    if (questionType === 'normal')  return evaluationQuestions;
    if (teacher === "장진민" && subject === "사회") return jangJinMinQuestions;
    if (teacher === "지성현" && subject === "탐구런투런") return runToRunQuestions;
    return evaluationQuestions;
}

function getOpenQuestionsForTeacher(teacher, subject, questionType) {
    if (questionType === 'runtrun') return runToRunOpenQuestions;
    if (teacher === "지성현" && subject === "탐구런투런") return runToRunOpenQuestions;
    return openEndedQuestions;
}
