// ========================================================
// MY SPECIAL ENGLISH : 고1 내신 대비 비밀 노트 (app.js)
// Supabase 클라우드 DB 연동, 스마트 채점, PWA & 부모님 실시간 리포트
// ========================================================

const APP_STATE = {
  currentSubject: '영어',
  currentLessonId: 1,
  currentLessonName: "3. The Gift of Art (비상 홍민표)",
  subjects: ['영어'],
  subjectsMeta: [],
  lessons: [],
  allWords: [],

  // Study View
  currentPage: 1, // 1~2 (20개씩)
  pageSize: 20,
  totalPages: 2,
  maskMode: 'none', // 'none' | 'korean' | 'english' | 'all'
  individualReveals: {},

  // Test State
  testCategory: 'VOCAB', // 'VOCAB' | 'UNIT' | 'WRITING'
  testTitle: '',
  testMode: 'ALL',       // 'ALL' | 'WRONG_ONLY'
  currentRound: 1,       // 1~5
  testStartTime: null,   // 테스트 시작 시각 (소요 시간 측정)
  testQuestions: [],
  userAnswers: {},

  // Stats & Admin
  totalStars: 0,
  wrongRanking: [],
  adminUnlocked: true,
  adminPin: '0000',
  currentReportSubject: '영어',
  currentReportFilter: 'ALL',
  currentReportLessonId: null,

  // PDF Paper Test State (2단 분할 뷰어 & 패드 필기)
  pdfTests: [],
  currentPdfTest: null,
  paperSolveMode: 'EXAM', // 'EXAM' (실전 모의고사) | 'TRAINING' (즉시 학습)
  paperTimerInterval: null,
  paperDurationSec: 0,
  paperCurrentQ: 1,
  paperUserAnswers: {},
  paperTotalQuestions: 20,
  paperPdfDoc: null,
  paperStartPage: 1,
  paperEndPage: 1,
  paperCurrentStep: 0,
  paperTotalSteps: 0,
  drawingsCache: {},    // step -> dataURL
  penColor: '#111827',
  penWidth: 2,
  penMode: 'pen',       // 'pen' | 'highlighter' | 'eraser'
  currentRenderTask: null,

  // Explanation Viewer State
  explPdfDoc: null,
  explStartPage: 1,
  explEndPage: 1,
  explCurrentStep: 0,
  explTotalSteps: 0,
  currentExplRenderTask: null,

  // Writing Sentences Practice State (서술형 영작)
  writingSentences: [],
  currentWritingIndex: 0
};

// --------------------------------------------------------
// 완전 무음 보장 (모든 효과음 소리 없음)
// --------------------------------------------------------
const soundFX = {
  click() {},
  success() {},
  fail() {}
};

// 학생이 스피커 아이콘을 직접 눌렀을 때만 발음 재생 (Web Speech API)
function speakWord(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  }
}

// --------------------------------------------------------
// 데이터 로드 & 클라우드 상태 초기화
// --------------------------------------------------------
async function initAppData() {
  // PWA 서비스 워커 등록
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('PWA ServiceWorker registration failed:', err);
      });
    });
  }

  // PDF.js 워커 공식 CDN 설정 (Fake worker 경고 방지)
  if (typeof pdfjsLib !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // Supabase 클라이언트 초기화
  window.MSE_DB.initSupabase();
  updateCloudStatusBadge();

  // 메타데이터(별, PIN) 불러오기
  await fetchMeta();

  // 과목 및 대단원 목록 불러오기 (2단계 계층)
  await fetchSubjectsAndLessons();
}

function updateCloudStatusBadge() {
  const tag = document.getElementById('cloudStatusTag');
  const desc = document.getElementById('cloudStatusDesc');
  if (window.MSE_DB.isSupabaseConnected()) {
    tag.textContent = '클라우드 동기화 중';
    tag.className = 'cloud-status-tag connected';
    desc.innerHTML = 'Supabase 클라우드와 연결되어 모든 기기 간 성적이 <b>실시간 자동 동기화</b>됩니다.';
  } else {
    tag.textContent = '로컬 오프라인 모드';
    tag.className = 'cloud-status-tag local';
    desc.innerHTML = '현재 로컬 기기에 안전 보관 중입니다. <b>[클라우드 설정]</b>에서 Supabase를 연동하면 원격 동기화가 활성화됩니다.';
  }
}

async function fetchMeta() {
  try {
    const stars = await window.MSE_DB.apiGetMeta('total_stars', '0');
    APP_STATE.totalStars = parseInt(stars, 10) || 0;
    updateStarDisplay();

    const pin = await window.MSE_DB.apiGetMeta('admin_pin', '0000');
    APP_STATE.adminPin = pin || '0000';
  } catch (e) {
    console.warn('fetchMeta error:', e);
  }
}

function updateStarDisplay() {
  const starCountEl = document.getElementById('headerStarCount');
  if (starCountEl) starCountEl.textContent = APP_STATE.totalStars;
  const rewardStarEl = document.getElementById('rewardStarCount');
  if (rewardStarEl) rewardStarEl.textContent = APP_STATE.totalStars;
  renderStampBoard();
}

async function fetchSubjectsAndLessons() {
  try {
    const rawSubjects = await window.MSE_DB.apiGetSubjects();
    APP_STATE.subjectsMeta = Array.isArray(rawSubjects) ? rawSubjects : [];
    APP_STATE.subjects = APP_STATE.subjectsMeta.map(s => typeof s === 'string' ? s : s.name).filter(Boolean);
    if (APP_STATE.subjects.length === 0) {
      APP_STATE.subjects = ['영어'];
      APP_STATE.subjectsMeta = [{ name: '영어', dday: '', target_score: 100, color: 'indigo' }];
    }
    if (!APP_STATE.subjects.includes(APP_STATE.currentSubject)) {
      APP_STATE.currentSubject = APP_STATE.subjects[0];
    }

    renderSubjectSelect();
    updateCategoryBoxVisibility();
    updateTabsVisibilityBySubject();
    updateSubjectHeaderBadge();
    await loadLessonsForSubject(APP_STATE.currentSubject);
    await loadPdfTests(APP_STATE.currentSubject);
  } catch (e) {
    console.warn('fetchSubjectsAndLessons error:', e);
  }
}

