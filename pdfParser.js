// ========================================================
// MY SPECIAL ENGLISH : 순수 클라이언트 PDF 단어 표 파서 (pdfParser.js)
// 외부 AI API 없이 브라우저 내장 PDF.js로 단어 표를 초고속 추출
// ========================================================

/**
 * PDF 파일에서 텍스트 아이템들을 추출하여 표 구조 분석
 * @param {File} file - 사용자가 선택하거나 드롭한 PDF 파일
 * @returns {Promise<Array<{word_no: number, word: string, pos: string, meaning: string, eng_def: string}>>}
 */
async function parseVocabPdf(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF.js 라이브러리가 로드되지 않았습니다.');
  }

  try {
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  } catch (e) {}

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
  });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  let allLines = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Y 좌표 기반으로 라인 정렬 (위에서 아래로)
    const items = textContent.items;
    if (!items || items.length === 0) continue;

    // 대략적인 y좌표 그룹핑 (허용 오차 4px)
    const lineBuckets = [];
    items.forEach(item => {
      const text = item.str.trim();
      if (!text) return;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);

      let bucket = lineBuckets.find(b => Math.abs(b.y - y) <= 4);
      if (!bucket) {
        bucket = { y, items: [] };
        lineBuckets.push(bucket);
      }
      bucket.items.push({ x, text });
    });

    // Y좌표 내림차순 정렬 (PDF 좌표계는 아래가 0)
    lineBuckets.sort((a, b) => b.y - a.y);

    // 각 줄 내부에서 X좌표 오름차순 정렬
    lineBuckets.forEach(b => {
      b.items.sort((ix1, ix2) => ix1.x - ix2.x);
      const lineStr = b.items.map(it => it.text).join(' ');
      if (lineStr.trim()) {
        allLines.push(lineStr.trim());
      }
    });
  }

  console.log('PDF 추출 총 라인 수:', allLines.length);

  // 추출된 라인들을 기반으로 단어 데이터 파싱
  const extractedWords = [];
  const knownPosList = ['형', '명', '동', '부', '동/명', '명/동', '숙어', '대', '전', '접', 'v', 'n', 'a', 'adv'];

  // 라인들을 순회하며 번호로 시작하는 패턴 또는 표 행 분석
  // 예시 패턴:
  // "1 primary 형 주요한 first in importance or degree"
  // 또는 여러 줄에 걸쳐 나뉘어 있는 경우 대응
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];

    // 번호로 시작하는 패턴 (1~60)
    const match = line.match(/^(\d{1,2})[\s.)\t]+([a-zA-Z~' \-]+)(.*)$/);
    if (match) {
      const wordNo = parseInt(match[1], 10);
      let word = match[2].trim();
      let rest = (match[3] || '').trim();

      let pos = '';
      let meaning = '';
      let engDef = '';

      // rest에서 품사 찾기
      const tokens = rest.split(/\s+/);
      let foundPosIdx = -1;

      for (let t = 0; t < tokens.length; t++) {
        const token = tokens[t].replace(/[()[\]]/g, '');
        if (knownPosList.includes(token)) {
          pos = token;
          foundPosIdx = t;
          break;
        }
      }

      if (foundPosIdx !== -1) {
        // 품사 앞쪽이 단어의 나머지일 수 있음
        const extraWord = tokens.slice(0, foundPosIdx).join(' ').trim();
        if (extraWord && /^[a-zA-Z~' \-]+$/.test(extraWord)) {
          word = (word + ' ' + extraWord).trim();
        }
        
        // 품사 뒤쪽: 한글 뜻 + 영영풀이
        const afterPos = tokens.slice(foundPosIdx + 1).join(' ').trim();
        // 한글과 영어 경계 분리
        const engDefMatch = afterPos.match(/([a-zA-Z].{8,})$/);
        if (engDefMatch) {
          engDef = engDefMatch[1].trim();
          meaning = afterPos.replace(engDefMatch[1], '').trim();
        } else {
          meaning = afterPos;
        }
      } else {
        // 품사가 분리되지 않은 경우, 한글 시작 부분 탐색
        const korMatch = rest.match(/([가-힣].*)/);
        if (korMatch) {
          const korPart = korMatch[1];
          const engDefMatch = korPart.match(/([a-zA-Z].{8,})$/);
          if (engDefMatch) {
            engDef = engDefMatch[1].trim();
            meaning = korPart.replace(engDefMatch[1], '').trim();
          } else {
            meaning = korPart;
          }
        } else {
          meaning = rest;
        }
      }

      if (word && wordNo > 0 && wordNo <= 100) {
        extractedWords.push({
          word_no: wordNo,
          word: word.replace(/^~|~$/g, '').trim(),
          pos: pos || '기타',
          meaning: meaning || word,
          eng_def: engDef
        });
      }
    }
  }

  // 중복 번호 제거 및 번호순 정렬
  const uniqueWordsMap = new Map();
  extractedWords.forEach(w => {
    if (!uniqueWordsMap.has(w.word_no)) {
      uniqueWordsMap.set(w.word_no, w);
    }
  });

  const sortedWords = Array.from(uniqueWordsMap.values()).sort((a, b) => a.word_no - b.word_no);

  if (sortedWords.length === 0) {
    throw new Error('PDF에서 단어 표 형식을 인식하지 못했습니다. 표준 표 형식의 단어장 PDF인지 확인해주세요.');
  }

  return sortedWords;
}

/**
 * 문제+정답 통합 PDF 파서:
 * - 전체 페이지 텍스트 분석
 * - 정답 페이지(빠른 정답, 정답 및 해설 등) 자동 식별
 * - 정답 번호 및 답안(①~⑤ 또는 숫자/단어) 정규식 추출
 * - 문제 페이지 범위 (startPage ~ endPage) 계산
 */
async function parseTestPaperPdf(file, customAnswerPage = null) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF.js 라이브러리가 로드되지 않았습니다.');
  }

  try {
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  } catch (e) {}

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
  });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const pageTexts = [];
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const str = textContent.items.map(it => it.str).join(' ');
    pageTexts.push({ pageNum, text: str });
  }

  // 1. 정답 페이지 식별 (수동 지정 페이지 우선)
  let answerPageNum = -1;
  if (customAnswerPage && Number(customAnswerPage) >= 1 && Number(customAnswerPage) <= numPages) {
    answerPageNum = Number(customAnswerPage);
  } else {
    // 자동 감지: 1순위 명시적 키워드 (빠른 정답, 정답표, 정답 및 해설 등)
    const answerKeywords = ['빠른 정답', '빠른정답', '정답표', '정답 및 해설', '정답과 해설', '정 답', '정답', '정 답 표'];
    for (let pNum = 1; pNum <= numPages; pNum++) {
      const pText = pageTexts[pNum - 1]?.text || '';
      if (answerKeywords.some(kw => pText.includes(kw))) {
        answerPageNum = pNum;
        break;
      }
    }

    // 2순위: 뒤쪽 페이지부터 원문자 밀집도 검사 (정답 섹션의 시작 페이지 탐색)
    if (answerPageNum === -1) {
      for (let pNum = numPages; pNum >= 1; pNum--) {
        const pText = pageTexts[pNum - 1]?.text || '';
        const circleMatches = (pText.match(/[①②③④⑤❶❷❸❹❺]/g) || []).length;
        if (circleMatches >= 5) {
          answerPageNum = pNum;
        } else if (answerPageNum !== -1) {
          break; // 이전 페이지는 문제가 시작되는 영역
        }
      }
    }
  }

  // 감지되지 않은 경우 기본값으로 마지막 페이지 지정
  if (answerPageNum === -1 || answerPageNum > numPages) {
    answerPageNum = numPages;
  }

  // 2. 정답 및 해설 텍스트 추출: 정답 시작 페이지부터 마지막 페이지만 추출
  // 2단(2-Column) 레이아웃 자동 감지 및 순서 재배치 (좌측단 위->아래 후 우측단 위->아래)
  const extractedLines = [];
  const lineMeta = [];
  const circleMap = { '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5', '❶': '1', '❷': '2', '❸': '3', '❹': '4', '❺': '5' };
  const falsePositives = new Set(['점', '쪽', '월', '일', '년', '학년', '배점', '단원', '페이지', '과목', '정답', '해설', '출제', '문항', '번호', '과', '선택']);

  const formatBucketItems = (items) => {
    const lineBuckets = [];
    items.forEach(item => {
      const text = item.str.trim();
      if (!text) return;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);

      let bucket = lineBuckets.find(b => Math.abs(b.y - y) <= 4);
      if (!bucket) {
        bucket = { y, items: [] };
        lineBuckets.push(bucket);
      }
      bucket.items.push({ x, text });
    });

    lineBuckets.sort((a, b) => b.y - a.y);
    const lines = [];
    lineBuckets.forEach(b => {
      b.items.sort((i1, i2) => i1.x - i2.x);
      const lineStr = b.items.map(it => it.text).join(' ');
      if (lineStr.trim()) {
        lines.push(lineStr.trim());
      }
    });
    return lines;
  };

  for (let p = answerPageNum; p <= numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1.0 });
    const midX = viewport.width / 2;
    const textContent = await page.getTextContent();
    const items = textContent.items;
    if (!items || items.length === 0) continue;

    // 2단 레이아웃 여부 판별 (중앙선 기준 좌우 양쪽에 텍스트가 고루 분포하는지 확인)
    let leftCount = 0;
    let rightCount = 0;
    items.forEach(it => {
      const str = (it.str || '').trim();
      if (!str) return;
      const x = it.transform[4];
      if (x < midX - 25) leftCount++;
      else if (x > midX + 25) rightCount++;
    });

    const isTwoColumn = leftCount >= 5 && rightCount >= 5;

    if (isTwoColumn) {
      const leftItems = [];
      const rightItems = [];
      items.forEach(it => {
        const str = (it.str || '').trim();
        if (!str) return;
        const x = it.transform[4];
        if (x < midX) leftItems.push(it);
        else rightItems.push(it);
      });
      const leftLines = formatBucketItems(leftItems);
      const rightLines = formatBucketItems(rightItems);
      leftLines.forEach(l => {
        extractedLines.push(l);
        lineMeta.push({ page: p, col: 'left' });
      });
      rightLines.forEach(l => {
        extractedLines.push(l);
        lineMeta.push({ page: p, col: 'right' });
      });
    } else {
      const pageLines = formatBucketItems(items);
      pageLines.forEach(l => {
        extractedLines.push(l);
        lineMeta.push({ page: p, col: 'left' });
      });
    }
  }

  const fullAnswerText = extractedLines.join('\n');
  const answerSheet = {};
  const explanations = {};
  const questionPages = {};

  // 문자열 인덱스로부터 해당 줄의 페이지/컬럼 메타데이터 검색 헬퍼
  const lineStartIndices = [];
  let curOffset = 0;
  for (let i = 0; i < extractedLines.length; i++) {
    lineStartIndices.push(curOffset);
    curOffset += extractedLines[i].length + 1; // + 1 for '\n'
  }
  const getLineMetaByCharIndex = (charIdx) => {
    let lIdx = 0;
    for (let i = 0; i < lineStartIndices.length; i++) {
      if (lineStartIndices[i] <= charIdx) lIdx = i;
      else break;
    }
    return lineMeta[lIdx] || { page: answerPageNum, col: 'left' };
  };

  // 1단계: 문항별 블록 분할 및 (번호 ... 정답 ... 답 / 해설) 추출
  // 예: "10) ❚ 정답 ③", "1. 정답 ⑤", "[1] 정답: ③", "1) [정답] ⑤" 등 지원
  const headerRegex = /(?:^|\n)\s*(?:문\s*|Q\s*)?(?:\[)?0?(\d{1,2})(?:\]|\.|\)|\:|\s*번)/gi;
  const headers = [];
  let hm;
  while ((hm = headerRegex.exec(fullAnswerText)) !== null) {
    headers.push({ q: parseInt(hm[1], 10), index: hm.index });
  }

  // 중복 번호 방지 및 위치순 정렬
  const uniqueHeaders = [];
  const seenQ = new Set();
  for (const h of headers) {
    if (!seenQ.has(h.q)) {
      seenQ.add(h.q);
      uniqueHeaders.push(h);
    }
  }
  uniqueHeaders.sort((a, b) => a.index - b.index);

  uniqueHeaders.forEach((item, idx) => {
    const meta = getLineMetaByCharIndex(item.index);
    questionPages[item.q] = { page: meta.page, col: meta.col };

    const nextIdx = uniqueHeaders[idx + 1] ? uniqueHeaders[idx + 1].index : fullAnswerText.length;
    const block = fullAnswerText.slice(item.index, nextIdx);

    // 정답 추출: '정답' 이후 모든 기호·공백을 건너뛰고 첫 번호나 글자(한글, 영문, 숫자, 원문자, 여는괄호)부터 캡처
    const ansMatch = block.match(/정\s*답[^a-zA-Z0-9가-힣①-⑮❶-❿(\r\n]*([①-⑮❶-❿0-9가-힣a-zA-Z(].*?)(?=\s*(?:❚|■|\[)?\s*해\s*설|\n|$)/i);
    if (ansMatch) {
      let rawAns = ansMatch[1].trim();
      const circle = rawAns.match(/^[①②③④⑤❶❷❸❹❺]/);
      if (circle) {
        answerSheet[item.q] = circleMap[circle[0]];
      } else if (/^[1-5]$/.test(rawAns)) {
        answerSheet[item.q] = rawAns;
      } else {
        answerSheet[item.q] = rawAns;
      }
    }

    // 해설 추출
    const explMatch = block.match(/(?:❚|■|\[)?\s*해\s*설(?:\s*[:=\-]|\s+)([\s\S]*)/i);
    if (explMatch) {
      explanations[item.q] = explMatch[1].trim().replace(/\s+/g, ' ');
    } else if (answerSheet[item.q]) {
      explanations[item.q] = `정답: ${answerSheet[item.q]}`;
    }
  });

  // 2단계: 표(Table) 형태 빠른 정답 인식 (빠른 정답 표)
  for (let i = 0; i < extractedLines.length - 1; i++) {
    const line1 = extractedLines[i];
    const line2 = extractedLines[i + 1];

    const qNums = (line1.match(/\b\d{1,2}\b/g) || []).map(Number);
    if (qNums.length >= 3 && qNums[1] === qNums[0] + 1) {
      let normL2 = line2;
      Object.keys(circleMap).forEach(sym => {
        normL2 = normL2.replaceAll(sym, ` ${circleMap[sym]} `);
      });
      const ansTokens = normL2.split(/\s+/).filter(t => !falsePositives.has(t) && (/^[1-5]$/.test(t) || /^[가-힣a-zA-Z0-9_\-\.]+$/.test(t)));
      if (ansTokens.length >= qNums.length) {
        qNums.forEach((q, idx) => {
          if (!answerSheet[q] && ansTokens[idx]) {
            answerSheet[q] = ansTokens[idx];
            if (!questionPages[q]) {
              questionPages[q] = lineMeta[i] || { page: answerPageNum, col: 'left' };
            }
          }
        });
      }
    }
  }

  // 3단계: 인라인 원문자 정답 매칭 ("10) ❚ 정답 ③", "1. ③", "1) ③", "[1] ③", "1번 ③", "1 ③")
  const circleInlineRegex = /(?:^|\s)(?:문\s*|Q\s*)?(?:\[)?0?(\d{1,2})(?:\]|\.|\)|\:|\-|\s*번)?\s*[^a-zA-Z0-9가-힣\n]{0,5}\s*(?:정\s*답\s*)?([①②③④⑤❶❷❸❹❺])(?=\s+|$|[^\d])/g;
  while ((m = circleInlineRegex.exec(fullAnswerText)) !== null) {
    const qNum = parseInt(m[1], 10);
    if (qNum >= 1 && qNum <= 100 && !answerSheet[qNum]) {
      answerSheet[qNum] = circleMap[m[2]] || m[2];
      if (!questionPages[qNum]) {
        questionPages[qNum] = getLineMetaByCharIndex(m.index);
      }
    }
  }

  // 4단계: 인라인 숫자 정답 매칭 ("10) ❚ 정답 3", "1. 3", "1) 3", "1번 3", "1 3")
  const digitInlineRegex = /(?:^|\s)(?:문\s*|Q\s*)?(?:\[)?0?(\d{1,2})(?:\]|\.|\)|\:|\-|\s*번)?\s*[^a-zA-Z0-9가-힣\n]{0,5}\s*(?:정\s*답\s*)?([1-5])(?=\s+|$)/g;
  while ((m = digitInlineRegex.exec(fullAnswerText)) !== null) {
    const qNum = parseInt(m[1], 10);
    if (qNum >= 1 && qNum <= 100 && !answerSheet[qNum]) {
      answerSheet[qNum] = m[2];
      if (!questionPages[qNum]) {
        questionPages[qNum] = getLineMetaByCharIndex(m.index);
      }
    }
  }

  // 해설이 아직 없는 문항에 대한 보완
  const questionKeys = Object.keys(answerSheet).map(Number).sort((a, b) => a - b);
  questionKeys.forEach((q, idx) => {
    if (!questionPages[q]) {
      questionPages[q] = { page: answerPageNum, col: 'left' };
    }
    if (!explanations[q]) {
      const nextQ = questionKeys[idx + 1];
      const qPattern = new RegExp(`(?:^|\\s)(?:문\\s*)?(?:\\[)?0?${q}(?:\\]|\\.|\\)|\\:|번)\\s*(?:[1-5]|[가-힣a-zA-Z0-9_\\-\\.]+)?([\\s\\S]*?)(?=(?:(?:^|\\s)(?:문\\s*)?(?:\\[)?0?${nextQ || 999}(?:\\]|\\.|\\)|\\:|번))|$)`, 'i');
      const explMatch = fullAnswerText.match(qPattern);
      if (explMatch && explMatch[1] && explMatch[1].trim().length > 5) {
        explanations[q] = explMatch[1].trim().replace(/\s+/g, ' ');
      } else {
        explanations[q] = `정답: ${answerSheet[q] || '-'}`;
      }
    }
  });

  const totalQuestions = questionKeys.length > 0 ? Math.max(...questionKeys) : 20;
  let startPage = 1;
  let endPage = answerPageNum > 1 ? answerPageNum - 1 : 1;

  // 4단계: 문제지 영역(startPage ~ endPage) 내 문항 번호 위치(페이지, 좌/우 컬럼) 추출
  const examQuestionPages = {};
  for (let p = startPage; p <= endPage; p++) {
    try {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1.0 });
      const midX = viewport.width / 2;
      const textContent = await page.getTextContent();
      const items = textContent.items;
      if (!items || items.length === 0) continue;

      let leftCount = 0;
      let rightCount = 0;
      items.forEach(it => {
        const str = (it.str || '').trim();
        if (!str) return;
        const x = it.transform[4];
        if (x < midX - 25) leftCount++;
        else if (x > midX + 25) rightCount++;
      });

      const isTwoColumn = leftCount >= 5 && rightCount >= 5;
      const pageColLines = [];

      if (isTwoColumn) {
        const leftItems = [];
        const rightItems = [];
        items.forEach(it => {
          const str = (it.str || '').trim();
          if (!str) return;
          const x = it.transform[4];
          if (x < midX) leftItems.push(it);
          else rightItems.push(it);
        });
        formatBucketItems(leftItems).forEach(l => pageColLines.push({ line: l, col: 'left' }));
        formatBucketItems(rightItems).forEach(l => pageColLines.push({ line: l, col: 'right' }));
      } else {
        formatBucketItems(items).forEach(l => pageColLines.push({ line: l, col: 'left' }));
      }

      const qPattern = /(?:^|\s)(?:\[|【)?(?:Q\s*)?0?(\d{1,2})(?:\]|】|\.|\)|\:|\s*번)(?!\d)/gi;
      pageColLines.forEach(({ line, col }) => {
        let match;
        while ((match = qPattern.exec(line)) !== null) {
          const qNum = parseInt(match[1], 10);
          if (qNum >= 1 && qNum <= totalQuestions && !examQuestionPages[qNum]) {
            examQuestionPages[qNum] = { page: p, col };
          }
        }
      });
    } catch (err) {
      console.warn(`문제지 ${p}페이지 파싱 중 건너뜀:`, err);
    }
  }

  // 누락된 문항 fallback 위치 보정
  let lastKnown = { page: startPage, col: 'left' };
  for (let q = 1; q <= totalQuestions; q++) {
    if (examQuestionPages[q]) {
      lastKnown = examQuestionPages[q];
    } else {
      const estPage = Math.min(endPage, Math.max(startPage, startPage + Math.floor(((q - 1) / Math.max(1, totalQuestions)) * (endPage - startPage + 1))));
      examQuestionPages[q] = { page: estPage, col: lastKnown.col || 'left' };
    }
  }

  return {
    success: true,
    numPages,
    answerPageNum,
    startPage,
    endPage,
    totalQuestions,
    answerSheet,
    explanations,
    questionPages,
    examQuestionPages
  };
}

