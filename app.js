// ========================================================
// MY SPECIAL ENGLISH : 고1 내신 대비 비밀 노트 (app.js)
// Supabase 클라우드 DB 연동, 스마트 채점, PWA & 부모님 실시간 리포트
// ========================================================

const APP_STATE = {
  currentLessonId: 1,
  currentLessonName: "3. The Gift of Art (비상 홍민표)",
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
  testPart: 1,           // 1: 1~20번, 2: 21~40번
  testQuestions: [],
  userAnswers: {},

  // Stats & Admin
  totalStars: 0,
  wrongRanking: [],
  adminUnlocked: false,
  adminPin: '0000',
  currentReportFilter: null // null | 'VOCAB' | 'UNIT' | 'WRITING'
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

  // Supabase 클라이언트 초기화
  window.MSE_DB.initSupabase();
  updateCloudStatusBadge();

  // 메타데이터(별, PIN) 불러오기
  await fetchMeta();

  // 대단원 목록 불러오기
  await fetchLessons();

  // 현재 대단원 단어 불러오기
  await fetchWords(APP_STATE.currentLessonId);
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
  document.getElementById('headerStarCount').textContent = APP_STATE.totalStars;
  document.getElementById('rewardStarCount').textContent = APP_STATE.totalStars;
  renderStampBoard();
}

async function fetchLessons() {
  try {
    const list = await window.MSE_DB.apiGetLessons();
    APP_STATE.lessons = list || [];
    renderLessonSelect();
  } catch (e) {
    console.warn('fetchLessons error:', e);
  }
}

function renderLessonSelect() {
  const sel = document.getElementById('lessonSelect');
  sel.innerHTML = '';
  APP_STATE.lessons.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.unit_name;
    if (Number(l.id) === Number(APP_STATE.currentLessonId)) opt.selected = true;
    sel.appendChild(opt);
  });

  const cur = APP_STATE.lessons.find(l => Number(l.id) === Number(APP_STATE.currentLessonId));
  if (cur) {
    APP_STATE.currentLessonName = cur.unit_name;
    document.getElementById('drawerCurrentLessonText').textContent = cur.unit_name;
    const parts = cur.unit_name.split(' ');
    document.getElementById('headerLessonTag').textContent = `${parts[0]} ${parts[1] || ''}`;
  }
}

async function switchLesson(lessonId) {
  APP_STATE.currentLessonId = Number(lessonId);
  const cur = APP_STATE.lessons.find(l => Number(l.id) === Number(lessonId));
  if (cur) {
    APP_STATE.currentLessonName = cur.unit_name;
    document.getElementById('drawerCurrentLessonText').textContent = cur.unit_name;
    const parts = cur.unit_name.split(' ');
    document.getElementById('headerLessonTag').textContent = `${parts[0]} ${parts[1] || ''}`;
  }
  APP_STATE.currentPage = 1;
  APP_STATE.individualReveals = {};
  await fetchWords(APP_STATE.currentLessonId);
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
    renderDrawerWrongList();
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
    // 짝수 번호는 한글 뜻 쓰기, 홀수 번호는 영단어 쓰기
    const isWriteKorean = (idx % 2 === 0);
    return {
      index: idx + 1,
      target: w,
      qType: isWriteKorean ? 'KOREAN' : 'ENGLISH',
      prompt: isWriteKorean ? `${w.word} (${w.pos || ''})` : `${w.meaning} (${w.pos || ''})`,
      placeholder: isWriteKorean ? "한글 뜻 입력 (복수 뜻 중 1개만 써도 인정)" : "영어 단어 입력",
      badgeText: isWriteKorean ? "🇰🇷 한글 뜻 쓰기" : "🇺🇸 영단어 쓰기"
    };
  });

  APP_STATE.userAnswers = {};
  APP_STATE.testPart = 1;

  // 파트 선택 버튼 보이기/숨기기 (20문제 초과 시 2구간 분할)
  const partNav = document.getElementById('testPartNav');
  if (APP_STATE.testQuestions.length <= 20) {
    partNav.style.display = 'none';
  } else {
    partNav.style.display = 'flex';
  }

  renderTestQuestions();
}

