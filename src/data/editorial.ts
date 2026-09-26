/**
 * 피드와 클래스 하단에 걸리는 읽을거리 — 칼럼, 광고 예시, 준비물 목록.
 *
 * 전부 정적 데이터다. 학부모 계정이 없는 지금은 피드를 CMS로 만들 이유가 없고,
 * 파일럿 팀이 생기면 그 팀의 코치가 쓴 글이 이 자리를 대신한다. 그때까지 이 파일은
 * "피드가 채워지면 어떤 모양인가"를 보여주는 견본이다.
 *
 * 칼럼은 일반적인 정보만 담는다. 부상·영양 글은 진단이나 처방처럼 읽히지 않게
 * 썼고, 몸에 관한 글은 전부 끝에 전문가 상담을 권한다.
 *
 * 광고는 전부 가상 브랜드다. 실제 광고주가 없는 상태에서 실제 브랜드 이름을
 * 쓰면 제휴처럼 보이므로, 카드마다 "광고 예시 · 가상 브랜드"를 붙인다.
 */

export type Audience = 'parent' | 'player' | 'coach';

export const AUDIENCE_LABEL: Record<Audience, string> = {
  parent: '학부모',
  player: '선수',
  coach: '코치',
};

/** Which illustration `ArticleArt` draws. */
export type ArtVariant =
  'pitch' | 'ball' | 'floodlight' | 'bottle' | 'moon' | 'boot' | 'bench' | 'plate' | 'heel';

export interface ArticleSection {
  heading: string;
  paragraphs: string[];
  points?: string[];
  /** A highlighted box under the section — a tip, or a warning. */
  note?: { tone: 'tip' | 'caution'; text: string };
}

export interface Article {
  id: string;
  /** Small tracked label, e.g. "COACHING NOTES". */
  kicker: string;
  /** Korean category shown on list rows. */
  category: string;
  title: string;
  dek: string;
  audience: Audience[];
  minutes: number;
  art: ArtVariant;
  sections: ArticleSection[];
  /** Shown under the body for anything touching the body or health. */
  medical?: boolean;
}