/**
 * 'Level 2 영작 연습하기' 서술형 전용 PDF 파서
 * - 4~6p의 한글 문제 문장(1~15번) 추출
 * - 7~8p(정답 및 해설)의 영작 연습하기 영어 정답 문장(1~15번) 추출
 * - 1:1 매칭 후 writing_sentences 규격으로 반환
 * @param {File|ArrayBuffer} file
 * @returns {Promise<Array<{sentence_no: number, korean_prompt: string, english_sentence: string, word_count: number}>>}
 */
async function parseWritingPdf(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF.js 라이브러리가 로드되지 않았습니다.');
  }

  try {
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  } catch (e) {}

  const arrayBuffer = (file instanceof ArrayBuffer) ? file : await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
  });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  // 1. 전체 페이지를 라인 단위로 추출 (Y좌표 버킷 정렬)
  const allPageLines = [];
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items || [];

    const lineBuckets = [];
    items.forEach(item => {
      const str = item.str ? item.str.trim() : '';
      if (!str) return;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);

      let bucket = lineBuckets.find(b => Math.abs(b.y - y) <= 4);
      if (!bucket) {
        bucket = { y, items: [] };
        lineBuckets.push(bucket);
      }
      bucket.items.push({ x, str });
    });

    lineBuckets.sort((a, b) => b.y - a.y);
    const lines = lineBuckets.map(b => {
      b.items.sort((ia, ib) => ia.x - ib.x);
      return b.items.map(i => i.str).join(' ');
    }).filter(l => l.length > 0);

    allPageLines.push({ pageNum, lines });
  }

  // 2. 정답 섹션 시작 페이지 식별 (정답 및 해설, 정답 등)
  let answerStartPage = -1;
  const answerKeywords = ['정답 및 해설', '정답과 해설', '정 답', '빠른 정답', '빠른정답', '정답'];
  for (let p = 1; p <= numPages; p++) {
    const text = allPageLines[p - 1].lines.join(' ');
    if (answerKeywords.some(kw => text.includes(kw))) {
      answerStartPage = p;
      break;
    }
  }
  if (answerStartPage === -1) {
    answerStartPage = Math.max(1, Math.floor(numPages * 0.7));
  }

  // 3. 문제 영역에서 '영작 연습하기' 한글 문제(1~15번) 추출
  const questions = {};
  let inWritingQuestionSection = false;
  let currentQNo = null;

  for (let p = 1; p < answerStartPage; p++) {
    const lines = allPageLines[p - 1].lines;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 섹션 헤더 감지
      if (line.includes('영작 연습하기') || line.includes('영작연습하기') || (line.includes('Level 2') && line.includes('영작'))) {
        inWritingQuestionSection = true;
        continue;
      }
      // 다른 Level로 넘어가면 종료
      if (inWritingQuestionSection && (line.includes('Level 3') || line.includes('STEP 7') || line.includes('본문 빈칸'))) {
        inWritingQuestionSection = false;
        continue;
      }

      if (!inWritingQuestionSection) continue;

      // 번호 매칭: "1. 저희의 최신 전시인..."
      const numMatch = line.match(/^(\d{1,2})\.\s*(.*)$/);
      if (numMatch) {
        currentQNo = parseInt(numMatch[1], 10);
        const rest = numMatch[2].trim();
        // 한글이 포함된 문장인지 확인
        if (/[가-힣]/.test(rest)) {
          questions[currentQNo] = rest;
        } else {
          questions[currentQNo] = '';
        }
      } else if (currentQNo !== null) {
        // 번호 다음 줄: 한글 문장이 이어지는 경우 누적
        // 단, 밑줄(___)이나 영어 단어 나열, 힌트 박스([ ... ]) 이전까지만 한글 취합
        if (line.includes('___') || line.startsWith('[') || line.startsWith('(')) {
          // 밑줄 또는 단어 힌트 시작 -> 문제 문장 누적 마감
          currentQNo = null;
        } else if (/[가-힣]/.test(line)) {
          if (!questions[currentQNo]) questions[currentQNo] = line;
          else questions[currentQNo] += ' ' + line;
        } else if (/[a-zA-Z]/.test(line) && !/[가-힣]/.test(line)) {
          // 영어만 있는 줄이면 밑줄 빈칸 영단어이므로 종료
          currentQNo = null;
        }
      }
    }
  }

  // 4. 정답 영역에서 '영작 연습하기' 영어 정답(1~15번) 추출
  const answers = {};
  let inWritingAnswerSection = false;
  let currentAnsNo = null;

  for (let p = answerStartPage; p <= numPages; p++) {
    const lines = allPageLines[p - 1].lines;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 정답 페이지 내 '영작 연습하기' 섹션 헤더 감지
      if (line.includes('영작 연습하기') || line.includes('영작연습하기')) {
        inWritingAnswerSection = true;
        currentAnsNo = null;
        continue;
      }
      // 다른 섹션(순서 배열하기 정답, Level 3 정답 등) 감지 시 영작 섹션 마감
      if (inWritingAnswerSection && (line.includes('순서 배열하기') || line.includes('Level 1') || line.includes('Level 3') || line.includes('본문 빈칸'))) {
        inWritingAnswerSection = false;
        currentAnsNo = null;
        continue;
      }

      if (!inWritingAnswerSection) continue;

      // 번호 매칭: "1. As we walk through..."
      const numMatch = line.match(/^(\d{1,2})\.\s*(.*)$/);
      if (numMatch) {
        currentAnsNo = parseInt(numMatch[1], 10);
        answers[currentAnsNo] = numMatch[2].trim();
      } else if (currentAnsNo !== null) {
        const currentText = (answers[currentAnsNo] || '').trim();
        // 이미 문장이 마침표(.), 물음표(?), 느낌표(!)로 완결되었는데 다음 줄로 넘어온 경우 즉시 누적 마감 (마지막 문항 줄바꿈 버그 차단)
        if (/[.?!]$/.test(currentText)) {
          currentAnsNo = null;
          continue;
        }

        // 푸터, 페이지 번호, 한글 해설, 사이트 주소 등 불필요한 라인 감지 시 마감
        if (line.startsWith('◇') || line.startsWith('www.') || line.includes('All rights reserved') || /^\d+$/.test(line) || /[가-힣]/.test(line)) {
          currentAnsNo = null;
          continue;
        }

        // 영어 문장이 다음 라인으로 이어지는 경우 누적
        if (/[a-zA-Z]/.test(line)) {
          answers[currentAnsNo] += ' ' + line;
        } else {
          currentAnsNo = null;
        }
      }
    }
  }

  // 5. 문제 문장과 정답 문장 1:1 매칭
  const result = [];
  const maxNo = 30; // 1~30번 탐색
  for (let no = 1; no <= maxNo; no++) {
    const eng = answers[no]?.trim();
    let kor = questions[no]?.trim();

    if (eng) {
      // 한글 문제가 파싱 누락된 경우 대체 텍스트
      if (!kor) kor = `${no}번 문장을 영작하세요.`;

      // 구두점 및 연속 공백 정리
      const cleanEng = eng.replace(/\s+/g, ' ').trim();
      const cleanKor = kor.replace(/\s+/g, ' ').trim();
      const wordCount = cleanEng.split(/\s+/).filter(Boolean).length;

      result.push({
        sentence_no: no,
        korean_prompt: cleanKor,
        english_sentence: cleanEng,
        word_count: wordCount
      });
    }
  }

  if (result.length === 0) {
    throw new Error('PDF에서 "영작 연습하기" 문항을 찾을 수 없습니다. 올바른 영작 학습 PDF인지 확인해주세요.');
  }

  return result;
}

