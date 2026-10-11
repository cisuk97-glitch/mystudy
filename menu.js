// ========================================================
// MENU CONFIGURATION (메뉴 설정 및 확장 파일)
// 새로운 메뉴나 단원, 학습 단계는 이 파일에서 언제든 추가/관리할 수 있습니다.
// ========================================================

const MENU_CONFIG = {
  // 현재 단원 정보
  currentLesson: {
    title: "Lesson 3. The Gift of Art",
    publisher: "비상(홍민표)",
    grade: "고1 영어"
  },

  // 전체 학습 메뉴 목록 (PDF 상단 STEP 1 ~ STEP 6 반영)
  menuItems: [
    {
      id: "study",
      title: "STEP 1. 단어장 공부 (20단어씩)",
      icon: "📖",
      type: "internal", // 현재 앱 내부 탭
      description: "한눈에 20단어씩 뜻과 꿀팁을 확인하고 가림판으로 외우기",
      badge: "학습중"
    },
    {
      id: "test",
      title: "STEP 1-1. 40단어 주관식 테스트",
      icon: "✍️",
      type: "internal",
      description: "단어-뜻, 뜻-단어 주관식 입력 (띄어쓰기/유의어 자동 인정)",
      badge: "1~5회차"
    },
    {
      id: "rewards",
      title: "나의 별 & 스티커 보관함",
      icon: "⭐️",
      type: "internal",
      description: "테스트를 통해 모은 별과 도장판 확인",
      badge: "도장판"
    },
    // 추후 다른 파일로 연결할 수 있는 확장 메뉴 슬롯
    {
      id: "grammar",
      title: "STEP 2. 교과서 속 핵심 문법",
      icon: "🔍",
      type: "external", // 다른 파일(grammar.html 등)로 연결 가능
      url: "grammar.html",
      description: "예고 맞춤형 친절한 핵심 문법 정리",
      badge: "준비중"
    },
    {
      id: "text_analysis",
      title: "STEP 3. 본문 한 줄 분석",
      icon: "🎨",
      type: "external",
      url: "text_analysis.html",
      description: "미술 관련 본문 끊어 읽기 및 직독직해",
      badge: "준비중"
    },
    {
      id: "vocab_choice",
      title: "STEP 4. 어휘·어법 고르기",
      icon: "🎯",
      type: "external",
      url: "vocab_choice.html",
      description: "본문 문맥에 맞는 어휘와 어법 선택 훈련",
      badge: "준비중"
    },
    {
      id: "blanks",
      title: "STEP 5. 빈칸 채우기 훈련",
      icon: "🧩",
      type: "external",
      url: "blanks.html",
      description: "주요 어휘와 핵심 문법 빈칸 테스트",
      badge: "준비중"
    },
    {
      id: "writing",
      title: "STEP 6. 서술형 영작하기",
      icon: "🖋️",
      type: "external",
      url: "writing.html",
      description: "서술형 대비 핵심 문장 영작 훈련",
      badge: "준비중"
    }
  ]
};

// 숨김 사이드바 메뉴 렌더링 함수
function renderDrawerMenu() {
  const container = document.getElementById('drawerMenuList');
  if (!container) return;
  container.innerHTML = '';

  MENU_CONFIG.menuItems.forEach(item => {
    const btn = document.createElement('div');
    btn.className = `drawer-item ${item.type === 'internal' ? 'active-type' : 'external-type'}`;
    btn.innerHTML = `
      <div class="drawer-item-icon">${item.icon}</div>
      <div class="drawer-item-text">
        <div class="drawer-item-title">${item.title}</div>
        <div class="drawer-item-desc">${item.description}</div>
      </div>
      <span class="drawer-badge">${item.badge}</span>
    `;

    btn.addEventListener('click', () => {
      if (item.type === 'internal') {
        switchTab(item.id);
        closeDrawer();
      } else {
        alert(`'${item.title}' 메뉴는 별도 파일(${item.url})로 분리되어 있습니다.\n새로운 파일이 추가되면 바로 연결됩니다! 🌸`);
      }
    });

    container.appendChild(btn);
  });
}