function updateTestModeButtons() {
  document.getElementById('modeBtnAll').classList.toggle('active', APP_STATE.testMode === 'ALL');
  document.getElementById('modeBtnWrong').classList.toggle('active', APP_STATE.testMode === 'WRONG_ONLY');
}

function renderTestQuestions() {
  document.querySelectorAll('.part-tab-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.part, 10) === APP_STATE.testPart);
  });

  const startIdx = (APP_STATE.testPart - 1) * 20;
  const partQuestions = APP_STATE.testQuestions.slice(startIdx, startIdx + 20);

  const half = Math.ceil(partQuestions.length / 2);
  const leftQuestions = partQuestions.slice(0, half);
  const rightQuestions = partQuestions.slice(half);

  const leftCol = document.getElementById('testColLeft');
  const rightCol = document.getElementById('testColRight');
  leftCol.innerHTML = '';
  rightCol.innerHTML = '';

  const renderCard = (q, globalIdx) => {
    const card = document.createElement('div');
    const existingVal = APP_STATE.userAnswers[globalIdx] || '';
    card.className = `subjective-card ${existingVal.trim() ? 'answered' : ''}`;

    card.innerHTML = `
      <div class="q-top-row">
        <span class="q-num-tag">Q${q.index}</span>
        <span style="font-size:10.5px; color:#9587B6; font-weight:700;">${q.badgeText}</span>
      </div>
      <div class="q-target-prompt">${q.prompt}</div>
      <input type="text" class="subjective-input" 
        data-qidx="${globalIdx}" 
        placeholder="${q.placeholder}" 
        value="${existingVal}"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
    `;

    const inputEl = card.querySelector('.subjective-input');
    inputEl.addEventListener('input', (e) => {
      const val = e.target.value;
      APP_STATE.userAnswers[globalIdx] = val;
      card.classList.toggle('answered', Boolean(val.trim()));
      updateTestProgress();
    });

    return card;
  };

  leftQuestions.forEach((q, i) => leftCol.appendChild(renderCard(q, startIdx + i)));
  rightQuestions.forEach((q, i) => rightCol.appendChild(renderCard(q, startIdx + half + i)));

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
    correctWordIds: correctWordIds
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
    wrongItems
  });

  // 단어 목록 재동기화 (오답 횟수 갱신)
  await fetchWords(APP_STATE.currentLessonId);
}

function showResultModal(data) {
  const modal = document.getElementById('resultModal');
  const modeTitle = APP_STATE.testMode === 'WRONG_ONLY' ? '오답 집중' : '전체 시험';
  document.getElementById('currentRoundBadge').textContent = `${APP_STATE.currentRound}회차 ${modeTitle}`;
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
    feedback.textContent = '완벽해요! 만점 달성 💯 별 5개 획득!';
  } else if (data.score >= 80) {
    feedback.textContent = `정말 훌륭해요! (${data.correctCount}/${data.totalCount}문제 정답)`;
  } else if (data.score >= 60) {
    feedback.textContent = `조금만 더 복습하면 만점 가능! (${data.correctCount}/${data.totalCount}문제 정답)`;
  } else {
    feedback.textContent = `틀린 단어들을 오답 노트에서 다시 복습해볼까요? 화이팅! 💖`;
  }

  // 오답 재시험 버튼 활성화 여부
  const retakeWrongBtn = document.getElementById('modalBtnRetakeWrong');
  if (data.wrongItems && data.wrongItems.length > 0) {
    retakeWrongBtn.style.display = 'block';
  } else {
    retakeWrongBtn.style.display = 'none';
  }

  modal.classList.add('open');
}