/**
 * 한글 문제 텍스트 전체와 영어 정답 텍스트 전체를 파싱하여 1:1 매칭
 * @param {string} koreanRawText
 * @param {string} englishRawText
 * @returns {{ success: boolean, sentences: Array, matchedCount: number, totalCount: number, koreanCount: number, englishCount: number, missing: Array }}
 */
function parseDirectWritingText(koreanRawText, englishRawText) {
  function extractNumbered(raw) {
    const map = {};
    if (!raw || typeof raw !== 'string') return map;
    const lines = raw.split(/\r?\n/);
    let currentNo = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // 번호 패턴 감지: "1. ", "1) ", "1 ", "[1] " 등
      const match = line.match(/^\[?\s*(\d{1,2})\s*[\.\)\]\s]\s*(.*)$/);
      if (match) {
        currentNo = parseInt(match[1], 10);
        map[currentNo] = (match[2] || '').trim();
      } else if (currentNo !== null) {
        // 다음 번호가 나오기 전까지 여러 줄로 이어진 문장 누적
        const cleanChunk = line.replace(/_{2,}/g, '').trim();
        if (cleanChunk) {
          if (map[currentNo]) map[currentNo] += ' ' + cleanChunk;
          else map[currentNo] = cleanChunk;
        }
      }
    }

    // 각 문장 내 연속 공백 및 잔여 밑줄 정리
    Object.keys(map).forEach(no => {
      map[no] = map[no].replace(/_{2,}/g, '').replace(/\s+/g, ' ').trim();
    });
    return map;
  }

  const korMap = extractNumbered(koreanRawText);
  const engMap = extractNumbered(englishRawText);

  const allNos = Array.from(new Set([...Object.keys(korMap), ...Object.keys(engMap)]))
    .map(Number)
    .sort((a, b) => a - b);

  const sentences = [];
  const missing = [];

  allNos.forEach(no => {
    const kor = korMap[no]?.trim() || '';
    const eng = engMap[no]?.trim() || '';

    if (kor && eng) {
      const wordCount = eng.split(/\s+/).filter(Boolean).length;
      sentences.push({
        sentence_no: no,
        korean_prompt: kor,
        english_sentence: eng,
        word_count: wordCount
      });
    } else {
      if (!kor) missing.push({ no, missingType: 'KOREAN', desc: `한글 ${no}번 문제 문장이 누락되었습니다.` });
      if (!eng) missing.push({ no, missingType: 'ENGLISH', desc: `영어 ${no}번 정답 문장이 누락되었습니다.` });
    }
  });

  return {
    success: sentences.length > 0 && missing.length === 0,
    sentences,
    matchedCount: sentences.length,
    totalCount: allNos.length,
    koreanCount: Object.keys(korMap).length,
    englishCount: Object.keys(engMap).length,
    missing
  };
}

if (typeof window !== 'undefined') {
  window.parseVocabPdf = parseVocabPdf;
  window.parseTestPaperPdf = parseTestPaperPdf;
  window.parseWritingPdf = parseWritingPdf;
  window.parseDirectWritingText = parseDirectWritingText;
}