function renderSubjectSelect() {
  const selects = [document.getElementById('mainSubjectSelect'), document.getElementById('subjectSelect')].filter(Boolean);
  selects.forEach(sel => {
    sel.innerHTML = '';
    APP_STATE.subjects.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.textContent = `📚 ${sub}`;
      if (sub === APP_STATE.currentSubject) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function updateCategoryBoxVisibility() {
  const box = document.getElementById('englishCategoryBox');
  if (box) {
    const isEng = (APP_STATE.currentSubject === '영어');
    box.style.display = isEng ? 'flex' : 'none';
  }
}

function updateTabsVisibilityBySubject() {
  const tabsBar = document.querySelector('.tabs-bar');
  if (!tabsBar) return;
  const isEng = (APP_STATE.currentSubject === '영어');
  tabsBar.classList.toggle('tabs-hidden', !isEng);

  // 타 과목(국어, 수학 등) 선택 시 시험지 탭으로 자동 이동하여 시험지 표시
  if (!isEng && !document.getElementById('tab-paper_test')?.classList.contains('active')) {
    document.getElementById('tabBtnPaperTest')?.click();
  }
}

function updateSubjectHeaderBadge() {
  const badgeEl = document.getElementById('headerSubjectBadge');
  if (!badgeEl) return;
  const meta = APP_STATE.subjectsMeta.find(s => (s.name || s) === APP_STATE.currentSubject);
  if (!meta) {
    badgeEl.style.display = 'none';
    return;
  }

  let ddayText = null;
  if (meta.dday) {
    const target = new Date(meta.dday + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (!isNaN(diffDays)) {
      if (diffDays === 0) ddayText = 'D-Day';
      else if (diffDays > 0) ddayText = `D-${diffDays}`;
      else ddayText = `D+${Math.abs(diffDays)}`;
    }
  }

  const parts = [];
  if (ddayText) parts.push(ddayText);
  if (meta.target_score) parts.push(`목표 ${meta.target_score}점`);

  if (parts.length > 0) {
    badgeEl.textContent = `🎯 ${parts.join(' · ')}`;
    badgeEl.dataset.color = meta.color || 'indigo';
    badgeEl.style.display = 'inline-flex';
  } else {
    badgeEl.style.display = 'none';
  }
}

async function loadLessonsForSubject(subject) {
  try {
    APP_STATE.lessons = await window.MSE_DB.apiGetLessons(subject);
    renderLessonSelect();

    if (APP_STATE.lessons.length > 0) {
      const exists = APP_STATE.lessons.find(l => String(l.id) === String(APP_STATE.currentLessonId));
      const targetId = exists ? exists.id : APP_STATE.lessons[0].id;
      await switchLesson(targetId);
    } else {
      await switchLesson('ALL_TESTS');
    }
  } catch (e) {
    console.warn('loadLessonsForSubject error:', e);
  }
}

function renderLessonSelect() {
  const selects = [document.getElementById('mainLessonSelect'), document.getElementById('lessonSelect')].filter(Boolean);
  selects.forEach(sel => {
    sel.innerHTML = '';

    // 전체테스트 옵션 최상단 추가
    const allOpt = document.createElement('option');
    allOpt.value = 'ALL_TESTS';
    allOpt.textContent = '⭐ [전체테스트] 전체 범위';
    if (APP_STATE.currentLessonId === 'ALL_TESTS') allOpt.selected = true;
    sel.appendChild(allOpt);

    APP_STATE.lessons.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.unit_name;
      if (String(l.id) === String(APP_STATE.currentLessonId)) opt.selected = true;
      sel.appendChild(opt);
    });
  });

  const drawerText = document.getElementById('drawerCurrentLessonText');
  const headerTag = document.getElementById('headerLessonTag');
  if (APP_STATE.currentLessonId === 'ALL_TESTS') {
    APP_STATE.currentLessonName = '⭐ [전체테스트] 전체 범위';
    if (drawerText) drawerText.textContent = `${APP_STATE.currentSubject} · [전체테스트]`;
    if (headerTag) headerTag.textContent = `${APP_STATE.currentSubject} · [전체테스트]`;
  } else {
    const cur = APP_STATE.lessons.find(l => String(l.id) === String(APP_STATE.currentLessonId));
    if (cur) {
      APP_STATE.currentLessonName = cur.unit_name;
      if (drawerText) drawerText.textContent = `${cur.subject_name || APP_STATE.currentSubject} · ${cur.unit_name}`;
      if (headerTag) headerTag.textContent = `${cur.subject_name || APP_STATE.currentSubject} · ${cur.unit_name}`;
    }
  }
}

async function switchLesson(lessonId) {
  APP_STATE.currentLessonId = (lessonId === 'ALL_TESTS') ? 'ALL_TESTS' : Number(lessonId);
  const selects = [document.getElementById('mainLessonSelect'), document.getElementById('lessonSelect')].filter(Boolean);
  selects.forEach(s => s.value = lessonId);

  const drawerText = document.getElementById('drawerCurrentLessonText');
  const headerTag = document.getElementById('headerLessonTag');

  if (lessonId === 'ALL_TESTS') {
    APP_STATE.currentLessonName = '⭐ [전체테스트] 전체 범위';
    if (drawerText) drawerText.textContent = `${APP_STATE.currentSubject} · [전체테스트]`;
    if (headerTag) headerTag.textContent = `${APP_STATE.currentSubject} · [전체테스트]`;
    APP_STATE.allWords = [];
    renderStudyPage();
  } else {
    const cur = APP_STATE.lessons.find(l => String(l.id) === String(lessonId));
    if (cur) {
      APP_STATE.currentLessonName = cur.unit_name;
      if (drawerText) drawerText.textContent = `${cur.subject_name || APP_STATE.currentSubject} · ${cur.unit_name}`;
      if (headerTag) headerTag.textContent = `${cur.subject_name || APP_STATE.currentSubject} · ${cur.unit_name}`;
    }
    APP_STATE.currentPage = 1;
    APP_STATE.individualReveals = {};
    await fetchWords(APP_STATE.currentLessonId);
  }

  // 영어 과목인 경우 서술형 영작 데이터도 함께 로드
  if (APP_STATE.currentSubject === '영어' && lessonId !== 'ALL_TESTS') {
    await fetchWritingSentences(APP_STATE.currentLessonId);
    if (document.getElementById('tab-paper_test')?.classList.contains('active')) {
      initWritingSession();
    }
  }

  // 시험지 목록 다시 불러오기
  await loadPdfTests(APP_STATE.currentSubject, APP_STATE.currentLessonId);
}

async function fetchWords(lessonId) {
  try {
    let words = await window.MSE_DB.apiGetWords(lessonId);
    if (!words || words.length === 0) {
      if (typeof VOCAB_DATA !== 'undefined' && Number(lessonId) === 1) {
        words = VOCAB_DATA.map((w, idx) => ({
          ...w,
          id: w.id || idx + 1,
          lesson_id: 1,
          word_no: w.id || idx + 1,
          wrong_count: 0,
          test_count: 0
        }));
      }
    }
    APP_STATE.allWords = words || [];
    APP_STATE.totalPages = Math.max(1, Math.ceil(APP_STATE.allWords.length / APP_STATE.pageSize));
    renderStudyPage();
    await fetchWrongWords(lessonId);
    renderFinalMistakesTable();
  } catch (e) {
    console.warn('fetchWords error:', e);
  }
}

async function fetchWrongWords(lessonId) {
  try {
    const wrong = await window.MSE_DB.apiGetWrongWords(lessonId);
    APP_STATE.wrongRanking = wrong || [];
    renderRankingTable();
  } catch (e) {
    console.warn('fetchWrongWords error:', e);
  }
}

// --------------------------------------------------------
// TAB 1: 단어 공부 뷰 (한 화면 20단어 컴팩트 뷰)
// --------------------------------------------------------
function renderStudyPage() {
  const startIdx = (APP_STATE.currentPage - 1) * APP_STATE.pageSize;
  const currentWords = APP_STATE.allWords.slice(startIdx, startIdx + APP_STATE.pageSize);

  const startNo = currentWords.length > 0 ? (currentWords[0].word_no || startIdx + 1) : 0;
  const endNo = currentWords.length > 0 ? (currentWords[currentWords.length - 1].word_no || startIdx + currentWords.length) : 0;

  document.getElementById('pageTitleText').textContent = 
    `${APP_STATE.currentPage} / ${APP_STATE.totalPages} 페이지 (${startNo}~${endNo}번)`;

  // Dots
  const dotsContainer = document.getElementById('pageDots');
  dotsContainer.innerHTML = '';
  for (let i = 1; i <= APP_STATE.totalPages; i++) {
    const dot = document.createElement('div');
    dot.className = `page-dot ${i === APP_STATE.currentPage ? 'active' : ''}`;
    dotsContainer.appendChild(dot);
  }

  const grid = document.getElementById('wordsGrid');
  grid.innerHTML = '';

  if (currentWords.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #8C7FA9;">
      등록된 단어가 없습니다. 사이드바 메뉴에서 단어장 PDF를 등록해주세요.
    </div>`;
    return;
  }

  currentWords.forEach((word) => {
    const card = document.createElement('div');
    card.className = 'word-card';

    const wordKey = `w_${word.id || word.word_no}`;
    const isIndivRevealed = APP_STATE.individualReveals[wordKey];

    const isEngMasked = (APP_STATE.maskMode === 'english' || APP_STATE.maskMode === 'all') && !isIndivRevealed;
    const isKorMasked = (APP_STATE.maskMode === 'korean' || APP_STATE.maskMode === 'all') && !isIndivRevealed;

    card.innerHTML = `
      <div class="word-card-left">
        <span class="word-num">${word.word_no || word.id}</span>
        <button class="word-tts-btn" title="영어 발음 듣기" data-word="${word.word}">🔊</button>
        <div class="word-english-box">
          <span class="word-text ${isEngMasked ? 'masked-text' : ''}" data-wordkey="${wordKey}">
            ${word.word}
          </span>
          <span class="word-pos">${word.pos || ''}</span>
        </div>
      </div>
      <div class="word-meaning-box ${isKorMasked ? 'masked-text' : ''}" data-wordkey="${wordKey}" title="${word.meaning}">
        ${word.meaning}
      </div>
    `;

    // TTS Button (학생이 직접 누를 때만 소리 재생)
    const ttsBtn = card.querySelector('.word-tts-btn');
    ttsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakWord(word.word);
    });

    // 개별 마스크 토글
    card.querySelectorAll('[data-wordkey]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        APP_STATE.individualReveals[wordKey] = !APP_STATE.individualReveals[wordKey];
        renderStudyPage();
      });
    });

    grid.appendChild(card);
  });
}

// --------------------------------------------------------
// TAB 2: 주관식 테스트 모듈 (스마트 채점 연동)
// --------------------------------------------------------
function initTestSession() {
  let sourceWords = [];

  if (APP_STATE.testMode === 'WRONG_ONLY') {
    sourceWords = APP_STATE.allWords.filter(w => (w.wrong_count || 0) > 0);
    if (sourceWords.length === 0) {
      alert('현재 누적된 오답 단어가 없습니다! 모든 단어 풀기 모드로 진행합니다.');
      APP_STATE.testMode = 'ALL';
      updateTestModeButtons();
      sourceWords = [...APP_STATE.allWords];
    }
  } else {
    sourceWords = [...APP_STATE.allWords];
  }

  // 문제 구성 (영단어->한글뜻, 한글뜻->영단어 교차)
  APP_STATE.testQuestions = sourceWords.map((w, idx) => {
    const isWriteKorean = (idx % 2 === 0);
    return {
      index: idx + 1,
      target: w,
      qType: isWriteKorean ? 'KOREAN' : 'ENGLISH',
      prompt: isWriteKorean ? `${w.word} (${w.pos || ''})` : `${w.meaning} (${w.pos || ''})`,
      placeholder: isWriteKorean ? "한글 뜻 입력" : "영어 단어 입력",
      badgeText: isWriteKorean ? "🇰🇷 한글 뜻" : "🇺🇸 영단어"
    };
  });

  APP_STATE.userAnswers = {};
  APP_STATE.testStartTime = Date.now();

  renderTestQuestions();
}

function updateTestModeButtons() {
  document.getElementById('modeBtnAll').classList.toggle('active', APP_STATE.testMode === 'ALL');
  document.getElementById('modeBtnWrong').classList.toggle('active', APP_STATE.testMode === 'WRONG_ONLY');
}

function renderTestQuestions() {
  const container = document.getElementById('testRowsContainer');
  if (!container) return;
  container.innerHTML = '';

  APP_STATE.testQuestions.forEach((q, idx) => {
    const row = document.createElement('div');
    const existingVal = APP_STATE.userAnswers[idx] || '';
    row.className = `test-row ${existingVal.trim() ? 'answered' : ''}`;
    row.dataset.rowIdx = idx;

    row.innerHTML = `
      <span class="test-row-num">Q${q.index}</span>
      <div class="test-row-prompt">
        <span class="test-prompt-text" title="${q.prompt}">${q.prompt}</span>
        <span class="test-prompt-badge">${q.badgeText}</span>
      </div>
      <div class="test-row-input-wrap">
        <input type="text" class="test-row-input subjective-input" 
          data-qidx="${idx}" 
          placeholder="${q.placeholder}" 
          value="${existingVal}"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      </div>
    `;

    const inputEl = row.querySelector('.test-row-input');

    inputEl.addEventListener('input', (e) => {
      if (!APP_STATE.testStartTime) {
        APP_STATE.testStartTime = Date.now();
      }
      const val = e.target.value;
      APP_STATE.userAnswers[idx] = val;
      row.classList.toggle('answered', Boolean(val.trim()));
      updateTestProgress();
    });

    // Enter 키 입력 시 다음 번호 입력창으로 자동 포커스 이동
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nextInput = container.querySelector(`.test-row-input[data-qidx="${idx + 1}"]`);
        if (nextInput) {
          nextInput.focus();
        } else {
          inputEl.blur();
        }
      }
    });

    container.appendChild(row);
  });

  updateTestProgress();
}

function updateTestProgress() {
  const answeredCount = Object.values(APP_STATE.userAnswers).filter(v => v && v.trim()).length;
  const total = APP_STATE.testQuestions.length;
  const pct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  document.getElementById('testProgressBar').style.width = `${pct}%`;
  document.getElementById('testProgressText').textContent = `${answeredCount} / ${total}`;
}

// --------------------------------------------------------
// 채점 요청 및 Supabase 클라우드 실시간 전송 (핵심 ⭐)
// --------------------------------------------------------
async function submitAndGradeTest() {
  const total = APP_STATE.testQuestions.length;
  if (total === 0) return;

  const answeredCount = Object.values(APP_STATE.userAnswers).filter(v => v && v.trim()).length;
  if (answeredCount < total) {
    if (!confirm(`아직 작성하지 않은 문제가 있어요! (${answeredCount}/${total}문제 작성됨)\n이대로 채점할까요?`)) {
      return;
    }
  }

  // 1. 스마트 채점 진행 (grading.js)
  let correctCount = 0;
  const wrongItems = [];
  const correctWordIds = [];
  const gradingDetails = [];

  APP_STATE.testQuestions.forEach((q, idx) => {
    const userAns = APP_STATE.userAnswers[idx] || "";
    const isEnglish = (q.qType === 'ENGLISH');
    const targetText = isEnglish ? q.target.word : q.target.meaning;

    // grading.js 호출
    const gradeResult = window.gradeAnswer(userAns, targetText, isEnglish);

    if (gradeResult.isCorrect) {
      correctCount += 1;
      correctWordIds.push(q.target.id);
    } else {
      wrongItems.push({
        wordId: q.target.id,
        word: q.target.word,
        meaning: q.target.meaning,
        userAns: userAns,
        correctAns: targetText
      });
    }

    gradingDetails.push({
      question: q,
      userAns,
      targetText,
      result: gradeResult
    });
  });

  // 2. 점수 계산 (100점 만점)
  const score = Math.round((correctCount / total) * 100);

  // 3. 별(⭐️) 보상 계산 (60점 이상 1개, 10점마다 1개 추가)
  let starsWon = 0;
  if (score >= 100) starsWon = 5;
  else if (score >= 90) starsWon = 4;
  else if (score >= 80) starsWon = 3;
  else if (score >= 70) starsWon = 2;
  else if (score >= 60) starsWon = 1;

  // 3-1. 테스트 소요 시간(초 단위) 및 완료 일시 측정
  const durationSeconds = APP_STATE.testStartTime
    ? Math.max(1, Math.round((Date.now() - APP_STATE.testStartTime) / 1000))
    : 15; // 시작 시각이 누락된 경우에도 0초가 되지 않도록 기본값 보장
  const testDate = new Date().toISOString();

  // 4. Supabase DB에 실시간 저장
  const submitPayload = {
    lessonId: APP_STATE.currentLessonId,
    testCategory: APP_STATE.testCategory || 'VOCAB',
    testTitle: APP_STATE.testTitle || '',
    round: APP_STATE.currentRound,
    testMode: APP_STATE.testMode,
    score: score,
    correctCount: correctCount,
    totalCount: total,
    starsWon: starsWon,
    wrongItems: wrongItems,
    correctWordIds: correctWordIds,
    testDate: testDate,
    durationSeconds: durationSeconds
  };

  try {
    const res = await window.MSE_DB.apiSubmitTest(submitPayload);
    if (res && res.totalStars !== undefined) {
      APP_STATE.totalStars = res.totalStars;
      updateStarDisplay();
    }
  } catch (e) {
    console.warn('apiSubmitTest error:', e);
  }

  // 5. 무음 폭죽 연출 및 결과 모달
  triggerConfetti();
  showResultModal({
    score,
    correctCount,
    totalCount: total,
    starsWon,
    wrongItems,
    durationSeconds
  });

  // 단어 목록 재동기화 (오답 횟수 갱신)
  await fetchWords(APP_STATE.currentLessonId);
}

function showResultModal(data) {
  const modal = document.getElementById('resultModal');
  const modeTitle = APP_STATE.testMode === 'WRONG_ONLY' ? '오답 집중' : '전체 시험';
  const durSec = data.durationSeconds || 0;
  const durText = durSec >= 60 ? `${Math.floor(durSec / 60)}분 ${durSec % 60}초` : `${durSec}초`;
  document.getElementById('currentRoundBadge').textContent = `${APP_STATE.currentRound}회차 ${modeTitle} · 소요 시간: ${durText}`;
  document.getElementById('modalScoreNumber').textContent = `${data.score}점`;

  // 별 표시
  const starsContainer = document.getElementById('modalStarsRow');
  starsContainer.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const span = document.createElement('span');
    span.textContent = i < data.starsWon ? '⭐️' : '⚪️';
    starsContainer.appendChild(span);
  }

  // 피드백 문구
  const feedback = document.getElementById('modalFeedback');
  if (data.score === 100) {
    feedback.textContent = `완벽해요! 만점 달성 💯 별 5개 획득! (${durText})`;
  } else if (data.score >= 80) {
    feedback.textContent = `정말 훌륭해요! (${data.correctCount}/${data.totalCount}문제 정답, ${durText})`;
  } else if (data.score >= 60) {
    feedback.textContent = `조금만 더 복습하면 만점 가능! (${data.correctCount}/${data.totalCount}문제 정답, ${durText})`;
  } else {
    feedback.textContent = `틀린 단어들을 오답 노트에서 다시 복습해볼까요? 화이팅! 💖 (${durText})`;
  }

  // 오답 재시험 버튼 (요청에 따라 기본 숨김/제거됨)
  const retakeWrongBtn = document.getElementById('modalBtnRetakeWrong');
  if (retakeWrongBtn) {
    retakeWrongBtn.style.display = 'none';
  }

  modal.classList.add('open');
}

// --------------------------------------------------------
// TAB 3: 취약 단어 랭킹 & 파이널 오답 단어장
// --------------------------------------------------------

function renderRankingTable() {
  const container = document.getElementById('rankingTableContainer');
  if (APP_STATE.wrongRanking.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#8C7FA9;">
      현재 틀린 단어가 없습니다! 아주 훌륭합니다 🎉
    </div>`;
    return;
  }

  const rows = APP_STATE.wrongRanking.map((w, idx) => `
    <tr>
      <td style="font-weight:800; color:#8B78E6;">#${idx + 1}</td>
      <td style="font-weight:800; color:#382B68;">${w.word}</td>
      <td><span class="word-pos">${w.pos || ''}</span></td>
      <td>${w.meaning}</td>
      <td style="color:#FF5376; font-weight:900;">${w.wrong_count || 0}회</td>
      <td style="color:#7E739B;">${w.test_count || 0}회</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="ranking-table">
      <thead>
        <tr>
          <th>순위</th>
          <th>영어 단어</th>
          <th>품사</th>
          <th>교재 뜻</th>
          <th>누적 오답</th>
          <th>총 응시</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderFinalMistakesTable() {
  const container = document.getElementById('finalMistakesTableContainer');
  const wrongWords = APP_STATE.allWords.filter(w => (w.wrong_count || 0) > 0);

  if (wrongWords.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:#8C7FA9;">
      🎉 누적된 오답 단어가 하나도 없습니다! 내신 만점 준비 완료!
    </div>`;
    return;
  }

  const rows = wrongWords.map((w, idx) => `
    <tr>
      <td style="text-align:center; font-weight:800;">${idx + 1}</td>
      <td style="font-weight:800; font-size:14px; color:#2A1D54;">${w.word}</td>
      <td style="text-align:center;"><span class="word-pos">${w.pos || ''}</span></td>
      <td style="font-size:13.5px; font-weight:700;">${w.meaning}</td>
      <td style="font-size:12px; color:#6B5F8C;">${w.eng_def || '-'}</td>
      <td style="text-align:center; color:#FF5376; font-weight:900;">${w.wrong_count}회</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div style="margin-bottom:12px;">
      <h3 style="font-size:16px; font-weight:900; color:#382B68;">
        [${APP_STATE.currentLessonName}] 내신 대비 파이널 오답 단어장 (${wrongWords.length}단어)
      </h3>
    </div>
    <table class="final-mistakes-table">
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">번호</th>
          <th style="width:140px;">영어 단어</th>
          <th style="width:50px; text-align:center;">품사</th>
          <th style="width:200px;">교재 공식 뜻</th>
          <th>영영 풀이</th>
          <th style="width:70px; text-align:center;">오답 수</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// --------------------------------------------------------
// TAB 4 (구): 회차별 오답노트는 파이널 오답 단어장 및 과목 리포트로 통합됨
// --------------------------------------------------------
// TAB 6: 별 도장판
// --------------------------------------------------------
function renderStampBoard() {
  const grid = document.getElementById('stampGrid');
  grid.innerHTML = '';
  const total = 50; // 50칸 도장판
  const earned = APP_STATE.totalStars;

  for (let i = 1; i <= total; i++) {
    const slot = document.createElement('div');
    const isStamped = i <= earned;
    slot.className = `stamp-slot ${isStamped ? 'stamped' : ''}`;
    slot.textContent = isStamped ? '⭐️' : i;
    grid.appendChild(slot);
  }

  // 레벨 배지
  const levelBadge = document.getElementById('rewardLevel');
  if (earned >= 50) levelBadge.textContent = '👑 Lv.5 비밀 노트 완결 마스터!';
  else if (earned >= 35) levelBadge.textContent = '💎 Lv.4 내신 1등급 달성자!';
  else if (earned >= 20) levelBadge.textContent = '🌟 Lv.3 우등 열공생!';
  else if (earned >= 10) levelBadge.textContent = '🌿 Lv.2 단어 암기 도전자!';
  else levelBadge.textContent = '🌱 Lv.1 비밀 노트 입문자';
}

// --------------------------------------------------------
// 관리자 & 부모님 보안 (PIN 인증 모달)
// --------------------------------------------------------
function setupAdminSecurity() {
  const btnUnlock = document.getElementById('btnUnlockAdmin');
  if (!btnUnlock) return;
  const pinModal = document.getElementById('pinModal');
  const pinInput = document.getElementById('pinInput');
  const pinError = document.getElementById('pinErrorMsg');
  const btnCancelPin = document.getElementById('btnCancelPin');
  const btnConfirmPin = document.getElementById('btnConfirmPin');

  btnUnlock.addEventListener('click', () => {
    pinInput.value = '';
    pinError.style.display = 'none';
    pinModal.classList.add('open');
    setTimeout(() => pinInput.focus(), 100);
  });

  btnCancelPin.addEventListener('click', () => {
    pinModal.classList.remove('open');
  });

  const verifyPin = () => {
    const entered = pinInput.value.trim();
    if (entered === APP_STATE.adminPin) {
      APP_STATE.adminUnlocked = true;
      pinModal.classList.remove('open');
      document.getElementById('adminLockedControls').style.display = 'none';
      document.getElementById('adminUnlockedControls').style.display = 'block';
      document.getElementById('adminLockBadge').textContent = '🔓 인증됨';
      document.getElementById('adminLockBadge').style.background = '#D4F4DD';
      document.getElementById('adminLockBadge').style.color = '#1E6B38';
      document.getElementById('adminDescText').textContent = '관리자 권한이 활성화되었습니다. 성적 조회 및 PDF 등록이 가능합니다.';
    } else {
      pinError.style.display = 'block';
      pinInput.value = '';
      pinInput.focus();
    }
  };

  btnConfirmPin.addEventListener('click', verifyPin);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyPin();
  });

  // 관리자 잠그기
  document.getElementById('btnLockAdmin').addEventListener('click', () => {
    APP_STATE.adminUnlocked = false;
    document.getElementById('adminLockedControls').style.display = 'block';
    document.getElementById('adminUnlockedControls').style.display = 'none';
    document.getElementById('adminLockBadge').textContent = '🔒 잠김';
    document.getElementById('adminLockBadge').style.background = '#F2ECFB';
    document.getElementById('adminLockBadge').style.color = '#7A68A8';
    document.getElementById('adminDescText').textContent = 'PDF 교재 단어 등록 및 실시간 성적 리포트는 4자리 PIN 인증 후 이용 가능합니다.';
  });

  // PIN 변경 모달
  const changePinModal = document.getElementById('changePinModal');
  document.getElementById('btnOpenChangePinModal').addEventListener('click', () => {
    document.getElementById('newPinInput').value = '';
    document.getElementById('newPinConfirmInput').value = '';
    changePinModal.classList.add('open');
  });
  document.getElementById('btnCancelChangePin').addEventListener('click', () => {
    changePinModal.classList.remove('open');
  });
  document.getElementById('btnSaveChangePin').addEventListener('click', async () => {
    const p1 = document.getElementById('newPinInput').value.trim();
    const p2 = document.getElementById('newPinConfirmInput').value.trim();
    if (p1.length !== 4 || !/^\d{4}$/.test(p1)) {
      alert('PIN 번호는 4자리 숫자여야 합니다.');
      return;
    }
    if (p1 !== p2) {
      alert('두 PIN 번호가 일치하지 않습니다.');
      return;
    }
    APP_STATE.adminPin = p1;
    await window.MSE_DB.apiSetMeta('admin_pin', p1);
    alert('새 관리자 PIN이 성공적으로 저장되었습니다!');
    changePinModal.classList.remove('open');
  });

}

// --------------------------------------------------------
// Supabase 클라우드 설정 모달
// --------------------------------------------------------
function setupCloudSettingsModal() {
  const cloudModal = document.getElementById('cloudSettingsModal');
  const btnOpen = document.getElementById('btnOpenCloudModal');
  const btnCancel = document.getElementById('btnCancelCloudSettings');
  const btnSave = document.getElementById('btnSaveCloudSettings');

  if (btnOpen && cloudModal) {
    btnOpen.addEventListener('click', () => {
      const conf = window.MSE_DB.getSupabaseConfig();
      const urlInput = document.getElementById('supabaseUrlInput');
      const keyInput = document.getElementById('supabaseAnonKeyInput');
      if (urlInput) urlInput.value = conf.url || '';
      if (keyInput) keyInput.value = conf.anonKey || '';
      cloudModal.classList.add('open');
    });
  }

  if (btnCancel && cloudModal) {
    btnCancel.addEventListener('click', () => {
      cloudModal.classList.remove('open');
    });
  }

  if (btnSave && cloudModal) {
    btnSave.addEventListener('click', async () => {
      const url = document.getElementById('supabaseUrlInput')?.value.trim() || '';
      const key = document.getElementById('supabaseAnonKeyInput')?.value.trim() || '';
      window.MSE_DB.saveSupabaseConfig(url, key);
      updateCloudStatusBadge();
      alert('클라우드 DB 연동 설정이 적용되었습니다!');
      cloudModal.classList.remove('open');
      await fetchSubjectsAndLessons();
      if (APP_STATE.currentLessonId) {
        await fetchWords(APP_STATE.currentLessonId);
      }
    });
  }
}

// --------------------------------------------------------
// 부모님 전용 실시간 성적 대시보드 (과목별 분리 & 영어/타과목 분기 필터)
// --------------------------------------------------------
function setupParentReport() {
  const reportModal = document.getElementById('parentReportModal');
  document.getElementById('btnOpenParentReport').addEventListener('click', async () => {
    reportModal.classList.add('open');
    APP_STATE.currentReportSubject = APP_STATE.currentSubject || '영어';
    APP_STATE.currentReportFilter = 'ALL';
    APP_STATE.currentReportLessonId = null;
    await renderReportSubjectBar();
    await renderReportFilters();
    await loadParentReportData();
  });
  document.getElementById('btnCloseParentReport').addEventListener('click', () => {
    reportModal.classList.remove('open');
  });
  document.getElementById('btnRefreshParentReport').addEventListener('click', async () => {
    await renderReportSubjectBar();
    await renderReportFilters();
    await loadParentReportData();
  });
}

async function renderReportSubjectBar() {
  const bar = document.getElementById('reportSubjectBar');
  if (!bar) return;
  const subjects = APP_STATE.subjects && APP_STATE.subjects.length > 0 
    ? APP_STATE.subjects 
    : ['영어'];

  bar.innerHTML = subjects.map(s => {
    const subName = typeof s === 'object' ? (s.name || '영어') : s;
    const isActive = subName === APP_STATE.currentReportSubject;
    return `<button class="report-subject-pill ${isActive ? 'active' : ''}" data-subject="${subName}">
      📚 ${subName}
    </button>`;
  }).join('');

  bar.querySelectorAll('.report-subject-pill').forEach(btn => {
    btn.addEventListener('click', async () => {
      APP_STATE.currentReportSubject = btn.dataset.subject;
      APP_STATE.currentReportFilter = 'ALL';
      APP_STATE.currentReportLessonId = null;
      await renderReportSubjectBar();
      await renderReportFilters();
      await loadParentReportData();
    });
  });
}

async function renderReportFilters() {
  const filterGroup = document.getElementById('reportFilterGroup');
  if (!filterGroup) return;

  const isEnglish = (APP_STATE.currentReportSubject === '영어');

  if (isEnglish) {
    // 영어 과목: 전체, 단어, 서술형, 단원평가
    const curFilter = APP_STATE.currentReportFilter || 'ALL';
    filterGroup.innerHTML = `
      <button class="report-filter-pill ${curFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">전체 보기</button>
      <button class="report-filter-pill ${curFilter === 'VOCAB' ? 'active' : ''}" data-filter="VOCAB">📖 단어 시험</button>
      <button class="report-filter-pill ${curFilter === 'WRITING' ? 'active' : ''}" data-filter="WRITING">🖋️ 서술형 영작</button>
      <button class="report-filter-pill ${curFilter === 'UNIT' ? 'active' : ''}" data-filter="UNIT">📝 단원 평가</button>
    `;

    filterGroup.querySelectorAll('.report-filter-pill').forEach(btn => {
      btn.addEventListener('click', async () => {
        filterGroup.querySelectorAll('.report-filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        APP_STATE.currentReportFilter = btn.dataset.filter;
        APP_STATE.currentReportLessonId = null;
        await loadParentReportData();
      });
    });
  } else {
    // 타 과목: 전체 + 해당 과목의 단원별 버튼
    let lessons = [];
    try {
      lessons = await window.MSE_DB.apiGetLessons(APP_STATE.currentReportSubject);
    } catch (e) {
      lessons = [];
    }

    let pillsHtml = `<button class="report-filter-pill ${!APP_STATE.currentReportLessonId ? 'active' : ''}" data-filter="ALL">전체 보기</button>`;
    lessons.forEach(les => {
      const isSelected = Number(APP_STATE.currentReportLessonId) === Number(les.id);
      pillsHtml += `<button class="report-filter-pill ${isSelected ? 'active' : ''}" data-filter="LESSON" data-lesson-id="${les.id}">
        📄 ${les.unit_name.split(' ')[0] || les.unit_name}
      </button>`;
    });

    filterGroup.innerHTML = pillsHtml;

    filterGroup.querySelectorAll('.report-filter-pill').forEach(btn => {
      btn.addEventListener('click', async () => {
        filterGroup.querySelectorAll('.report-filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (btn.dataset.filter === 'ALL') {
          APP_STATE.currentReportFilter = 'ALL';
          APP_STATE.currentReportLessonId = null;
        } else {
          APP_STATE.currentReportFilter = 'LESSON';
          APP_STATE.currentReportLessonId = btn.dataset.lessonId;
        }
        await loadParentReportData();
      });
    });
  }
}

async function loadParentReportData() {
  const recordsBody = document.getElementById('reportRecordsBody');
  const wrongBody = document.getElementById('reportWrongLogsBody');

  recordsBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:16px;">기록을 불러오는 중...</td></tr>`;
  wrongBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px;">기록을 불러오는 중...</td></tr>`;

  try {
    const curSub = APP_STATE.currentReportSubject || '영어';
    const cat = (curSub === '영어' && APP_STATE.currentReportFilter !== 'ALL') ? APP_STATE.currentReportFilter : null;
    const lesId = (curSub !== '영어') ? APP_STATE.currentReportLessonId : null;

    const records = await window.MSE_DB.apiGetTestRecords(lesId, 50, cat, curSub);
    const wrongLogs = await window.MSE_DB.apiGetWrongHistory(null, 50, curSub);

    // 요약 집계
    const totalTests = records.length;
    const avgScore = totalTests > 0 
      ? Math.round(records.reduce((acc, r) => acc + (r.score || 0), 0) / totalTests)
      : 0;

    document.getElementById('reportTotalTests').textContent = `${totalTests}회`;
    document.getElementById('reportAvgScore').textContent = `${avgScore}점`;
    document.getElementById('reportStarsWon').textContent = `${APP_STATE.totalStars}개`;

    // 이력 테이블
    if (records.length === 0) {
      recordsBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#9587B6; padding:16px;">[${curSub}] 조건의 시험 기록이 없습니다.</td></tr>`;
    } else {
      recordsBody.innerHTML = records.map(r => {
        const d = new Date(r.test_date);
        const yy = String(d.getFullYear()).slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yy}${mm}${dd}`;
        const modeLabel = r.test_mode === 'WRONG_ONLY' ? '오답집중' : '전체';

        // 소요 시간 포맷
        const dur = r.duration_seconds || 0;
        const durStr = dur > 0 ? (dur >= 60 ? `${Math.floor(dur / 60)}분 ${dur % 60}초` : `${dur}초`) : '-';

        // 시험 유형 배지
        const testCat = r.test_category || 'VOCAB';
        let catBadge = '<span class="badge-cat badge-vocab">📖 단어</span>';
        if (testCat === 'UNIT') catBadge = '<span class="badge-cat badge-unit">📝 단원</span>';
        else if (testCat === 'WRITING') catBadge = '<span class="badge-cat badge-writing">🖋️ 영작</span>';

        return `
          <tr>
            <td style="font-weight:700; color:#5C4B99; letter-spacing:0.5px;">${dateStr}</td>
            <td style="font-weight:700;">${r.lessons?.unit_name?.split(' ')[0] || '단원'}</td>
            <td>
              <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                ${catBadge}
                <span class="word-pos">${r.round}회 (${modeLabel})</span>
                ${r.test_title ? `<span style="font-size:10.5px; color:#7E739B; font-weight:700;">${r.test_title}</span>` : ''}
              </div>
            </td>
            <td style="font-weight:700; color:#5C4B99;">${durStr}</td>
            <td style="font-weight:900; color:${r.score >= 80 ? '#6C52EE' : '#FF5376'};">${r.score}점</td>
            <td>${r.correct_count} / ${r.total_count}</td>
            <td style="color:#FFA400; font-weight:800;">⭐️ ${r.stars_won}</td>
          </tr>
        `;
      }).join('');
    }

    // 오답 상세 테이블
    if (wrongLogs.length === 0) {
      wrongBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#9587B6; padding:16px;">[${curSub}] 오답 기록이 없습니다. 완벽합니다!</td></tr>`;
    } else {
      wrongBody.innerHTML = wrongLogs.map(h => {
        const d = new Date(h.created_at);
        const yy = String(d.getFullYear()).slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const timeStr = `${yy}${mm}${dd}`;
        return `
          <tr>
            <td style="font-weight:900; color:#382B68;">${h.vocab_words?.word || '-'}</td>
            <td><span class="word-pos">${h.vocab_words?.pos || '-'}</span></td>
            <td style="font-weight:700; color:#5C4B99;">${h.correct_answer || h.vocab_words?.meaning}</td>
            <td style="color:#FF5376; font-weight:800;">${h.user_answer || '(미작성)'}</td>
            <td style="color:#8F83AE; font-weight:700; letter-spacing:0.5px;">${timeStr}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (e) {
    console.warn('loadParentReportData error:', e);
  }
}

// --------------------------------------------------------
// PDF 업로드 및 파싱 모듈 (PDF.js 연동)
// --------------------------------------------------------
function setupPdfDropzone() {
  const dropzone = document.getElementById('pdfDropzone');
  const fileInput = document.getElementById('pdfFileInput');
  const statusEl = document.getElementById('pdfParseStatus');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.background = '#F2ECFF';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.background = '#FFFFFF';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.background = '#FFFFFF';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handlePdfFile(e.dataTransfer.files[0]);
      }
    });
  }

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handlePdfFile(e.target.files[0]);
    }
  });

  async function handlePdfFile(file) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#6C52EE';
      statusEl.textContent = '⏳ PDF 단어 표를 초고속 파싱하는 중...';
    }

    try {
      const words = await window.parseVocabPdf(file);
      if (statusEl) statusEl.textContent = `✅ ${words.length}개 단어 파싱 성공! 클라우드에 등록 중...`;

      await window.MSE_DB.apiInsertWords(APP_STATE.currentLessonId, words);
      if (statusEl) {
        statusEl.style.color = '#1E6B38';
        statusEl.textContent = `🎉 ${words.length}개 단어가 클라우드에 즉시 등록되었습니다!`;
      }

      await fetchWords(APP_STATE.currentLessonId);
    } catch (err) {
      if (statusEl) {
        statusEl.style.color = '#FF5376';
        statusEl.textContent = `❌ 오류: ${err.message}`;
      }
    }
  }
}

// --------------------------------------------------------
// 설정 서랍 및 단원 관리 (팝업 모달 & 단어장 PDF 버튼)
// --------------------------------------------------------
function setupSettingsDrawer() {
  // 단어장/서술형 PDF 통합 등록 버튼 -> 등록 분기 모달 오픈
  const uploadVocabBtn = document.getElementById('btnUploadVocabPdf');
  if (uploadVocabBtn) {
    uploadVocabBtn.addEventListener('click', () => {
      openUploadChoiceModal('VOCAB');
    });
  }

  // 서술형 Empty State 내 바로가기 버튼 연동 -> 직접 텍스트 입력 모달 오픈
  document.getElementById('btnOpenWritingPdfModalDirect')?.addEventListener('click', () => {
    openDirectWritingModal();
  });

  // 새 단원 등록 모달 열기
  const openAddLessonBtn = document.getElementById('btnOpenAddLessonModal');
  const addLessonModal = document.getElementById('addLessonModal');
  const modalSubSel = document.getElementById('modalAddLessonSubject');
  const modalTitleInput = document.getElementById('modalAddLessonTitle');

  if (openAddLessonBtn && addLessonModal) {
    openAddLessonBtn.addEventListener('click', () => {
      if (modalSubSel) {
        modalSubSel.innerHTML = '';
        APP_STATE.subjects.forEach(sub => {
          const opt = document.createElement('option');
          opt.value = sub;
          opt.textContent = `📚 ${sub}`;
          if (sub === APP_STATE.currentSubject) opt.selected = true;
          modalSubSel.appendChild(opt);
        });
      }
      if (modalTitleInput) modalTitleInput.value = '';
      addLessonModal.classList.add('open');
    });

    document.getElementById('btnCancelAddLessonModal')?.addEventListener('click', () => {
      addLessonModal.classList.remove('open');
    });

    // 모달 단원 등록 제출 (영어 과목도 타 과목과 동일하게 접두사 없이 심플하게 등록)
    document.getElementById('btnSubmitAddLessonModal')?.addEventListener('click', async () => {
      const sub = modalSubSel?.value || APP_STATE.currentSubject || '영어';
      const unit = modalTitleInput?.value.trim();

      if (!unit) {
        alert('단원명을 입력해주세요.');
        return;
      }

      try {
        const newLesson = await window.MSE_DB.apiCreateLesson(sub, unit);
        addLessonModal.classList.remove('open');
        alert(`[${sub}] '${unit}' 단원이 등록되었습니다!`);
        APP_STATE.currentSubject = sub;
        await fetchSubjectsAndLessons();
        if (newLesson && newLesson.id) {
          await switchLesson(newLesson.id);
        }
      } catch (e) {
        alert('단원 등록 중 오류: ' + e.message);
      }
    });
  }

  // 대단원 삭제
  const delBtn = document.getElementById('btnDeleteLesson');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!APP_STATE.currentLessonId) {
        alert('삭제할 단원이 없습니다.');
        return;
      }
      const curLesson = APP_STATE.lessons.find(l => Number(l.id) === Number(APP_STATE.currentLessonId));
      const unitName = curLesson?.unit_name || APP_STATE.currentLessonName;
      if (!confirm(`정말 '${unitName}' 단원을 삭제하시겠습니까?\n포함된 모든 단어 및 시험 기록이 삭제됩니다.`)) {
        return;
      }
      try {
        await window.MSE_DB.apiDeleteLesson(APP_STATE.currentLessonId);
        alert(`'${unitName}' 단원이 삭제되었습니다.`);
        await fetchSubjectsAndLessons();
      } catch (e) {
        alert('단원 삭제 중 오류: ' + e.message);
      }
    });
  }

  // 수동 동기화
  const syncBtn = document.getElementById('btnManualSync');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      const connected = window.MSE_DB.initSupabase();
      updateCloudStatusBadge();
      if (connected) {
        await fetchMeta();
        await fetchSubjectsAndLessons();
        alert('☁️ Supabase 클라우드 동기화 완료!');
      } else {
        alert('로컬 오프라인 모드입니다. [클라우드 설정]에서 연결 정보를 확인해주세요.');
      }
    });
  }
}

// --------------------------------------------------------
// 무음 Canvas 폭죽 연출
// --------------------------------------------------------
function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colors = ['#8B78E6', '#FF6584', '#FFD3E2', '#FFF2B2', '#D4F4DD', '#7B61FF'];

  for (let i = 0; i < 90; i++) {
    pieces.push({
      x: canvas.width / 2,
      y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.7) * 16,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: Math.random() * 0.02 + 0.012
    });
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // 중력
      p.alpha -= p.decay;

      if (p.alpha > 0) {
        active = true;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (active) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  frame();
}

// --------------------------------------------------------
// PDF 학습 자료 등록 모달 로직 (단어장 vs 서술형 영작 분기)
// --------------------------------------------------------
let cachedUploadChoiceFile = null;

function openUploadChoiceModal(defaultType = 'VOCAB') {
  const modal = document.getElementById('uploadChoiceModal');
  const sel = document.getElementById('uploadChoiceLessonSelect');
  const btnVocab = document.getElementById('btnTypeVocab');
  const btnWriting = document.getElementById('btnTypeWriting');
  const typeInput = document.getElementById('uploadChoiceType');
  const notice = document.getElementById('uploadChoiceFileNotice');
  const statusEl = document.getElementById('uploadChoiceStatus');
  const submitBtn = document.getElementById('btnSubmitUploadChoiceModal');
  const fileInput = document.getElementById('uploadChoiceFileInput');

  if (!modal) return;

  // 단원 목록 로드
  if (sel) {
    sel.innerHTML = '';
    const filteredLessons = APP_STATE.lessons.filter(l => (l.subject_name || '영어') === APP_STATE.currentSubject);
    filteredLessons.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = `${l.subject_name || APP_STATE.currentSubject} · ${l.unit_name}`;
      if (Number(l.id) === Number(APP_STATE.currentLessonId)) opt.selected = true;
      sel.appendChild(opt);
    });
    if (filteredLessons.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '-- 등록된 단원이 없습니다 (먼저 단원을 등록해주세요) --';
      sel.appendChild(opt);
    }
  }

  // 유형 버튼 초기화
  if (typeInput) typeInput.value = defaultType;
  if (defaultType === 'WRITING') {
    btnVocab?.classList.remove('active');
    btnWriting?.classList.add('active');
  } else {
    btnVocab?.classList.add('active');
    btnWriting?.classList.remove('active');
  }

  // 파일 및 상태 초기화
  cachedUploadChoiceFile = null;
  if (fileInput) fileInput.value = '';
  if (notice) notice.textContent = '클릭하여 PDF 선택 또는 파일 끌어다 놓기';
  if (statusEl) {
    statusEl.style.display = 'none';
    statusEl.textContent = '';
  }
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '등록하기';
  }

  modal.classList.add('open');
}

function setupUploadChoiceModal() {
  const modal = document.getElementById('uploadChoiceModal');
  const dropzone = document.getElementById('uploadChoiceDropZone');
  const fileInput = document.getElementById('uploadChoiceFileInput');
  const btnVocab = document.getElementById('btnTypeVocab');
  const btnWriting = document.getElementById('btnTypeWriting');
  const typeInput = document.getElementById('uploadChoiceType');
  const cancelBtn = document.getElementById('btnCancelUploadChoiceModal');
  const submitBtn = document.getElementById('btnSubmitUploadChoiceModal');
  const notice = document.getElementById('uploadChoiceFileNotice');
  const statusEl = document.getElementById('uploadChoiceStatus');

  if (!modal) return;

  // 취소 닫기
  cancelBtn?.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  // 유형 전환
  btnVocab?.addEventListener('click', () => {
    btnVocab.classList.add('active');
    btnWriting?.classList.remove('active');
    if (typeInput) typeInput.value = 'VOCAB';
  });

  btnWriting?.addEventListener('click', () => {
    modal.classList.remove('open');
    const curLessonId = document.getElementById('uploadChoiceLessonSelect')?.value;
    openDirectWritingModal(curLessonId);
  });

  // 드롭존 및 파일 선택
  dropzone?.addEventListener('click', () => {
    fileInput?.click();
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.background = '#F2ECFF';
    dropzone.style.borderColor = '#6C52EE';
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.style.background = '#FBF9FE';
    dropzone.style.borderColor = '#B8AEDD';
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.background = '#FBF9FE';
    dropzone.style.borderColor = '#B8AEDD';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedPdf(e.dataTransfer.files[0]);
    }
  });

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedPdf(e.target.files[0]);
    }
  });

  function handleSelectedPdf(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('PDF 파일만 등록할 수 있습니다.');
      return;
    }
    cachedUploadChoiceFile = file;
    if (notice) notice.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    if (submitBtn) submitBtn.disabled = false;
  }

  // 등록 제출
  submitBtn?.addEventListener('click', async () => {
    const lessonSel = document.getElementById('uploadChoiceLessonSelect');
    const lessonId = lessonSel?.value ? Number(lessonSel.value) : null;
    const type = typeInput?.value || 'VOCAB';

    if (!lessonId) {
      alert('학습을 등록할 대단원을 선택해주세요.');
      return;
    }
    if (!cachedUploadChoiceFile) {
      alert('PDF 파일을 첨부해주세요.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '파싱 및 등록 중...';
    }
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#6C52EE';
      statusEl.textContent = '⏳ PDF 문서를 분석하는 중...';
    }

    try {
      if (type === 'VOCAB') {
        if (statusEl) statusEl.textContent = '⏳ PDF 단어 표를 파싱하는 중...';
        const words = await window.parseVocabPdf(cachedUploadChoiceFile);
        if (statusEl) statusEl.textContent = `✅ ${words.length}개 단어 파싱 완료! 저장 중...`;
        await window.MSE_DB.apiInsertWords(lessonId, words);
        modal.classList.remove('open');
        alert(`🎉 ${words.length}개 단어가 성공적으로 등록되었습니다!`);
        await switchLesson(lessonId);
      } else {
        if (statusEl) statusEl.textContent = '⏳ "Level 2 영작 연습하기" 문항을 파싱하는 중...';
        const sentences = await window.parseWritingPdf(cachedUploadChoiceFile);
        if (statusEl) statusEl.textContent = `✅ ${sentences.length}개 서술형 문항 매칭 완료! 저장 중...`;
        await window.MSE_DB.apiInsertWritingSentences(lessonId, sentences);
        modal.classList.remove('open');
        alert(`🎉 ${sentences.length}개 서술형 영작 문제가 성공적으로 등록되었습니다!`);
        await switchLesson(lessonId);
        // 서술형 영작 탭으로 전환
        document.getElementById('tabBtnPaperTest')?.click();
      }
    } catch (err) {
      console.error('Upload choice error:', err);
      if (statusEl) {
        statusEl.style.color = '#EF4444';
        statusEl.textContent = `❌ ${err.message}`;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '다시 시도';
      }
      alert('등록 중 오류 발생: ' + err.message);
    }
  });
}

// --------------------------------------------------------
// 서술형(영작) 직접 텍스트 일괄 등록 모달 로직
// --------------------------------------------------------
let cachedParsedDirectWriting = null;

function openDirectWritingModal(lessonId = null) {
  const modal = document.getElementById('writingDirectInputModal');
  const sel = document.getElementById('directWritingLessonSelect');
  const korInput = document.getElementById('directWritingKoreanInput');
  const engInput = document.getElementById('directWritingEnglishInput');
  const matchBadge = document.getElementById('directWritingMatchBadge');
  const previewList = document.getElementById('directWritingPreviewList');
  const submitBtn = document.getElementById('btnSubmitDirectWriting');
  const korBadge = document.getElementById('koreanPromptCountBadge');
  const engBadge = document.getElementById('englishSentenceCountBadge');

  if (!modal) return;

  // 단원 목록 로드
  if (sel) {
    sel.innerHTML = '';
    const filteredLessons = APP_STATE.lessons.filter(l => (l.subject_name || '영어') === APP_STATE.currentSubject);
    filteredLessons.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = `${l.subject_name || APP_STATE.currentSubject} · ${l.unit_name}`;
      const targetId = lessonId || APP_STATE.currentLessonId;
      if (Number(l.id) === Number(targetId)) opt.selected = true;
      sel.appendChild(opt);
    });
    if (filteredLessons.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '-- 등록된 단원이 없습니다 (먼저 단원을 등록해주세요) --';
      sel.appendChild(opt);
    }
  }

  // 필드 초기화
  cachedParsedDirectWriting = null;
  if (korInput) korInput.value = '';
  if (engInput) engInput.value = '';
  if (korBadge) korBadge.textContent = '0개 감지';
  if (engBadge) engBadge.textContent = '0개 감지';
  if (matchBadge) {
    matchBadge.style.background = '#E2E8F0';
    matchBadge.style.color = '#64748B';
    matchBadge.textContent = '문항을 입력해주세요';
  }
  if (previewList) {
    previewList.innerHTML = '<div style="text-align: center; color: #9C8EB9; padding: 12px;">한글 문제와 영어 정답을 입력하면 번호별 매칭 결과가 여기에 표시됩니다.</div>';
  }
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '🚀 영작 문제 일괄 등록하기';
  }

  modal.classList.add('open');
}

function setupDirectWritingModal() {
  const modal = document.getElementById('writingDirectInputModal');
  const closeBtn = document.getElementById('btnCloseDirectWritingModal');
  const cancelBtn = document.getElementById('btnCancelDirectWritingModal');
  const submitBtn = document.getElementById('btnSubmitDirectWriting');
  const korInput = document.getElementById('directWritingKoreanInput');
  const engInput = document.getElementById('directWritingEnglishInput');
  const matchBadge = document.getElementById('directWritingMatchBadge');
  const previewList = document.getElementById('directWritingPreviewList');
  const korBadge = document.getElementById('koreanPromptCountBadge');
  const engBadge = document.getElementById('englishSentenceCountBadge');
  const sel = document.getElementById('directWritingLessonSelect');

  if (!modal) return;

  const closeModal = () => modal.classList.remove('open');
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  // 실시간 텍스트 파싱 및 미리보기 갱신
  function updatePreview() {
    const korText = korInput?.value || '';
    const engText = engInput?.value || '';

    const parsed = window.parseDirectWritingText ? window.parseDirectWritingText(korText, engText) : { sentences: [], missing: [] };
    cachedParsedDirectWriting = parsed;

    if (korBadge) korBadge.textContent = `${parsed.koreanCount || 0}개 감지`;
    if (engBadge) engBadge.textContent = `${parsed.englishCount || 0}개 감지`;

    if (!korText.trim() && !engText.trim()) {
      if (matchBadge) {
        matchBadge.style.background = '#E2E8F0';
        matchBadge.style.color = '#64748B';
        matchBadge.textContent = '문항을 입력해주세요';
      }
      if (previewList) {
        previewList.innerHTML = '<div style="text-align: center; color: #9C8EB9; padding: 12px;">한글 문제와 영어 정답을 입력하면 번호별 매칭 결과가 여기에 표시됩니다.</div>';
      }
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    // 매칭 상태 배지
    if (matchBadge) {
      if (parsed.success && parsed.matchedCount > 0) {
        matchBadge.style.background = '#DCFCE7';
        matchBadge.style.color = '#15803D';
        matchBadge.textContent = `✅ ${parsed.matchedCount}개 문항 완벽 매칭! (등록 가능)`;
      } else if (parsed.matchedCount > 0) {
        matchBadge.style.background = '#FEF3C7';
        matchBadge.style.color = '#B45309';
        matchBadge.textContent = `⚠️ ${parsed.matchedCount}개 매칭 완료 (누락: ${parsed.missing.length}개)`;
      } else {
        matchBadge.style.background = '#FEE2E2';
        matchBadge.style.color = '#B91C1C';
        matchBadge.textContent = `❌ 일치하는 번호가 없습니다 (번호 형식: 1. 문장)`;
      }
    }

    // 미리보기 테이블 렌더링
    if (previewList) {
      if (parsed.sentences.length === 0) {
        previewList.innerHTML = '<div style="text-align: center; color: #EF4444; padding: 10px;">번호(1., 2. ...)가 매칭된 문항이 없습니다. 문항 번호를 확인해주세요.</div>';
      } else {
        let html = '<table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">';
        html += '<thead style="background: #ECE7F6; color: #5C4B99;"><tr><th style="padding: 4px; width: 36px; text-align: center;">번호</th><th style="padding: 4px; text-align: left;">한글 문제</th><th style="padding: 4px; text-align: left;">영어 정답</th><th style="padding: 4px; width: 45px; text-align: center;">단어</th></tr></thead><tbody>';

        parsed.sentences.forEach(s => {
          const korShort = s.korean_prompt.length > 28 ? s.korean_prompt.slice(0, 28) + '...' : s.korean_prompt;
          const engShort = s.english_sentence.length > 32 ? s.english_sentence.slice(0, 32) + '...' : s.english_sentence;
          html += `<tr style="border-bottom: 1px solid #F1EDFA;">
            <td style="padding: 4px; text-align: center; font-weight: 800; color: #6C52EE;">${s.sentence_no}</td>
            <td style="padding: 4px; color: #382B68;" title="${s.korean_prompt}">${korShort}</td>
            <td style="padding: 4px; color: #1E293B; font-weight: 600;" title="${s.english_sentence}">${engShort}</td>
            <td style="padding: 4px; text-align: center; color: #7B6E9E;">${s.word_count}단어</td>
          </tr>`;
        });
        html += '</tbody></table>';

        if (parsed.missing.length > 0) {
          html += '<div style="margin-top: 6px; font-size: 11px; color: #DC2626; font-weight: 700;">';
          parsed.missing.forEach(m => {
            html += `• ${m.desc} `;
          });
          html += '</div>';
        }

        previewList.innerHTML = html;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = (parsed.sentences.length === 0);
    }
  }

  korInput?.addEventListener('input', updatePreview);
  engInput?.addEventListener('input', updatePreview);

  // 일괄 등록 버튼 클릭
  submitBtn?.addEventListener('click', async () => {
    const lessonId = sel?.value ? Number(sel.value) : null;
    if (!lessonId) {
      alert('등록할 대단원을 선택해주세요.');
      return;
    }

    if (!cachedParsedDirectWriting || cachedParsedDirectWriting.sentences.length === 0) {
      alert('등록할 영작 문항이 없습니다. 한글 문제와 영어 정답을 입력해주세요.');
      return;
    }

    if (cachedParsedDirectWriting.missing.length > 0) {
      if (!confirm(`일부 문항이 누락되었습니다:\n매칭 성공: ${cachedParsedDirectWriting.matchedCount}개\n\n매칭된 문항만 등록하시겠습니까?`)) {
        return;
      }
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';

    try {
      await window.MSE_DB.apiInsertWritingSentences(lessonId, cachedParsedDirectWriting.sentences);
      modal.classList.remove('open');
      alert(`🎉 ${cachedParsedDirectWriting.sentences.length}개 서술형 영작 문제가 성공적으로 등록되었습니다!`);
      await switchLesson(lessonId);
      // 서술형 영작 탭으로 전환
      document.getElementById('tabBtnPaperTest')?.click();
    } catch (err) {
      console.error('apiInsertWritingSentences error:', err);
      alert('서술형 영작 등록 실패: ' + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 영작 문제 일괄 등록하기';
    }
  });
}

// ========================================================
// PDF 단원평가 & 타과목 시험 모듈 (한 문제/지문 뷰어 & 모드 스위치)
// ========================================================

async function loadPdfTests(subject, lessonId = null) {
  try {
    const list = await window.MSE_DB.apiGetPdfTests(subject, lessonId);
    APP_STATE.pdfTests = list || [];
    renderPaperTestSelect();
  } catch (e) {
    console.warn('loadPdfTests error:', e);
    APP_STATE.pdfTests = [];
  }
}

function getCompletedPdfTestIds() {
  try {
    const raw = localStorage.getItem('mse_completed_pdf_tests');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function markPdfTestCompleted(testId) {
  try {
    const ids = getCompletedPdfTestIds();
    const idStr = String(testId);
    if (!ids.includes(idStr)) {
      ids.push(idStr);
      localStorage.setItem('mse_completed_pdf_tests', JSON.stringify(ids));
    }
  } catch (e) {}
}

function renderPaperTestSelect() {
  const sel = document.getElementById('paperTestSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- 등록된 시험지를 선택하세요 --</option>';

  const subjectTag = document.getElementById('paperTestSubjectTag');
  if (subjectTag) subjectTag.textContent = APP_STATE.currentSubject;

  const completedIds = getCompletedPdfTestIds();

  APP_STATE.pdfTests.forEach(test => {
    const opt = document.createElement('option');
    opt.value = test.id;
    const isCompleted = completedIds.includes(String(test.id));
    const prefix = isCompleted ? '🔄 [다시풀기] ' : '';
    opt.textContent = `${prefix}${test.title} (${test.total_questions || 20}문항)`;
    sel.appendChild(opt);
  });

  const emptyState = document.getElementById('paperTestEmptyState');
  const activeArea = document.getElementById('paperTestActiveArea');

  // 듀얼 해설 뷰 모드 가드: 듀얼 모드 진행 중에는 emptyState 노출 및 startPaperTest 방지
  const splitGrid = document.querySelector('.paper-split-grid');
  const isExplMode = splitGrid && splitGrid.classList.contains('expl-mode');
  if (isExplMode) {
    if (emptyState) emptyState.style.display = 'none';
    if (activeArea) activeArea.style.display = 'block';
    if (sel && APP_STATE.currentPdfTest) sel.value = APP_STATE.currentPdfTest.id;
    return;
  }

  if (APP_STATE.pdfTests.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (activeArea) activeArea.style.display = 'none';
  } else if (!APP_STATE.currentPdfTest) {
    sel.value = APP_STATE.pdfTests[0].id;
    startPaperTest(APP_STATE.pdfTests[0].id);
  } else {
    sel.value = APP_STATE.currentPdfTest.id;
  }
}

async function initPaperTestSession() {
  await loadPdfTests(APP_STATE.currentSubject);
}

async function startPaperTest(testId) {
  const test = APP_STATE.pdfTests.find(t => String(t.id) === String(testId));
  if (!test) return;

  APP_STATE.currentPdfTest = test;
  APP_STATE.paperUserAnswers = {};
  APP_STATE.paperTotalQuestions = Number(test.total_questions) || Object.keys(test.answer_sheet || {}).filter(k => !k.startsWith('_')).length || 20;

  // 테스트 완료 전에는 항상 기존에 보이던 테스트 뷰 모양으로 리셋!
  closeDualExplanation();

  const startP = Number(test.start_page) || 1;
  const endP = Number(test.end_page) || startP;
  APP_STATE.paperStartPage = startP;
  APP_STATE.paperEndPage = endP;
  APP_STATE.paperTotalSteps = Math.max(1, (endP - startP + 1) * 2);
  APP_STATE.paperCurrentStep = 0;
  APP_STATE.drawingsCache = {};

  const titleEl = document.getElementById('paperTestTitle');
  if (titleEl) titleEl.textContent = test.title;
  const examTitleEl = document.getElementById('paperViewerExamTitle');
  if (examTitleEl) examTitleEl.textContent = `📄 ${test.title}`;

  const emptyState = document.getElementById('paperTestEmptyState');
  const activeArea = document.getElementById('paperTestActiveArea');
  if (emptyState) emptyState.style.display = 'none';
  if (activeArea) activeArea.style.display = 'block';

  // 타이머 리셋 & 시작
  if (APP_STATE.paperTimerInterval) clearInterval(APP_STATE.paperTimerInterval);
  APP_STATE.paperDurationSec = 0;
  updatePaperTimerDisplay();
  APP_STATE.paperTimerInterval = setInterval(() => {
    APP_STATE.paperDurationSec++;
    updatePaperTimerDisplay();
  }, 1000);

  // 컨트롤 슬라이더 설정
  const slider = document.getElementById('paperStepSlider');
  if (slider) {
    slider.min = 0;
    slider.max = APP_STATE.paperTotalSteps - 1;
    slider.value = 0;
  }

  // 필기 캔버스 엔진 초기화
  setupDrawingEngine();

  // OMR 시트 렌더링
  renderPaperOmrSheet();

  // PDF 문서 로드 및 첫 단(1P 좌측) 렌더링
  if (test.pdf_file_url && typeof pdfjsLib !== 'undefined') {
    await loadPaperPdfDoc(test);
    await renderPaperColStep(0);
  }
}

async function loadPaperPdfDoc(test) {
  if (!test || !test.pdf_file_url || typeof pdfjsLib === 'undefined') return null;
  if (APP_STATE.paperPdfDoc && APP_STATE.currentPdfTest?.id === test.id) {
    return APP_STATE.paperPdfDoc;
  }
  try {
    let docSource;
    if (test.pdf_file_url.startsWith('idb:')) {
      const idbKey = test.pdf_file_url.replace('idb:', '');
      const blob = window.MSE_DB?.getPdfBlob
        ? await window.MSE_DB.getPdfBlob(idbKey)
        : null;
      if (blob) {
        docSource = { data: await blob.arrayBuffer() };
      } else {
        throw new Error('로컬 IndexedDB에서 PDF 파일을 찾을 수 없습니다.');
      }
    } else if (test.pdf_file_url.startsWith('data:')) {
      docSource = { data: convertDataURIToBinary(test.pdf_file_url) };
    } else {
      docSource = { url: test.pdf_file_url };
    }

    APP_STATE.paperPdfDoc = await pdfjsLib.getDocument({
      ...docSource,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true
    }).promise;
    return APP_STATE.paperPdfDoc;
  } catch (e) {
    console.warn('PDF 로드 실패:', e);
    return null;
  }
}

function convertDataURIToBinary(dataURI) {
  const base64Index = dataURI.indexOf(';base64,') + 8;
  const base64 = dataURI.substring(base64Index);
  const raw = window.atob(base64);
  const rawLength = raw.length;
  const array = new Uint8Array(new ArrayBuffer(rawLength));
  for (let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

function updatePaperTimerDisplay() {
  const timerText = document.getElementById('paperTimerText');
  if (!timerText) return;
  const m = String(Math.floor(APP_STATE.paperDurationSec / 60)).padStart(2, '0');
  const s = String(APP_STATE.paperDurationSec % 60).padStart(2, '0');
  timerText.textContent = `${m}:${s}`;
}

// --------------------------------------------------------
// 2단(2-Column) 슬라이스 렌더링 엔진
// --------------------------------------------------------
async function renderPaperColStep(step) {
  if (!APP_STATE.paperPdfDoc || APP_STATE.paperTotalSteps === 0) return;
  if (step < 0) step = 0;
  if (step >= APP_STATE.paperTotalSteps) step = APP_STATE.paperTotalSteps - 1;

  // 이전 스텝 필기 저장
  saveCurrentStepDrawing();

  APP_STATE.paperCurrentStep = step;

  const startP = APP_STATE.paperStartPage || 1;
  const pageNum = startP + Math.floor(step / 2);
  const isRightCol = (step % 2 === 1);

  // OMR 뱃지 및 슬라이더 갱신
  const badgeText = document.getElementById('paperColBadgeText');
  const badgeEl = document.getElementById('paperColBadge');
  const counterEl = document.getElementById('paperStepCounter');
  const slider = document.getElementById('paperStepSlider');

  if (badgeText) badgeText.textContent = `${pageNum}페이지 [${isRightCol ? '우' : '좌'}]`;
  if (badgeEl) {
    badgeEl.className = 'status-badge ' + (isRightCol ? 'badge-col-right' : 'badge-col-left');
  }
  if (counterEl) counterEl.textContent = `${step + 1} / ${APP_STATE.paperTotalSteps}`;
  if (slider) {
    slider.min = 0;
    slider.max = APP_STATE.paperTotalSteps - 1;
    slider.value = step;
  }

  const btnPrev = document.getElementById('btnPaperPrevCol');
  const btnNext = document.getElementById('btnPaperNextCol');
  if (btnPrev) btnPrev.disabled = (step === 0);
  if (btnNext) btnNext.disabled = (step === APP_STATE.paperTotalSteps - 1);

  // 좌측 시험지 뷰어 전용 툴바 동기화 (해설지 뷰어와 동일한 UI)
  const viewerBadgeText = document.getElementById('paperViewerBadgeText');
  const viewerBadgeEl = document.getElementById('paperViewerColBadge');
  const viewerCounterEl = document.getElementById('viewerStepCounter');
  const viewerSlider = document.getElementById('viewerStepSlider');

  if (viewerBadgeText) viewerBadgeText.textContent = `문제 P.${pageNum} [${isRightCol ? '우' : '좌'}]`;
  if (viewerBadgeEl) {
    viewerBadgeEl.className = 'status-badge ' + (isRightCol ? 'badge-col-right' : 'badge-col-left');
  }
  if (viewerCounterEl) viewerCounterEl.textContent = `${step + 1} / ${APP_STATE.paperTotalSteps}`;
  if (viewerSlider) {
    viewerSlider.min = 0;
    viewerSlider.max = APP_STATE.paperTotalSteps - 1;
    viewerSlider.value = step;
  }

  const btnViewerPrev = document.getElementById('btnViewerPrevCol');
  const btnViewerNext = document.getElementById('btnViewerNextCol');
  if (btnViewerPrev) btnViewerPrev.disabled = (step === 0);
  if (btnViewerNext) btnViewerNext.disabled = (step === APP_STATE.paperTotalSteps - 1);

  // 이전 렌더 작업 취소
  if (APP_STATE.currentRenderTask) {
    try { APP_STATE.currentRenderTask.cancel(); } catch (e) {}
    APP_STATE.currentRenderTask = null;
  }

  try {
    const page = await APP_STATE.paperPdfDoc.getPage(pageNum);
    const scale = 2.0; // 고선명도
    const viewport = page.getViewport({ scale });

    // 메모리 내 임시 캔버스
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;
    const tempCtx = tempCanvas.getContext('2d');

    APP_STATE.currentRenderTask = page.render({
      canvasContext: tempCtx,
      viewport
    });

    await APP_STATE.currentRenderTask.promise;

    // 표시용 cropCanvas에 좌 또는 우 절반 크롭 복사
    const cropCanvas = document.getElementById('cropCanvas');
    const drawCanvas = document.getElementById('drawCanvas');
    if (!cropCanvas || !drawCanvas) return;

    const halfWidth = Math.floor(viewport.width / 2);
    // 중앙 파란색 분할선이 좌/우단 어디서든 잘리지 않고 선명하게 보이도록 여유 마진(3px) 포함
    const sx = isRightCol ? Math.max(0, halfWidth - 3) : 0;
    const colWidth = isRightCol ? (viewport.width - sx) : (halfWidth + 3);

    cropCanvas.width = colWidth;
    cropCanvas.height = viewport.height;

    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(
      tempCanvas,
      sx, 0, colWidth, viewport.height,
      0, 0, colWidth, viewport.height
    );

    // 필기 캔버스 크기를 1:1로 맞추고 해당 단 필기 복원
    drawCanvas.width = colWidth;
    drawCanvas.height = viewport.height;
    restoreStepDrawing(step);

  } catch (err) {
    if (err && err.name === 'RenderingCancelledException') return;
    console.warn('renderPaperColStep error:', err);
  }
}

async function goToPaperStep(step) {
  if (step < 0 || step >= APP_STATE.paperTotalSteps) return;
  await renderPaperColStep(step);
}

// --------------------------------------------------------
// 패드(아이패드/태블릿) 실시간 캔버스 필기 엔진 (PointerEvents)
// --------------------------------------------------------
let isDrawing = false;
let lastX = 0;
let lastY = 0;

function setupDrawingEngine() {
  const drawCanvas = document.getElementById('drawCanvas');
  if (!drawCanvas) return;

  const ctx = drawCanvas.getContext('2d');

  const getCanvasCoords = (e) => {
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  drawCanvas.onpointerdown = (e) => {
    e.preventDefault();
    isDrawing = true;
    const coords = getCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (APP_STATE.penMode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 26;
      ctx.globalAlpha = 1.0;
    } else if (APP_STATE.penMode === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 18;
      ctx.strokeStyle = '#FDE047';
      ctx.globalAlpha = 0.35;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = APP_STATE.penWidth || 2;
      ctx.strokeStyle = APP_STATE.penColor || '#111827';
      ctx.globalAlpha = 1.0;
    }
  };

  drawCanvas.onpointermove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    lastX = coords.x;
    lastY = coords.y;
  };

  const endDrawing = (e) => {
    if (isDrawing) {
      isDrawing = false;
      ctx.closePath();
      saveCurrentStepDrawing();
    }
  };

  drawCanvas.onpointerup = endDrawing;
  drawCanvas.onpointercancel = endDrawing;
  drawCanvas.onpointerleave = endDrawing;

  // 툴바 버튼 바인딩
  document.querySelectorAll('.pen-tool-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.pen-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (btn.id === 'btnPenClear') {
        ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        delete APP_STATE.drawingsCache[APP_STATE.paperCurrentStep];
        return;
      }

      if (btn.id === 'btnPenEraser') {
        APP_STATE.penMode = 'eraser';
      } else if (btn.id === 'btnPenHighlighter') {
        APP_STATE.penMode = 'highlighter';
      } else {
        APP_STATE.penMode = 'pen';
        APP_STATE.penColor = btn.dataset.color || '#111827';
        APP_STATE.penWidth = parseInt(btn.dataset.width, 10) || 2;
      }
    };
  });
}

function saveCurrentStepDrawing() {
  const drawCanvas = document.getElementById('drawCanvas');
  if (!drawCanvas || drawCanvas.width === 0) return;
  APP_STATE.drawingsCache[APP_STATE.paperCurrentStep] = drawCanvas.toDataURL();
}

function restoreStepDrawing(step) {
  const drawCanvas = document.getElementById('drawCanvas');
  if (!drawCanvas) return;
  const ctx = drawCanvas.getContext('2d');
  ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

  const cachedData = APP_STATE.drawingsCache[step];
  if (cachedData) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
    };
    img.src = cachedData;
  }
}

// --------------------------------------------------------
// OMR ANSWER SHEET 렌더링 & 마킹
// --------------------------------------------------------
function renderPaperOmrSheet() {
  const sheetBody = document.getElementById('paperOmrSheetBody');
  if (!sheetBody) return;
  sheetBody.innerHTML = '';

  const total = APP_STATE.paperTotalQuestions || 20;

  for (let q = 1; q <= total; q++) {
    const row = document.createElement('div');
    row.className = 'omr-row';
    row.dataset.q = q;

    const qNum = document.createElement('div');
    qNum.className = 'omr-qnum';
    qNum.textContent = `${q}번`;

    const bubbles = document.createElement('div');
    bubbles.className = 'omr-bubbles';

    for (let opt = 1; opt <= 5; opt++) {
      const bubble = document.createElement('div');
      bubble.className = 'omr-bubble';
      bubble.textContent = opt;
      bubble.dataset.choice = opt;

      if (String(APP_STATE.paperUserAnswers[q]) === String(opt)) {
        bubble.classList.add('marked');
      }

      bubble.addEventListener('click', () => {
        markPaperAnswer(q, opt, row);
      });

      bubbles.appendChild(bubble);
    }

    row.appendChild(qNum);
    row.appendChild(bubbles);
    sheetBody.appendChild(row);
  }

  updatePaperOmrProgress();
}

function markPaperAnswer(q, choice, rowEl) {
  if (String(APP_STATE.paperUserAnswers[q]) === String(choice)) {
    delete APP_STATE.paperUserAnswers[q];
  } else {
    APP_STATE.paperUserAnswers[q] = String(choice);
  }

  // Row 상태 갱신
  rowEl.querySelectorAll('.omr-bubble').forEach(b => {
    b.classList.toggle('marked', b.dataset.choice === APP_STATE.paperUserAnswers[q]);
  });

  updatePaperOmrProgress();
}

function updatePaperOmrProgress() {
  const markedCount = Object.keys(APP_STATE.paperUserAnswers).length;
  const total = APP_STATE.paperTotalQuestions || 20;
  const pct = Math.round((markedCount / total) * 100);

  const label = document.getElementById('paperOmrProgressLabel');
  const fill = document.getElementById('paperOmrProgressFill');
  if (label) label.textContent = `${markedCount} / ${total} (${pct}%)`;
  if (fill) fill.style.width = `${pct}%`;
}

// --------------------------------------------------------
// 시험 채점 및 제출
// --------------------------------------------------------
async function submitPaperTest() {
  if (!APP_STATE.currentPdfTest) return;

  const answeredCount = Object.keys(APP_STATE.paperUserAnswers).length;
  const total = APP_STATE.paperTotalQuestions;

  if (answeredCount < total) {
    const proceed = confirm(`총 ${total}문제 중 ${total - answeredCount}문제를 아직 풀지 않았습니다.\n제출하시겠습니까?`);
    if (!proceed) return;
  }

  if (APP_STATE.paperTimerInterval) clearInterval(APP_STATE.paperTimerInterval);

  // 채점 계산
  const answerSheet = APP_STATE.currentPdfTest.answer_sheet || {};
  let correctCount = 0;
  const wrongItems = [];

  for (let q = 1; q <= total; q++) {
    const userAns = String(APP_STATE.paperUserAnswers[q] || '').trim();
    const correctAns = String(answerSheet[q] || '').trim();

    if (userAns && userAns === correctAns) {
      correctCount++;
    } else {
      wrongItems.push({
        wordId: q,
        userAns: userAns || '(미응답)',
        correctAns: correctAns || '-'
      });
    }
  }

  const score = Math.round((correctCount / total) * 100);
  let starsWon = 0;
  if (score >= 60) starsWon = 1;
  if (score >= 70) starsWon = 2;
  if (score >= 80) starsWon = 3;
  if (score >= 90) starsWon = 4;
  if (score === 100) starsWon = 5;

  // DB 및 플래너 schedules 자동 저장 (apiSubmitTest 내부에서 apiCreateScheduleFromTest 호출)
  await window.MSE_DB.apiSubmitTest({
    lessonId: APP_STATE.currentPdfTest.lesson_id || APP_STATE.currentLessonId,
    round: 1,
    testMode: 'ALL',
    score,
    correctCount,
    totalCount: total,
    starsWon,
    wrongItems: [], // PDF 시험은 test_wrong_history 및 vocab_words 갱신 제외
    correctWordIds: [],
    testCategory: 'UNIT', // PDF 시험지는 항상 'UNIT'으로 등록 (chk_test_category 제약 준수)
    testTitle: APP_STATE.currentPdfTest.title,
    testDate: new Date().toISOString(),
    durationSeconds: APP_STATE.paperDurationSec,
    testId: APP_STATE.currentPdfTest.id,
    userAnswers: APP_STATE.paperUserAnswers
  });

  // 완료된 시험지로 등록 후 리스트에 [다시풀기] 갱신
  if (APP_STATE.currentPdfTest) {
    markPdfTestCompleted(APP_STATE.currentPdfTest.id);
    renderPaperTestSelect();
  }

  // 1) 테스트 완료 버튼을 누르기 전 및 제출 직후에는 기존 테스트 뷰 유지
  // 2) 채점 결과 모달 노출 (점수, 피드백 등 확인)
  const resModal = document.getElementById('resultModal');
  if (resModal) {
    document.getElementById('modalTitle').textContent = '📄 시험지 채점 완료!';
    document.getElementById('currentRoundBadge').textContent = `${APP_STATE.currentPdfTest.title} (풀이시간: ${Math.floor(APP_STATE.paperDurationSec / 60)}분 ${APP_STATE.paperDurationSec % 60}초)`;
    document.getElementById('modalScoreNumber').textContent = `${score}점 (${correctCount}/${total})`;
    document.getElementById('modalFeedback').textContent = score >= 90 ? '완벽해요! 플래너 일정에 자동 등록되었습니다 📅' : '수고했어요! 플래너 일정에 자동 등록되었습니다 📅';

    const starsRow = document.getElementById('modalStarsRow');
    if (starsRow) starsRow.innerHTML = '⭐️'.repeat(starsWon) || '🌱';

    // 답안 제출 완료 후 결과 화면에서 '해설보기' 버튼을 누르면 그때 테스트 뷰가 해설뷰와 같은 모양으로 전환!
    const btnExpl = document.getElementById('modalBtnExplanation');
    if (btnExpl) {
      btnExpl.onclick = () => {
        resModal.classList.remove('open');
        openDualExplanation(APP_STATE.currentPdfTest, APP_STATE.paperUserAnswers, {
          score,
          correctCount,
          total,
          starsWon
        });
      };
    }

    resModal.classList.add('open');
  }
}

// --------------------------------------------------------
// 듀얼 해설 보기 모달 (텍스트 해설 + 2단 해설지 이미지)
// --------------------------------------------------------
function setupExplanationViewer() {
  const modal = document.getElementById('explanationModal');
  if (!modal) return;

  document.getElementById('btnCloseExplanationModal')?.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  const tabText = document.getElementById('btnExplTabText');
  const tabImage = document.getElementById('btnExplTabImage');
  const textContainer = document.getElementById('explTextContainer');
  const imageContainer = document.getElementById('explImageContainer');

  tabText?.addEventListener('click', () => {
    tabText.classList.add('active');
    tabImage.classList.remove('active');
    textContainer.style.display = 'block';
    imageContainer.style.display = 'none';
  });

  tabImage?.addEventListener('click', async () => {
    tabImage.classList.add('active');
    tabText.classList.remove('active');
    textContainer.style.display = 'none';
    imageContainer.style.display = 'flex';
    await renderExplColStep(APP_STATE.explCurrentStep || 0);
  });

  document.getElementById('btnExplPrevCol')?.addEventListener('click', () => {
    goToExplStep(APP_STATE.explCurrentStep - 1);
  });
  document.getElementById('btnExplNextCol')?.addEventListener('click', () => {
    goToExplStep(APP_STATE.explCurrentStep + 1);
  });
  document.getElementById('explStepSlider')?.addEventListener('input', (e) => {
    goToExplStep(parseInt(e.target.value, 10));
  });
}

async function openExplanationModal(test, userAnswers = {}) {
  const modal = document.getElementById('explanationModal');
  if (!modal || !test) return;

  document.getElementById('explModalTitle').textContent = `💡 [${test.title}] 정답 및 해설 보기`;

  // 1. 텍스트 해설 채우기
  const textContent = document.getElementById('explTextContent');
  if (textContent) {
    textContent.innerHTML = '';
    const answerSheet = test.answer_sheet || {};
    const explanations = test.explanations || {};
    const total = test.total_questions || Object.keys(answerSheet).filter(k => !k.startsWith('_')).length || 20;

    for (let q = 1; q <= total; q++) {
      const uAns = userAnswers[q] || '(미응답)';
      const cAns = answerSheet[q] || '-';
      const isCorrect = String(uAns).trim() === String(cAns).trim();
      const explText = explanations[q] || `정답: ${cAns}`;

      const card = document.createElement('div');
      card.className = 'expl-card';
      card.innerHTML = `
        <div class="expl-card-header">
          <div class="expl-card-title">
            <span style="font-weight:900; margin-right:6px;">Q${q}</span>
            <span style="color:${isCorrect ? '#16A34A' : '#DC2626'}; font-weight:800;">
              ${isCorrect ? '✅ 정답' : '❌ 오답'}
            </span>
          </div>
          <div style="font-size:12px; color:#78716C;">
            내 답안: <b>${uAns}</b> | 실제 정답: <b style="color:#6C52EE;">${cAns}</b>
          </div>
        </div>
        <div class="expl-card-body">
          ${explText}
        </div>
      `;
      textContent.appendChild(card);
    }
  }

  // 2. 해설 이미지 슬라이스 상태 준비
  const numPages = (APP_STATE.paperPdfDoc ? APP_STATE.paperPdfDoc.numPages : 1);
  const explStart = Number(test.answer_page) || (Number(test.end_page) + 1);
  APP_STATE.explStartPage = Math.min(explStart, numPages);
  APP_STATE.explEndPage = numPages;
  APP_STATE.explTotalSteps = Math.max(1, (APP_STATE.explEndPage - APP_STATE.explStartPage + 1) * 2);
  APP_STATE.explCurrentStep = 0;

  const slider = document.getElementById('explStepSlider');
  if (slider) {
    slider.min = 0;
    slider.max = APP_STATE.explTotalSteps - 1;
    slider.value = 0;
  }

  // 기본 텍스트 탭 활성화 후 모달 오픈
  document.getElementById('btnExplTabText')?.click();
  modal.classList.add('open');
}

async function renderExplColStep(step) {
  if (!APP_STATE.paperPdfDoc || APP_STATE.explTotalSteps === 0) return;
  if (step < 0) step = 0;
  if (step >= APP_STATE.explTotalSteps) step = APP_STATE.explTotalSteps - 1;

  APP_STATE.explCurrentStep = step;

  const startP = APP_STATE.explStartPage || 1;
  const pageNum = startP + Math.floor(step / 2);
  const isRightCol = (step % 2 === 1);

  const badgeEl = document.getElementById('explColBadge');
  const counterEl = document.getElementById('explStepCounter');
  const slider = document.getElementById('explStepSlider');

  if (badgeEl) badgeEl.textContent = `해설 P.${pageNum} [${isRightCol ? '우' : '좌'}]`;
  if (counterEl) counterEl.textContent = `${step + 1} / ${APP_STATE.explTotalSteps}`;
  if (slider) slider.value = step;

  if (APP_STATE.currentExplRenderTask) {
    try { APP_STATE.currentExplRenderTask.cancel(); } catch (e) {}
    APP_STATE.currentExplRenderTask = null;
  }

  try {
    const page = await APP_STATE.paperPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;
    const tempCtx = tempCanvas.getContext('2d');

    APP_STATE.currentExplRenderTask = page.render({ canvasContext: tempCtx, viewport });
    await APP_STATE.currentExplRenderTask.promise;

    const canvas = document.getElementById('explCropCanvas');
    if (!canvas) return;
    const halfWidth = Math.floor(viewport.width / 2);
    canvas.width = halfWidth;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    const sx = isRightCol ? halfWidth : 0;
    ctx.drawImage(tempCanvas, sx, 0, halfWidth, viewport.height, 0, 0, halfWidth, viewport.height);
  } catch (e) {
    if (e && e.name === 'RenderingCancelledException') return;
    console.warn('renderExplColStep error:', e);
  }
}

async function goToExplStep(step) {
  if (step < 0 || step >= APP_STATE.explTotalSteps) return;
  await renderExplColStep(step);
}

// --------------------------------------------------------
// 50:50 좌우 2분할 해설 뷰어 (좌측: 문제지 1/2, 우측: 해설지 1/2 - 3번 요구사항)
// --------------------------------------------------------
function setupDualExplanationViewer() {
  document.getElementById('btnCloseDualExpl')?.addEventListener('click', closeDualExplanation);

  const tabImg = document.getElementById('btnDualExplTabImg');
  const tabTxt = document.getElementById('btnDualExplTabTxt');
  const imgContainer = document.getElementById('dualExplImgContainer');
  const txtContainer = document.getElementById('dualExplTxtContainer');
  const imgToolbar = document.getElementById('dualExplImgToolbar');

  tabImg?.addEventListener('click', async () => {
    tabImg.classList.add('active');
    tabTxt?.classList.remove('active');
    if (imgContainer) imgContainer.style.display = 'block';
    if (txtContainer) txtContainer.style.display = 'none';
    if (imgToolbar) imgToolbar.style.display = 'flex';
    await renderDualExplColStep(APP_STATE.dualExplStep || 0);
  });

  tabTxt?.addEventListener('click', () => {
    tabTxt.classList.add('active');
    tabImg?.classList.remove('active');
    if (imgContainer) imgContainer.style.display = 'none';
    if (txtContainer) txtContainer.style.display = 'flex';
    if (imgToolbar) imgToolbar.style.display = 'none';
  });

  document.getElementById('btnDualExplPrevCol')?.addEventListener('click', () => {
    renderDualExplColStep((APP_STATE.dualExplStep || 0) - 1);
  });

  document.getElementById('btnDualExplNextCol')?.addEventListener('click', () => {
    renderDualExplColStep((APP_STATE.dualExplStep || 0) + 1);
  });

  document.getElementById('dualExplStepSlider')?.addEventListener('input', (e) => {
    renderDualExplColStep(parseInt(e.target.value, 10));
  });

  // 좌측 시험지 문제 뷰어 탐색 컨트롤러 바인딩 (해설지 뷰어와 동일한 조작감)
  document.getElementById('btnViewerPrevCol')?.addEventListener('click', () => {
    goToPaperStep((APP_STATE.paperCurrentStep || 0) - 1);
  });

  document.getElementById('btnViewerNextCol')?.addEventListener('click', () => {
    goToPaperStep((APP_STATE.paperCurrentStep || 0) + 1);
  });

  document.getElementById('viewerStepSlider')?.addEventListener('input', (e) => {
    goToPaperStep(parseInt(e.target.value, 10));
  });
}

async function openDualExplanation(test, userAnswers = {}, resultSummary = null) {
  if (!test) return;

  APP_STATE.currentPdfTest = test;
  const startP = Number(test.start_page) || 1;
  const endP = Number(test.end_page) || startP;
  APP_STATE.paperStartPage = startP;
  APP_STATE.paperEndPage = endP;
  APP_STATE.paperTotalSteps = Math.max(1, (endP - startP + 1) * 2);
  APP_STATE.paperCurrentStep = 0;

  // 1. 기존 결과 모달 닫기 (전면 뷰어만 보이도록)
  document.getElementById('resultModal')?.classList.remove('open');

  // 2. 단원평가 탭 직접 UI 활성화 (tabBtn.click()으로 인한 initPaperTestSession 경합 차단)
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const tabBtn = document.getElementById('tabBtnPaperTest');
  const tabContent = document.getElementById('tab-paper_test');
  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');

  const diaryContainer = document.querySelector('.diary-container');
  if (diaryContainer) diaryContainer.classList.add('wide-mode');

  // 시험지 과목 및 상단 드롭다운 동기화
  if (test.subject_name) {
    APP_STATE.currentSubject = test.subject_name;
  }
  const testSelect = document.getElementById('paperTestSelect');
  if (testSelect) testSelect.value = test.id;

  const emptyState = document.getElementById('paperTestEmptyState');
  const activeArea = document.getElementById('paperTestActiveArea');
  if (emptyState) emptyState.style.display = 'none';
  if (activeArea) activeArea.style.display = 'block';

  // 3. 2분할 50:50 전면 뷰어 레이아웃 활성화 (좌: 시험지 50%, 우: 해설지 50%)
  const splitGrid = document.querySelector('.paper-split-grid');
  if (splitGrid) splitGrid.classList.add('expl-mode');

  const omrPanel = document.querySelector('.paper-omr-panel:not(.paper-expl-panel)');
  if (omrPanel) omrPanel.style.display = 'none';

  const explPanel = document.getElementById('paperExplSplitPanel');
  if (explPanel) explPanel.style.display = 'flex';

  // 좌측 시험지 뷰어를 해설뷰와 같은 모양으로 전환!
  const examHeader = document.getElementById('viewerExamHeader');
  const explHeader = document.getElementById('viewerExplHeader');
  const explToolbar = document.getElementById('viewerExplToolbar');
  if (examHeader) examHeader.style.display = 'none';
  if (explHeader) explHeader.style.display = 'flex';
  if (explToolbar) explToolbar.style.display = 'flex';

  // 시험지 제목 및 채점 결과 뱃지 업데이트
  const titleEl = document.getElementById('paperViewerTitle');
  if (titleEl) titleEl.textContent = `📄 ${test.title}`;

  const scoreBadge = document.getElementById('paperResultScoreBadge');
  if (scoreBadge) {
    if (resultSummary && resultSummary.score !== undefined) {
      scoreBadge.textContent = `🏆 ${resultSummary.score}점 (${resultSummary.correctCount}/${resultSummary.total}) ${'⭐️'.repeat(resultSummary.starsWon || 0)}`;
      scoreBadge.style.display = 'inline-block';
    } else {
      scoreBadge.style.display = 'none';
    }
  }

  // 좌측 시험지 슬라이더 세팅
  const viewerSlider = document.getElementById('viewerStepSlider');
  if (viewerSlider) {
    viewerSlider.min = 0;
    viewerSlider.max = APP_STATE.paperTotalSteps - 1;
    viewerSlider.value = 0;
  }

  // PDF 문서 로드 확인 및 첫 단 렌더링
  if (!APP_STATE.paperPdfDoc || APP_STATE.currentPdfTest?.id !== test.id) {
    await loadPaperPdfDoc(test);
  }
  await renderPaperColStep(0);

  // 4. 문항별 정답/해설 텍스트 탭 구성
  const textContent = document.getElementById('dualExplTxtContainer');
  if (textContent) {
    textContent.innerHTML = '';
    const answerSheet = test.answer_sheet || {};
    const explanations = test.explanations || {};
    const total = test.total_questions || Object.keys(answerSheet).filter(k => !k.startsWith('_')).length || 20;

    for (let q = 1; q <= total; q++) {
      const uAns = userAnswers[q] || '(미응답)';
      const cAns = answerSheet[q] || '-';
      const isCorrect = String(uAns).trim() === String(cAns).trim();
      const explText = explanations[q] || `정답: ${cAns}`;

      const card = document.createElement('div');
      card.className = 'expl-card';
      card.style.cssText = 'background:#fff; border:1.5px solid #E5E0F2; border-radius:8px; padding:10px 12px; margin-bottom:8px; box-shadow:0 2px 6px rgba(0,0,0,0.04);';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div>
            <span style="font-weight:900; margin-right:6px; font-size:14px; color:#382B68;">Q${q}</span>
            <span style="color:${isCorrect ? '#16A34A' : '#DC2626'}; font-weight:800; font-size:12px;">
              ${isCorrect ? '✅ 정답' : '❌ 오답'}
            </span>
          </div>
          <div style="font-size:12px; color:#6B7280;">
            내 답안: <b style="color:${isCorrect ? '#16A34A' : '#DC2626'}">${uAns}</b> | 실제 정답: <b style="color:#6C52EE;">${cAns}</b>
          </div>
        </div>
        <div style="font-size:12px; color:#374151; background:#F8F7FC; padding:8px 10px; border-radius:6px; line-height:1.5;">
          ${explText}
        </div>
      `;
      textContent.appendChild(card);
    }
  }

  // 5. 해설 이미지 슬라이스 준비
  const numPages = (APP_STATE.paperPdfDoc ? APP_STATE.paperPdfDoc.numPages : 1);
  const explStart = Number(test.answer_page) || (Number(test.end_page) + 1);
  APP_STATE.dualExplStartPage = Math.min(explStart, numPages);
  APP_STATE.dualExplEndPage = numPages;
  APP_STATE.dualExplTotalSteps = Math.max(1, (APP_STATE.dualExplEndPage - APP_STATE.dualExplStartPage + 1) * 2);
  APP_STATE.dualExplStep = 0;

  const slider = document.getElementById('dualExplStepSlider');
  if (slider) {
    slider.min = 0;
    slider.max = APP_STATE.dualExplTotalSteps - 1;
    slider.value = 0;
  }

  // 기본 이미지 탭 활성화
  document.getElementById('btnDualExplTabImg')?.click();

  // 6. 틀린 문항 수집 및 오답노트 작성창
  const wrongQuestions = [];
  const ansSheet = test.answer_sheet || {};
  const totQuestions = test.total_questions || Object.keys(ansSheet).filter(k => !k.startsWith('_')).length || 20;

  for (let q = 1; q <= totQuestions; q++) {
    const uAns = userAnswers[q] || '(미응답)';
    const cAns = ansSheet[q] || '-';
    const isCorrect = userAnswers[q] !== undefined && String(uAns).trim() === String(cAns).trim();
    if (!isCorrect) {
      wrongQuestions.push({
        num: q,
        user_answer: uAns,
        correct_answer: cAns
      });
    }
  }

  // 만약 userAnswers가 없어서 wrongQuestions가 0개이거나 100점인 경우, 기존 저장된 오답노트 조회
  if (wrongQuestions.length === 0) {
    try {
      const existingNotes = await window.MSE_DB?.getWrongAnswerNotes({ test_id: test.id });
      if (existingNotes && existingNotes.length > 0) {
        existingNotes.forEach(n => {
          wrongQuestions.push({
            num: n.question_num,
            user_answer: n.user_answer || '-',
            correct_answer: n.correct_answer || ansSheet[n.question_num] || '-'
          });
        });
        wrongQuestions.sort((a, b) => a.num - b.num);
      }
    } catch (e) {
      console.warn('getWrongAnswerNotes error:', e);
    }
  }

  // 그래도 비어있으면 전체 문항을 오답노트 편집 대상으로 생성
  if (wrongQuestions.length === 0) {
    for (let q = 1; q <= totQuestions; q++) {
      wrongQuestions.push({
        num: q,
        user_answer: userAnswers[q] || '-',
        correct_answer: ansSheet[q] || '-'
      });
    }
  }

  const btnReopen = document.getElementById('btnReopenWrongNoteModal');
  if (wrongQuestions.length > 0) {
    if (btnReopen) {
      btnReopen.style.display = 'inline-block';
      btnReopen.textContent = `📝 오답노트 (${wrongQuestions.length})`;
    }
    await openFloatingWrongNoteModal(test, wrongQuestions);
  } else {
    if (btnReopen) btnReopen.style.display = 'none';
    closeFloatingWrongNoteModal();
  }
}

async function renderDualExplColStep(step) {
  if (!APP_STATE.paperPdfDoc || !APP_STATE.dualExplTotalSteps) return;
  if (step < 0) step = 0;
  if (step >= APP_STATE.dualExplTotalSteps) step = APP_STATE.dualExplTotalSteps - 1;

  APP_STATE.dualExplStep = step;

  const startP = APP_STATE.dualExplStartPage || 1;
  const pageNum = startP + Math.floor(step / 2);
  const isRightCol = (step % 2 === 1);

  const badgeEl = document.getElementById('dualExplBadgeText');
  const counterEl = document.getElementById('dualExplStepCounter');
  const slider = document.getElementById('dualExplStepSlider');

  if (badgeEl) badgeEl.textContent = `해설 P.${pageNum} [${isRightCol ? '우' : '좌'}]`;
  if (counterEl) counterEl.textContent = `${step + 1} / ${APP_STATE.dualExplTotalSteps}`;
  if (slider) slider.value = step;

  if (APP_STATE.currentDualExplRenderTask) {
    try { APP_STATE.currentDualExplRenderTask.cancel(); } catch (e) {}
    APP_STATE.currentDualExplRenderTask = null;
  }

  try {
    const page = await APP_STATE.paperPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;
    const tempCtx = tempCanvas.getContext('2d');

    APP_STATE.currentDualExplRenderTask = page.render({ canvasContext: tempCtx, viewport });
    await APP_STATE.currentDualExplRenderTask.promise;

    const canvas = document.getElementById('dualExplCropCanvas');
    if (!canvas) return;
    const halfWidth = Math.floor(viewport.width / 2);
    canvas.width = halfWidth;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    const sx = isRightCol ? halfWidth : 0;
    ctx.drawImage(tempCanvas, sx, 0, halfWidth, viewport.height, 0, 0, halfWidth, viewport.height);
  } catch (e) {
    if (e && e.name === 'RenderingCancelledException') return;
    console.warn('renderDualExplColStep error:', e);
  }
}

function closeDualExplanation() {
  const splitGrid = document.querySelector('.paper-split-grid');
  if (splitGrid) splitGrid.classList.remove('expl-mode');

  const explPanel = document.getElementById('paperExplSplitPanel');
  if (explPanel) explPanel.style.display = 'none';

  const omrPanel = document.querySelector('.paper-omr-panel:not(.paper-expl-panel)');
  if (omrPanel) omrPanel.style.display = 'flex';

  // 좌측 시험지 뷰어를 기존 시험 뷰 모양으로 복원!
  const examHeader = document.getElementById('viewerExamHeader');
  const explHeader = document.getElementById('viewerExplHeader');
  const explToolbar = document.getElementById('viewerExplToolbar');
  if (examHeader) examHeader.style.display = 'flex';
  if (explHeader) explHeader.style.display = 'none';
  if (explToolbar) explToolbar.style.display = 'none';

  const scoreBadge = document.getElementById('paperResultScoreBadge');
  if (scoreBadge) scoreBadge.style.display = 'none';

  // 오답노트 작성창 닫기 및 재오픈 버튼 숨김
  closeFloatingWrongNoteModal();
  const btnReopen = document.getElementById('btnReopenWrongNoteModal');
  if (btnReopen) btnReopen.style.display = 'none';
}

// --------------------------------------------------------
// 테스트 뷰어 창 확대/축소 줌 컨트롤러 (8번 요구사항)
// --------------------------------------------------------
function setupPaperZoomControls() {
  APP_STATE.paperZoom = 100;

  const updateZoom = (val) => {
    APP_STATE.paperZoom = Math.min(250, Math.max(60, val));
    const wrapper = document.getElementById('canvasStackWrapper');
    if (wrapper) {
      wrapper.style.width = `${APP_STATE.paperZoom}%`;
      wrapper.style.maxWidth = 'none';
    }
    const display = document.getElementById('zoomLevelText');
    if (display) display.textContent = `${APP_STATE.paperZoom}%`;
    const displayDual = document.getElementById('zoomLevelTextDual');
    if (displayDual) displayDual.textContent = `${APP_STATE.paperZoom}%`;
  };

  document.getElementById('btnZoomIn')?.addEventListener('click', () => {
    updateZoom((APP_STATE.paperZoom || 100) + 15);
  });
  document.getElementById('btnZoomOut')?.addEventListener('click', () => {
    updateZoom((APP_STATE.paperZoom || 100) - 15);
  });
  document.getElementById('btnZoomReset')?.addEventListener('click', () => {
    updateZoom(100);
  });

  // 해설 모드용 줌 컨트롤러도 동일하게 연동
  document.getElementById('btnZoomInDual')?.addEventListener('click', () => {
    updateZoom((APP_STATE.paperZoom || 100) + 15);
  });
  document.getElementById('btnZoomOutDual')?.addEventListener('click', () => {
    updateZoom((APP_STATE.paperZoom || 100) - 15);
  });
  document.getElementById('btnZoomResetDual')?.addEventListener('click', () => {
    updateZoom(100);
  });
}

// --------------------------------------------------------
// 단원 및 시험지 관리 모달 (삭제 기능 포함 - 7번 요구사항)
// --------------------------------------------------------
function setupManageTestsModal() {
  const modal = document.getElementById('manageTestsModal');
  const openBtn = document.getElementById('btnOpenManageTests');
  const closeBtn = document.getElementById('btnCloseManageTestsModal');
  const subSelect = document.getElementById('manageTestsSubjectSelect');
  const addPdfBtn = document.getElementById('btnManageOpenAddPdfModal');

  if (!modal) return;

  openBtn?.addEventListener('click', async () => {
    // 서랍 메뉴 닫기
    document.getElementById('drawerSidebar')?.classList.remove('open');
    const overlay = document.getElementById('drawerOverlay');
    if (overlay) overlay.style.display = 'none';

    // 과목 셀렉트 채우기
    if (subSelect) {
      subSelect.innerHTML = '';
      const rawSubjects = await window.MSE_DB.apiGetSubjects();
      let subjects = (Array.isArray(rawSubjects) && rawSubjects.length > 0)
        ? rawSubjects.map(s => typeof s === 'string' ? s : s.name).filter(Boolean)
        : [];
      if (subjects.length === 0) {
        subjects = (APP_STATE.subjects && APP_STATE.subjects.length > 0)
          ? APP_STATE.subjects
          : ['영어'];
      }
      subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (s === APP_STATE.currentSubject) opt.selected = true;
        subSelect.appendChild(opt);
      });
    }

    modal.classList.add('open');
    await loadManageTestsTable(subSelect?.value || APP_STATE.currentSubject);
  });

  closeBtn?.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  subSelect?.addEventListener('change', async (e) => {
    await loadManageTestsTable(e.target.value);
  });

  addPdfBtn?.addEventListener('click', () => {
    modal.classList.remove('open');
    document.getElementById('btnOpenPdfTestModal')?.click();
  });
}

async function loadManageTestsTable(subject) {
  const subSelect = document.getElementById('manageTestsSubjectSelect');
  if (subSelect && subSelect.options.length === 0) {
    const rawSubjects = await window.MSE_DB.apiGetSubjects();
    let subjects = (Array.isArray(rawSubjects) && rawSubjects.length > 0)
      ? rawSubjects.map(s => typeof s === 'string' ? s : s.name).filter(Boolean)
      : [];
    if (subjects.length === 0) {
      subjects = (APP_STATE.subjects && APP_STATE.subjects.length > 0)
        ? APP_STATE.subjects
        : ['영어'];
    }
    subSelect.innerHTML = '';
    subjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (s === subject) opt.selected = true;
      subSelect.appendChild(opt);
    });
  }

  const tbody = document.getElementById('manageTestsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px;">시험지 목록을 불러오는 중...</td></tr>';

  try {
    const [tests, lessons] = await Promise.all([
      window.MSE_DB.apiGetPdfTests(subject, null),
      window.MSE_DB.apiGetLessons(subject)
    ]);

    const lessonMap = {};
    (lessons || []).forEach(l => {
      lessonMap[l.id] = l.unit_name;
    });

    if (!tests || tests.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#9587B6; padding:20px;">[${subject}] 과목에 등록된 시험지가 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = tests.map(t => {
      const d = new Date(t.created_at);
      const dateStr = !isNaN(d.getTime()) 
        ? `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
        : '-';
      const subjectName = t.subject_name || subject || '영어';

      return `
        <tr>
          <td style="color:#8F83AE; font-weight:700;">#${t.id}</td>
          <td style="font-weight:800; color:#382B68;">${t.title}</td>
          <td><span class="badge-cat badge-vocab" style="font-weight:800;">${subjectName}</span></td>
          <td style="font-weight:700; color:#5C4B99;">${t.total_questions || '-'}문항</td>
          <td style="color:#78716C; font-size:12px; font-weight:700; letter-spacing:0.5px;">${dateStr}</td>
          <td style="text-align:center;">
            <button class="btn-micro delete-test-btn" data-testid="${t.id}" data-testtitle="${t.title}" style="background:#FEE2E2; color:#DC2626; border:1px solid #FCA5A5; font-weight:800; padding:3px 8px;">
              🗑️ 삭제
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // 삭제 버튼 이벤트 바인딩
    tbody.querySelectorAll('.delete-test-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tId = btn.dataset.testid;
        const tTitle = btn.dataset.testtitle;
        if (!confirm(`'${tTitle}' 시험지를 정말 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`)) {
          return;
        }

        btn.disabled = true;
        btn.textContent = '삭제중...';
        await window.MSE_DB.apiDeletePdfTest(tId);
        alert(`'${tTitle}' 시험지가 삭제되었습니다.`);

        // 리스트 갱신 및 메인 셀렉트 동기화
        await loadManageTestsTable(subject);
        await loadPdfTests(APP_STATE.currentSubject);
      });
    });
  } catch (e) {
    console.warn('loadManageTestsTable error:', e);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#DC2626; padding:16px;">목록을 불러오는 중 오류가 발생했습니다: ${e.message}</td></tr>`;
  }
}

// ========================================================
// 오답노트 플로팅 드래그 모달 및 설정 관리 엔진
// ========================================================

const FLOATING_WRONG_STATE = {
  test: null,
  wrongQuestions: [],
  activeIndex: 0,
  savedNotesMap: {},
  draftNotes: {},
  isDragging: false,
  isMinimized: false
};

function setupFloatingWrongNoteModal() {
  const modal = document.getElementById('floatingWrongNoteModal');
  const header = document.getElementById('floatingWrongHeader');
  const minBtn = document.getElementById('btnMinimizeWrongNote');
  const closeBtn = document.getElementById('btnCloseWrongNote');
  const reopenBtn = document.getElementById('btnReopenWrongNoteModal');
  const saveBtn = document.getElementById('btnSaveWrongNote');
  const saveAllBtn = document.getElementById('btnSaveAllWrongNotes');
  const noteInput = document.getElementById('floatingWrongNoteInput');

  if (!modal || !header) return;

  // 1. 드래그 이동 핸들러 (마우스 & 터치)
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

  const onDragStart = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) return;

    FLOATING_WRONG_STATE.isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = modal.getBoundingClientRect();
    modal.style.transform = 'none';
    modal.style.bottom = 'auto';
    modal.style.left = `${rect.left}px`;
    modal.style.top = `${rect.top}px`;

    startX = clientX;
    startY = clientY;
    initialLeft = rect.left;
    initialTop = rect.top;

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchend', onDragEnd);
  };

  const onDragMove = (e) => {
    if (!FLOATING_WRONG_STATE.isDragging) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;

    const modalWidth = modal.offsetWidth;
    const modalHeight = modal.offsetHeight;
    const maxLeft = window.innerWidth - modalWidth - 10;
    const maxTop = window.innerHeight - modalHeight - 10;

    const newLeft = Math.max(10, Math.min(maxLeft, initialLeft + dx));
    const newTop = Math.max(10, Math.min(maxTop, initialTop + dy));

    modal.style.left = `${newLeft}px`;
    modal.style.top = `${newTop}px`;
  };

  const onDragEnd = () => {
    FLOATING_WRONG_STATE.isDragging = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchend', onDragEnd);
  };

  header.addEventListener('mousedown', onDragStart);
  header.addEventListener('touchstart', onDragStart, { passive: true });

  // 2. 최소화 / 복원 토글
  minBtn?.addEventListener('click', () => {
    FLOATING_WRONG_STATE.isMinimized = !FLOATING_WRONG_STATE.isMinimized;
    if (FLOATING_WRONG_STATE.isMinimized) {
      modal.classList.add('minimized');
      minBtn.textContent = '⬜';
      minBtn.title = '펼치기';
    } else {
      modal.classList.remove('minimized');
      minBtn.textContent = '_';
      minBtn.title = '최소화';
    }
  });

  // 3. 닫기 버튼
  closeBtn?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // 4. 해설 상단 툴바 오답노트 재오픈 버튼
  reopenBtn?.addEventListener('click', () => {
    modal.style.display = 'flex';
    modal.classList.remove('minimized');
    if (minBtn) minBtn.textContent = '_';
    FLOATING_WRONG_STATE.isMinimized = false;
  });

  // 텍스트 실시간 draft 저장
  noteInput?.addEventListener('input', () => {
    const curQ = FLOATING_WRONG_STATE.wrongQuestions[FLOATING_WRONG_STATE.activeIndex];
    if (curQ) {
      if (!FLOATING_WRONG_STATE.draftNotes) FLOATING_WRONG_STATE.draftNotes = {};
      FLOATING_WRONG_STATE.draftNotes[curQ.num] = noteInput.value;
      updateWrongQuestionTabs();
    }
  });

  // 5. 단일 문항 오답노트 저장 버튼
  saveBtn?.addEventListener('click', async () => {
    const curQ = FLOATING_WRONG_STATE.wrongQuestions[FLOATING_WRONG_STATE.activeIndex];
    if (!curQ || !FLOATING_WRONG_STATE.test) return;

    const noteVal = noteInput ? noteInput.value.trim() : '';
    const saveStatus = document.getElementById('floatingNoteSaveStatus');

    saveBtn.disabled = true;
    saveBtn.textContent = '💾 저장 중...';

    try {
      const saved = await window.MSE_DB.saveWrongAnswerNote({
        id: FLOATING_WRONG_STATE.savedNotesMap[curQ.num]?.id,
        user_id: 'student',
        subject: FLOATING_WRONG_STATE.test.subject_name || APP_STATE.currentSubject || '영어',
        lesson_id: FLOATING_WRONG_STATE.test.lesson_id,
        test_id: FLOATING_WRONG_STATE.test.id,
        test_title: FLOATING_WRONG_STATE.test.title,
        question_num: curQ.num,
        user_answer: curQ.user_answer,
        correct_answer: curQ.correct_answer,
        notes: noteVal
      });

      FLOATING_WRONG_STATE.savedNotesMap[curQ.num] = saved;
      if (!FLOATING_WRONG_STATE.draftNotes) FLOATING_WRONG_STATE.draftNotes = {};
      FLOATING_WRONG_STATE.draftNotes[curQ.num] = noteVal;
      updateWrongQuestionTabs();

      if (saveStatus) {
        saveStatus.textContent = '✅ 저장 완료!';
        setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 2500);
      }
    } catch (err) {
      console.error('오답노트 저장 실패:', err);
      alert('오답노트 저장 중 오류가 발생했습니다.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 해당 문항 저장';
    }
  });

  // 6. 작성된 모든 문항 일괄 저장 및 닫기 버튼
  saveAllBtn?.addEventListener('click', async () => {
    if (!FLOATING_WRONG_STATE.test || !FLOATING_WRONG_STATE.wrongQuestions?.length) return;

    // 현재 포커스된 문항 텍스트 draft 반영
    const curQ = FLOATING_WRONG_STATE.wrongQuestions[FLOATING_WRONG_STATE.activeIndex];
    if (curQ && noteInput) {
      if (!FLOATING_WRONG_STATE.draftNotes) FLOATING_WRONG_STATE.draftNotes = {};
      FLOATING_WRONG_STATE.draftNotes[curQ.num] = noteInput.value;
    }

    saveAllBtn.disabled = true;
    saveAllBtn.textContent = '⏳ 일괄 저장 중...';

    try {
      const promises = [];
      FLOATING_WRONG_STATE.wrongQuestions.forEach(wq => {
        const draft = FLOATING_WRONG_STATE.draftNotes?.[wq.num];
        const existing = FLOATING_WRONG_STATE.savedNotesMap[wq.num];
        const noteVal = (draft !== undefined) ? draft.trim() : (existing?.notes?.trim() || '');

        if (noteVal || existing) {
          promises.push(
            window.MSE_DB.saveWrongAnswerNote({
              id: existing?.id,
              user_id: 'student',
              subject: FLOATING_WRONG_STATE.test.subject_name || APP_STATE.currentSubject || '영어',
              lesson_id: FLOATING_WRONG_STATE.test.lesson_id,
              test_id: FLOATING_WRONG_STATE.test.id,
              test_title: FLOATING_WRONG_STATE.test.title,
              question_num: wq.num,
              user_answer: wq.user_answer,
              correct_answer: wq.correct_answer,
              notes: noteVal
            }).then(saved => {
              FLOATING_WRONG_STATE.savedNotesMap[wq.num] = saved;
            })
          );
        }
      });

      await Promise.all(promises);
      updateWrongQuestionTabs();

      const saveStatus = document.getElementById('floatingNoteSaveStatus');
      if (saveStatus) saveStatus.textContent = '✅ 전체 저장 완료!';

      setTimeout(() => {
        modal.style.display = 'none';
        if (saveStatus) saveStatus.textContent = '';
      }, 500);
    } catch (err) {
      console.error('오답노트 일괄 저장 실패:', err);
      alert('오답노트 일괄 저장 중 오류가 발생했습니다.');
    } finally {
      saveAllBtn.disabled = false;
      saveAllBtn.textContent = '✨ 작성한 오답 일괄 저장 및 닫기';
    }
  });
}