// --------------------------------------------------------
// TAB 3: 취약 단어 랭킹 & 파이널 오답 단어장
// --------------------------------------------------------
function renderDrawerWrongList() {
  const listEl = document.getElementById('drawerWrongWordsList');
  if (APP_STATE.wrongRanking.length === 0) {
    listEl.innerHTML = `<span style="font-size:11.5px; color:#8C7FA9;">아직 누적된 오답이 없습니다. 멋져요! ✨</span>`;
    return;
  }
  listEl.innerHTML = APP_STATE.wrongRanking.slice(0, 5).map(w => `
    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
      <span style="font-weight:700; color:#493874;">${w.word}</span>
      <span style="color:#FF5376; font-weight:800;">${w.wrong_count}회 오답</span>
    </div>
  `).join('');
}

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
// TAB 4: 회차별 오답 보관함
// --------------------------------------------------------
function renderMistakesRoundButtons() {
  const container = document.getElementById('mistakesRoundButtons');
  container.innerHTML = '';
  for (let r = 1; r <= 5; r++) {
    const btn = document.createElement('button');
    btn.className = `round-pill ${r === 1 ? 'active' : ''}`;
    btn.textContent = `${r}회차`;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.round-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadRoundMistakes(r);
    });
    container.appendChild(btn);
  }
  loadRoundMistakes(1);
}

async function loadRoundMistakes(round) {
  const container = document.getElementById('mistakesContainer');
  try {
    const records = await window.MSE_DB.apiGetTestRecords(APP_STATE.currentLessonId);
    const roundRecord = records.find(r => Number(r.round) === Number(round));

    if (!roundRecord) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:#8C7FA9;">
        ${round}회차 시험 응시 기록이 아직 없습니다. 주관식 단어 시험을 먼저 치러보세요!
      </div>`;
      return;
    }

    const wrongLogs = await window.MSE_DB.apiGetWrongHistory(roundRecord.id);
    if (!wrongLogs || wrongLogs.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:#382B68; font-weight:800;">
        🎉 ${round}회차 시험은 100점 만점으로 오답이 없습니다!
      </div>`;
      return;
    }

    container.innerHTML = wrongLogs.map(item => `
      <div style="background:#FFF; border:1px solid #EFE9FB; border-radius:10px; padding:10px 14px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="font-weight:900; color:#382B68; font-size:15px;">${item.vocab_words?.word || item.correct_answer}</span>
          <span style="color:#FF5376; font-size:12px; font-weight:700;">내 답안: ${item.user_answer || '(미작성)'}</span>
        </div>
        <div style="font-size:13px; color:#6C52EE; font-weight:700;">정답: ${item.correct_answer || item.vocab_words?.meaning}</div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div style="text-align:center; color:#8C7FA9;">오답 노트를 불러올 수 없습니다.</div>`;
  }
}

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

  // Supabase 클라우드 설정 모달
  const cloudModal = document.getElementById('cloudSettingsModal');
  document.getElementById('btnOpenCloudModal').addEventListener('click', () => {
    const conf = window.MSE_DB.getSupabaseConfig();
    document.getElementById('supabaseUrlInput').value = conf.url;
    document.getElementById('supabaseAnonKeyInput').value = conf.anonKey;
    cloudModal.classList.add('open');
  });
  document.getElementById('btnCancelCloudSettings').addEventListener('click', () => {
    cloudModal.classList.remove('open');
  });
  document.getElementById('btnSaveCloudSettings').addEventListener('click', async () => {
    const url = document.getElementById('supabaseUrlInput').value.trim();
    const key = document.getElementById('supabaseAnonKeyInput').value.trim();
    window.MSE_DB.saveSupabaseConfig(url, key);
    updateCloudStatusBadge();
    alert('클라우드 DB 연동 설정이 적용되었습니다!');
    cloudModal.classList.remove('open');
    await fetchWords(APP_STATE.currentLessonId);
  });
}

