-- =============================================
--  정율사관학원 강사 만족도 조사 DB 스키마
--  Migration 0001: Initial Schema
-- =============================================

-- 강사 마스터 테이블
CREATE TABLE IF NOT EXISTS teacher_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL,        -- 0=중3, 1=고1, 2=고2, 3=고3
  question_type TEXT NOT NULL DEFAULT 'normal',  -- 'normal' | 'jang' | 'runtrun'
  is_active INTEGER NOT NULL DEFAULT 1,          -- 1=활성, 0=비활성
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 설문 기간 설정 테이블
CREATE TABLE IF NOT EXISTS survey_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  label TEXT NOT NULL,           -- 예: "2025년 3월"
  is_active INTEGER NOT NULL DEFAULT 0,  -- 1개만 활성화 가능
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 설문 응답 테이블
CREATE TABLE IF NOT EXISTS survey_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER,
  month INTEGER,
  grade INTEGER NOT NULL,
  teacher TEXT NOT NULL,
  subject TEXT NOT NULL,
  -- 일반 객관식 (1~14)
  q1  INTEGER, q2  INTEGER, q3  INTEGER, q4  INTEGER,
  q5  INTEGER, q6  INTEGER, q7  INTEGER, q8  INTEGER,
  q9  INTEGER, q10 INTEGER, q11 INTEGER, q12 INTEGER,
  q13 INTEGER, q14 INTEGER,
  -- 런투런 전용 (r1~r3)
  r1  INTEGER, r2  INTEGER, r3  INTEGER,
  average REAL,
  comment1 TEXT DEFAULT '',
  comment2 TEXT DEFAULT '',
  timestamp TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_teacher_master_grade ON teacher_master(grade);
CREATE INDEX IF NOT EXISTS idx_teacher_master_active ON teacher_master(is_active);
CREATE INDEX IF NOT EXISTS idx_survey_responses_teacher ON survey_responses(teacher);
CREATE INDEX IF NOT EXISTS idx_survey_responses_month ON survey_responses(year, month);
CREATE INDEX IF NOT EXISTS idx_survey_responses_grade ON survey_responses(grade);
CREATE INDEX IF NOT EXISTS idx_survey_settings_active ON survey_settings(is_active);
