// 비상(홍민표) 3과 The Gift of Art - 단어 40개 전체 데이터
const VOCAB_DATA = [
  {
    id: 1,
    word: "primary",
    pos: "형",
    meaning: "주요한",
    engDef: "first in importance or degree",
    tip: "미술에서 'Primary colors'는 빨강, 노랑, 파랑 같은 '주요한(기본적인)' 3원색을 뜻해! 🎨",
    example: "The primary purpose of art is to express emotions."
  },
  {
    id: 2,
    word: "inspiration",
    pos: "명",
    meaning: "영감, 영감을 주는 것",
    engDef: "someone or something that gives you ideas for doing something",
    tip: "in(안으로) + spir(숨쉬다) = 가슴속으로 찌릿한 아이디어가 훅 불어 들어오는 '영감'! 💡",
    example: "Nature is a great source of inspiration for artists."
  },
  {
    id: 3,
    word: "exceptionally",
    pos: "부",
    meaning: "유난히, 이례적으로",
    engDef: "to a greater degree than normal",
    tip: "except(예외) + ion + ally = 보통 규칙에서 '예외적'으로 엄청나서 '유난히, 이례적으로'! ✨",
    example: "She is an exceptionally talented painter."
  },
  {
    id: 4,
    word: "intense",
    pos: "형",
    meaning: "강렬한",
    engDef: "of extreme force, degree, or strength",
    tip: "불꽃처럼 쨍하고 시선을 확 사로잡는 '강렬한' 원색 느낌을 떠올려봐! 🔥",
    example: "The painter used intense colors to show passion."
  },
  {
    id: 5,
    word: "feature",
    pos: "동/명",
    meaning: "특징으로 삼다 / 특징, 특성",
    engDef: "to have as an impressive attribute or aspect",
    tip: "얼굴의 생김새(이목구비)도 feature! 그림의 가장 눈에 띄는 '특징'을 기억해줘! 🖼️",
    example: "The exhibition features modern sculptures."
  },
  {
    id: 6,
    word: "recognizable",
    pos: "형",
    meaning: "(쉽게) 알아볼 수 있는, 유명한",
    engDef: "easy to become aware of",
    tip: "re(다시) + cognize(알다) + able(할 수 있는) = 보자마자 '어, 나 이거 알아!' 하고 알아볼 수 있는! 👀",
    example: "Van Gogh's brush strokes are easily recognizable."
  },
  {
    id: 7,
    word: "preference",
    pos: "명",
    meaning: "선호",
    engDef: "a greater liking for one option over another",
    tip: "prefer(~를 더 좋아하다)의 명사형! 내가 더 아끼는 '취향과 선호'! 💖",
    example: "Everyone has a different preference in music and art."
  },
  {
    id: 8,
    word: "emphasize",
    pos: "동",
    meaning: "강조하다",
    engDef: "to give special importance to something",
    tip: "형광펜으로 쫙 긋거나 붓으로 두껍게 덧칠해서 '강조하다'! 🖍️",
    example: "The artist emphasized the contrast between light and dark."
  },
  {
    id: 9,
    word: "depict",
    pos: "동",
    meaning: "묘사하다",
    engDef: "to show by a drawing or other art forms",
    tip: "pict는 picture(그림)! 캔버스 위에 그림으로 생생하게 그려내며 '묘사하다'! 🖌️",
    example: "The painting depicts a peaceful village."
  },
  {
    id: 10,
    word: "surroundings",
    pos: "명",
    meaning: "(주위) 환경",
    engDef: "everything that is around or near somebody or something",
    tip: "surround(둘러싸다) + ings = 내 주변을 빙 둘러싸고 있는 '주위 환경'! 🌳",
    example: "The studio has quiet and beautiful surroundings."
  },
  {
    id: 11,
    word: "direct",
    pos: "형",
    meaning: "직접적인 (반의어: indirect)",
    engDef: "without anything else in between",
    tip: "다이렉트로 직진! 중간에 가로막는 것 없이 곧장 통하는 '직접적인'! 🎯",
    example: "Art allows direct communication from heart to heart."
  },
  {
    id: 12,
    word: "shade",
    pos: "명",
    meaning: "색조 / 그늘",
    engDef: "a color slightly different from the original one",
    tip: "물감 팔레트에서 미묘하게 다른 여러 '색조(음영)'나 시원한 나무 '그늘'! 🎨",
    example: "She blended different shades of purple."
  },
  {
    id: 13,
    word: "calming",
    pos: "형",
    meaning: "진정시키는",
    engDef: "making someone feel less worried about something",
    tip: "calm down(진정해~)! 파스텔 블루처럼 마음을 포근하게 가라앉혀주는 '진정시키는'! 🌿",
    example: "Soft piano music has a calming effect."
  },
  {
    id: 14,
    word: "identity",
    pos: "명",
    meaning: "정체성",
    engDef: "the characteristics that make people different from others",
    tip: "아이돌 ID카드(신분증)처럼 '나는 누구인가'를 보여주는 나만의 고유한 '정체성'! 🆔",
    example: "Her artworks reflect her cultural identity."
  },
  {
    id: 15,
    word: "easel",
    pos: "명",
    meaning: "이젤 (화판 받침대)",
    engDef: "a wooden frame, usually with legs, that holds a picture",
    tip: "미술실에서 캔버스를 척 올려두고 그림 그리는 삼각 다리 나무틀 '이젤'! 🪵",
    example: "She placed a fresh canvas on the wooden easel."
  },
  {
    id: 16,
    word: "associate",
    pos: "동",
    meaning: "연관 짓다",
    engDef: "to connect something with something else in one's mind",
    tip: "사과를 보면 백설공주가 떠오르듯 머릿속에서 두 가지를 서로 '연관 짓다'! 🔗",
    example: "Many people associate yellow with happiness."
  },
  {
    id: 17,
    word: "figure",
    pos: "명",
    meaning: "모습, 형상 / 인물",
    engDef: "bodily shape or form especially of a person",
    tip: "피규어(인형)처럼 캔버스 위에 돋보이는 사람의 형태나 매력적인 '모습'! 🧍‍♀️",
    example: "A mysterious figure was standing in the painting."
  },
  {
    id: 18,
    word: "resemble",
    pos: "동",
    meaning: "닮다",
    engDef: "to look or seem like",
    tip: "엄마의 예쁜 눈매나 아름다운 풍경을 쏙 빼닮아 닮아 보이다! 👯‍♀️",
    example: "The girl resembles her mother very closely."
  },
  {
    id: 19,
    word: "transformative",
    pos: "형",
    meaning: "변화시키는",
    engDef: "causing a marked change in someone or something",
    tip: "트랜스포머(변신 로봇)처럼 삶과 생각을 멋지게 완전히 '변화시키는'! 🦋",
    example: "Art can have a transformative power on people's lives."
  },
  {
    id: 20,
    word: "stimulate",
    pos: "동",
    meaning: "자극하다",
    engDef: "to rouse to action or effort",
    tip: "감각과 상상력을 톡톡 건드려 호기심을 마구 샘솟게 '자극하다'! ⚡",
    example: "Creative activities stimulate your brain."
  },
  {
    id: 21,
    word: "interpret",
    pos: "동",
    meaning: "해석하다",
    engDef: "to decide what the intended meaning of something is",
    tip: "추상화를 보면서 '작가는 어떤 감정을 표현했을까?' 하고 나만의 의미로 '해석하다'! 🧐",
    example: "Different viewers interpret the artwork in different ways."
  },
  {
    id: 22,
    word: "century",
    pos: "명",
    meaning: "세기, 100년",
    engDef: "a period of 100 years",
    tip: "cent는 100(1센트, 센티미터)! 100년이라는 기나긴 한 '세기'! ⏳",
    example: "This painting was made in the 19th century."
  },
  {
    id: 23,
    word: "stone-faced",
    pos: "형",
    meaning: "돌처럼 굳은 표정의 얼굴인",
    engDef: "showing no emotion on one's face",
    tip: "stone(돌) + faced(얼굴) = 웃지도 찡그리지도 않는 무표정한 돌부처 얼굴! 🗿",
    example: "He remained stone-faced even after hearing the joke."
  },
  {
    id: 24,
    word: "norm",
    pos: "명",
    meaning: "일반적인 것, 표준",
    engDef: "standard or usual pattern",
    tip: "normal(정상적인, 평범한)의 뿌리! 사회에서 흔히 다들 따르는 '표준과 기준'! 📏",
    example: "Wearing masks became a new norm."
  },
  {
    id: 25,
    word: "photograph",
    pos: "동/명",
    meaning: "사진 찍다 / 사진",
    engDef: "to take a picture of someone or something",
    tip: "photo(빛) + graph(기록하다) = 빛을 담아내는 순간의 기록 '사진'! 📷",
    example: "He loves to photograph beautiful flowers."
  },
  {
    id: 26,
    word: "analyze",
    pos: "동",
    meaning: "분석하다",
    engDef: "to examine details carefully",
    tip: "그림의 구도와 명암, 기법을 하나하나 꼼꼼하게 뜯어보고 '분석하다'! 🔬",
    example: "The teacher asked us to analyze the painting."
  },
  {
    id: 27,
    word: "yearbook",
    pos: "명",
    meaning: "졸업 앨범",
    engDef: "a book published once a year recording school events",
    tip: "year(1년) + book(책) = 학창 시절 소중한 추억을 한 권에 담은 '졸업 앨범'! 🎓",
    example: "We took funny photos for our school yearbook."
  },
  {
    id: 28,
    word: "portrait",
    pos: "명",
    meaning: "초상화, 초상 사진",
    engDef: "a painting or drawing of a person's head and shoulders",
    tip: "모나리자처럼 사람의 얼굴과 표정을 정성스레 담아낸 인물화 '초상화'! 👩‍🎨",
    example: "The artist painted a lovely portrait of the girl."
  },
  {
    id: 29,
    word: "measure",
    pos: "동",
    meaning: "측정하다",
    engDef: "to find the size, quantity, etc. in standard units",
    tip: "줄자(tape measure)를 들고 길이와 크기를 정확하게 '측정하다'! 📐",
    example: "She measured the canvas before starting to paint."
  },
  {
    id: 30,
    word: "manners",
    pos: "명",
    meaning: "예의범절",
    engDef: "polite ways of treating other people",
    tip: "영화 킹스맨 명대사 'Manners maketh man'! 다정하고 바른 '예의범절'! 🙇‍♀️",
    example: "Good manners make everyone feel respected."
  },
  {
    id: 31,
    word: "demand",
    pos: "동",
    meaning: "요구하다",
    engDef: "to make a very strong request for something",
    tip: "단호하고 당당하게 원하는 것을 달라고 강력하게 '요구하다'! ✊",
    example: "The audience demanded an encore performance."
  },
  {
    id: 32,
    word: "mean",
    pos: "형/동",
    meaning: "비열한, 못된 / 의미하다",
    engDef: "unkind / to have a specific meaning",
    tip: "영화 퀸카로 살아남는 법(Mean Girls)의 못되고 짓궂은, 또는 어떤 뜻을 '의미하다'! 👿",
    example: "Don't be mean to your classmates."
  },
  {
    id: 33,
    word: "spread",
    pos: "명/동",
    meaning: "확산, 퍼짐 / 펼치다, 퍼지다",
    engDef: "to cover a larger area or open out",
    tip: "빵에 잼을 넓게 바르듯 향기와 색이 사방으로 활짝 '퍼지다, 펼치다'! 🍞",
    example: "Kind words spread joy quickly."
  },
  {
    id: 34,
    word: "launch",
    pos: "동",
    meaning: "시작하다, 착수하다, 출시하다",
    engDef: "to start an activity, especially an organized one",
    tip: "로켓을 슝 발사하듯 새로운 멋진 프로젝트나 전시회를 야심차게 '시작하다'! 🚀",
    example: "The museum will launch a special art tour."
  },
  {
    id: 35,
    word: "celebration",
    pos: "명",
    meaning: "기념, 축하",
    engDef: "a special event organized to celebrate something",
    tip: "생일 파티나 전시 오프닝처럼 풍선 불고 다 같이 기뻐하는 '축하 행사'! 🎉",
    example: "They held a celebration for the grand opening."
  },
  {
    id: 36,
    word: "capture",
    pos: "동",
    meaning: "포착하다, 담아내다",
    engDef: "to record or catch something successfully",
    tip: "화면 캡처하듯 마음을 흔드는 찰나의 아름다운 감정과 순간을 사진에 쏙 '포착하다'! 📸",
    example: "Her drawing captured the gentle evening sunlight."
  },
  {
    id: 37,
    word: "on one's own",
    pos: "숙어",
    meaning: "혼자서",
    engDef: "by oneself, alone",
    tip: "남에게 기대지 않고 스스로 내 힘으로 씩씩하게 '혼자서'! 🌟",
    example: "She finished the huge oil painting on her own."
  },
  {
    id: 38,
    word: "bring up",
    pos: "숙어",
    meaning: "~을 불러일으키다, 화제를 꺼내다",
    engDef: "to mention a subject or cause to appear",
    tip: "마음속 깊은 곳에 있던 옛 기억이나 흥미진진한 이야기를 수면 위로 쑥 '꺼내다'! 🗣️",
    example: "The old song brought up sweet childhood memories."
  },
  {
    id: 39,
    word: "take ~ for granted",
    pos: "숙어",
    meaning: "~을 당연하게 여기다",
    engDef: "to fail to appreciate properly",
    tip: "언제나 곁에 있는 맑은 공기나 가족의 사랑을 소중함 없이 '당연하게 여기다'! 🥺",
    example: "We should never take good friends for granted."
  },
  {
    id: 40,
    word: "follow suit",
    pos: "숙어",
    meaning: "남이 한 대로 따라 하다",
    engDef: "to do the same thing that someone else has just done",
    tip: "카드 게임에서 앞사람 패를 따라 내듯, 앞서간 사람의 행동을 벤치마킹해 '따라 하다'! 🐾",
    example: "When she took off her shoes, everyone followed suit."
  }
];
