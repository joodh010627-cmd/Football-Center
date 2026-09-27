/**
 * The standard session library — ships with the app, same for every academy.
 *
 * A session is one goal plus the blocks that serve it. They are filed under the
 * five abilities of the growth pentagon, so "a session for passing" is found by
 * opening 기술, not by knowing which track and which week a class is on.
 *
 * Provenance matters here. Everything below was written for FC GROWTH from
 * common youth-coaching practice (small-sided games, rondos, 1v1 channels). It
 * is **not** a federation's material and must not be labelled as one. When a
 * licensed library (KFA or otherwise) is obtained, it goes in as another set of
 * `standard` rows with its own `SOURCE_LABEL`, and nothing else changes.
 *
 * Ids are prefixed `std-` so they can never collide with a centre's uuids, and
 * so persistence can tell a library row from a database row at a glance.
 */

import type { AgeGroup, Ability, SessionTemplate, TrainingBlock, TrainingCategory } from '@/types';

export const SOURCE_LABEL = {
  standard: 'FC GROWTH 표준',
  center: '우리 센터',
} as const;

export const isStandardId = (id: string | null | undefined): boolean =>
  typeof id === 'string' && id.startsWith('std-');

const ALL: AgeGroup[] = ['U7', 'U9', 'U11', 'U13', 'U15'];
const U9UP: AgeGroup[] = ['U9', 'U11', 'U13', 'U15'];
const U11UP: AgeGroup[] = ['U11', 'U13', 'U15'];

type BlockSeed = [
  id: string,
  title: string,
  category: TrainingCategory,
  ability: Ability,
  minutes: number,
  description: string,
  points: string[],
  equipment: string[],
  ages?: AgeGroup[],
];

