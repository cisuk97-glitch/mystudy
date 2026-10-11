// ========================================================
// MY SPECIAL ENGLISH : Supabase 클라우드 데이터베이스 클라이언트
// CDN 기반 @supabase/supabase-js 연동 및 완벽한 오프라인 Fallback
// ========================================================

const SUPABASE_STORAGE_KEY_URL = 'MSE_SUPABASE_URL';
const SUPABASE_STORAGE_KEY_ANON = 'MSE_SUPABASE_ANON_KEY';

// 기본 설정값 (사용자가 Supabase 대시보드에서 생성한 Project URL과 anon key를 넣을 수 있습니다)
const DEFAULT_SUPABASE_CONFIG = {
  url: window.MSE_DEFAULT_SUPABASE_URL || '',
  anonKey: window.MSE_DEFAULT_SUPABASE_ANON_KEY || ''
};

let supabaseClient = null;

/**
 * Supabase 클라이언트 초기화
 */
function initSupabase() {
  const savedUrl = localStorage.getItem(SUPABASE_STORAGE_KEY_URL) || DEFAULT_SUPABASE_CONFIG.url;
  const savedKey = localStorage.getItem(SUPABASE_STORAGE_KEY_ANON) || DEFAULT_SUPABASE_CONFIG.anonKey;

  if (savedUrl && savedKey && window.supabase && window.supabase.createClient) {
    try {
      supabaseClient = window.supabase.createClient(savedUrl, savedKey);
      console.log('✨ Supabase Cloud DB connected:', savedUrl);
      return true;
    } catch (e) {
      console.warn('Supabase init failed:', e);
      supabaseClient = null;
      return false;
    }
  }
  supabaseClient = null;
  return false;
}

/**
 * 현재 클라우드 DB 연결 상태 확인
 */
function isSupabaseConnected() {
  return supabaseClient !== null;
}

/**
 * Supabase 연결 정보 업데이트 & 저장
 */
function saveSupabaseConfig(url, anonKey) {
  if (url && anonKey) {
    localStorage.setItem(SUPABASE_STORAGE_KEY_URL, url.trim());
    localStorage.setItem(SUPABASE_STORAGE_KEY_ANON, anonKey.trim());
  } else {
    localStorage.removeItem(SUPABASE_STORAGE_KEY_URL);
    localStorage.removeItem(SUPABASE_STORAGE_KEY_ANON);
  }
  return initSupabase();
}

function getSupabaseConfig() {
  return {
    url: localStorage.getItem(SUPABASE_STORAGE_KEY_URL) || DEFAULT_SUPABASE_CONFIG.url,
    anonKey: localStorage.getItem(SUPABASE_STORAGE_KEY_ANON) || DEFAULT_SUPABASE_CONFIG.anonKey
  };
}

// ========================================================
// 로컬 스토리지 Fallback 데이터 헬퍼 (오프라인 / 미연동 시 안전 구동)
// ========================================================
const LOCAL_STORAGE_KEYS = {
  SUBJECTS: 'mse_local_subjects',
  LESSONS: 'mse_local_lessons',
  WORDS_PREFIX: 'mse_local_words_',
  WRITING_PREFIX: 'mse_local_writing_',
  RECORDS: 'mse_local_records',
  WRONG_HISTORY: 'mse_local_wrong_history',
  WRONG_ANSWERS: 'mse_local_wrong_answers',
  META_PREFIX: 'mse_local_meta_'
};

function getLocalMeta(key, defaultVal) {
  return localStorage.getItem(LOCAL_STORAGE_KEYS.META_PREFIX + key) || defaultVal;
}

function setLocalMeta(key, val) {
  localStorage.setItem(LOCAL_STORAGE_KEYS.META_PREFIX + key, String(val));
}

// 기본 3과 시드 데이터
function getSeedWords() {
  if (typeof VOCAB_DATA !== 'undefined' && Array.isArray(VOCAB_DATA)) {
    return VOCAB_DATA.map((w, idx) => ({
      id: w.id || idx + 1,
      lesson_id: 1,
      word_no: w.id || idx + 1,
      word: w.word,
      pos: w.pos,
      meaning: w.meaning,
      eng_def: w.engDef || '',
      test_count: 0,
      wrong_count: 0,
      is_mastered: false
    }));
  }
  return [];
}

// ========================================================
// 비즈니스 데이터베이스 API 함수
// ========================================================

/**
 * 0. 과목 목록 및 메타정보 가져오기 (subjects)
 */
async function apiGetSubjects() {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .from('subjects')
        .select('*')
        .order('name', { ascending: true });
      if (!error && data && data.length > 0) return data;
    } catch (e) {
      console.warn('apiGetSubjects fallback to local:', e);
    }
  }

  // Local fallback
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.SUBJECTS);
  let subjects = [];
  if (raw) {
    try { subjects = JSON.parse(raw); } catch (e) {}
  }
  if (!subjects || subjects.length === 0) {
    subjects = [{ name: '영어', dday: '', target_score: 100, color: 'indigo' }];
    localStorage.setItem(LOCAL_STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
  }
  return subjects;
}

/**
 * 0-1. 과목 메타정보(D-Day, 목표점수, 테마색상) 등록 및 수정 (Upsert)
 */
async function apiUpsertSubject({ name, dday = '', target_score = 100, color = 'indigo' }) {
  const subName = (name || '').trim();
  if (!subName) throw new Error('과목명을 입력해주세요.');

  const payload = {
    name: subName,
    dday: dday || null,
    target_score: Number(target_score) || 100,
    color: color || 'indigo',
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .from('subjects')
        .upsert([payload])
        .select();
      if (error) throw error;
      if (data && data[0]) return data[0];
    } catch (e) {
      console.warn('apiUpsertSubject cloud error:', e);
      throw e;
    }
  }

  // Local fallback
  const subjects = await apiGetSubjects();
  const existingIdx = subjects.findIndex(s => (s.name || s) === subName);
  const updatedItem = {
    name: subName,
    dday: dday || '',
    target_score: Number(target_score) || 100,
    color: color || 'indigo'
  };

  if (existingIdx >= 0) {
    subjects[existingIdx] = updatedItem;
  } else {
    subjects.push(updatedItem);
  }
  localStorage.setItem(LOCAL_STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
  return updatedItem;
}