/**
 * 플로팅 오답노트 창 팝업 오픈
 */
async function openFloatingWrongNoteModal(test, wrongQuestions) {
  const modal = document.getElementById('floatingWrongNoteModal');
  if (!modal || !test || !wrongQuestions || wrongQuestions.length === 0) return;

  FLOATING_WRONG_STATE.test = test;
  FLOATING_WRONG_STATE.wrongQuestions = wrongQuestions;
  FLOATING_WRONG_STATE.activeIndex = 0;
  FLOATING_WRONG_STATE.isMinimized = false;
  FLOATING_WRONG_STATE.draftNotes = {};

  const titleSub = document.getElementById('floatingWrongTestTitle');
  if (titleSub) titleSub.textContent = test.title;

  modal.classList.remove('minimized');
  const minBtn = document.getElementById('btnMinimizeWrongNote');
  if (minBtn) minBtn.textContent = '_';

  // 초기 위치: 하단 중앙
  modal.style.transform = 'translateX(-50%)';
  modal.style.left = '50%';
  modal.style.top = 'auto';
  modal.style.bottom = '24px';
  modal.style.display = 'flex';

  // 기존 저장된 오답노트 조회
  try {
    const existingNotes = await window.MSE_DB.getWrongAnswerNotes({ test_id: test.id });
    const map = {};
    if (Array.isArray(existingNotes)) {
      existingNotes.forEach(n => {
        if (n && n.question_num) {
          map[n.question_num] = n;
          FLOATING_WRONG_STATE.draftNotes[n.question_num] = n.notes || '';
        }
      });
    }
    FLOATING_WRONG_STATE.savedNotesMap = map;
  } catch (e) {
    FLOATING_WRONG_STATE.savedNotesMap = {};
  }

  renderWrongQuestionTabs();
  selectWrongQuestionTab(0);
}

