-- =============================================
--  정율사관학원 강사 만족도 조사 — 시드 데이터
--  실제 강사 데이터 기반
-- =============================================

-- 중학교 3학년 강사
INSERT OR IGNORE INTO teacher_master (name, subject, grade, question_type, is_active) VALUES
  ('박현준', '국어', 0, 'normal', 1),
  ('권미형', '수학', 0, 'normal', 1),
  ('박은지', '영어', 0, 'normal', 1),
  ('장진민', '사회', 0, 'jang', 1);

-- 고등학교 1학년 강사
INSERT OR IGNORE INTO teacher_master (name, subject, grade, question_type, is_active) VALUES
  ('박현준', '국어', 1, 'normal', 1),
  ('권미형', '수학', 1, 'normal', 1),
  ('박은지', '영어', 1, 'normal', 1),
  ('장진민', '사회', 1, 'jang', 1);

-- 고등학교 2학년 강사
INSERT OR IGNORE INTO teacher_master (name, subject, grade, question_type, is_active) VALUES
  ('박현준', '국어', 2, 'normal', 1),
  ('권미형', '수학', 2, 'normal', 1),
  ('박은지', '영어', 2, 'normal', 1),
  ('장진민', '사회', 2, 'jang', 1);

-- 고등학교 3학년 강사
INSERT OR IGNORE INTO teacher_master (name, subject, grade, question_type, is_active) VALUES
  ('박현준', '국어', 3, 'normal', 1),
  ('권미형', '수학', 3, 'normal', 1),
  ('박은지', '영어', 3, 'normal', 1),
  ('지성현', '탐구런투런', 3, 'runtrun', 1);

-- 현재 평가 기간 설정 (예: 2025년 3월)
INSERT OR IGNORE INTO survey_settings (year, month, label, is_active) VALUES
  (2025, 3, '2025년 3월', 1);