/**
 * 0-2. 과목 삭제 (연관 대단원, 단어, 시험 기록 일괄 삭제)
 */
async function apiDeleteSubject(subjectName) {
  const subName = (subjectName || '').trim();
  if (!subName) return false;

  if (isSupabaseConnected()) {
    try {
      const { error } = await supabaseClient
        .from('subjects')
        .delete()
        .eq('name', subName);
      if (error) throw error;
    } catch (e) {
      console.warn('apiDeleteSubject cloud error:', e);
    }
  }

  // Local fallback
  let subjects = await apiGetSubjects();
  subjects = subjects.filter(s => (s.name || s) !== subName);
  localStorage.setItem(LOCAL_STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));

  // 해당 과목의 단원들 삭제
  let lessons = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.LESSONS) || '[]');
  const deletedLessonIds = lessons.filter(l => (l.subject_name || '영어') === subName).map(l => l.id);
  for (const lid of deletedLessonIds) {
    await apiDeleteLesson(lid);
  }
  return true;
}

/**
 * 1. 대단원 목록 가져오기 (특정 과목 필터링 지원)
 */
async function apiGetLessons(subject = null) {
  if (isSupabaseConnected()) {
    try {
      let query = supabaseClient
        .from('lessons')
        .select('*')
        .order('id', { ascending: true });
      if (subject) {
        query = query.eq('subject_name', subject);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map(l => ({ ...l, subject_name: l.subject_name || '영어' }));
      }
    } catch (e) {
      console.warn('apiGetLessons fallback to local:', e);
    }
  }

  // Local fallback
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.LESSONS);
  let lessons = [];
  if (raw) {
    try { lessons = JSON.parse(raw); } catch (e) {}
  }
  if (!lessons || lessons.length === 0) {
    lessons = [{ id: 1, subject_name: "영어", unit_name: "3. The Gift of Art (비상 홍민표)" }];
    localStorage.setItem(LOCAL_STORAGE_KEYS.LESSONS, JSON.stringify(lessons));
  } else {
    lessons = lessons.map(l => ({ ...l, subject_name: l.subject_name || '영어' }));
  }

  if (subject) {
    return lessons.filter(l => (l.subject_name || '영어') === subject);
  }
  return lessons;
}

/**
 * 2. 새 대단원 생성 (과목명, 단원명)
 */
async function apiCreateLesson(subjectName, unitName) {
  let sub = subjectName;
  let unit = unitName;
  if (!unit) {
    unit = sub;
    sub = '영어';
  }
  sub = (sub || '영어').trim();
  unit = (unit || '').trim();

  // 과목이 subjects에 없으면 자동 등록 (외래키 제약조건 만족)
  try {
    await apiUpsertSubject({ name: sub });
  } catch (e) {}

  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .from('lessons')
        .insert([{ subject_name: sub, unit_name: unit }])
        .select();
      if (!error && data && data[0]) return data[0];
      if (error) throw error;
    } catch (e) {
      console.warn('apiCreateLesson cloud error:', e);
      throw e;
    }
  }

  // Local fallback
  const lessons = await apiGetLessons();
  const nextId = lessons.reduce((max, l) => Math.max(max, Number(l.id) || 0), 0) + 1;
  const newLesson = { id: nextId, subject_name: sub, unit_name: unit };
  lessons.push(newLesson);
  localStorage.setItem(LOCAL_STORAGE_KEYS.LESSONS, JSON.stringify(lessons));
  return newLesson;
}

/**
 * 2-1. 대단원 및 연관 단어/성적 데이터 일괄 삭제
 */
async function apiDeleteLesson(lessonId) {
  const idNum = Number(lessonId);
  if (isSupabaseConnected()) {
    try {
      await supabaseClient.from('vocab_words').delete().eq('lesson_id', idNum);
      await supabaseClient.from('test_records').delete().eq('lesson_id', idNum);
      const { error } = await supabaseClient.from('lessons').delete().eq('id', idNum);
      if (error) throw error;
    } catch (e) {
      console.warn('apiDeleteLesson cloud error:', e);
    }
  }

  // Local fallback
  let lessons = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.LESSONS) || '[]');
  lessons = lessons.filter(l => Number(l.id) !== idNum);
  localStorage.setItem(LOCAL_STORAGE_KEYS.LESSONS, JSON.stringify(lessons));

  localStorage.removeItem(LOCAL_STORAGE_KEYS.WORDS_PREFIX + idNum);

  let recs = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.RECORDS) || '[]');
  const removedIds = new Set(recs.filter(r => Number(r.lesson_id) === idNum).map(r => r.id));
  recs = recs.filter(r => Number(r.lesson_id) !== idNum);
  localStorage.setItem(LOCAL_STORAGE_KEYS.RECORDS, JSON.stringify(recs));

  let hist = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.WRONG_HISTORY) || '[]');
  hist = hist.filter(h => !removedIds.has(h.record_id));
  localStorage.setItem(LOCAL_STORAGE_KEYS.WRONG_HISTORY, JSON.stringify(hist));

  return true;
}

/**
 * 3. 대단원별 단어 목록 가져오기
 */