function closeFloatingWrongNoteModal() {
  const modal = document.getElementById('floatingWrongNoteModal');
  if (modal) modal.style.display = 'none';
}

function renderWrongQuestionTabs() {
  const tabsContainer = document.getElementById('floatingWrongTabs');
  if (!tabsContainer) return;
  tabsContainer.innerHTML = '';

  FLOATING_WRONG_STATE.wrongQuestions.forEach((q, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wrong-q-tab';
    btn.dataset.index = idx;

    const hasSaved = (FLOATING_WRONG_STATE.draftNotes?.[q.num]?.trim() || FLOATING_WRONG_STATE.savedNotesMap[q.num]?.notes?.trim());
    if (hasSaved) {
      btn.classList.add('saved');
      btn.textContent = `✓ ${q.num}번`;
    } else {
      btn.textContent = `${q.num}번`;
    }

    if (idx === FLOATING_WRONG_STATE.activeIndex) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      selectWrongQuestionTab(idx);
    });

    tabsContainer.appendChild(btn);
  });
}

function updateWrongQuestionTabs() {
  const tabsContainer = document.getElementById('floatingWrongTabs');
  if (!tabsContainer) return;
  const buttons = tabsContainer.querySelectorAll('.wrong-q-tab');

  buttons.forEach((btn, idx) => {
    const q = FLOATING_WRONG_STATE.wrongQuestions[idx];
    if (!q) return;
    const hasSaved = (FLOATING_WRONG_STATE.draftNotes?.[q.num]?.trim() || FLOATING_WRONG_STATE.savedNotesMap[q.num]?.notes?.trim());
    if (hasSaved) {
      btn.classList.add('saved');
      btn.textContent = `✓ ${q.num}번`;
    } else {
      btn.classList.remove('saved');
      btn.textContent = `${q.num}번`;
    }
    if (idx === FLOATING_WRONG_STATE.activeIndex) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * 문항 번호(qNum)에 해당하는 문제지(시험지) 2단 슬라이스 스텝 계산
 */
function getExamStepForQuestion(qNum, test) {
  if (!test) return 0;
  const examPages = test.answer_sheet?._exam_pages;
  const startP = Number(test.start_page) || 1;
  const endP = Number(test.end_page) || startP;
  const maxSteps = Math.max(1, (endP - startP + 1) * 2);

  if (examPages && examPages[qNum]) {
    const meta = examPages[qNum];
    const page = Number(meta.page) || startP;
    const isRight = (meta.col === 'right');
    const step = (page - startP) * 2 + (isRight ? 1 : 0);
    return Math.max(0, Math.min(step, maxSteps - 1));
  }

  // Graceful degradation: 문제지 전체 문항 대비 비율로 추정 이동
  const total = Number(test.total_questions) || Object.keys(test.answer_sheet || {}).filter(k => !k.startsWith('_')).length || 20;
  const ratio = Math.max(0, Math.min(1, (Number(qNum) - 1) / Math.max(1, total)));
  const step = Math.floor(ratio * maxSteps);
  return Math.max(0, Math.min(step, maxSteps - 1));
}

/**
 * 문항 번호(qNum)에 해당하는 해설지 2단 슬라이스 스텝 계산
 */
function getExplStepForQuestion(qNum, test) {
  if (!test) return 0;
  const explPages = test.answer_sheet?._pages;
  const startP = Number(APP_STATE.dualExplStartPage) || Number(test.answer_page) || (Number(test.end_page) + 1);
  const totalSteps = APP_STATE.dualExplTotalSteps || 1;

  if (explPages && explPages[qNum]) {
    const meta = explPages[qNum];
    const page = Number(meta.page) || startP;
    const isRight = (meta.col === 'right');
    const step = (page - startP) * 2 + (isRight ? 1 : 0);
    return Math.max(0, Math.min(step, totalSteps - 1));
  }

  // Fallback: 0
  return 0;
}

function selectWrongQuestionTab(idx) {
  // 이전 탭에서 입력 중이던 값 draft 보관
  const prevQ = FLOATING_WRONG_STATE.wrongQuestions[FLOATING_WRONG_STATE.activeIndex];
  const noteInput = document.getElementById('floatingWrongNoteInput');
  if (prevQ && noteInput && FLOATING_WRONG_STATE.activeIndex !== idx) {
    if (!FLOATING_WRONG_STATE.draftNotes) FLOATING_WRONG_STATE.draftNotes = {};
    FLOATING_WRONG_STATE.draftNotes[prevQ.num] = noteInput.value;
  }

  FLOATING_WRONG_STATE.activeIndex = idx;
  const q = FLOATING_WRONG_STATE.wrongQuestions[idx];
  if (!q) return;

  updateWrongQuestionTabs();

  const badge = document.getElementById('floatingQNumBadge');
  const uAnsText = document.getElementById('floatingUserAnswerText');
  const cAnsText = document.getElementById('floatingCorrectAnswerText');
  const saveStatus = document.getElementById('floatingNoteSaveStatus');

  if (badge) badge.textContent = `Q${q.num}`;
  if (uAnsText) uAnsText.textContent = q.user_answer || '(미응답)';
  if (cAnsText) cAnsText.textContent = q.correct_answer || '-';

  const savedNote = FLOATING_WRONG_STATE.savedNotesMap[q.num];
  const draftVal = FLOATING_WRONG_STATE.draftNotes?.[q.num];
  const currentVal = (draftVal !== undefined) ? draftVal : (savedNote?.notes || '');
  if (noteInput) {
    noteInput.value = currentVal;
  }
  if (saveStatus) {
    saveStatus.textContent = savedNote?.notes?.trim() ? '✓ 저장된 기록 있음' : '';
  }

  // 문항별 테스트지(좌측) 및 해설지(우측) 뷰어 위치 동기화 자동 이동
  const test = FLOATING_WRONG_STATE.test;
  if (test) {
    // 1. 좌측 시험지(문제지) 위치로 이동
    const examStep = getExamStepForQuestion(q.num, test);
    if (typeof goToPaperStep === 'function') {
      goToPaperStep(examStep);
    }

    // 2. 우측 해설지 위치로 이동 (듀얼 해설 뷰어가 열려있는 경우)
    const explStep = getExplStepForQuestion(q.num, test);
    if (typeof renderDualExplColStep === 'function') {
      renderDualExplColStep(explStep);
    }
  }
}

// ========================================================
// 설정 내 '오답노트 관리' 페이지 로직
// ========================================================

let TARGET_WRONG_NOTE_TO_MOVE = null;

function setupWrongNotesManageModal() {
  const modal = document.getElementById('wrongNotesManageModal');
  const openBtn = document.getElementById('btnOpenWrongNotesManage');
  const closeBtn = document.getElementById('btnCloseWrongNotesManageModal');
  const subSelect = document.getElementById('wrongManageSubjectSelect');
  const lesSelect = document.getElementById('wrongManageLessonSelect');
  const testSelect = document.getElementById('wrongManageTestSelect');
  const editTestBtn = document.getElementById('btnEditWrongNotesForTest');

  const moveModal = document.getElementById('changeWrongNoteLessonModal');
  const closeMoveBtn = document.getElementById('btnCloseChangeWrongLessonModal');
  const cancelMoveBtn = document.getElementById('btnCancelChangeWrongLesson');
  const confirmMoveBtn = document.getElementById('btnConfirmChangeWrongLesson');

  if (!modal) return;

  openBtn?.addEventListener('click', async () => {
    document.getElementById('drawerSidebar')?.classList.remove('open');
    const overlay = document.getElementById('drawerOverlay');
    if (overlay) overlay.style.display = 'none';

    if (subSelect) {
      subSelect.innerHTML = '';
      const rawSubjects = await window.MSE_DB.apiGetSubjects();
      let subjects = (Array.isArray(rawSubjects) && rawSubjects.length > 0)
        ? rawSubjects.map(s => typeof s === 'string' ? s : s.name).filter(Boolean)
        : [];
      if (subjects.length === 0) {
        subjects = (APP_STATE.subjects && APP_STATE.subjects.length > 0)
          ? APP_STATE.subjects
          : ['영어'];
      }
      subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (s === APP_STATE.currentSubject) opt.selected = true;
        subSelect.appendChild(opt);
      });
    }

    modal.classList.add('open');
    await refreshWrongManageView();
  });

  closeBtn?.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  subSelect?.addEventListener('change', async () => {
    await refreshWrongManageView();
  });

  lesSelect?.addEventListener('change', async () => {
    await refreshWrongManageTests(subSelect.value, lesSelect.value);
    await loadWrongNotesTable(subSelect.value, lesSelect.value, testSelect?.value || 'ALL');
  });

  testSelect?.addEventListener('change', async () => {
    if (editTestBtn) {
      editTestBtn.style.display = (testSelect.value !== 'ALL') ? 'inline-block' : 'none';
    }
    await loadWrongNotesTable(subSelect.value, lesSelect.value, testSelect.value);
  });

  editTestBtn?.addEventListener('click', async () => {
    const testId = testSelect?.value;
    if (!testId || testId === 'ALL') return;

    try {
      const tests = await window.MSE_DB.apiGetPdfTests(subSelect.value, null);
      const targetTest = tests.find(t => String(t.id) === String(testId));
      if (!targetTest) {
        alert('시험지 정보를 찾을 수 없습니다.');
        return;
      }

      // 1. 오답노트 관리 모달 닫기
      modal.classList.remove('open');

      // 2. 해당 시험지의 마지막 응시 기록(test_records) 조회
      let lastRecord = null;
      if (window.MSE_DB?.apiGetLastTestRecordByTestId) {
        lastRecord = await window.MSE_DB.apiGetLastTestRecordByTestId(targetTest.id);
      }
      const userAnswers = lastRecord?.user_answers || {};
      const summary = lastRecord ? {
        score: lastRecord.score,
        correctCount: lastRecord.correct_count,
        total: lastRecord.total_count,
        starsWon: lastRecord.stars_won
      } : null;

      // 3. PDF 문서 로드 및 듀얼 해설 뷰 실행
      await loadPaperPdfDoc(targetTest);
      await openDualExplanation(targetTest, userAnswers, summary);
    } catch (err) {
      console.error('오답노트 해설 뷰 전환 실패:', err);
      alert('오답노트 해설 뷰 전환 중 오류가 발생했습니다.');
    }
  });

  closeMoveBtn?.addEventListener('click', () => moveModal?.classList.remove('open'));
  cancelMoveBtn?.addEventListener('click', () => moveModal?.classList.remove('open'));

  confirmMoveBtn?.addEventListener('click', async () => {
    if (!TARGET_WRONG_NOTE_TO_MOVE) return;
    const targetLessonSelect = document.getElementById('selectTargetWrongLesson');
    const newLessonId = targetLessonSelect?.value;

    confirmMoveBtn.disabled = true;
    confirmMoveBtn.textContent = '이동 중...';

    try {
      await window.MSE_DB.updateWrongAnswerLesson(TARGET_WRONG_NOTE_TO_MOVE.id, newLessonId);
      moveModal?.classList.remove('open');
      TARGET_WRONG_NOTE_TO_MOVE = null;
      await loadWrongNotesTable(subSelect.value, lesSelect.value, testSelect?.value || 'ALL');
    } catch (e) {
      console.error('단원 이동 실패:', e);
      alert('단원 이동 중 오류가 발생했습니다.');
    } finally {
      confirmMoveBtn.disabled = false;
      confirmMoveBtn.textContent = '단원 이동 저장';
    }
  });
}

async function refreshWrongManageTests(subject, lessonFilter = 'ALL') {
  const testSelect = document.getElementById('wrongManageTestSelect');
  const editTestBtn = document.getElementById('btnEditWrongNotesForTest');
  if (!testSelect) return;

  const prevVal = testSelect.value;
  testSelect.innerHTML = '<option value="ALL">전체 테스트지</option>';

  let tests = [];
  try {
    const lId = (lessonFilter === 'ALL') ? null : (lessonFilter === 'UNASSIGNED' ? 'ALL_TESTS' : lessonFilter);
    tests = await window.MSE_DB.apiGetPdfTests(subject, lId);
  } catch (e) {
    tests = [];
  }

  if (Array.isArray(tests)) {
    tests.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.title;
      testSelect.appendChild(opt);
    });
  }

  if (prevVal && Array.from(testSelect.options).some(o => o.value === prevVal)) {
    testSelect.value = prevVal;
  } else {
    testSelect.value = 'ALL';
  }

  if (editTestBtn) {
    editTestBtn.style.display = (testSelect.value !== 'ALL') ? 'inline-block' : 'none';
  }
}