// prettier-ignore
const BLOCKS: BlockSeed[] = [
  // --- 준비 ----------------------------------------------------------------
  ['std-w-ball', '볼 마스터리', 'warmup', 'technical', 10, '1인 1볼로 인사이드·솔·아웃사이드 터치를 번갈아 하며 제자리와 이동을 섞는다.', ['공을 몸 가까이', '양발을 번갈아', '고개를 들 때마다 칭찬'], ['공 1인 1개']],
  ['std-w-move', '동적 스트레칭 & 스텝', 'warmup', 'physical', 10, '마커 사이를 사이드스텝·백스텝·무릎 올리기로 왕복하고 마지막 한 번은 전력 질주.', ['발목부터 위로 순서대로', '마지막은 짧고 빠르게'], ['마커 8개']],
  ['std-w-rondo', '4대1 론도', 'warmup', 'tactical', 10, '사각형 안 4명이 패스를 돌리고 1명이 뺏는다. 뺏기면 실수한 선수가 술래.', ['두 터치 안에 처리', '받기 전 몸을 연다'], ['마커 4개', '공 2개'], U9UP],
  ['std-w-tag', '볼 꼬리잡기', 'warmup', 'mental', 10, '허리에 조끼를 꽂고 드리블하며 서로의 조끼를 뺏는다. 뺏겨도 바로 다시 참여.', ['뺏겨도 멈추지 않기', '공과 주변을 번갈아 보기'], ['조끼 인원수', '공 1인 1개']],
  ['std-w-names', '이름 부르며 패스', 'warmup', 'attitude', 10, '원을 만들고 받을 사람 이름을 부른 뒤 패스한다. 익숙해지면 공을 2개로 늘린다.', ['패스 전에 이름 먼저', '받는 사람은 손을 든다'], ['공 2개']],

  // --- 기술 ----------------------------------------------------------------
  ['std-t-gates', '패스 게이트', 'skill', 'technical', 15, '둘씩 짝을 지어 1m 폭 게이트 사이로 인사이드 패스. 1분 동안 통과한 게이트 수를 센다.', ['디딤발은 공 옆', '발목을 고정', '받는 사람 발 앞으로'], ['마커 20개', '공 2인 1개']],
  ['std-t-triangle', '삼각 패스 & 이동', 'skill', 'technical', 15, '삼각형 꼭짓점 3명이 패스 후 패스한 방향으로 이동한다. 방향을 바꿔 반복.', ['패스 후 바로 이동', '약한 발도 사용'], ['마커 3개', '공 1개'], U9UP],
  ['std-t-firsttouch', '첫 터치 방향 바꾸기', 'skill', 'technical', 15, '코치가 굴려준 공을 첫 터치로 좌우 마커 쪽으로 보낸 뒤 드리블 통과.', ['받기 전 어깨 너머 확인', '터치로 공을 앞에 둔다'], ['마커 6개', '공 5개']],
  ['std-t-turn', '받고 돌아서기', 'skill', 'technical', 15, '등 뒤에서 오는 패스를 받아 돌아서 반대편 게이트로 드리블. 수비는 소극적으로 시작.', ['받기 전 몸을 반쯤 연다', '먼 발로 받기'], ['마커 8개', '공 4개'], U9UP],
  ['std-t-dribble', '콘 드리블 & 속도 변화', 'skill', 'technical', 15, '지그재그 콘을 통과한 뒤 마지막 5m는 폭발적으로 가속한다.', ['작은 터치로 가까이', '마지막은 큰 터치로 가속'], ['콘 10개', '공 1인 1개']],
  ['std-t-1v1', '1대1 채널 돌파', 'skill', 'technical', 15, '폭 8m 채널에서 공격 1명이 수비 1명을 제치고 끝선 통과. 성공하면 공수 교대.', ['수비 앞에서 속도를 줄였다 올리기', '페인트 뒤 반대로'], ['마커 8개', '조끼'], U9UP],
  ['std-t-shoot', '슈팅 자세 익히기', 'skill', 'technical', 15, '정지한 공을 발등으로 차서 골대 구석 표적을 맞힌다. 거리를 조금씩 늘린다.', ['디딤발은 공 옆, 골대 방향', '발끝을 편다', '상체를 숙인다'], ['미니골대 2개', '공 8개']],
  ['std-t-finish', '패스 받아 마무리', 'skill', 'technical', 15, '측면에서 온 패스를 한 번 터치해 슈팅. 좌우를 번갈아 진행.', ['슈팅 전 골키퍼 위치 보기', '첫 터치는 슈팅하기 좋은 곳으로'], ['골대 1개', '공 10개', '마커 4개'], U9UP],

  // --- 전술 ----------------------------------------------------------------
  ['std-c-passmove', '패스하고 빈 곳으로', 'skill', 'tactical', 15, '4명이 사각형 네 모서리에서 패스 후 빈 모서리로 이동. 항상 한 모서리는 비워 둔다.', ['패스 후 멈추지 않기', '받을 수 있는 각도 만들기'], ['마커 4개', '공 1개'], U9UP],
  ['std-c-3v1', '3대1 지원 움직임', 'skill', 'tactical', 15, '작은 사각형에서 3명이 공을 지키고 1명이 뺏는다. 공을 가진 동료 양옆으로 선택지를 만든다.', ['공 가진 동료에게 두 방향 만들기', '수비 뒤에 숨지 않기'], ['마커 4개', '공 2개', '조끼'], U9UP],
  ['std-c-scan', '색깔 보고 받기', 'skill', 'tactical', 15, '코치가 받기 직전 색 마커를 들면, 받은 선수가 그 색 게이트로 돌아선다.', ['받기 전에 한 번 더 보기', '보고 나서 몸 방향 정하기'], ['색 마커 4종', '공 4개'], U9UP],
  ['std-c-zones', '세 구역 빌드업', 'skill', 'tactical', 15, '경기장을 세 구역으로 나누고 각 구역을 패스로 거쳐야만 득점할 수 있다.', ['넓게 서기', '뒤로 돌아가는 패스도 좋은 선택'], ['마커 12개', '미니골대 2개', '조끼'], U11UP],
  ['std-c-transition', '4대4 전환 게임', 'skill', 'tactical', 15, '공을 잃은 팀은 5초 안에 되찾으면 보너스 1점. 코치가 5초를 센다.', ['잃은 자리에서 바로 압박', '가장 가까운 선수가 먼저'], ['미니골대 2개', '조끼', '공 4개'], U11UP],
  ['std-c-defend1v1', '1대1 수비 자세', 'skill', 'tactical', 15, '공격이 드리블해 오면 수비는 반측면 자세로 한쪽 방향으로 몰아낸다.', ['공과 골대 사이에 서기', '발을 모으지 않기', '서두르지 않고 기다리기'], ['마커 8개', '공 4개'], U9UP],
  ['std-c-cover', '2대2 커버 수비', 'skill', 'tactical', 15, '수비 2명이 한 명은 압박, 한 명은 뒤에서 커버. 압박자가 뚫리면 역할이 바뀐다.', ['압박자와 커버의 거리 3~5m', '말로 역할 정하기'], ['마커 8개', '미니골대 2개', '조끼'], U11UP],

  // --- 피지컬 ---------------------------------------------------------------
  ['std-p-agility', '지그재그 방향 전환', 'skill', 'physical', 15, '마커 지그재그를 사이드스텝으로 통과한 뒤 공을 받아 드리블로 복귀.', ['무게중심을 낮게', '바깥 발로 밀어내기'], ['마커 12개', '공 4개']],
  ['std-p-react', '신호 반응 출발', 'skill', 'physical', 15, '코치의 손뼉·색 신호에 맞춰 3m 앞 마커까지 출발. 앉기·엎드리기 등 시작 자세를 바꾼다.', ['첫 세 걸음은 짧고 빠르게', '팔을 크게 흔들기'], ['마커 10개']],
  ['std-p-race', '공 쫓기 레이스', 'skill', 'physical', 15, '둘이 나란히 서 있다가 코치가 앞으로 찬 공을 먼저 잡는 쪽이 슈팅.', ['출발 반응 속도', '공과 상대 사이로 몸을 넣기'], ['미니골대 1개', '공 8개'], U9UP],
  ['std-p-balance', '한 발 밸런스', 'warmup', 'physical', 10, '한 발로 서서 공을 발바닥으로 굴리거나 짝과 공을 주고받는다.', ['디딤발 무릎을 살짝 굽히기', '시선은 앞으로'], ['공 2인 1개'], ALL],
  ['std-p-shield', '공 지키기', 'skill', 'physical', 15, '원 안에서 공을 가진 선수가 30초 동안 공을 지킨다. 수비는 어깨 접촉까지 허용.', ['상대와 공 사이에 몸 넣기', '팔로 거리 재기(밀지 않기)'], ['마커 8개', '공 4개'], U9UP],
  ['std-p-interval', '인터벌 점유 게임', 'game', 'physical', 20, '3분 경기 · 1분 휴식을 4회. 휴식 때 물 마시기.', ['휴식 시간 지키기', '마지막 판도 같은 강도로'], ['미니골대 2개', '조끼', '공 4개'], U11UP],

  // --- 멘탈 ----------------------------------------------------------------
  ['std-m-retry', '다시 도전하는 1대1', 'skill', 'mental', 15, '1대1에서 실패하면 바로 줄 맨 앞으로 돌아와 다른 방법으로 재도전.', ['실패 직후 칭찬하기', '두 번째는 다른 방법으로'], ['마커 8개', '조끼'], ALL],
  ['std-m-switch', '신호 바뀌면 과제 바꾸기', 'skill', 'mental', 15, '드리블 중 코치 신호가 바뀌면 멈추기·방향 전환·패스 중 새 과제를 즉시 수행.', ['신호를 끝까지 듣기', '틀려도 바로 다음 신호로'], ['마커 12개', '공 1인 1개'], ALL],
  ['std-m-challenge', '기술 챌린지', 'skill', 'mental', 15, '오늘의 기술 하나(예: 헛다리)를 정하고 각자 성공 횟수를 기록한다.', ['시도 자체를 칭찬', '실패한 이유를 스스로 말해 보기'], ['마커 8개', '공 1인 1개'], ALL],
  ['std-m-pressure', '압박 론도', 'skill', 'mental', 15, '5대2 론도에서 한 터치 제한 구간을 둔다. 서두르지 않고 선택하는 장면을 찾는다.', ['받기 전에 미리 보기', '안전한 패스도 좋은 선택'], ['마커 4개', '공 2개', '조끼'], U11UP],

  // --- 태도 ----------------------------------------------------------------
  ['std-a-call', '부르고 받기', 'skill', 'attitude', 15, '패스는 이름을 부른 선수에게만 줄 수 있다. 부르지 않고 받으면 공 넘김.', ['크고 짧게 부르기', '받을 준비된 자세로 부르기'], ['마커 4개', '공 2개', '조끼'], ALL],
  ['std-a-mission', '함께 푸는 패스 미션', 'skill', 'attitude', 15, '팀 전원이 한 번씩 공을 만져야 골 인정. 누가 아직 안 만졌는지 팀이 스스로 챙긴다.', ['덜 받은 동료 찾기', '성공하면 팀이 함께 기뻐하기'], ['미니골대 2개', '조끼', '공 2개'], ALL],
  ['std-a-roles', '역할 교대 게임', 'skill', 'attitude', 15, '매 2분마다 수비·공격·골키퍼 역할을 돌아가며 맡는다. 맡은 역할을 끝까지 수행한다.', ['역할 바뀌면 바로 위치로', '맡은 역할 끝까지'], ['미니골대 2개', '조끼'], ALL],
  ['std-a-explain', '설명하고 보여주기', 'skill', 'attitude', 10, '짝에게 오늘 배운 포인트 한 가지를 말로 설명하고 시범을 보인다.', ['말로 표현하기', '짝의 설명 끝까지 듣기'], ['공 2인 1개'], U9UP],

  // --- 게임 ----------------------------------------------------------------
  ['std-g-3pass', '3패스 후 득점 게임', 'game', 'technical', 20, '4대4. 패스 3번을 연결해야 골이 인정된다.', ['좁을 땐 넓게 서기', '공 없는 선수가 먼저 움직이기'], ['미니골대 2개', '조끼', '공 4개']],
  ['std-g-endzone', '엔드존 드리블 게임', 'game', 'technical', 20, '4대4. 상대 끝선 존에 드리블로 들어가 멈추면 득점.', ['1대1 기회에서 과감하게', '속도 변화'], ['마커 12개', '조끼', '공 4개']],
  ['std-g-2touch', '두 터치 경기', 'game', 'tactical', 20, '5대5. 한 사람이 최대 두 번까지만 터치할 수 있다.', ['받기 전에 다음 선택 정하기', '넓게 벌려 서기'], ['미니골대 2개', '조끼', '공 4개'], U9UP],
  ['std-g-small', '자유 미니게임', 'game', 'tactical', 20, '4대4 또는 5대5 자유 경기. 오늘 배운 장면이 나오면 코치가 멈추고 짧게 칭찬.', ['멈춤은 짧게', '오늘의 한 장면만 짚기'], ['미니골대 2개', '조끼', '공 4개']],
  ['std-g-bonus', '보너스 골 게임', 'game', 'mental', 20, '오늘 연습한 기술을 쓰고 넣은 골은 2점.', ['시도한 선수를 크게 칭찬', '실패해도 다시 시도'], ['미니골대 2개', '조끼', '공 4개']],
  ['std-g-talk', '말하는 팀 게임', 'game', 'attitude', 20, '4대4. 패스 전 이름을 부르지 않으면 상대 공. 득점하면 팀 전원이 하이파이브.', ['이름 부르기', '동료 실수에 격려'], ['미니골대 2개', '조끼', '공 4개']],
];