async function apiGetWords(lessonId) {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .from('vocab_words')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('word_no', { ascending: true });
      if (!error && data && data.length > 0) return data;
    } catch (e) {
      console.warn('apiGetWords fallback to local:', e);
    }
  }

  // Local fallback
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.WORDS_PREFIX + lessonId);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  // 3과 기본 시드 복원
  if (Number(lessonId) === 1) {
    const seed = getSeedWords();
    localStorage.setItem(LOCAL_STORAGE_KEYS.WORDS_PREFIX + 1, JSON.stringify(seed));
    return seed;
  }
  return [];
}

/**
 * 4. PDF 파싱 단어 일괄 등록 (Batch Insert / Upsert)
 */
async function apiInsertWords(lessonId, words) {
  const records = words.map(w => ({
    lesson_id: lessonId,
    word_no: w.word_no,
    word: w.word,
    pos: w.pos || '',
    meaning: w.meaning,
    eng_def: w.eng_def || ''
  }));

  if (isSupabaseConnected()) {
    try {
      // 기존 단어 삭제 후 재등록 or upsert
      await supabaseClient
        .from('vocab_words')
        .delete()
        .eq('lesson_id', lessonId);

      const { data, error } = await supabaseClient
        .from('vocab_words')
        .insert(records)
        .select();

      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('apiInsertWords cloud error:', e);
      throw e;
    }
  }

  // Local fallback
  const saved = records.map((r, i) => ({
    ...r,
    id: i + 1,
    test_count: 0,
    wrong_count: 0,
    is_mastered: false
  }));
  localStorage.setItem(LOCAL_STORAGE_KEYS.WORDS_PREFIX + lessonId, JSON.stringify(saved));
  return saved;
}

/**
 * 5. 취약 단어 (wrong_count > 0 내림차순)
 */
async function apiGetWrongWords(lessonId) {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .from('vocab_words')
        .select('*')
        .eq('lesson_id', lessonId)
        .gt('wrong_count', 0)
        .order('wrong_count', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn('apiGetWrongWords fallback:', e);
    }
  }

  const words = await apiGetWords(lessonId);
  return words
    .filter(w => (w.wrong_count || 0) > 0)
    .sort((a, b) => (b.wrong_count || 0) - (a.wrong_count || 0));
}

/**
 * 6. 시험 결과 제출 및 실시간 Supabase 저장
 */