async function refreshWrongManageView() {
  const subSelect = document.getElementById('wrongManageSubjectSelect');
  const lesSelect = document.getElementById('wrongManageLessonSelect');
  if (!subSelect || !lesSelect) return;

  const currentSub = subSelect.value || APP_STATE.currentSubject || '영어';

  let lessons = [];
  try {
    lessons = await window.MSE_DB.apiGetLessons(currentSub);
  } catch (e) {
    lessons = [];
  }

  lesSelect.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = 'ALL';
  optAll.textContent = '전체 보기 (모든 단원)';
  lesSelect.appendChild(optAll);

  const optUnassigned = document.createElement('option');
  optUnassigned.value = 'UNASSIGNED';
  optUnassigned.textContent = '⭐ [전체테스트] 단원 미지정';
  lesSelect.appendChild(optUnassigned);

  if (Array.isArray(lessons)) {
    lessons.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.unit_name;
      lesSelect.appendChild(opt);
    });
  }

  await refreshWrongManageTests(currentSub, 'ALL');
  await loadWrongNotesTable(currentSub, 'ALL', 'ALL');
}

async function loadWrongNotesTable(subject, lessonFilter = 'ALL', testFilter = 'ALL') {
  const tbody = document.getElementById('wrongNotesTableBody');
  const countTag = document.getElementById('wrongManageCountTag');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#9CA3AF;">오답노트를 불러오는 중...</td></tr>';

  try {
    const [notes, lessons] = await Promise.all([
      window.MSE_DB.getWrongAnswerNotes({ subject, lesson_id: lessonFilter, test_id: testFilter }),
      window.MSE_DB.apiGetLessons(subject)
    ]);

    const lessonMap = {};
    if (Array.isArray(lessons)) {
      lessons.forEach(l => { lessonMap[l.id] = l.unit_name; });
    }

    if (countTag) {
      countTag.textContent = `총 ${notes.length}건`;
    }

    if (!notes || notes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px 10px; color:#9CA3AF;">선택한 조건에 등록된 오답노트가 없습니다 🌸</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    notes.forEach(note => {
      const tr = document.createElement('tr');
      const unitTitle = (note.lesson_id && lessonMap[note.lesson_id])
        ? `<span class="tag-lesson-assigned">${lessonMap[note.lesson_id]}</span>`
        : `<span class="tag-lesson-unassigned">⭐ 전체범위 / 미지정</span>`;

      tr.innerHTML = `
        <td style="font-weight:700; color:#5C4B99;">${note.subject || subject}</td>
        <td>${unitTitle}</td>
        <td style="font-weight:600; color:#374151; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${note.test_title || '시험지'}">
          ${note.test_title || '시험지'}
        </td>
        <td style="text-align:center;">
          <span style="font-weight:800; color:#7C3AED; background:#EDE9FE; padding:2px 6px; border-radius:4px; font-size:12px;">Q${note.question_num}</span>
        </td>
        <td>
          <span style="color:#DC2626; font-weight:700;">${note.user_answer || '-'}</span>
          <span style="color:#9CA3AF;"> / </span>
          <span style="color:#16A34A; font-weight:700;">${note.correct_answer || '-'}</span>
        </td>
        <td>
          <div style="font-size:12px; color:#374151; white-space:pre-wrap; line-height:1.4; max-height:60px; overflow-y:auto;">
            ${note.notes || '<span style="color:#9CA3AF;">(메모 없음)</span>'}
          </div>
        </td>
        <td style="text-align:center; white-space:nowrap;">
          <button type="button" class="btn-table-action edit-note" style="margin-right:4px; background:#EDE9FE; color:#6C52EE; font-weight:700;">수정</button>
          <button type="button" class="btn-table-action change-lesson" style="margin-right:4px;">단원 변경</button>
          <button type="button" class="btn-table-action delete-note">삭제</button>
        </td>
      `;

      const btnEdit = tr.querySelector('.btn-table-action.edit-note');
      btnEdit?.addEventListener('click', async () => {
        let testObj = null;
        if (note.test_id) {
          const allTests = await window.MSE_DB.apiGetPdfTests(subject, null);
          testObj = allTests.find(t => String(t.id) === String(note.test_id));
        }
        if (!testObj) {
          testObj = {
            id: note.test_id,
            title: note.test_title || '시험지',
            subject_name: note.subject || subject,
            lesson_id: note.lesson_id,
            answer_sheet: {}
          };
        }
        const testNotes = await window.MSE_DB.getWrongAnswerNotes({ test_id: note.test_id });
        let wQuestions = [];
        if (testNotes && testNotes.length > 0) {
          wQuestions = testNotes.map(n => ({
            num: n.question_num,
            user_answer: n.user_answer,
            correct_answer: n.correct_answer
          })).sort((a, b) => a.num - b.num);
        } else {
          wQuestions = [{
            num: note.question_num,
            user_answer: note.user_answer,
            correct_answer: note.correct_answer
          }];
        }
        await openFloatingWrongNoteModal(testObj, wQuestions);
        const targetIdx = wQuestions.findIndex(q => q.num == note.question_num);
        if (targetIdx >= 0) {
          selectWrongQuestionTab(targetIdx);
        }
      });

      const btnChange = tr.querySelector('.btn-table-action.change-lesson');
      btnChange?.addEventListener('click', async () => {
        TARGET_WRONG_NOTE_TO_MOVE = note;
        const moveModal = document.getElementById('changeWrongNoteLessonModal');
        const select = document.getElementById('selectTargetWrongLesson');
        const promptText = document.getElementById('changeWrongLessonPromptText');

        if (promptText) {
          promptText.innerHTML = `<b>Q${note.question_num}번</b> (${note.test_title || '시험'}) 문항을 이동할 세부 단원을 선택해주세요.`;
        }

        if (select) {
          select.innerHTML = '';
          const optUnassigned = document.createElement('option');
          optUnassigned.value = 'ALL_TESTS';
          optUnassigned.textContent = '⭐ [전체테스트] 단원 미지정으로 변경';
          select.appendChild(optUnassigned);

          if (Array.isArray(lessons)) {
            lessons.forEach(l => {
              const opt = document.createElement('option');
              opt.value = l.id;
              opt.textContent = l.unit_name;
              if (note.lesson_id == l.id) opt.selected = true;
              select.appendChild(opt);
            });
          }
        }

        moveModal?.classList.add('open');
      });

      const btnDel = tr.querySelector('.btn-table-action.delete-note');
      btnDel?.addEventListener('click', async () => {
        if (!confirm(`Q${note.question_num}번 오답노트를 삭제하시겠습니까?`)) return;
        try {
          await window.MSE_DB.deleteWrongAnswerNote(note.id);
          await loadWrongNotesTable(subject, lessonFilter, testFilter);
        } catch (e) {
          console.error('오답노트 삭제 실패:', e);
          alert('삭제 중 오류가 발생했습니다.');
        }
      });

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('loadWrongNotesTable 에러:', err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#EF4444;">오답노트를 불러오는 중 오류가 발생했습니다.</td></tr>';
  }
}

function setupPdfTestModal() {
  const modal = document.getElementById('pdfTestModal');
  if (!modal) return;

  const renderModalLessonOptions = async (subject) => {
    const lesSel = document.getElementById('pdfTestLessonSelect');
    if (!lesSel) return;
    lesSel.innerHTML = '<option value="ALL_TESTS">⭐ [전체테스트] 전체 범위</option>';
    let lessons = [];
    try {
      lessons = await window.MSE_DB.apiGetLessons(subject);
    } catch (e) {
      lessons = [];
    }
    lessons.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.unit_name;
      if (String(l.id) === String(APP_STATE.currentLessonId)) opt.selected = true;
      lesSel.appendChild(opt);
    });
  };

  const openModal = async () => {
    const subSel = document.getElementById('pdfTestSubjectSelect');
    if (subSel) {
      subSel.innerHTML = '';
      APP_STATE.subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = `📚 ${sub}`;
        if (sub === APP_STATE.currentSubject) opt.selected = true;
        subSel.appendChild(opt);
      });
      await renderModalLessonOptions(APP_STATE.currentSubject);
    }

    document.getElementById('pdfTestTitleInput').value = '';
    document.getElementById('pdfTestStartPage').value = '1';
    document.getElementById('pdfTestAnswerPage').value = '';
    document.getElementById('pdfTestEndPage').value = '';
    document.getElementById('pdfTestTotalQuestions').value = '';
    document.getElementById('pdfTestParseStatus').style.display = 'none';
    const fInput = document.getElementById('pdfTestFileInput');
    if (fInput) fInput.value = '';
    delete modal.dataset.cachedPdfFile;
    delete modal.dataset.explanations;
    delete modal.dataset.questionPages;
    delete modal.dataset.examQuestionPages;
    delete modal._cachedPdfFile;
    renderAnswerSheetGrid(0, {});

    modal.classList.add('open');
  };

  document.getElementById('pdfTestSubjectSelect')?.addEventListener('change', async (e) => {
    await renderModalLessonOptions(e.target.value);
  });

  document.getElementById('btnOpenPdfTestModal')?.addEventListener('click', openModal);
  document.getElementById('btnOpenPdfModalDirect')?.addEventListener('click', openModal);

  document.getElementById('btnCancelPdfTest')?.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  const dropzone = document.getElementById('pdfTestDropzone');
  const fileInput = document.getElementById('pdfTestFileInput');

  dropzone?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('dragover');
  });
  dropzone?.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
  });
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      processTestPaperPdfFile(droppedFile);
    }
  });

  fileInput?.addEventListener('change', (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processTestPaperPdfFile(selectedFile);
    }
  });

  // 정답 시작 페이지 번호 입력 시 문제 끝 페이지 자동 계산 및 재파싱
  document.getElementById('pdfTestAnswerPage')?.addEventListener('input', async (e) => {
    const ansPage = parseInt(e.target.value, 10);
    if (ansPage && ansPage > 1) {
      document.getElementById('pdfTestEndPage').value = ansPage - 1;
      if (modal._cachedPdfFile) {
        await processTestPaperPdfFile(modal._cachedPdfFile, ansPage);
      }
    }
  });

  document.getElementById('pdfTestTotalQuestions')?.addEventListener('input', (e) => {
    const count = parseInt(e.target.value, 10) || 0;
    if (count > 0) {
      renderAnswerSheetGrid(count, collectCurrentAnswerSheet());
    }
  });

  document.getElementById('btnSavePdfTest')?.addEventListener('click', async () => {
    const sub = document.getElementById('pdfTestSubjectSelect').value || APP_STATE.currentSubject;
    const lesVal = document.getElementById('pdfTestLessonSelect')?.value || 'ALL_TESTS';
    const title = document.getElementById('pdfTestTitleInput').value.trim();
    if (!title) {
      alert('시험지 제목을 입력해주세요.');
      return;
    }

    const saveBtn = document.getElementById('btnSavePdfTest');
    const file = modal._cachedPdfFile;
    if (!file && !modal.dataset.pdfFileUrl) {
      alert('PDF 파일을 먼저 선택해주세요.');
      return;
    }

    const startPage = parseInt(document.getElementById('pdfTestStartPage').value, 10) || 1;
    const endPage = parseInt(document.getElementById('pdfTestEndPage').value, 10) || 1;
    const ansPage = parseInt(document.getElementById('pdfTestAnswerPage').value, 10) || (endPage + 1);
    const totalQ = parseInt(document.getElementById('pdfTestTotalQuestions').value, 10) || 20;
    const answerSheet = collectCurrentAnswerSheet();
    let explanations = {};
    let questionPages = {};
    let examQuestionPages = {};
    try {
      explanations = JSON.parse(modal.dataset.explanations || '{}');
    } catch (e) {}
    try {
      questionPages = JSON.parse(modal.dataset.questionPages || '{}');
    } catch (e) {}
    try {
      examQuestionPages = JSON.parse(modal.dataset.examQuestionPages || '{}');
    } catch (e) {}

    // 문항별 해설 페이지 메타데이터를 기존 answer_sheet의 _pages 키에 안전 보관
    if (questionPages && Object.keys(questionPages).length > 0) {
      answerSheet._pages = questionPages;
    }

    // 문항별 문제지 위치 메타데이터를 _exam_pages 키에 안전 보관
    if (examQuestionPages && Object.keys(examQuestionPages).length > 0) {
      answerSheet._exam_pages = examQuestionPages;
    }

    const originalText = saveBtn ? saveBtn.textContent : '저장하기';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ 시험지 저장 및 업로드 중...';
    }

    let pdfFileUrl = modal.dataset.pdfFileUrl || '';
    try {
      if (file) {
        const uploadRes = await window.MSE_DB.apiUploadPdfFile(file);
        pdfFileUrl = uploadRes?.publicUrl || '';
      }
    } catch (err) {
      console.warn('PDF 업로드 fallback:', err);
    }

    const newTest = await window.MSE_DB.apiCreatePdfTest({
      subject_name: sub,
      lesson_id: (lesVal === 'ALL_TESTS') ? null : Number(lesVal),
      test_category: 'UNIT',
      title,
      pdf_filename: file ? file.name : (modal.dataset.pdfFilename || 'test.pdf'),
      pdf_file_url: pdfFileUrl,
      start_page: startPage,
      end_page: endPage,
      answer_page: ansPage,
      total_questions: totalQ,
      answer_sheet: answerSheet,
      explanations
    });

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }

    modal.classList.remove('open');
    alert(`'${title}' 시험지가 성공적으로 등록되었습니다!`);

    await loadPdfTests(sub, APP_STATE.currentLessonId);
    document.getElementById('tabBtnPaperTest')?.click();
    if (newTest) startPaperTest(newTest.id);
  });
}