export const ARTICLES: Article[] = [
  {
    id: 'scan-before-touch',
    kicker: 'COACHING NOTES / 01',
    category: '코칭 노트',
    title: '좋은 터치의 시작은,\n공을 보기 전.',
    dek: '첫 터치가 좋은 선수는 공이 오기 전에 이미 주변을 봤습니다. 집에서도 연습할 수 있는 "고개 들기" 이야기.',
    audience: ['player', 'parent'],
    minutes: 3,
    art: 'ball',
    sections: [
      {
        heading: '받기 전에 한 번, 오는 동안 한 번',
        paragraphs: [
          '공을 잘 받는 선수와 그렇지 않은 선수의 차이는 발보다 눈에서 먼저 납니다. 패스가 오기 전에 고개를 들어 동료와 상대, 빈 공간을 확인해 둔 선수는 공이 발에 닿는 순간 이미 다음 동작을 알고 있습니다.',
          '수업에서는 이것을 "스캔"이라고 부릅니다. 동료가 공을 차기 직전에 한 번, 공이 굴러오는 동안 한 번 — 어깨 너머로 짧게 보는 습관입니다.',
        ],
      },
      {
        heading: '집에서 하는 5분 연습',
        paragraphs: ['벽이나 보호자와 가볍게 패스를 주고받으면서 할 수 있습니다.'],
        points: [
          '보호자가 아이 뒤쪽에서 손가락을 1~5개 펼쳐 보인다',
          '아이는 공을 받기 전에 뒤를 보고 숫자를 소리 내어 말한다',
          '숫자를 맞힌 뒤에 공을 받는다 — 순서가 핵심이다',
          '익숙해지면 손가락 대신 색깔 카드, 왼쪽·오른쪽 방향으로 바꾼다',
        ],
      },
      {
        heading: '저학년은 "봤다"는 것만 칭찬해 주세요',
        paragraphs: [
          '처음에는 고개를 드는 순간 공을 놓치는 일이 많습니다. 정상입니다. 이 시기에는 터치가 좋았는지보다 고개를 들었는지를 먼저 칭찬해 주세요. 습관이 먼저 생기고, 터치는 그 뒤에 따라옵니다.',
        ],
        note: {
          tone: 'tip',
          text: '경기 영상을 볼 때 공 대신 아이의 고개만 따라가 보세요. 공이 오기 전 몇 번 주변을 보는지 세어 보면 성장이 숫자로 보입니다.',
        },
      },
    ],
  },
  {
    id: 'ride-home',
    kicker: 'PARENT GUIDE / 02',
    category: '학부모 가이드',
    title: '경기 끝난 차 안,\n가장 좋은 첫마디.',
    dek: '분석도, 격려도 아닌 한 문장. 경기 직후 아이가 가장 듣고 싶어 하는 말에 대하여.',
    audience: ['parent'],
    minutes: 4,
    art: 'floodlight',
    sections: [
      {
        heading: '경기 직후, 아이는 아직 경기장에 있습니다',
        paragraphs: [
          '이겼든 졌든, 경기가 끝나고 한 시간 정도는 아이의 감정이 정리되지 않은 상태입니다. 이때 듣는 "그때 왜 패스 안 했어?"는 조언이 아니라 채점으로 들립니다.',
          '코치에게 이미 한 번 피드백을 받은 아이에게 보호자의 두 번째 피드백은 방향이 다를 수도 있습니다. 두 목소리가 다르면 아이는 누구의 말을 따라야 할지 몰라 경기장에서 머뭇거리게 됩니다.',
        ],
      },
      {
        heading: '추천하는 첫마디',
        paragraphs: ['결과나 플레이가 아니라, 아이 자체에 대한 말이 가장 오래 남습니다.'],
        points: [
          '"오늘 네가 뛰는 거 보는 게 참 좋았어."',
          '"배고프지? 뭐 먹을까?"',
          '"오늘 제일 재밌었던 순간이 뭐야?" — 아이가 먼저 말하고 싶어 할 때만',
        ],
      },
      {
        heading: '이야기는 아이가 꺼낼 때',
        paragraphs: [
          '경기 이야기는 아이가 먼저 꺼낼 때 시작하는 편이 좋습니다. 다음 날쯤 아이가 스스로 "그때 그 슛 말이야" 하고 말을 꺼내면, 그때는 판단보다 질문으로 들어 주세요. "너는 어떻게 하고 싶었어?"',
          '결과 대신 노력과 태도를 짚어 주세요. "끝까지 뛰어서 수비한 거 봤어"는 이기고 지는 것과 상관없이 아이가 다음 경기에서도 다시 할 수 있는 일에 대한 칭찬입니다.',
        ],
        note: {
          tone: 'tip',
          text: '코치와 이야기가 필요하다면 경기 직후보다 하루가 지난 뒤, 아이가 없는 자리에서 연락하는 것이 서로에게 편합니다.',
        },
      },
    ],
  },
  {
    id: 'match-day-meal',
    kicker: 'NUTRITION / 03',
    category: '영양',
    title: '경기 날 식사,\n세 시간 전이 기준.',
    dek: '무엇을 먹느냐만큼 언제 먹느냐가 중요합니다. 경기 전후 식사 시간표.',
    audience: ['parent', 'player'],
    minutes: 3,
    art: 'plate',
    medical: true,
    sections: [
      {
        heading: '경기 2~3시간 전: 든든하지만 가볍게',
        paragraphs: [
          '주 에너지원은 탄수화물입니다. 밥, 국수, 빵 같은 익숙한 음식에 달걀이나 두부처럼 소화가 편한 단백질을 곁들이면 충분합니다.',
          '튀김이나 기름진 고기, 매운 음식은 소화에 시간이 걸려 뛰는 동안 배가 불편할 수 있습니다.',
        ],
      },
      {
        heading: '경기 1시간 전: 간식만',
        paragraphs: ['식사 시간을 놓쳤다면 작고 소화가 빠른 간식으로 대신합니다.'],
        points: ['바나나 반 개~한 개', '작은 주먹밥', '크래커 몇 조각'],
      },
      {
        heading: '경기 후: 회복은 먹는 것부터',
        paragraphs: [
          '경기가 끝나고 너무 늦지 않게 탄수화물과 단백질이 함께 든 음식을 먹으면 회복에 도움이 됩니다. 우유 한 잔과 샌드위치, 김밥 같은 것으로 충분합니다.',
        ],
        note: {
          tone: 'caution',
          text: '경기 날에는 처음 먹어 보는 음식을 피하세요. 평소 잘 먹던 음식이 가장 안전합니다. 알레르기나 식이 제한이 있다면 전문가와 상의해 주세요.',
        },
      },
    ],
  },
  {
    id: 'hydration',
    kicker: 'PLAYER CARE / 04',
    category: '컨디션',
    title: '목마르기 전에\n마시는 연습.',
    dek: '갈증은 이미 늦었다는 신호입니다. 훈련 전·중·후 물 마시기와 더위 속 위험 신호.',
    audience: ['player', 'parent', 'coach'],
    minutes: 3,
    art: 'bottle',
    medical: true,
    sections: [
      {
        heading: '언제, 얼마나',
        paragraphs: [
          '아이들은 뛰는 데 집중하면 목마름을 잘 느끼지 못합니다. 그래서 "목마르면 마셔"보다 "쉬는 시간마다 마셔"가 더 효과적입니다.',
        ],
        points: [
          '훈련 전: 집을 나서기 전 물 한 컵',
          '훈련 중: 15~20분마다 몇 모금씩',
          '훈련 후: 소변 색이 연한 레몬색으로 돌아올 때까지 조금씩',
        ],
      },
      {
        heading: '물이면 충분합니다',
        paragraphs: [
          '한 시간 안팎의 훈련이라면 물로 충분합니다. 한여름에 오래 뛰는 날이나 땀을 많이 흘리는 경우에만 스포츠음료를 고려해도 됩니다. 탄산음료와 카페인 음료는 훈련용으로 맞지 않습니다.',
        ],
      },
      {
        heading: '더위 속 위험 신호',
        paragraphs: [
          '아래 증상이 보이면 즉시 운동을 멈추고 그늘에서 쉬게 한 뒤, 코치에게 알려 주세요.',
        ],
        points: [
          '두통이나 어지러움',
          '메스꺼움, 구토',
          '평소보다 심한 피로, 얼굴이 창백하거나 지나치게 붉음',
        ],
        note: {
          tone: 'caution',
          text: '의식이 흐려지거나 말이 어눌해지면 응급 상황입니다. 바로 119에 연락하세요.',
        },
      },
    ],
  },
  {
    id: 'sleep',
    kicker: 'RECOVERY / 05',
    category: '회복',
    title: '잠도 훈련이다.',
    dek: '실력은 운동장에서 쌓이고, 몸은 잠자는 동안 자랍니다. 연령별 권장 수면 시간과 저녁 훈련 후 잠드는 법.',
    audience: ['parent', 'player'],
    minutes: 3,
    art: 'moon',
    medical: true,
    sections: [
      {
        heading: '몇 시간이면 될까요',
        paragraphs: [
          '미국수면의학회(AASM)는 6~12세 어린이에게 하루 9~12시간, 13~18세 청소년에게 8~10시간의 수면을 권장합니다. 훈련이 있는 날이라고 더 줄여도 되는 시간이 아닙니다.',
        ],
      },
      {
        heading: '저녁 훈련 후 잠이 안 올 때',
        paragraphs: [
          '저녁에 뛰고 오면 몸이 한동안 각성된 상태라 바로 잠들기 어렵습니다. 잠들기 전 한 시간을 "내려가는 시간"으로 만들어 주세요.',
        ],
        points: [
          '미지근한 물로 샤워',
          '잠들기 1시간 전부터 화면(휴대폰·태블릿) 끄기',
          '방은 어둡고 서늘하게',
          '주말에도 일어나는 시간을 크게 바꾸지 않기',
        ],
      },
      {
        heading: '경기 전날 밤보다 그 전 며칠',
        paragraphs: [
          '경기 전날 긴장해서 잠을 설치는 것은 흔한 일이고, 하룻밤 정도는 경기력에 큰 영향을 주지 않는 경우가 많습니다. 더 중요한 것은 그 주 내내 충분히 잤는지입니다. 전날 밤 "빨리 자야 해"라는 압박이 오히려 잠을 방해할 수 있습니다.',
        ],
      },
    ],
  },
  {
    id: 'heel-pain',
    kicker: 'PLAYER CARE / 06',
    category: '부상 예방',
    title: '성장기 뒤꿈치 통증,\n참고 뛰지 않기.',
    dek: '초등 고학년 선수에게 흔한 뒤꿈치·무릎 아래 통증. 성장통으로 넘기기 전에 알아둘 것.',
    audience: ['parent', 'coach'],
    minutes: 4,
    art: 'heel',
    medical: true,
    sections: [
      {
        heading: '왜 이 나이에 자주 생기나요',
        paragraphs: [
          '뼈가 빠르게 자라는 시기에는 뼈 끝의 성장판 주변이 상대적으로 약합니다. 여기에 달리기와 점프가 반복되면 힘줄이 붙는 자리에 자극이 쌓여 통증이 생길 수 있습니다.',
          '축구를 하는 초등 고학년~중학생에게는 뒤꿈치 뒤쪽이나 무릎 바로 아래가 아프다고 하는 경우가 자주 있습니다.',
        ],
      },
      {
        heading: '이런 모습이 보이면',
        paragraphs: ['아이가 말로 표현하지 않아도 행동으로 먼저 보이는 경우가 많습니다.'],
        points: [
          '훈련 후 뒤꿈치를 들고 까치발로 걷는다',
          '운동 뒤 절뚝이다가 쉬면 나아진다',
          '무릎 아래 뼈가 튀어나온 부분을 누르면 아파한다',
        ],
      },
      {
        heading: '집에서 할 수 있는 것',
        paragraphs: [
          '통증이 있는 동안에는 점프와 전력 질주를 줄이고, 운동 후 냉찜질을 해 주세요. 종아리와 허벅지 앞쪽 스트레칭이 도움이 되는 경우가 많습니다. 다만 정확한 원인과 운동량 조절은 반드시 진료를 통해 정해야 합니다.',
        ],
        note: {
          tone: 'caution',
          text: '붓기가 심하거나, 밤에 자다가도 아프거나, 열이 함께 나거나, 체중을 싣지 못할 정도라면 성장통으로 넘기지 말고 바로 병원(정형외과) 진료를 받으세요.',
        },
      },
    ],
  },
  {
    id: 'ten-minute-touch',
    kicker: 'HOME TRAINING / 07',
    category: '홈 트레이닝',
    title: '하루 10분,\n집 앞에서 하는 볼 터치.',
    dek: '넓은 운동장이 없어도 됩니다. 공 하나와 벽 하나로 끝나는 양발 루틴.',
    audience: ['player'],
    minutes: 2,
    art: 'pitch',
    sections: [
      {
        heading: '10분 루틴',
        paragraphs: [
          '매일 조금씩이 주말에 몰아서 한 시간보다 낫습니다. 양발을 똑같이 쓰는 것이 규칙입니다.',
        ],
        points: [
          '1분 — 발바닥으로 공 굴리기 (좌우, 앞뒤)',
          '1분 — 토탭: 공 위를 양발로 번갈아 가볍게 치기',
          '3분 — 벽 패스: 오른발 인사이드 30번, 왼발 30번',
          '3분 — 신발 두 짝을 콘 삼아 8자 드리블',
          '2분 — 저글링 최고 기록 도전',
        ],
      },
      {
        heading: '기록을 남기면 계속하게 됩니다',
        paragraphs: [
          '저글링 최고 기록, 벽 패스 30번에 걸린 시간처럼 숫자로 남길 수 있는 것은 달력에 적어 두세요. 어제의 나와 비교하는 것이 가장 오래가는 동기입니다.',
        ],
        note: {
          tone: 'tip',
          text: '약한 발로 먼저 시작하세요. 힘이 남아 있을 때 해야 제대로 된 동작이 몸에 남습니다.',
        },
      },
    ],
  },
  {
    id: 'bench-day',
    kicker: 'MINDSET / 08',
    category: '멘탈',
    title: '벤치에 앉은 날,\n해줄 수 있는 것.',
    dek: '출전 시간이 적었던 날, 아이의 실망을 성장의 재료로 바꾸는 대화법.',
    audience: ['parent', 'coach'],
    minutes: 4,
    art: 'bench',
    sections: [
      {
        heading: '실망은 자연스러운 감정입니다',
        paragraphs: [
          '많이 뛰고 싶었던 날 벤치에 오래 앉아 있었다면 속상한 게 당연합니다. "괜찮아, 다음에 뛰면 돼"로 서둘러 덮기보다 "많이 뛰고 싶었지"라고 먼저 인정해 주세요.',
        ],
      },
      {
        heading: '벤치에서 본 것을 물어봐 주세요',
        paragraphs: [
          '벤치는 경기 전체를 가장 잘 볼 수 있는 자리이기도 합니다. "밖에서 보니까 우리 팀은 어디가 비었던 것 같아?" 같은 질문은 아이를 관중이 아니라 팀의 일원으로 만들어 줍니다.',
        ],
      },
      {
        heading: '코치와의 대화는 이렇게',
        paragraphs: [
          '출전 시간에 대해 궁금하다면 대화는 충분히 가능하고, 좋은 코치라면 반기는 일입니다.',
        ],
        points: [
          '경기 직후가 아니라 하루 정도 지난 뒤에',
          '"왜 안 내보냈나요"보다 "무엇을 더 연습하면 좋을까요"로',
          '가능하면 아이가 직접 코치에게 묻도록 돕기',
        ],
        note: {
          tone: 'tip',
          text: '아이 앞에서 코치나 다른 선수를 평가하는 말은 피해 주세요. 아이는 그 말을 들은 채로 다음 훈련에 나가야 합니다.',
        },
      },
    ],
  },
  {
    id: 'first-boots',
    kicker: 'GEAR GUIDE / 09',
    category: '용품',
    title: '첫 축구화,\n이렇게 고르세요.',
    dek: '금방 크니까 넉넉하게? 첫 축구화에서 가장 흔한 실수와 구장별 스터드 고르는 법.',
    audience: ['parent', 'player'],
    minutes: 3,
    art: 'boot',
    sections: [
      {
        heading: '구장부터 확인하세요',
        paragraphs: [
          '축구화 바닥(스터드)은 뛰는 바닥에 맞춰 고릅니다. 주로 훈련하는 구장이 기준입니다.',
        ],
        points: [
          'FG — 천연 잔디용. 스터드가 길고 날카로운 편',
          'AG — 인조 잔디용. 짧고 둥근 스터드가 많이 박힌 형태',
          'TF — 풋살장·짧은 인조 잔디용. 작은 고무 돌기가 촘촘한 형태',
        ],
      },
      {
        heading: '사이즈는 딱 맞게',
        paragraphs: [
          '"금방 크니까" 한두 치수 큰 신발을 사면 신발 안에서 발이 밀려 물집이 생기고, 방향을 바꿀 때 발목에 무리가 갑니다. 엄지발가락 끝에 손가락 반 마디(약 0.5~1cm) 정도 여유가 있으면 적당합니다.',
        ],
        points: [
          '발이 붓는 오후에 신어 보기',
          '축구 양말을 신고 신어 보기',
          '양발 모두 신고 매장 안을 걸어 보기',
        ],
      },
      {
        heading: '길들이기',
        paragraphs: [
          '새 축구화는 바로 경기에 신지 말고, 두세 번 연습 때 먼저 신어 발에 맞춰 주세요.',
        ],
      },
    ],
  },
];