async function apiSubmitTest({
  lessonId,
  round,
  testMode,
  score,
  correctCount,
  totalCount,
  starsWon,
  wrongItems = [],
  correctWordIds = [],
  testCategory = 'VOCAB',
  testTitle = '',
  testDate = null,
  completedAt = null,
  durationSeconds = 0,
  testId = null,
  userAnswers = null
}) {
  let recordId = Date.now();
  const testFinishTime = testDate || completedAt || new Date().toISOString();
  const durationSec = Number(durationSeconds) || 0;

  // test_records 체크 제약조건 (chk_test_category: 'VOCAB' | 'UNIT' | 'WRITING') 보정
  let normalizedCategory = 'VOCAB';
  const rawCat = String(testCategory || '').toUpperCase().trim();
  if (rawCat === 'VOCAB' || rawCat === 'UNIT' || rawCat === 'WRITING') {
    normalizedCategory = rawCat;
  } else if (rawCat.includes('UNIT') || rawCat.includes('단원') || rawCat.includes('PDF') || rawCat.includes('전체테스트')) {
    normalizedCategory = 'UNIT';
  } else if (rawCat.includes('WRIT') || rawCat.includes('서술') || rawCat.includes('영작')) {
    normalizedCategory = 'WRITING';
  } else {
    normalizedCategory = 'UNIT';
  }

  const isVocabTest = (normalizedCategory === 'VOCAB');

  if (isSupabaseConnected()) {
    try {
      // 6-1. test_records 삽입
      const baseRecord = {
        lesson_id: lessonId,
        test_category: normalizedCategory,
        test_title: testTitle,
        round: round,
        test_mode: testMode,
        score: score,
        correct_count: correctCount,
        total_count: totalCount,
        stars_won: starsWon,
        test_date: testFinishTime
      };

      const extendedRecord = { ...baseRecord, duration_seconds: durationSec };
      if (testId !== null && testId !== undefined) {
        extendedRecord.test_id = Number(testId) || testId;
      }
      if (userAnswers !== null && userAnswers !== undefined) {
        extendedRecord.user_answers = userAnswers;
      }

      let recInsertResult = await supabaseClient
        .from('test_records')
        .insert([extendedRecord])
        .select();

      // DB 스키마에 test_id / user_answers / duration_seconds 컬럼이 아직 없는 경우 단계적 fallback
      if (recInsertResult.error && (recInsertResult.error.code === 'PGRST204' || recInsertResult.error.message?.includes('schema cache'))) {
        console.warn('test_records 확장 컬럼 누락, duration_seconds만 포함하여 재시도:', recInsertResult.error.message);
        recInsertResult = await supabaseClient
          .from('test_records')
          .insert([{ ...baseRecord, duration_seconds: durationSec }])
          .select();

        if (recInsertResult.error && (recInsertResult.error.code === 'PGRST204' || recInsertResult.error.message?.includes('schema cache'))) {
          console.warn('test_records duration_seconds 컬럼도 누락, 기본 컬럼으로 재시도:', recInsertResult.error.message);
          recInsertResult = await supabaseClient
            .from('test_records')
            .insert([baseRecord])
            .select();
        }
      }

      const recData = recInsertResult.data;
      const recErr = recInsertResult.error;

      if (recErr) console.warn('Record insert error:', recErr);
      if (recData && recData[0]) {
        recordId = recData[0].id;
      }

      // 6-2 & 6-3: VOCAB 시험일 때만 test_wrong_history 삽입 및 vocab_words 갱신
      if (isVocabTest) {
        // 6-2. test_wrong_history 삽입 (정상 레코드 ID가 있을 때만 실행)
        if (!recErr && recordId && wrongItems && wrongItems.length > 0) {
          const historyRows = wrongItems.map(item => ({
            record_id: recordId,
            word_id: item.wordId,
            user_answer: item.userAns || '',
            correct_answer: item.correctAns || ''
          }));
          await supabaseClient.from('test_wrong_history').insert(historyRows);
        }

        // 6-3. vocab_words 오답 횟수 및 테스트 응시 횟수 증가
        // 틀린 단어들: wrong_count + 1, test_count + 1
        for (const item of wrongItems) {
          const { data: curWord } = await supabaseClient
            .from('vocab_words')
            .select('wrong_count, test_count')
            .eq('id', item.wordId)
            .single();
          if (curWord) {
            await supabaseClient
              .from('vocab_words')
              .update({
                wrong_count: (curWord.wrong_count || 0) + 1,
                test_count: (curWord.test_count || 0) + 1
              })
              .eq('id', item.wordId);
          }
        }

        // 맞은 단어들: test_count + 1
        for (const wid of correctWordIds) {
          const { data: curWord } = await supabaseClient
            .from('vocab_words')
            .select('test_count')
            .eq('id', wid)
            .single();
          if (curWord) {
            await supabaseClient
              .from('vocab_words')
              .update({ test_count: (curWord.test_count || 0) + 1 })
              .eq('id', wid);
          }
        }
      }

      // 6-4. 누적 별 개수 업데이트
      const currentStars = await apiGetMeta('total_stars', '0');
      const newStars = parseInt(currentStars, 10) + starsWon;
      await apiSetMeta('total_stars', String(newStars));

      // 6-5. schedules 테이블 자동 일정 등록
      try {
        let subName = '영어';
        const allLessons = await apiGetLessons();
        const matchedLesson = allLessons.find(l => Number(l.id) === Number(lessonId));
        if (matchedLesson && matchedLesson.subject_name) {
          subName = matchedLesson.subject_name;
        }
        await apiCreateScheduleFromTest({
          subject: subName,
          lessonId,
          testTitle: testTitle || (testCategory === 'VOCAB' ? '단어 주관식 시험' : '단원평가'),
          category: testCategory === 'VOCAB' ? '단어시험' : '단원평가',
          score,
          correctCount,
          totalCount,
          durationSec
        });
      } catch (schedErr) {
        console.warn('schedules sync error:', schedErr);
      }

      return { success: true, recordId, totalStars: newStars };
    } catch (e) {
      console.warn('apiSubmitTest cloud error, saving locally:', e);
    }
  }

  // Local fallback 업데이트
  if (isVocabTest) {
    const localWords = await apiGetWords(lessonId);
    const wrongMap = new Set(wrongItems.map(w => w.wordId));
    const correctMap = new Set(correctWordIds);

    const updatedWords = localWords.map(w => {
      let wrongCnt = w.wrong_count || 0;
      let testCnt = w.test_count || 0;
      if (wrongMap.has(w.id)) {
        wrongCnt += 1;
        testCnt += 1;
      } else if (correctMap.has(w.id)) {
        testCnt += 1;
      }
      return { ...w, wrong_count: wrongCnt, test_count: testCnt };
    });
    localStorage.setItem(LOCAL_STORAGE_KEYS.WORDS_PREFIX + lessonId, JSON.stringify(updatedWords));
  }

  // 로컬 시험 기록 저장
  const recs = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.RECORDS) || '[]');
  const localRec = {
    id: recordId,
    lesson_id: lessonId,
    test_category: testCategory,
    test_title: testTitle,
    round,
    test_mode: testMode,
    score,
    correct_count: correctCount,
    total_count: totalCount,
    stars_won: starsWon,
    duration_seconds: durationSec,
    test_date: testFinishTime
  };
  if (testId !== null && testId !== undefined) {
    localRec.test_id = Number(testId) || testId;
  }
  if (userAnswers !== null && userAnswers !== undefined) {
    localRec.user_answers = userAnswers;
  }
  recs.unshift(localRec);
  localStorage.setItem(LOCAL_STORAGE_KEYS.RECORDS, JSON.stringify(recs));

  // 로컬 오답 히스토리 (VOCAB만)
  if (isVocabTest && wrongItems && wrongItems.length > 0) {
    const hist = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.WRONG_HISTORY) || '[]');
    wrongItems.forEach(item => {
      hist.unshift({
        id: Date.now() + Math.random(),
        record_id: recordId,
        word_id: item.wordId,
        user_answer: item.userAns || '',
        correct_answer: item.correctAns || '',
        created_at: new Date().toISOString()
      });
    });
    localStorage.setItem(LOCAL_STORAGE_KEYS.WRONG_HISTORY, JSON.stringify(hist));
  }

  // 로컬 별 업데이트
  const curStars = parseInt(getLocalMeta('total_stars', '0'), 10) + starsWon;
  setLocalMeta('total_stars', curStars);

  // 로컬 schedules 자동 연동
  try {
    let subName = '영어';
    const allLessons = await apiGetLessons();
    const matchedLesson = allLessons.find(l => Number(l.id) === Number(lessonId));
    if (matchedLesson && matchedLesson.subject_name) {
      subName = matchedLesson.subject_name;
    }
    await apiCreateScheduleFromTest({
      subject: subName,
      lessonId,
      testTitle: testTitle || (testCategory === 'VOCAB' ? '단어 주관식 시험' : '단원평가'),
      category: testCategory === 'VOCAB' ? '단어시험' : '단원평가',
      score,
      correctCount,
      totalCount,
      durationSec
    });
  } catch (schedErr) {}

  return { success: true, recordId, totalStars: curStars };
}

/**
 * 7. 부모님/관리자용 시험 성적표 목록 조회
 */