async function processTestPaperPdfFile(file, overrideAnswerPage = null) {
  if (!file) return;
  console.log('[MSE] processTestPaperPdfFile called:', file.name, file.size);

  const modal = document.getElementById('pdfTestModal');
  if (modal) {
    modal._cachedPdfFile = file;
    modal.dataset.pdfFilename = file.name;
  }

  const statusEl = document.getElementById('pdfTestParseStatus');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.color = '#6C52EE';
    statusEl.textContent = `⏳ [${file.name}] 정답 페이지 분석 및 정답표 추출 중...`;
  }

  try {
    const ansPageVal = document.getElementById('pdfTestAnswerPage')?.value.trim();
    const customAnsPage = overrideAnswerPage || (ansPageVal ? parseInt(ansPageVal, 10) : null);

    const result = await window.parseTestPaperPdf(file, (customAnsPage && !isNaN(customAnsPage) && customAnsPage >= 1) ? customAnsPage : null);
    console.log('[MSE] parseTestPaperPdf result:', result);

    const titleInput = document.getElementById('pdfTestTitleInput');
    if (titleInput && !titleInput.value) {
      titleInput.value = file.name.replace(/\.[^/.]+$/, '');
    }

    document.getElementById('pdfTestStartPage').value = result.startPage;
    document.getElementById('pdfTestEndPage').value = result.endPage;
    document.getElementById('pdfTestAnswerPage').value = result.answerPageNum;

    const detectedTotalQ = result.totalQuestions || 20;
    const totalQInput = document.getElementById('pdfTestTotalQuestions');
    if (totalQInput) {
      totalQInput.value = detectedTotalQ;
    }

    if (modal) {
      modal.dataset.explanations = JSON.stringify(result.explanations || {});
      modal.dataset.questionPages = JSON.stringify(result.questionPages || {});
      modal.dataset.examQuestionPages = JSON.stringify(result.examQuestionPages || {});
    }

    // 설정된 총 문항수만큼 Q1~QN 칸 100% 생성 및 파싱된 정답 1:1 매핑 미리보기 노출
    renderAnswerSheetGrid(detectedTotalQ, result.answerSheet);

    const matchCount = Object.keys(result.answerSheet).filter(k => !k.startsWith('_')).length;
    if (statusEl) {
      statusEl.style.color = '#276749';
      statusEl.textContent = `✨ 분석 완료! 총 ${result.numPages}p (문제: ${result.startPage}~${result.endPage}p, 정답페이지: ${result.answerPageNum}p) | ${detectedTotalQ}문항 중 ${matchCount}개 정답 매칭 완료`;
    }
  } catch (err) {
    console.warn('PDF 시험지 분석 에러:', err);
    if (statusEl) {
      statusEl.style.color = '#E53E3E';
      statusEl.textContent = '⚠️ PDF 분석 실패: ' + err.message;
    }
  }
}