export function findArticle(id: string): Article | null {
  return ARTICLES.find((a) => a.id === id) ?? null;
}

/** Articles sharing an audience with `article`, nearest first, excluding it. */
export function relatedTo(article: Article, count = 2): Article[] {
  const shares = (a: Article) => a.audience.some((x) => article.audience.includes(x));
  const index = ARTICLES.findIndex((a) => a.id === article.id);
  const ordered = [...ARTICLES.slice(index + 1), ...ARTICLES.slice(0, index)];
  return ordered.filter(shares).slice(0, count);
}

/** One per day, so the class tab's teaser changes without anyone editing it. */
export function articleOfTheDay(date: string): Article {
  const day = Number(date.replace(/-/g, '')) || 0;
  return ARTICLES[day % ARTICLES.length];
}

// ---------------------------------------------------------------------------
// 광고 예시 — 브랜드 스토리
// ---------------------------------------------------------------------------

export interface BrandStory {
  id: string;
  /** Segment label. */
  tab: string;
  kicker: string;
  headline: string;
  body: string;
  brand: string;
  /** Tailwind classes for the card surface and its text. */
  surface: string;
  ink: 'dark' | 'light';
}

export const BRAND_STORIES: BrandStory[] = [
  {
    id: 'care',
    tab: '선수 케어',
    kicker: 'PLAYER CARE',
    headline: '뛰는 날만큼,\n돌보는 날도.',
    body: '우리 아이의 컨디션을 묻는 시간.\n보호자와 함께하는 스포츠 상담 안내.',
    brand: '온필드 정형외과',
    surface: 'bg-gradient-to-br from-[#EEF3F2] via-[#E3ECEB] to-[#B9D3D8]',
    ink: 'dark',
  },
  {
    id: 'meal',
    tab: '팀 식사',
    kicker: 'TEAM MEAL',
    headline: '경기 세 시간 전,\n가볍게 든든하게.',
    body: '훈련 일정에 맞춰 준비하는 단체 도시락.\n기름기는 덜고, 탄수화물은 충분히.',
    brand: '그린킥 키친',
    surface: 'bg-gradient-to-br from-[#F7F1E6] via-[#F1E6D2] to-[#E2C9A3]',
    ink: 'dark',
  },
  {
    id: 'gear',
    tab: '스포츠',
    kicker: 'GEAR',
    headline: '처음 신는 축구화는,\n발에 맞춰서.',
    body: '구장별 스터드 상담부터 사이즈 측정까지.\n성장기 발을 위한 피팅 데이.',
    brand: '스트라이드 풋웨어',
    surface: 'bg-gradient-to-br from-[#0E1310] via-[#10241A] to-[#00563A]',
    ink: 'light',
  },
  {
    id: 'trip',
    tab: '팀 여행',
    kicker: 'AWAY DAYS',
    headline: '원정 경기,\n이동까지 팀으로.',
    body: '대회 일정에 맞춘 전세 버스와 숙소.\n보호자 동반 좌석까지 한 번에.',
    brand: '원정버스 투어',
    surface: 'bg-gradient-to-br from-[#E8EEF6] via-[#DCE5F0] to-[#A9BFD9]',
    ink: 'dark',
  },
];

// ---------------------------------------------------------------------------
// FC GROWTH PICKS — 주말 축구 가방
// ---------------------------------------------------------------------------

export interface KitPick {
  id: string;
  label: string;
  detail: string;
}

export const KIT_PICKS: KitPick[] = [
  { id: 'water', label: '물병', detail: '500ml 이상, 이름 스티커 붙여서' },
  { id: 'shin', label: '정강이 보호대', detail: '연습 경기에도 꼭' },
  { id: 'socks', label: '여벌 양말', detail: '비 오는 날엔 한 켤레 더' },
  { id: 'towel', label: '작은 수건', detail: '땀 닦기, 벤치 깔개 겸용' },
  { id: 'snack', label: '가벼운 간식', detail: '바나나, 작은 주먹밥' },
  { id: 'season', label: '계절 준비물', detail: '여름엔 모자·선크림, 겨울엔 넥워머' },
];
