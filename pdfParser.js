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

  // Worker 설정
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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

if (typeof window !== 'undefined') {
  window.parseVocabPdf = parseVocabPdf;
}