async function apiGetTestRecords(lessonId = null, limit = 50, category = null, subjectName = null) {
  if (isSupabaseConnected()) {
    try {
      let query = supabaseClient
        .from('test_records')
        .select('*, lessons!inner(unit_name, subject_name)')
        .order('test_date', { ascending: false })
        .limit(limit);

      if (subjectName) {
        query = query.eq('lessons.subject_name', subjectName);
      }
      if (lessonId) {
        query = query.eq('lesson_id', lessonId);
      }
      if (category && category !== 'ALL') {
        query = query.eq('test_category', category);
      }
      const { data, error } = await query;
      if (!error && data) return data;
    } catch (e) {
      console.warn('apiGetTestRecords fallback:', e);
    }
  }

  // Local fallback
  let recs = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.RECORDS) || '[]');
  const lessons = await apiGetLessons();
  const lessonObjMap = Object.fromEntries(lessons.map(l => [l.id, l]));

  if (subjectName) {
    recs = recs.filter(r => {
      const les = lessonObjMap[r.lesson_id];
      return les && les.subject_name === subjectName;
    });
  }
  if (lessonId) {
    recs = recs.filter(r => Number(r.lesson_id) === Number(lessonId));
  }
  if (category && category !== 'ALL') {
    recs = recs.filter(r => (r.test_category || 'VOCAB') === category);
  }
  return recs.slice(0, limit).map(r => ({
    ...r,
    lessons: {
      unit_name: lessonObjMap[r.lesson_id]?.unit_name || '3과 The Gift of Art',
      subject_name: lessonObjMap[r.lesson_id]?.subject_name || '영어'
    }
  }));
}

/**
 * 7-1. 특정 시험지(test_id)의 마지막 응시 기록 조회
 */
async function apiGetLastTestRecordByTestId(testId) {
  if (!testId) return null;
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .from('test_records')
        .select('*')
        .eq('test_id', Number(testId) || testId)
        .order('test_date', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) return data[0];
    } catch (e) {
      console.warn('apiGetLastTestRecordByTestId cloud error:', e);
    }
  }

  // Local fallback
  const recs = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.RECORDS) || '[]');
  const matched = recs.find(r => String(r.test_id) === String(testId));
  return matched || null;
}

/**
 * 8. 회차별/시험별 오답 상세 로그 조회 (과목 필터 지원)
 */
async function apiGetWrongHistory(recordId = null, limit = 50, subjectName = null) {
  if (isSupabaseConnected()) {
    try {
      let query = supabaseClient
        .from('test_wrong_history')
        .select('*, vocab_words(word, meaning, pos, word_no, lesson_id)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (recordId) {
        query = query.eq('record_id', recordId);
      }
      const { data, error } = await query;
      if (!error && data) {
        if (subjectName) {
          const lessons = await apiGetLessons(subjectName);
          const lessonIds = new Set(lessons.map(l => Number(l.id)));
          return data.filter(d => lessonIds.has(Number(d.vocab_words?.lesson_id)));
        }
        return data;
      }
    } catch (e) {
      console.warn('apiGetWrongHistory fallback:', e);
    }
  }

  // Local fallback
  const hist = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.WRONG_HISTORY) || '[]');
  let filtered = recordId ? hist.filter(h => h.record_id === recordId) : hist;
  return filtered.slice(0, limit);
}

/**
 * 9. 메타데이터 (별 개수, 관리자 PIN)
 */
async function apiGetMeta(key, defaultVal = '') {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .from('app_meta')
        .select('value')
        .eq('key', key)
        .single();
      if (!error && data) return data.value;
    } catch (e) {}
  }
  return getLocalMeta(key, defaultVal);
}

async function apiSetMeta(key, value) {
  if (isSupabaseConnected()) {
    try {
      await supabaseClient
        .from('app_meta')
        .upsert({ key, value: String(value) });
    } catch (e) {}
  }
  setLocalMeta(key, value);
  return true;
}

/**
 * 10. PDF 시험지 목록 조회 (pdf_tests)
 */
async function apiGetPdfTests(subjectName = null, lessonId = null) {
  if (isSupabaseConnected()) {
    try {
      let query = supabaseClient
        .from('pdf_tests')
        .select('*')
        .order('id', { ascending: false });
      if (subjectName) {
        query = query.eq('subject_name', subjectName);
      }
      if (lessonId && lessonId !== 'ALL_TESTS') {
        query = query.eq('lesson_id', Number(lessonId));
      }
      const { data, error } = await query;
      if (!error && data) return data;
    } catch (e) {
      console.warn('apiGetPdfTests cloud error, fallback:', e);
    }
  }

  // Local fallback
  const raw = localStorage.getItem('mse_local_pdf_tests');
  let tests = [];
  if (raw) {
    try { tests = JSON.parse(raw); } catch (e) {}
  }
  if (subjectName) {
    tests = tests.filter(t => (t.subject_name || '영어') === subjectName);
  }
  if (lessonId && lessonId !== 'ALL_TESTS') {
    tests = tests.filter(t => Number(t.lesson_id) === Number(lessonId));
  }
  return tests;
}

// --------------------------------------------------------
// IndexedDB 로컬 PDF 영구 저장소 (오프라인 & Supabase 스토리지 미설정 대응)
// --------------------------------------------------------
const PDF_DB_NAME = 'MSE_OFFLINE_PDF_DB';
const PDF_STORE_NAME = 'pdf_blobs';

function openPdfIndexedDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(PDF_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
        db.createObjectStore(PDF_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePdfBlobToIndexedDB(key, blob) {
  try {
    const db = await openPdfIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_STORE_NAME, 'readwrite');
      tx.objectStore(PDF_STORE_NAME).put(blob, key);
      tx.oncomplete = () => resolve(key);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('savePdfBlobToIndexedDB error:', err);
    return null;
  }
}

async function getPdfBlobFromIndexedDB(key) {
  try {
    const db = await openPdfIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_STORE_NAME, 'readonly');
      const req = tx.objectStore(PDF_STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('getPdfBlobFromIndexedDB error:', err);
    return null;
  }
}

/**
 * 10-1. PDF 파일 Supabase Storage 업로드 (버킷: test_papers)
 * 클라우드 업로드 실패 시 IndexedDB 로컬 영구 저장소 자동 Fallback
 * @param {File} file
 * @returns {Promise<{ publicUrl: string, path: string }>}
 */
async function apiUploadPdfFile(file) {
  const cleanName = file.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const filePath = `tests/${Date.now()}_${cleanName}`;

  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .storage
        .from('test_papers')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (!error) {
        const { data: publicData } = supabaseClient
          .storage
          .from('test_papers')
          .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
          return {
            publicUrl: publicData.publicUrl,
            path: filePath
          };
        }
      } else {
        console.warn('Supabase Storage 업로드 에러 (로컬 IndexedDB로 보존):', error);
      }
    } catch (err) {
      console.warn('apiUploadPdfFile 클라우드 예외 (로컬 IndexedDB로 보존):', err);
    }
  }

  // 로컬/오프라인 모드 또는 스토리지 미설정 시 IndexedDB에 영구 보존
  await savePdfBlobToIndexedDB(filePath, file);
  return {
    publicUrl: `idb:${filePath}`,
    path: filePath,
    offline: true
  };
}

/**
 * 11. PDF 시험지 등록 (pdf_tests)
 */
async function apiCreatePdfTest(testData) {
  const isAllTests = (!testData.lesson_id || testData.lesson_id === 'ALL_TESTS' || testData.lesson_id === '전체테스트');
  const payload = {
    subject_name: testData.subject_name || '영어',
    lesson_id: isAllTests ? null : Number(testData.lesson_id),
    title: testData.title || '새 시험지',
    pdf_filename: testData.pdf_filename || '',
    pdf_file_url: testData.pdf_file_url || '',
    start_page: Number(testData.start_page) || 1,
    end_page: Number(testData.end_page) || 1,
    total_questions: Number(testData.total_questions) || 0,
    answer_sheet: testData.answer_sheet || {},
    test_category: testData.test_category || 'UNIT',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .from('pdf_tests')
        .insert([payload])
        .select();
      if (!error && data && data[0]) return data[0];
      if (error) console.warn('apiCreatePdfTest cloud insert error:', error);
    } catch (e) {
      console.warn('apiCreatePdfTest cloud error, saving locally:', e);
    }
  }

  // Local fallback
  const raw = localStorage.getItem('mse_local_pdf_tests');
  let tests = [];
  if (raw) {
    try { tests = JSON.parse(raw); } catch (e) {}
  }
  const nextId = tests.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0) + 1;
  const newTest = { id: nextId, ...payload };
  tests.unshift(newTest);
  localStorage.setItem('mse_local_pdf_tests', JSON.stringify(tests));
  return newTest;
}

/**
 * 12. PDF 시험지 삭제
 */
async function apiDeletePdfTest(testId) {
  const idNum = Number(testId);
  if (isSupabaseConnected()) {
    try {
      await supabaseClient.from('pdf_tests').delete().eq('id', idNum);
    } catch (e) {
      console.warn('apiDeletePdfTest cloud error:', e);
    }
  }

  const raw = localStorage.getItem('mse_local_pdf_tests');
  let tests = [];
  if (raw) {
    try { tests = JSON.parse(raw); } catch (e) {}
  }
  tests = tests.filter(t => Number(t.id) !== idNum);
  localStorage.setItem('mse_local_pdf_tests', JSON.stringify(tests));
  return true;
}

/**
 * 13. 테스트 완료 시 schedules 테이블 자동 일정 등록 (실제 플래너 12개 컬럼 완벽 일치)
 */
async function apiCreateScheduleFromTest({ subject, lessonId, testTitle, category, score, correctCount, totalCount, durationSec }) {
  const today = new Date().toISOString().slice(0, 10);
  const scheduleId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'sched_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  const schedulePayload = {
    id: scheduleId,
    lesson_id: lessonId ? Number(lessonId) : null,
    subject: subject || '영어',
    date: today,
    category: category || '테스트',
    title: `${testTitle || '시험'} 완료`,
    detail: `${correctCount || 0}/${totalCount || 0} 정답 (${score}점 획득)`,
    progress: 100,
    score: String(score),
    duration_sec: Number(durationSec) || 0,
    completed: true,
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConnected()) {
    try {
      const { error } = await supabaseClient.from('schedules').insert([schedulePayload]);
      if (error) console.warn('schedules insert error:', error);
      else console.log('✨ schedules 테이블 자동 등록 성공:', schedulePayload.title);
    } catch (e) {
      console.warn('schedules insert warning:', e);
    }
  }

  // Local fallback
  const raw = localStorage.getItem('mse_local_schedules');
  let scheds = [];
  if (raw) {
    try { scheds = JSON.parse(raw); } catch (e) {}
  }
  scheds.unshift(schedulePayload);
  localStorage.setItem('mse_local_schedules', JSON.stringify(scheds.slice(0, 50)));
  return schedulePayload;
}

// ========================================================
// 12. 오답노트 관리 API (wrong_answers)
// ========================================================

/**
 * 오답노트 저장 / 수정
 */