// prettier-ignore
type SessionSeed = [id: string, ability: Ability, title: string, goal: string, blockIds: string[], ages?: AgeGroup[]];

// prettier-ignore
const SESSIONS: SessionSeed[] = [
  // 기술
  ['std-s-pass', 'technical', '패스 정확도', '짧은 인사이드 패스를 동료 발 앞에 정확히 보낸다', ['std-w-ball', 'std-t-gates', 'std-t-triangle', 'std-g-3pass']],
  ['std-s-firsttouch', 'technical', '첫 터치', '받는 순간 다음 방향으로 공을 놓는다', ['std-w-ball', 'std-t-firsttouch', 'std-t-turn', 'std-g-2touch']],
  ['std-s-dribble', 'technical', '드리블 돌파', '1대1에서 속도를 바꿔 수비를 제친다', ['std-w-ball', 'std-t-dribble', 'std-t-1v1', 'std-g-endzone']],
  ['std-s-shoot', 'technical', '슈팅 마무리', '골대 구석을 보고 발등으로 마무리한다', ['std-w-move', 'std-t-shoot', 'std-t-finish', 'std-g-small']],
  // 전술
  ['std-s-passmove', 'tactical', '패스 후 움직임', '패스한 뒤 다시 받을 수 있는 자리로 움직인다', ['std-w-rondo', 'std-c-passmove', 'std-c-3v1', 'std-g-2touch'], U9UP],
  ['std-s-scan', 'tactical', '공간 인식', '받기 전에 주변을 보고 빈 공간을 찾는다', ['std-w-rondo', 'std-c-scan', 'std-c-zones', 'std-g-small'], U9UP],
  ['std-s-transition', 'tactical', '공수 전환', '공을 잃으면 5초 안에 되찾으려 압박한다', ['std-w-tag', 'std-c-3v1', 'std-c-transition', 'std-g-small'], U11UP],
  ['std-s-defend', 'tactical', '수비 위치', '공과 골대 사이에 서서 상대를 한쪽으로 몬다', ['std-w-move', 'std-c-defend1v1', 'std-c-cover', 'std-g-small'], U9UP],
  // 피지컬
  ['std-s-agility', 'physical', '민첩성', '멈추고 방향을 바꿀 때 중심을 잃지 않는다', ['std-p-balance', 'std-p-agility', 'std-t-dribble', 'std-g-endzone']],
  ['std-s-speed', 'physical', '첫 세 걸음', '신호에 맞춰 누구보다 빠르게 출발한다', ['std-w-move', 'std-p-react', 'std-p-race', 'std-g-small']],
  ['std-s-shield', 'physical', '밸런스와 몸싸움', '어깨가 부딪혀도 공을 지킨다', ['std-p-balance', 'std-p-shield', 'std-t-1v1', 'std-g-small'], U9UP],
  ['std-s-stamina', 'physical', '경기 체력', '경기 끝까지 같은 강도로 뛴다', ['std-w-move', 'std-c-3v1', 'std-p-interval'], U11UP],
  // 멘탈
  ['std-s-retry', 'mental', '실수 후 재도전', '실수 뒤 바로 다음 플레이에 다시 참여한다', ['std-w-tag', 'std-m-retry', 'std-g-bonus']],
  ['std-s-focus', 'mental', '집중 전환', '신호가 바뀌면 곧바로 새 과제에 집중한다', ['std-w-ball', 'std-m-switch', 'std-p-react', 'std-g-small']],
  ['std-s-confidence', 'mental', '자신감 있는 시도', '새로 배운 기술을 경기에서 먼저 시도한다', ['std-w-ball', 'std-m-challenge', 'std-t-1v1', 'std-g-bonus']],
  ['std-s-calm', 'mental', '압박 속 침착함', '수비가 다가와도 서두르지 않고 선택한다', ['std-w-rondo', 'std-m-pressure', 'std-g-2touch'], U11UP],
  // 태도
  ['std-s-talk', 'attitude', '소통', '이름을 부르고 공을 달라고 요청한다', ['std-w-names', 'std-a-call', 'std-g-talk']],
  ['std-s-teamwork', 'attitude', '협력', '동료와 함께 과제를 풀어낸다', ['std-w-names', 'std-a-mission', 'std-t-triangle', 'std-g-3pass']],
  ['std-s-roles', 'attitude', '책임감', '맡은 역할을 끝까지 해낸다', ['std-w-move', 'std-a-roles', 'std-g-small']],
  ['std-s-explain', 'attitude', '배운 것 나누기', '배운 포인트를 동료에게 말로 설명한다', ['std-w-ball', 'std-t-gates', 'std-a-explain', 'std-g-talk'], U9UP],
];

export const STANDARD_BLOCKS: TrainingBlock[] = BLOCKS.map(
  ([id, title, category, ability, durationMin, description, coachingPoints, equipment, ages]) => ({
    id,
    academyId: '',
    source: 'standard',
    title,
    category,
    ability,
    durationMin,
    description,
    coachingPoints,
    equipment,
    ageGroups: ages ?? ALL,
    usageCount: 0,
    isCoreCurriculum: true,
    status: 'published',
    proposedBy: null,
  }),
);

export const STANDARD_SESSIONS: SessionTemplate[] = SESSIONS.map(
  ([id, ability, title, goal, blockIds, ages]) => ({
    id,
    academyId: '',
    source: 'standard',
    ability,
    title,
    goal,
    blockIds,
    ageGroups: ages ?? ALL,
    status: 'published',
    proposedBy: null,
    reviewNote: '',
    usageCount: 0,
    createdAt: '',
    curriculumId: null,
  }),
);