function renderAnswerSheetGrid(count, prefill) {
  const grid = document.getElementById('pdfTestAnswerSheetGrid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let q = 1; q <= count; q++) {
    const cell = document.createElement('div');
    cell.className = 'pdf-ans-cell';
    const val = (prefill && (prefill[q] !== undefined || prefill[String(q)] !== undefined)) ? String(prefill[q] !== undefined ? prefill[q] : prefill[String(q)]) : '';

    const label = document.createElement('span');
    label.className = 'pdf-ans-label';
    label.textContent = `Q${q}`;

    const textarea = document.createElement('textarea');
    textarea.className = 'pdf-ans-input';
    textarea.dataset.q = q;
    textarea.value = val;
    textarea.placeholder = '-';
    textarea.title = val ? `Q${q} 정답: ${val}` : `Q${q} 정답 입력`;

    cell.appendChild(label);
    cell.appendChild(textarea);
    grid.appendChild(cell);
  }
}

function collectCurrentAnswerSheet() {
  const sheet = {};
  document.querySelectorAll('.pdf-ans-input').forEach(input => {
    const q = input.dataset.q;
    const val = input.value.trim();
    if (val) sheet[q] = val;
  });
  return sheet;
}

// --------------------------------------------------------
// 이벤트 리스너 바인딩
// --------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initAppData();
  setupAdminSecurity();
  setupParentReport();
  setupPdfDropzone();
  setupSettingsDrawer();
  setupPdfTestModal();
  setupCloudSettingsModal();

  // 드로어 열기 / 닫기 & 메뉴바 토글
  const drawer = document.getElementById('drawerSidebar');
  const overlay = document.getElementById('drawerOverlay');

  // 우측 설정(⚙️) 버튼 누르면 드로어(설정 및 관리자 메뉴) 열기
  document.getElementById('btnOpenSettings')?.addEventListener('click', () => {
    drawer.classList.add('open');
    overlay.style.display = 'block';
  });

  // 좌측 3줄 삼선(햄버거) 버튼 누르면 상단 메뉴바 보이기 / 숨기기 토글
  document.getElementById('drawerOpenBtn')?.addEventListener('click', () => {
    const tabsBar = document.querySelector('.tabs-bar');
    if (tabsBar) {
      tabsBar.classList.toggle('tabs-hidden');
    }
  });

  const closeDrawer = () => {
    drawer.classList.remove('open');
    overlay.style.display = 'none';
  };
  document.getElementById('drawerCloseBtn')?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  // 과목 선택 변경 (해당 과목 첫 단원 자동 로드 및 단원 등록 유형박스 연동)
  document.getElementById('subjectSelect')?.addEventListener('change', async (e) => {
    APP_STATE.currentSubject = e.target.value;
    updateCategoryBoxVisibility();
    updateTabsVisibilityBySubject();
    updateSubjectHeaderBadge();
    await loadLessonsForSubject(APP_STATE.currentSubject);
    await loadPdfTests(APP_STATE.currentSubject);
  });

  // 단원 드롭다운 변경
  document.getElementById('lessonSelect')?.addEventListener('change', (e) => {
    switchLesson(e.target.value);
  });

  // 탭 네비게이션
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const tabId = `tab-${btn.dataset.tab}`;
      const tabEl = document.getElementById(tabId);
      if (tabEl) tabEl.classList.add('active');

      const diaryContainer = document.querySelector('.diary-container');
      if (diaryContainer) {
        diaryContainer.classList.toggle('wide-mode', btn.dataset.tab === 'paper_test');
      }

      if (btn.dataset.tab === 'test') {
        initTestSession();
      } else if (btn.dataset.tab === 'paper_test') {
        if (APP_STATE.currentSubject === '영어') {
          initWritingSession();
        } else {
          initPaperTestSession();
        }
      } else if (btn.dataset.tab === 'final_mistakes') {
        renderFinalMistakesTable();
      } else if (btn.dataset.tab === 'rewards') {
        renderStampBoard();
      }
    });
  });

  // PDF 시험지 모드: 실전 시험 모드 단독 고정
  APP_STATE.paperSolveMode = 'EXAM';

  // PDF 시험지 드롭다운 변경
  document.getElementById('paperTestSelect')?.addEventListener('change', (e) => {
    if (e.target.value) startPaperTest(e.target.value);
  });

  // 메인 페이지 과목/단원 선택 이벤트
  document.getElementById('mainSubjectSelect')?.addEventListener('change', async (e) => {
    APP_STATE.currentSubject = e.target.value;
    updateTabsVisibilityBySubject();
    await fetchSubjectsAndLessons();
  });
  document.getElementById('mainLessonSelect')?.addEventListener('change', async (e) => {
    await switchLesson(e.target.value);
  });

  // 2단 뷰어 네비게이션 버튼 & 슬라이더
  document.getElementById('btnPaperPrevCol')?.addEventListener('click', () => {
    goToPaperStep(APP_STATE.paperCurrentStep - 1);
  });
  document.getElementById('btnPaperNextCol')?.addEventListener('click', () => {
    goToPaperStep(APP_STATE.paperCurrentStep + 1);
  });
  document.getElementById('paperStepSlider')?.addEventListener('input', (e) => {
    goToPaperStep(parseInt(e.target.value, 10));
  });

  // 키보드 좌/우 방향키로 단 이동 지원
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (APP_STATE.paperTotalSteps > 0 && document.getElementById('paperTestActiveArea')?.style.display !== 'none') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPaperStep(APP_STATE.paperCurrentStep - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToPaperStep(APP_STATE.paperCurrentStep + 1);
      }
    }
  });

  // PDF 시험지 최종 제출 버튼
  document.getElementById('btnSubmitPaperTest')?.addEventListener('click', submitPaperTest);

  // 해설 뷰어 (모달 & 50:50 2분할) 이벤트 초기화
  setupExplanationViewer();
  setupDualExplanationViewer();

  // 테스트 뷰어 줌 컨트롤 및 시험지 관리 모달 초기화
  setupPaperZoomControls();
  setupManageTestsModal();
  setupFloatingWrongNoteModal();
  setupWrongNotesManageModal();

  // 학습 탭 페이저
  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (APP_STATE.currentPage > 1) {
      APP_STATE.currentPage--;
      APP_STATE.individualReveals = {};
      renderStudyPage();
    }
  });
  document.getElementById('btnNextPage').addEventListener('click', () => {
    if (APP_STATE.currentPage < APP_STATE.totalPages) {
      APP_STATE.currentPage++;
      APP_STATE.individualReveals = {};
      renderStudyPage();
    }
  });

  // 학습 탭 가림판 모드 토글
  document.querySelectorAll('.toggle-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.toggle-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      APP_STATE.maskMode = chip.dataset.mode;
      APP_STATE.individualReveals = {};
      renderStudyPage();
    });
  });

  // 테스트 모드 토글 (전체 vs 오답만)
  document.getElementById('modeBtnAll').addEventListener('click', () => {
    APP_STATE.testMode = 'ALL';
    updateTestModeButtons();
    initTestSession();
  });
  document.getElementById('modeBtnWrong').addEventListener('click', () => {
    APP_STATE.testMode = 'WRONG_ONLY';
    updateTestModeButtons();
    initTestSession();
  });

  // 회차 선택
  document.querySelectorAll('.round-pill[data-round]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.round-pill[data-round]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      APP_STATE.currentRound = parseInt(pill.dataset.round, 10);
    });
  });

  // 시험 제출 버튼
  document.getElementById('btnSubmitAll').addEventListener('click', submitAndGradeTest);

  // 결과 모달 액션 버튼들
  const resModal = document.getElementById('resultModal');
  document.getElementById('modalBtnRetakeWrong')?.addEventListener('click', () => {
    resModal.classList.remove('open');
    APP_STATE.testMode = 'WRONG_ONLY';
    updateTestModeButtons();
    initTestSession();
  });
  document.getElementById('modalBtnRetakeAll').addEventListener('click', () => {
    resModal.classList.remove('open');
    APP_STATE.testMode = 'ALL';
    updateTestModeButtons();
    initTestSession();
  });
  document.getElementById('modalBtnStudy').addEventListener('click', () => {
    resModal.classList.remove('open');
    document.getElementById('tabBtnStudy').click();
  });

  // 랭킹 취약단어 바로 재시험 버튼
  const launchWrongTest = () => {
    closeDrawer();
    document.getElementById('tabBtnTest').click();
    APP_STATE.testMode = 'WRONG_ONLY';
    updateTestModeButtons();
    initTestSession();
  };
  document.getElementById('btnTestRankingWords').addEventListener('click', launchWrongTest);

  // 파이널 오답 단어장 액션
  document.getElementById('btnTestFinalMistakes').addEventListener('click', launchWrongTest);
  document.getElementById('btnPrintFinalMistakes').addEventListener('click', () => {
    window.print();
  });

  // PDF 통합 등록 모달 초기화
  setupUploadChoiceModal();
  // 서술형 직접 텍스트 등록 모달 초기화
  setupDirectWritingModal();

  // 서술형 영작 버튼 이벤트 바인딩
  document.getElementById('btnWritingPrev')?.addEventListener('click', () => {
    if (APP_STATE.currentWritingIndex > 0) {
      APP_STATE.currentWritingIndex--;
      renderWritingCurrentQuestion();
    }
  });

  document.getElementById('btnWritingNext')?.addEventListener('click', () => {
    if (APP_STATE.currentWritingIndex < (APP_STATE.writingSentences.length - 1)) {
      APP_STATE.currentWritingIndex++;
      renderWritingCurrentQuestion();
    }
  });

  document.getElementById('btnWritingMic')?.addEventListener('click', () => {
    toggleWritingSpeechRecognition();
  });

  document.getElementById('btnWritingHint')?.addEventListener('click', () => {
    showWritingHint();
  });

  document.getElementById('btnWritingReset')?.addEventListener('click', () => {
    resetWritingCurrentQuestion();
  });

  document.getElementById('btnWritingGrade')?.addEventListener('click', () => {
    gradeWritingCurrentQuestion();
  });
});