async function saveWrongAnswerNote(data) {
  if (!data) return null;

  const now = new Date().toISOString();
  let lessonIdVal = data.lesson_id;
  if (lessonIdVal === 'ALL_TESTS' || lessonIdVal === '전체테스트' || !lessonIdVal) {
    lessonIdVal = null;
  } else {
    lessonIdVal = Number(lessonIdVal);
  }

  const payload = {
    user_id: data.user_id || 'student',
    subject: data.subject || '영어',
    lesson_id: lessonIdVal,
    test_id: data.test_id ? Number(data.test_id) : null,
    test_title: data.test_title || '',
    question_num: Number(data.question_num),
    user_answer: data.user_answer !== undefined ? String(data.user_answer) : '',
    correct_answer: data.correct_answer !== undefined ? String(data.correct_answer) : '',
    notes: data.notes !== undefined ? String(data.notes) : '',
    updated_at: now
  };

  let savedRecord = null;

  if (isSupabaseConnected()) {
    try {
      if (data.id) {
        const { data: updated, error } = await supabaseClient
          .from('wrong_answers')
          .update(payload)
          .eq('id', data.id)
          .select()
          .single();
        if (!error && updated) savedRecord = updated;
      } else if (payload.test_id && payload.question_num) {
        const { data: existing } = await supabaseClient
          .from('wrong_answers')
          .select('id')
          .eq('test_id', payload.test_id)
          .eq('question_num', payload.question_num)
          .maybeSingle();

        if (existing && existing.id) {
          const { data: updated, error } = await supabaseClient
            .from('wrong_answers')
            .update(payload)
            .eq('id', existing.id)
            .select()
            .single();
          if (!error && updated) savedRecord = updated;
        } else {
          payload.created_at = now;
          const { data: inserted, error } = await supabaseClient
            .from('wrong_answers')
            .insert([payload])
            .select()
            .single();
          if (!error && inserted) savedRecord = inserted;
        }
      } else {
        payload.created_at = now;
        const { data: inserted, error } = await supabaseClient
          .from('wrong_answers')
          .insert([payload])
          .select()
          .single();
        if (!error && inserted) savedRecord = inserted;
      }
    } catch (e) {
      console.warn('saveWrongAnswerNote supabase failed, fallback to local:', e);
    }
  }

  // Local storage fallback / mirror
  const raw = localStorage.getItem('mse_local_wrong_answers');
  let list = [];
  if (raw) {
    try { list = JSON.parse(raw); } catch (e) { list = []; }
  }

  if (savedRecord) {
    const idx = list.findIndex(item => item.id == savedRecord.id);
    if (idx >= 0) list[idx] = savedRecord;
    else list.unshift(savedRecord);
    localStorage.setItem('mse_local_wrong_answers', JSON.stringify(list));
    return savedRecord;
  }

  let targetIdx = -1;
  if (data.id) {
    targetIdx = list.findIndex(item => item.id == data.id);
  } else if (payload.test_id && payload.question_num) {
    targetIdx = list.findIndex(item => item.test_id == payload.test_id && item.question_num == payload.question_num);
  }

  if (targetIdx >= 0) {
    list[targetIdx] = {
      ...list[targetIdx],
      ...payload,
      updated_at: now
    };
    savedRecord = list[targetIdx];
  } else {
    savedRecord = {
      id: Date.now(),
      ...payload,
      created_at: now,
      updated_at: now
    };
    list.unshift(savedRecord);
  }

  localStorage.setItem('mse_local_wrong_answers', JSON.stringify(list));
  return savedRecord;
}

/**
 * 오답 목록 조회 (필터링: subject, lesson_id, test_id, question_num)
 */
async function getWrongAnswerNotes(filter = {}) {
  if (isSupabaseConnected()) {
    try {
      let query = supabaseClient.from('wrong_answers').select('*');
      if (filter.subject && filter.subject !== 'ALL') {
        query = query.eq('subject', filter.subject);
      }
      if (filter.lesson_id !== undefined && filter.lesson_id !== null && filter.lesson_id !== 'ALL') {
        if (filter.lesson_id === 'UNASSIGNED') {
          query = query.is('lesson_id', null);
        } else {
          query = query.eq('lesson_id', Number(filter.lesson_id));
        }
      }
      if (filter.test_id && filter.test_id !== 'ALL') {
        query = query.eq('test_id', Number(filter.test_id));
      }
      if (filter.question_num) {
        query = query.eq('question_num', Number(filter.question_num));
      }
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (e) {
      console.warn('getWrongAnswerNotes supabase failed, fallback to local:', e);
    }
  }

  // Local fallback
  const raw = localStorage.getItem('mse_local_wrong_answers');
  let list = [];
  if (raw) {
    try { list = JSON.parse(raw); } catch (e) { list = []; }
  }

  return list.filter(item => {
    if (filter.subject && filter.subject !== 'ALL' && item.subject !== filter.subject) return false;
    if (filter.lesson_id !== undefined && filter.lesson_id !== null && filter.lesson_id !== 'ALL') {
      if (filter.lesson_id === 'UNASSIGNED') {
        if (item.lesson_id !== null && item.lesson_id !== undefined && item.lesson_id !== 'ALL_TESTS') return false;
      } else if (item.lesson_id != filter.lesson_id) {
        return false;
      }
    }
    if (filter.test_id && filter.test_id !== 'ALL' && item.test_id != filter.test_id) return false;
    if (filter.question_num && item.question_num != filter.question_num) return false;
    return true;
  });
}

/**
 * 오답 단원 변경
 */
async function updateWrongAnswerLesson(noteId, newLessonId) {
  let lessonIdVal = newLessonId;
  if (lessonIdVal === 'ALL_TESTS' || lessonIdVal === '전체테스트' || !lessonIdVal) {
    lessonIdVal = null;
  } else {
    lessonIdVal = Number(lessonIdVal);
  }
  const now = new Date().toISOString();

  if (isSupabaseConnected()) {
    try {
      const { error } = await supabaseClient
        .from('wrong_answers')
        .update({ lesson_id: lessonIdVal, updated_at: now })
        .eq('id', noteId);
      if (error) console.warn('updateWrongAnswerLesson supabase error:', error);
    } catch (e) {
      console.warn('updateWrongAnswerLesson supabase failed:', e);
    }
  }

  // Local storage update
  const raw = localStorage.getItem('mse_local_wrong_answers');
  if (raw) {
    try {
      const list = JSON.parse(raw);
      const idx = list.findIndex(item => item.id == noteId);
      if (idx >= 0) {
        list[idx].lesson_id = lessonIdVal;
        list[idx].updated_at = now;
        localStorage.setItem('mse_local_wrong_answers', JSON.stringify(list));
      }
    } catch (e) {}
  }
  return true;
}

/**
 * 오답노트 삭제
 */
async function deleteWrongAnswerNote(noteId) {
  if (isSupabaseConnected()) {
    try {
      const { error } = await supabaseClient
        .from('wrong_answers')
        .delete()
        .eq('id', noteId);
      if (error) console.warn('deleteWrongAnswerNote supabase error:', error);
    } catch (e) {
      console.warn('deleteWrongAnswerNote supabase failed:', e);
    }
  }

  // Local storage update
  const raw = localStorage.getItem('mse_local_wrong_answers');
  if (raw) {
    try {
      let list = JSON.parse(raw);
      list = list.filter(item => item.id != noteId);
      localStorage.setItem('mse_local_wrong_answers', JSON.stringify(list));
    } catch (e) {}
  }
  return true;
}

/**
 * 9-1. 단원별 서술형 영작 문장 목록 조회
 */
async function apiGetWritingSentences(lessonId) {
  if (!lessonId) return [];
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .from('writing_sentences')
        .select('*')
        .eq('lesson_id', Number(lessonId) || lessonId)
        .order('sentence_no', { ascending: true });
      if (!error && data) return data;
    } catch (e) {
      console.warn('apiGetWritingSentences fallback:', e);
    }
  }

  // Local fallback
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.WRITING_PREFIX + lessonId);
  return raw ? JSON.parse(raw) : [];
}

