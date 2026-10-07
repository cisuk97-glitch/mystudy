// ========================================================
// MY SPECIAL ENGLISH : 스마트 채점 알고리즘 엔진 (grading.js)
// 한글 자모 분해, 편집거리 85% 유사도 오타 참작, 복수 뜻 인정
// ========================================================

const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNGSUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONGSUNG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

/**
 * 한글 문자열을 초성/중성/종성 음소(자모)로 완전 분해
 */
function decomposeHangul(text) {
  if (!text) return '';
  const result = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const sIndex = code - 0xAC00;
      const cho = Math.floor(sIndex / 588);
      const jung = Math.floor((sIndex % 588) / 28);
      const jong = sIndex % 28;
      result.push(CHOSUNG[cho]);
      result.push(JUNGSUNG[jung]);
      if (jong > 0) {
        result.push(JONGSUNG[jong]);
      }
    } else {
      result.push(text[i]);
    }
  }
  return result.join('');
}

/**
 * Levenshtein Distance (편집거리) 계산
 */
function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1 || s1.length === 0) return (s2 || '').length;
  if (!s2 || s2.length === 0) return (s1 || '').length;

  const len1 = s1.length;
  const len2 = s2.length;
  const d = [];

  for (let i = 0; i <= len1; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,     // 삭제
        d[i][j - 1] + 1,     // 삽입
        d[i - 1][j - 1] + cost // 대체
      );
    }
  }
  return d[len1][len2];
}

/**
 * 공백 및 특수문자 정규화 제거
 */
function cleanText(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/[\s~·,/()[\]\-_\'".!?~;:+]/g, '');
}

/**
 * 스마트 채점 판별 함수
 * @param {string} userInput - 학생 입력값
 * @param {string} targetAnswer - 정답 기준 텍스트
 * @param {boolean} isEnglish - 영단어 입력 여부 (false면 한글 뜻 채점)
 * @returns {{ isCorrect: boolean, isTypo: boolean, notice: string, matchedAnswer: string }}
 */
function gradeAnswer(userInput, targetAnswer, isEnglish = false) {
  const uClean = cleanText(userInput);
  const tClean = cleanText(targetAnswer);

  if (!uClean) {
    return { isCorrect: false, isTypo: false, notice: '', matchedAnswer: targetAnswer };
  }

  // 1. 단순 완전 일치
  if (uClean === tClean) {
    return { isCorrect: true, isTypo: false, notice: '', matchedAnswer: targetAnswer };
  }

  // 2. 영단어 채점 모드
  if (isEnglish) {
    const dist = levenshteinDistance(uClean, tClean);
    // 5자 이상 1타 오타 허용, 8자 이상 2타 오타 허용
    if ((tClean.length >= 5 && dist <= 1) || (tClean.length >= 8 && dist <= 2)) {
      return {
        isCorrect: true,
        isTypo: true,
        notice: `💡 살짝 오타: 원래 표기는 '${targetAnswer}'`,
        matchedAnswer: targetAnswer
      };
    }
    return { isCorrect: false, isTypo: false, notice: '', matchedAnswer: targetAnswer };
  }

  // 3. 한글 뜻 채점 모드 (복수 뜻 분할 및 오타 참작)
  // 쉼표, 슬래시, 줄바꿈 등으로 나열된 복수 정답 분할
  const rawCandidates = targetAnswer.split(/[,/·\n]/).map(c => c.trim()).filter(Boolean);
  
  // 전체 문장 및 각 단일 후보를 평가 대상에 포함
  const candidateList = rawCandidates.length > 0 ? rawCandidates : [targetAnswer];

  for (const cand of candidateList) {
    const cClean = cleanText(cand);

    // 3-1. 후보 뜻과 완전 일치
    if (uClean === cClean) {
      return { isCorrect: true, isTypo: false, notice: '', matchedAnswer: cand };
    }

    // 3-2. 동사 어근 일치 ('시작하다' -> '시작', '강조하다' -> '강조')
    if (cClean.endsWith('하다') && uClean === cClean.slice(0, -2)) {
      return { isCorrect: true, isTypo: false, notice: '', matchedAnswer: cand };
    }
    if (uClean.endsWith('하다') && cClean === uClean.slice(0, -2)) {
      return { isCorrect: true, isTypo: false, notice: '', matchedAnswer: cand };
    }

    // 3-3. 접미사 '~시키다', '~되다' 대응
    if ((cClean.endsWith('시키다') || cClean.endsWith('되다')) && uClean === cClean.slice(0, -3)) {
      return { isCorrect: true, isTypo: false, notice: '', matchedAnswer: cand };
    }

    // 3-4. 부분 일치 (2글자 이상 정확한 서브스트링)
    if (cClean.length >= 2 && uClean.length >= 2) {
      if (cClean.startsWith(uClean) && uClean.length >= cClean.length * 0.7) {
        return { isCorrect: true, isTypo: false, notice: '', matchedAnswer: cand };
      }
    }

    // 3-5. 한글 자모 분해 후 Levenshtein 편집거리 유사도 85% 이상 판별
    const uJamo = decomposeHangul(uClean);
    const cJamo = decomposeHangul(cClean);
    const jDist = levenshteinDistance(uJamo, cJamo);
    const maxLen = Math.max(uJamo.length, cJamo.length);

    if (maxLen > 0) {
      const similarity = 1.0 - (jDist / maxLen);
      if (similarity >= 0.85) {
        return {
          isCorrect: true,
          isTypo: true,
          notice: `💡 살짝 오타: 원래 표기는 '${cand}'`,
          matchedAnswer: cand
        };
      }
    }
  }

  return { isCorrect: false, isTypo: false, notice: '', matchedAnswer: targetAnswer };
}

// 브라우저 전역 노출
if (typeof window !== 'undefined') {
  window.gradeAnswer = gradeAnswer;
  window.decomposeHangul = decomposeHangul;
  window.levenshteinDistance = levenshteinDistance;
  window.cleanText = cleanText;
}