// ========================================================
// 서술형 영작 인터랙티브 풀이 모듈 (writing_sentences)
// ========================================================

async function fetchWritingSentences(lessonId) {
  try {
    if (!lessonId || lessonId === 'ALL_TESTS') {
      APP_STATE.writingSentences = [];
      return;
    }
    const list = await window.MSE_DB.apiGetWritingSentences(lessonId);
    APP_STATE.writingSentences = list || [];
    APP_STATE.currentWritingIndex = 0;
  } catch (e) {
    console.error('fetchWritingSentences error:', e);
    APP_STATE.writingSentences = [];
  }
}

function initWritingSession() {
  const paperEmpty = document.getElementById('paperTestEmptyState');
  const paperActive = document.getElementById('paperTestActiveArea');
  const writingWrap = document.getElementById('writingContainer');
  const writingEmpty = document.getElementById('writingEmptyState');
  const writingCard = document.getElementById('writingActiveCard');

  if (paperEmpty) paperEmpty.style.display = 'none';
  if (paperActive) paperActive.style.display = 'none';
  if (writingWrap) writingWrap.style.display = 'block';

  if (!APP_STATE.writingSentences || APP_STATE.writingSentences.length === 0) {
    if (writingEmpty) writingEmpty.style.display = 'block';
    if (writingCard) writingCard.style.display = 'none';
    return;
  }

  if (writingEmpty) writingEmpty.style.display = 'none';
  if (writingCard) writingCard.style.display = 'flex';

  renderWritingCurrentQuestion();
}

function renderWritingCurrentQuestion() {
  const list = APP_STATE.writingSentences;
  if (!list || list.length === 0) return;

  const idx = Math.max(0, Math.min(APP_STATE.currentWritingIndex, list.length - 1));
  APP_STATE.currentWritingIndex = idx;
  const q = list[idx];

  // 1. 상단 헤더 업데이트
  const qBadge = document.getElementById('writingQBadge');
  const titleEl = document.getElementById('writingLessonTitle');
  if (qBadge) qBadge.textContent = `Q ${idx + 1} / ${list.length}`;
  if (titleEl) titleEl.textContent = APP_STATE.currentLessonName || '영작 연습하기';

  // 이전/다음 버튼 활성/비활성 스타일
  const prevBtn = document.getElementById('btnWritingPrev');
  const nextBtn = document.getElementById('btnWritingNext');
  if (prevBtn) prevBtn.disabled = (idx === 0);
  if (nextBtn) nextBtn.disabled = (idx === list.length - 1);

  // 2. 한글 문제 텍스트
  const promptEl = document.getElementById('writingKoreanPrompt');
  if (promptEl) promptEl.textContent = q.korean_prompt;

  // 3. 단어별 밑줄 슬롯 렌더링
  const slotsContainer = document.getElementById('writingSlotsContainer');
  if (slotsContainer) {
    slotsContainer.innerHTML = '';

    const rawWords = (q.english_sentence || '').trim().split(/\s+/).filter(Boolean);

    rawWords.forEach((rawWord, wordIdx) => {
      // 끝 구두점 분리: 약어(R.C., U.S.A. 등) 내부의 온점은 보존하고, 맨 끝 문장부호(, 또는 종결 마침표)만 분리
      let cleanWord = rawWord;
      let punctuation = '';

      // 1) 쉼표, 세미콜론, 콜론, 따옴표 등 후행 문장부호 우선 분리
      const trailingPunct = rawWord.match(/^(.+?)([,;:"'?!]+)$/);
      if (trailingPunct) {
        cleanWord = trailingPunct[1];
        punctuation = trailingPunct[2];
      } else {
        // 2) 마침표(.)로 끝나는 경우:
        // 마지막 단어가 아니거나 약어 형태(예: R.C., Mr., Dr., etc.)인 경우 온점을 단어의 일부로 보존
        const isLastWord = (wordIdx === rawWords.length - 1);
        const isAbbr = /^([A-Za-z]\.){1,3}$/i.test(rawWord) || /^(Mr\.|Ms\.|Mrs\.|Dr\.|Prof\.|etc\.|e\.g\.|i\.e\.)$/i.test(rawWord);

        if (isLastWord && !isAbbr && rawWord.endsWith('.')) {
          cleanWord = rawWord.slice(0, -1);
          punctuation = '.';
        } else {
          cleanWord = rawWord;
          punctuation = '';
        }
      }

      const slotWrapper = document.createElement('div');
      slotWrapper.style.display = 'inline-flex';
      slotWrapper.style.alignItems = 'flex-end';
      slotWrapper.style.margin = '4px 3px';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'writing-word-slot';
      input.dataset.idx = wordIdx;
      input.dataset.target = cleanWord;
      input.dataset.punct = punctuation;
      input.autocomplete = 'off';
      input.autocapitalize = 'off';
      input.spellcheck = false;

      // 단어 길이에 비례한 밑줄 폭 설정
      const slotWidth = Math.max(48, Math.min(220, cleanWord.length * 13 + 16));
      input.style.width = `${slotWidth}px`;

      // 키보드 편의 기능
      input.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          const nextSlot = slotsContainer.querySelector(`.writing-word-slot[data-idx="${wordIdx + 1}"]`);
          if (nextSlot) {
            nextSlot.focus();
          } else if (e.key === 'Enter') {
            gradeWritingCurrentQuestion();
          }
        } else if (e.key === 'Backspace') {
          if (!input.value && wordIdx > 0) {
            e.preventDefault();
            const prevSlot = slotsContainer.querySelector(`.writing-word-slot[data-idx="${wordIdx - 1}"]`);
            if (prevSlot) {
              prevSlot.focus();
              prevSlot.value = '';
            }
          }
        }
      });

      // 타이핑 시 피드백 리셋
      input.addEventListener('input', () => {
        input.classList.remove('correct', 'wrong');
        const fb = document.getElementById('writingFeedbackBox');
        if (fb) fb.style.display = 'none';
      });

      slotWrapper.appendChild(input);

      if (punctuation) {
        const punctSpan = document.createElement('span');
        punctSpan.className = 'writing-punct-badge';
        punctSpan.textContent = punctuation;
        slotWrapper.appendChild(punctSpan);
      }

      slotsContainer.appendChild(slotWrapper);
    });

    // 첫 슬롯 자동 포커스
    setTimeout(() => {
      const firstSlot = slotsContainer.querySelector('.writing-word-slot');
      if (firstSlot) firstSlot.focus();
    }, 100);
  }

  // 4. 피드백 박스 초기화
  const fbBox = document.getElementById('writingFeedbackBox');
  if (fbBox) fbBox.style.display = 'none';

  // 5. 마이크 상태 초기화
  const micStatus = document.getElementById('writingMicStatus');
  if (micStatus) micStatus.textContent = '음성 입력';
}

// 스마트 채점
async function gradeWritingCurrentQuestion() {
  const list = APP_STATE.writingSentences;
  if (!list || list.length === 0) return;
  const q = list[APP_STATE.currentWritingIndex];
  if (!q) return;

  const slots = document.querySelectorAll('#writingSlotsContainer .writing-word-slot');
  if (slots.length === 0) return;

  let correctCount = 0;
  let wrongCount = 0;

  const norm = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  slots.forEach(slot => {
    const userVal = slot.value.trim();
    const targetVal = (slot.dataset.target || '').trim();

    slot.classList.remove('correct', 'wrong');

    if (norm(userVal) === norm(targetVal) && norm(targetVal).length > 0) {
      slot.classList.add('correct');
      correctCount++;
    } else {
      slot.classList.add('wrong');
      wrongCount++;
    }
  });

  const isAllCorrect = (wrongCount === 0 && correctCount === slots.length);

  // 피드백 박스 업데이트
  const fbBox = document.getElementById('writingFeedbackBox');
  const fbTitle = document.getElementById('writingFeedbackTitle');
  const fbAnswer = document.getElementById('writingCorrectAnswer');

  if (fbBox && fbTitle && fbAnswer) {
    fbBox.style.display = 'block';
    if (isAllCorrect) {
      fbBox.style.borderColor = '#16A34A';
      fbBox.style.background = '#F0FDF4';
      fbTitle.style.color = '#15803D';
      fbTitle.textContent = '🎉 완벽합니다! 모든 단어를 정확하게 영작했습니다.';
      fbAnswer.textContent = q.english_sentence;
    } else {
      fbBox.style.borderColor = '#EF4444';
      fbBox.style.background = '#FEF2F2';
      fbTitle.style.color = '#B91C1C';
      fbTitle.textContent = `❌ ${wrongCount}개 단어가 일치하지 않습니다. 틀린 단어(빨간색 밑줄)를 확인해보세요!`;
      fbAnswer.textContent = '정답: ' + q.english_sentence;
    }
  }

  // 통계 업데이트 (DB & 로컬)
  try {
    await window.MSE_DB.apiUpdateWritingSentenceStats(q.id, isAllCorrect);
  } catch (err) {
    console.error('apiUpdateWritingSentenceStats error:', err);
  }

  // 성적 리포트 저장
  try {
    const saveFunc = window.MSE_DB?.apiSubmitTest || window.MSE_DB?.apiSaveTestRecord || window.MSE_DB?.apiInsertTestRecord;
    if (saveFunc) {
      await saveFunc({
        lessonId: APP_STATE.currentLessonId,
        score: isAllCorrect ? 100 : Math.round((correctCount / slots.length) * 100),
        totalCount: slots.length,
        correctCount,
        wrongCount,
        starsWon: isAllCorrect ? 1 : 0,
        testCategory: 'WRITING',
        testTitle: `[서술형] ${APP_STATE.currentLessonName || '영작'} Q${q.sentence_no}`
      });
    }
  } catch (err) {
    console.error('apiSubmitTest error:', err);
  }
}

// 힌트 보기
function showWritingHint() {
  const slots = document.querySelectorAll('#writingSlotsContainer .writing-word-slot');
  slots.forEach(slot => {
    if (!slot.classList.contains('correct')) {
      const target = slot.dataset.target || '';
      slot.placeholder = target.length > 2 ? target.slice(0, 2) + '...' : target;
    }
  });
}

// 다시 쓰기
function resetWritingCurrentQuestion() {
  const slots = document.querySelectorAll('#writingSlotsContainer .writing-word-slot');
  slots.forEach(slot => {
    slot.value = '';
    slot.placeholder = '';
    slot.classList.remove('correct', 'wrong');
  });
  const fbBox = document.getElementById('writingFeedbackBox');
  if (fbBox) fbBox.style.display = 'none';

  if (slots.length > 0) slots[0].focus();
}

// Web Speech API 기반 음성 인식 (STT)
let writingRecognitionInstance = null;
function toggleWritingSpeechRecognition() {
  const btnMic = document.getElementById('btnWritingMic');
  const micStatus = document.getElementById('writingMicStatus');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('현재 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 또는 Safari 최신 버전을 사용해주세요.');
    return;
  }

  if (writingRecognitionInstance) {
    try {
      writingRecognitionInstance.stop();
    } catch (e) {}
    writingRecognitionInstance = null;
    if (btnMic) btnMic.classList.remove('recording');
    if (micStatus) micStatus.textContent = '음성 입력';
    return;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      writingRecognitionInstance = recognition;
      if (btnMic) btnMic.classList.add('recording');
      if (micStatus) micStatus.textContent = '듣고 있어요... 🎙️';
    };

    recognition.onresult = (event) => {
      let fullTranscript = '';
      let isFinal = false;

      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript + ' ';
        if (event.results[i].isFinal) isFinal = true;
      }

      if (micStatus) {
        micStatus.textContent = isFinal ? '인식 완료!' : '실시간 입력 중...';
      }

      const spokenWords = fullTranscript.trim().split(/\s+/).filter(Boolean);
      const slots = document.querySelectorAll('#writingSlotsContainer .writing-word-slot');

      spokenWords.forEach((word, idx) => {
        if (slots[idx]) {
          slots[idx].value = word.replace(/[^a-zA-Z0-9'’\-\.]/g, '');
          slots[idx].classList.remove('correct', 'wrong');
        }
      });

      if (isFinal && slots.length > 0) {
        const nextIdx = Math.min(spokenWords.length, slots.length - 1);
        slots[nextIdx]?.focus();
      }
    };

    recognition.onerror = (e) => {
      console.warn('SpeechRecognition error:', e);
      if (micStatus) micStatus.textContent = '인식 오류';
      if (btnMic) btnMic.classList.remove('recording');
      writingRecognitionInstance = null;
    };

    recognition.onend = () => {
      if (btnMic) btnMic.classList.remove('recording');
      writingRecognitionInstance = null;
      setTimeout(() => {
        if (micStatus && micStatus.textContent.includes('완료')) {
          micStatus.textContent = '음성 입력';
        }
      }, 2500);
    };

    recognition.start();
  } catch (err) {
    console.error('SpeechRecognition start failed:', err);
    if (btnMic) btnMic.classList.remove('recording');
    writingRecognitionInstance = null;
    alert('마이크 접근에 실패했습니다: ' + err.message);
  }
}
