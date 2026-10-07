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
  LESSONS: 'mse_local_lessons',
  WORDS_PREFIX: 'mse_local_words_',
  RECORDS: 'mse_local_records',
  WRONG_HISTORY: 'mse_local_wrong_history',
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
 * 1. 대단원 목록 가져오기
 */
async function apiGetLessons() {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .from('lessons')
        .select('*')
        .order('id', { ascending: true });
      if (!error && data && data.length > 0) return data;
    } catch (e) {
      console.warn('apiGetLessons fallback to local:', e);
    }
  }

  // Local fallback
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.LESSONS);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  const defaultLessons = [{ id: 1, unit_name: "3. The Gift of Art (비상 홍민표)" }];
  localStorage.setItem(LOCAL_STORAGE_KEYS.LESSONS, JSON.stringify(defaultLessons));
  return defaultLessons;
}

/**
 * 2. 새 대단원 생성
 */
async function apiCreateLesson(unitName) {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabaseClient
        .from('lessons')
        .insert([{ unit_name: unitName }])
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
  const newLesson = { id: nextId, unit_name: unitName };
  lessons.push(newLesson);
  localStorage.setItem(LOCAL_STORAGE_KEYS.LESSONS, JSON.stringify(lessons));
  return newLesson;
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
async function apiSubmitTest({ lessonId, round, testMode, score, correctCount, totalCount, starsWon, wrongItems, correctWordIds, testCategory = 'VOCAB', testTitle = '' }) {
  let recordId = Date.now();

  if (isSupabaseConnected()) {
    try {
      // 6-1. test_records 삽입
      const { data: recData, error: recErr } = await supabaseClient
        .from('test_records')
        .insert([{
          lesson_id: lessonId,
          test_category: testCategory,
          test_title: testTitle,
          round: round,
          test_mode: testMode,
          score: score,
          correct_count: correctCount,
          total_count: totalCount,
          stars_won: starsWon
        }])
        .select();

      if (recErr) console.warn('Record insert error:', recErr);
      if (recData && recData[0]) {
        recordId = recData[0].id;
      }

      // 6-2. test_wrong_history 삽입
      if (wrongItems && wrongItems.length > 0) {
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

      // 6-4. 누적 별 개수 업데이트
      const currentStars = await apiGetMeta('total_stars', '0');
      const newStars = parseInt(currentStars, 10) + starsWon;
      await apiSetMeta('total_stars', String(newStars));

      return { success: true, recordId, totalStars: newStars };
    } catch (e) {
      console.warn('apiSubmitTest cloud error, saving locally:', e);
    }
  }

  // Local fallback 업데이트
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

  // 로컬 시험 기록 저장
  const recs = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.RECORDS) || '[]');
  recs.unshift({
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
    test_date: new Date().toISOString()
  });
  localStorage.setItem(LOCAL_STORAGE_KEYS.RECORDS, JSON.stringify(recs));

  // 로컬 오답 히스토리
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

  // 로컬 별 업데이트
  const curStars = parseInt(getLocalMeta('total_stars', '0'), 10) + starsWon;
  setLocalMeta('total_stars', curStars);

  return { success: true, recordId, totalStars: curStars };
}

/**
 * 7. 부모님/관리자용 시험 성적표 목록 조회
 */
async function apiGetTestRecords(lessonId = null, limit = 20, category = null) {
  if (isSupabaseConnected()) {
    try {
      let query = supabaseClient
        .from('test_records')
        .select('*, lessons(unit_name)')
        .order('test_date', { ascending: false })
        .limit(limit);

      if (lessonId) {
        query = query.eq('lesson_id', lessonId);
      }
      if (category) {
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
  if (category) {
    recs = recs.filter(r => (r.test_category || 'VOCAB') === category);
  }
  const lessons = await apiGetLessons();
  const lessonMap = Object.fromEntries(lessons.map(l => [l.id, l.unit_name]));
  return recs.slice(0, limit).map(r => ({
    ...r,
    lessons: { unit_name: lessonMap[r.lesson_id] || '3과 The Gift of Art' }
  }));
}

/**
 * 8. 회차별/시험별 오답 상세 로그 조회
 */
async function apiGetWrongHistory(recordId = null, limit = 50) {
  if (isSupabaseConnected()) {
    try {
      let query = supabaseClient
        .from('test_wrong_history')
        .select('*, vocab_words(word, meaning, pos, word_no)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (recordId) {
        query = query.eq('record_id', recordId);
      }
      const { data, error } = await query;
      if (!error && data) return data;
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

// 브라우저 전역 노출
window.MSE_DB = {
  initSupabase,
  isSupabaseConnected,
  saveSupabaseConfig,
  getSupabaseConfig,
  apiGetLessons,
  apiCreateLesson,
  apiGetWords,
  apiInsertWords,
  apiGetWrongWords,
  apiSubmitTest,
  apiGetTestRecords,
  apiGetWrongHistory,
  apiGetMeta,
  apiSetMeta
};