/**
 * 9-2. 서술형 영작 문장 일괄 등록 (기존 삭제 후 등록)
 */
async function apiInsertWritingSentences(lessonId, sentences) {
  if (!lessonId || !sentences || sentences.length === 0) return [];
  const records = sentences.map((s, idx) => ({
    lesson_id: Number(lessonId) || lessonId,
    sentence_no: Number(s.sentence_no) || (idx + 1),
    korean_prompt: s.korean_prompt || '',
    english_sentence: s.english_sentence || '',
    word_count: Number(s.word_count) || (s.english_sentence ? s.english_sentence.trim().split(/\s+/).length : 0)
  }));

  if (isSupabaseConnected()) {
    try {
      await supabaseClient
        .from('writing_sentences')
        .delete()
        .eq('lesson_id', Number(lessonId) || lessonId);

      const { data, error } = await supabaseClient
        .from('writing_sentences')
        .insert(records)
        .select();

      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('apiInsertWritingSentences cloud error:', e);
      throw e;
    }
  }

  // Local fallback
  const saved = records.map((r, i) => ({
    ...r,
    id: Date.now() + i,
    test_count: 0,
    wrong_count: 0,
    is_mastered: false,
    created_at: new Date().toISOString()
  }));
  localStorage.setItem(LOCAL_STORAGE_KEYS.WRITING_PREFIX + lessonId, JSON.stringify(saved));
  return saved;
}

/**
 * 9-3. 서술형 문장 풀이 통계(오답/응시) 업데이트
 */
async function apiUpdateWritingSentenceStats(sentenceId, isCorrect, lessonId = null) {
  if (!sentenceId) return false;
  if (isSupabaseConnected()) {
    try {
      const { data: cur } = await supabaseClient
        .from('writing_sentences')
        .select('test_count, wrong_count')
        .eq('id', sentenceId)
        .single();
      if (cur) {
        await supabaseClient
          .from('writing_sentences')
          .update({
            test_count: (cur.test_count || 0) + 1,
            wrong_count: (cur.wrong_count || 0) + (isCorrect ? 0 : 1)
          })
          .eq('id', sentenceId);
      }
      return true;
    } catch (e) {
      console.warn('apiUpdateWritingSentenceStats cloud error:', e);
    }
  }

  // Local fallback
  if (lessonId) {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.WRITING_PREFIX + lessonId);
    if (raw) {
      try {
        const list = JSON.parse(raw);
        const item = list.find(s => s.id == sentenceId || s.sentence_no == sentenceId);
        if (item) {
          item.test_count = (item.test_count || 0) + 1;
          if (!isCorrect) item.wrong_count = (item.wrong_count || 0) + 1;
          localStorage.setItem(LOCAL_STORAGE_KEYS.WRITING_PREFIX + lessonId, JSON.stringify(list));
        }
      } catch (e) {}
    }
  }
  return true;
}

// 브라우저 전역 노출
window.MSE_DB = {
  initSupabase,
  isSupabaseConnected,
  saveSupabaseConfig,
  getSupabaseConfig,
  apiGetSubjects,
  apiUpsertSubject,
  apiDeleteSubject,
  apiGetLessons,
  apiCreateLesson,
  apiDeleteLesson,
  apiGetWords,
  apiInsertWords,
  apiGetWrongWords,
  apiSubmitTest,
  apiSaveTestRecord: apiSubmitTest,
  apiInsertTestRecord: apiSubmitTest,
  apiGetTestRecords,
  apiGetLastTestRecordByTestId,
  apiGetWrongHistory,
  apiGetMeta,
  apiSetMeta,
  apiGetPdfTests,
  apiUploadPdfFile,
  apiCreatePdfTest,
  apiDeletePdfTest,
  apiCreateScheduleFromTest,
  saveWrongAnswerNote,
  getWrongAnswerNotes,
  updateWrongAnswerLesson,
  deleteWrongAnswerNote,
  apiGetWritingSentences,
  apiInsertWritingSentences,
  apiUpdateWritingSentenceStats,
  getPdfBlob: getPdfBlobFromIndexedDB
};