// --------------------------------------------------------
// 부모님 전용 실시간 성적 대시보드
// --------------------------------------------------------
function setupParentReport() {
  const reportModal = document.getElementById('parentReportModal');
  document.getElementById('btnOpenParentReport').addEventListener('click', async () => {
    reportModal.classList.add('open');
    await loadParentReportData();
  });
  document.getElementById('btnCloseParentReport').addEventListener('click', () => {
    reportModal.classList.remove('open');
  });
  document.getElementById('btnRefreshParentReport').addEventListener('click', async () => {
    await loadParentReportData();
  });

  // 카테고리 필터 버튼 이벤트 바인딩
  document.querySelectorAll('.report-filter-pill').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.report-filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.category || null;
      APP_STATE.currentReportFilter = (cat === 'ALL' ? null : cat);
      await loadParentReportData();
    });
  });
}

async function loadParentReportData() {
  const recordsBody = document.getElementById('reportRecordsBody');
  const wrongBody = document.getElementById('reportWrongLogsBody');

  recordsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px;">기록을 불러오는 중...</td></tr>`;
  wrongBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px;">기록을 불러오는 중...</td></tr>`;

  try {
    const category = APP_STATE.currentReportFilter;
    const records = await window.MSE_DB.apiGetTestRecords(null, 30, category);
    const wrongLogs = await window.MSE_DB.apiGetWrongHistory(null, 50);

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
      recordsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#9587B6; padding:16px;">해당 조건의 시험 기록이 없습니다.</td></tr>`;
    } else {
      recordsBody.innerHTML = records.map(r => {
        const d = new Date(r.test_date);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const modeLabel = r.test_mode === 'WRONG_ONLY' ? '오답집중' : '전체';

        // 시험 유형 배지
        const cat = r.test_category || 'VOCAB';
        let catBadge = '<span class="badge-cat badge-vocab">📖 단어</span>';
        if (cat === 'UNIT') catBadge = '<span class="badge-cat badge-unit">📝 단원</span>';
        else if (cat === 'WRITING') catBadge = '<span class="badge-cat badge-writing">🖋️ 영작</span>';

        return `
          <tr>
            <td>${dateStr}</td>
            <td style="font-weight:700;">${r.lessons?.unit_name?.split(' ')[0] || '3과'}</td>
            <td>
              <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                ${catBadge}
                <span class="word-pos">${r.round}회 (${modeLabel})</span>
                ${r.test_title ? `<span style="font-size:10.5px; color:#7E739B; font-weight:700;">${r.test_title}</span>` : ''}
              </div>
            </td>
            <td style="font-weight:900; color:${r.score >= 80 ? '#6C52EE' : '#FF5376'};">${r.score}점</td>
            <td>${r.correct_count} / ${r.total_count}</td>
            <td style="color:#FFA400; font-weight:800;">⭐️ ${r.stars_won}</td>
          </tr>
        `;
      }).join('');
    }

    // 오답 상세 테이블
    if (wrongLogs.length === 0) {
      wrongBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#9587B6; padding:16px;">오답 기록이 없습니다. 완벽합니다!</td></tr>`;
    } else {
      wrongBody.innerHTML = wrongLogs.map(h => {
        const d = new Date(h.created_at);
        const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return `
          <tr>
            <td style="font-weight:900; color:#382B68;">${h.vocab_words?.word || '-'}</td>
            <td><span class="word-pos">${h.vocab_words?.pos || '-'}</span></td>
            <td style="font-weight:700; color:#5C4B99;">${h.correct_answer || h.vocab_words?.meaning}</td>
            <td style="color:#FF5376; font-weight:800;">${h.user_answer || '(미작성)'}</td>
            <td style="color:#8F83AE;">${timeStr}</td>
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

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handlePdfFile(e.target.files[0]);
    }
  });

  async function handlePdfFile(file) {
    statusEl.style.display = 'block';
    statusEl.style.color = '#6C52EE';
    statusEl.textContent = '⏳ PDF 단어 표를 초고속 파싱하는 중...';

    try {
      const words = await window.parseVocabPdf(file);
      statusEl.textContent = `✅ ${words.length}개 단어 파싱 성공! 클라우드에 등록 중...`;

      await window.MSE_DB.apiInsertWords(APP_STATE.currentLessonId, words);
      statusEl.style.color = '#1E6B38';
      statusEl.textContent = `🎉 ${words.length}개 단어가 클라우드에 즉시 등록되었습니다!`;

      await fetchWords(APP_STATE.currentLessonId);
    } catch (err) {
      statusEl.style.color = '#FF5376';
      statusEl.textContent = `❌ 오류: ${err.message}`;
    }
  }
}

// --------------------------------------------------------
// 새 대단원 추가 모달
// --------------------------------------------------------
function setupNewLessonModal() {
  const modal = document.getElementById('newLessonModal');
  const input = document.getElementById('newLessonNameInput');
  const btnOpen = document.getElementById('btnOpenNewLessonModal');
  const btnCancel = document.getElementById('btnCancelNewLesson');
  const btnSave = document.getElementById('btnSaveNewLesson');

  btnOpen.addEventListener('click', () => {
    input.value = '';
    modal.classList.add('open');
    input.focus();
  });

  btnCancel.addEventListener('click', () => modal.classList.remove('open'));

  btnSave.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) {
      alert('대단원 이름을 입력해주세요.');
      return;
    }
    try {
      const newLesson = await window.MSE_DB.apiCreateLesson(name);
      modal.classList.remove('open');
      await fetchLessons();
      if (newLesson && newLesson.id) {
        await switchLesson(newLesson.id);
      }
      alert(`[${name}] 대단원이 추가되었습니다! PDF 단어장을 등록해주세요.`);
    } catch (e) {
      alert('대단원 추가 중 오류가 발생했습니다: ' + e.message);
    }
  });
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
// 이벤트 리스너 바인딩
// --------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initAppData();
  setupAdminSecurity();
  setupParentReport();
  setupPdfDropzone();
  setupNewLessonModal();

  // 드로어 열기 / 닫기
  const drawer = document.getElementById('drawerSidebar');
  const overlay = document.getElementById('drawerOverlay');
  document.getElementById('drawerOpenBtn').addEventListener('click', () => {
    drawer.classList.add('open');
    overlay.style.display = 'block';
  });
  const closeDrawer = () => {
    drawer.classList.remove('open');
    overlay.style.display = 'none';
  };
  document.getElementById('drawerCloseBtn').addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  // 대단원 드롭다운 변경
  document.getElementById('lessonSelect').addEventListener('change', (e) => {
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

      if (btn.dataset.tab === 'test') {
        initTestSession();
      } else if (btn.dataset.tab === 'mistakes') {
        renderMistakesRoundButtons();
      } else if (btn.dataset.tab === 'final_mistakes') {
        renderFinalMistakesTable();
      } else if (btn.dataset.tab === 'rewards') {
        renderStampBoard();
      }
    });
  });

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

  // 1구간 / 2구간 전환
  document.querySelectorAll('.part-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      APP_STATE.testPart = parseInt(btn.dataset.part, 10);
      renderTestQuestions();
    });
  });

  // 시험 제출 버튼
  document.getElementById('btnSubmitAll').addEventListener('click', submitAndGradeTest);

  // 결과 모달 액션 버튼들
  const resModal = document.getElementById('resultModal');
  document.getElementById('modalBtnRetakeWrong').addEventListener('click', () => {
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

  // 사이드바 / 랭킹 취약단어 바로 재시험 버튼
  const launchWrongTest = () => {
    closeDrawer();
    document.getElementById('tabBtnTest').click();
    APP_STATE.testMode = 'WRONG_ONLY';
    updateTestModeButtons();
    initTestSession();
  };
  document.getElementById('btnTestWrongDirect').addEventListener('click', launchWrongTest);
  document.getElementById('btnTestRankingWords').addEventListener('click', launchWrongTest);

  // 파이널 오답 단어장 액션
  document.getElementById('btnTestFinalMistakes').addEventListener('click', launchWrongTest);
  document.getElementById('btnPrintFinalMistakes').addEventListener('click', () => {
    window.print();
  });
});
