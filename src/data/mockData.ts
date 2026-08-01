/**
 * Mock relational dataset.
 *
 * Rosters, classes and blocks are hand-authored; the ~8 weeks of attendance
 * history is generated from a seeded PRNG so that churn signals, retention and
 * margin numbers all agree with each other. Regenerating gives identical data
 * on every load, which keeps the dashboard stable while demoing.
 */

import type {
  AttendanceLog,
  BehaviorTag,
  Class,
  Coach,
  CsAction,
  ID,
  ISODate,
  SessionPlan,
  Student,
  StudentStatus,
  TrainingBlock,
  Weekday,
} from '@/types';

// ---------------------------------------------------------------------------
// Date helpers — everything is relative to "now" so the demo never goes stale.
// ---------------------------------------------------------------------------

const NOW = new Date();

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysAgo(n: number): ISODate {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

export const TODAY: ISODate = toISODate(NOW);

/** Whole days between two ISO dates (a − b). */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

/** Deterministic PRNG (mulberry32) — same seed, same dataset, every run. */
function makeRandom(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ---------------------------------------------------------------------------
// Coaches
// ---------------------------------------------------------------------------

export const coaches: Coach[] = [
  {
    id: 'coach-1',
    name: '김도현',
    satisfactionScore: 4.7,
    certifications: ['AFC C급', '유소년 지도자 1급', '응급처치'],
  },
  {
    id: 'coach-2',
    name: '박서준',
    satisfactionScore: 4.4,
    certifications: ['AFC C급', '생활체육지도사 2급'],
  },
  {
    id: 'coach-3',
    name: '이지훈',
    satisfactionScore: 3.9,
    certifications: ['생활체육지도사 2급'],
  },
  {
    id: 'coach-4',
    name: '최유나',
    satisfactionScore: 4.8,
    certifications: ['AFC C급', '유소년 지도자 1급', 'GK 스페셜리스트'],
  },
];

/** The coach whose phone we're simulating in the Coach App. */
export const CURRENT_COACH_ID: ID = 'coach-1';

/** The owner account behind the Admin Dashboard. */
export const OWNER_ID: ID = 'owner-1';

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export const classes: Class[] = [
  {
    id: 'class-1',
    title: '킨더 U7 새싹반',
    coachId: 'coach-1',
    schedule: { days: [1, 3] as Weekday[], startTime: '16:00', durationMin: 55 },
    monthlyRevenue: 2_640_000,
    monthlyCost: 1_480_000,
    ageGroup: 'U7',
    capacity: 12,
    venue: '본원 A구장',
    retentionRate: 0.92,
  },
  {
    id: 'class-2',
    title: 'U9 챌린저반',
    coachId: 'coach-1',
    schedule: { days: [2, 4] as Weekday[], startTime: '17:00', durationMin: 55 },
    monthlyRevenue: 2_970_000,
    monthlyCost: 1_620_000,
    ageGroup: 'U9',
    capacity: 12,
    venue: '본원 A구장',
    retentionRate: 0.85,
  },
  {
    id: 'class-3',
    title: 'U11 스킬 아카데미',
    coachId: 'coach-2',
    schedule: { days: [1, 5] as Weekday[], startTime: '18:00', durationMin: 70 },
    monthlyRevenue: 3_520_000,
    monthlyCost: 2_050_000,
    ageGroup: 'U11',
    capacity: 14,
    venue: '본원 B구장',
    retentionRate: 0.78,
  },
  {
    id: 'class-4',
    title: 'U13 엘리트 트랙',
    coachId: 'coach-2',
    schedule: { days: [2, 4, 6] as Weekday[], startTime: '19:00', durationMin: 80 },
    monthlyRevenue: 4_200_000,
    monthlyCost: 2_980_000,
    ageGroup: 'U13',
    capacity: 14,
    venue: '풋살파크 3구장',
    retentionRate: 0.71,
  },
  {
    id: 'class-5',
    title: '주말 U9 클럽',
    coachId: 'coach-3',
    schedule: { days: [6] as Weekday[], startTime: '10:00', durationMin: 90 },
    monthlyRevenue: 1_800_000,
    monthlyCost: 1_540_000,
    ageGroup: 'U9',
    capacity: 16,
    venue: '풋살파크 1구장',
    retentionRate: 0.61,
  },
  {
    id: 'class-6',
    title: 'U15 피지컬 & GK',
    coachId: 'coach-4',
    schedule: { days: [3, 5] as Weekday[], startTime: '19:30', durationMin: 80 },
    monthlyRevenue: 2_400_000,
    monthlyCost: 1_260_000,
    ageGroup: 'U15',
    capacity: 10,
    venue: '본원 B구장',
    retentionRate: 0.88,
  },
];

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

/**
 * Attendance archetype used to generate history. `lastAttendanceDate`,
 * `status` and `churnScore` are all derived from the resulting logs — never
 * hand-set — so the Red Alert list is always defensible.
 */
type Archetype = 'solid' | 'steady' | 'wobbly' | 'fading' | 'ghost' | 'injured';

interface StudentSeed {
  name: string;
  classId: ID;
  parentName: string;
  archetype: Archetype;
  monthsEnrolled: number;
  monthlyFee: number;
  memo?: string;
}

const studentSeeds: StudentSeed[] = [
  // --- class-1 · 킨더 U7 새싹반 -------------------------------------------
  { name: '강하준', classId: 'class-1', parentName: '강민석', archetype: 'solid', monthsEnrolled: 14, monthlyFee: 220_000 },
  { name: '김서우', classId: 'class-1', parentName: '김예린', archetype: 'steady', monthsEnrolled: 9, monthlyFee: 220_000 },
  { name: '박도윤', classId: 'class-1', parentName: '박성호', archetype: 'solid', monthsEnrolled: 11, monthlyFee: 220_000 },
  { name: '이시온', classId: 'class-1', parentName: '이정민', archetype: 'wobbly', monthsEnrolled: 5, monthlyFee: 220_000, memo: '땀 알레르기 — 여름철 수분 보충 자주 필요' },
  { name: '최은우', classId: 'class-1', parentName: '최다혜', archetype: 'steady', monthsEnrolled: 7, monthlyFee: 220_000 },
  { name: '정라온', classId: 'class-1', parentName: '정우진', archetype: 'fading', monthsEnrolled: 4, monthlyFee: 220_000, memo: '태권도 학원과 시간 겹침 상담 있었음' },
  { name: '한지호', classId: 'class-1', parentName: '한소영', archetype: 'solid', monthsEnrolled: 16, monthlyFee: 220_000 },
  { name: '오시윤', classId: 'class-1', parentName: '오현수', archetype: 'steady', monthsEnrolled: 6, monthlyFee: 220_000 },
  { name: '윤태오', classId: 'class-1', parentName: '윤가영', archetype: 'wobbly', monthsEnrolled: 3, monthlyFee: 220_000 },
  { name: '배로운', classId: 'class-1', parentName: '배준영', archetype: 'solid', monthsEnrolled: 10, monthlyFee: 220_000 },

  // --- class-2 · U9 챌린저반 ----------------------------------------------
  { name: '김건우', classId: 'class-2', parentName: '김태윤', archetype: 'solid', monthsEnrolled: 18, monthlyFee: 270_000 },
  { name: '이준서', classId: 'class-2', parentName: '이혜진', archetype: 'steady', monthsEnrolled: 12, monthlyFee: 270_000 },
  { name: '박시우', classId: 'class-2', parentName: '박진욱', archetype: 'injured', monthsEnrolled: 8, monthlyFee: 270_000, memo: '발목 인대 염좌 — 6월 말부터 재활 중' },
  { name: '조하람', classId: 'class-2', parentName: '조민서', archetype: 'solid', monthsEnrolled: 15, monthlyFee: 270_000 },
  { name: '신도현', classId: 'class-2', parentName: '신유정', archetype: 'fading', monthsEnrolled: 6, monthlyFee: 270_000, memo: '형이 U13반 퇴원 후 출석 급감' },
  { name: '장예찬', classId: 'class-2', parentName: '장현우', archetype: 'steady', monthsEnrolled: 9, monthlyFee: 270_000 },
  { name: '문서준', classId: 'class-2', parentName: '문지아', archetype: 'wobbly', monthsEnrolled: 4, monthlyFee: 270_000 },
  { name: '임하율', classId: 'class-2', parentName: '임채원', archetype: 'solid', monthsEnrolled: 13, monthlyFee: 270_000 },
  { name: '서지안', classId: 'class-2', parentName: '서동혁', archetype: 'ghost', monthsEnrolled: 5, monthlyFee: 270_000, memo: '3주째 무단 결석 — 학부모 연락 두절' },
  { name: '노시현', classId: 'class-2', parentName: '노은별', archetype: 'steady', monthsEnrolled: 7, monthlyFee: 270_000 },
  { name: '황준혁', classId: 'class-2', parentName: '황수민', archetype: 'solid', monthsEnrolled: 11, monthlyFee: 270_000 },

  // --- class-3 · U11 스킬 아카데미 ----------------------------------------
  { name: '권민재', classId: 'class-3', parentName: '권상우', archetype: 'solid', monthsEnrolled: 21, monthlyFee: 320_000 },
  { name: '유하진', classId: 'class-3', parentName: '유선아', archetype: 'steady', monthsEnrolled: 14, monthlyFee: 320_000 },
  { name: '송재이', classId: 'class-3', parentName: '송기훈', archetype: 'fading', monthsEnrolled: 9, monthlyFee: 320_000, memo: '중학 입시 학원 시작 — 주 1회 전환 문의' },
  { name: '홍시온', classId: 'class-3', parentName: '홍보경', archetype: 'solid', monthsEnrolled: 17, monthlyFee: 320_000 },
  { name: '전우주', classId: 'class-3', parentName: '전민호', archetype: 'wobbly', monthsEnrolled: 6, monthlyFee: 320_000 },
  { name: '고은성', classId: 'class-3', parentName: '고아름', archetype: 'ghost', monthsEnrolled: 8, monthlyFee: 320_000, memo: '타 아카데미 이적 소문' },
  { name: '남시후', classId: 'class-3', parentName: '남지환', archetype: 'steady', monthsEnrolled: 10, monthlyFee: 320_000 },
  { name: '심규빈', classId: 'class-3', parentName: '심유경', archetype: 'solid', monthsEnrolled: 19, monthlyFee: 320_000 },
  { name: '양태윤', classId: 'class-3', parentName: '양승철', archetype: 'wobbly', monthsEnrolled: 5, monthlyFee: 320_000 },
  { name: '진하늘', classId: 'class-3', parentName: '진소라', archetype: 'steady', monthsEnrolled: 12, monthlyFee: 320_000 },
  { name: '표승우', classId: 'class-3', parentName: '표건희', archetype: 'injured', monthsEnrolled: 7, monthlyFee: 320_000, memo: '성장통 — 러닝 볼륨 조절 요청' },

  // --- class-4 · U13 엘리트 트랙 ------------------------------------------
  { name: '류지환', classId: 'class-4', parentName: '류경민', archetype: 'solid', monthsEnrolled: 24, monthlyFee: 380_000 },
  { name: '차은호', classId: 'class-4', parentName: '차보람', archetype: 'fading', monthsEnrolled: 11, monthlyFee: 380_000, memo: '주 3회 부담 호소 — 학업 병행 어려움' },
  { name: '주민성', classId: 'class-4', parentName: '주현빈', archetype: 'steady', monthsEnrolled: 16, monthlyFee: 380_000 },
  { name: '백승현', classId: 'class-4', parentName: '백지우', archetype: 'ghost', monthsEnrolled: 10, monthlyFee: 380_000, memo: '엘리트 선발 탈락 후 동기 저하' },
  { name: '허재원', classId: 'class-4', parentName: '허수진', archetype: 'solid', monthsEnrolled: 20, monthlyFee: 380_000 },
  { name: '구본우', classId: 'class-4', parentName: '구정한', archetype: 'wobbly', monthsEnrolled: 8, monthlyFee: 380_000 },
  { name: '진성민', classId: 'class-4', parentName: '진혜원', archetype: 'steady', monthsEnrolled: 13, monthlyFee: 380_000 },
  { name: '엄태현', classId: 'class-4', parentName: '엄지훈', archetype: 'solid', monthsEnrolled: 18, monthlyFee: 380_000 },

  // --- class-5 · 주말 U9 클럽 ---------------------------------------------
  { name: '천유안', classId: 'class-5', parentName: '천서윤', archetype: 'wobbly', monthsEnrolled: 4, monthlyFee: 150_000 },
  { name: '방시안', classId: 'class-5', parentName: '방규리', archetype: 'fading', monthsEnrolled: 3, monthlyFee: 150_000, memo: '주말 가족 일정과 상시 충돌' },
  { name: '소민준', classId: 'class-5', parentName: '소재현', archetype: 'steady', monthsEnrolled: 6, monthlyFee: 150_000 },
  { name: '탁이든', classId: 'class-5', parentName: '탁영주', archetype: 'ghost', monthsEnrolled: 3, monthlyFee: 150_000, memo: '체험 후 등록했으나 2주째 미출석' },
  { name: '하윤슬', classId: 'class-5', parentName: '하동민', archetype: 'solid', monthsEnrolled: 9, monthlyFee: 150_000 },
  { name: '봉재하', classId: 'class-5', parentName: '봉세영', archetype: 'wobbly', monthsEnrolled: 5, monthlyFee: 150_000 },
  { name: '설가온', classId: 'class-5', parentName: '설민아', archetype: 'fading', monthsEnrolled: 4, monthlyFee: 150_000 },
  { name: '단시우', classId: 'class-5', parentName: '단재훈', archetype: 'steady', monthsEnrolled: 7, monthlyFee: 150_000 },

  // --- class-6 · U15 피지컬 & GK ------------------------------------------
  { name: '오세훈', classId: 'class-6', parentName: '오정근', archetype: 'solid', monthsEnrolled: 22, monthlyFee: 400_000 },
  { name: '지한결', classId: 'class-6', parentName: '지미르', archetype: 'steady', monthsEnrolled: 15, monthlyFee: 400_000 },
  { name: '위도경', classId: 'class-6', parentName: '위나연', archetype: 'solid', monthsEnrolled: 19, monthlyFee: 400_000 },
  { name: '명현서', classId: 'class-6', parentName: '명수철', archetype: 'wobbly', monthsEnrolled: 6, monthlyFee: 400_000 },
  { name: '연준영', classId: 'class-6', parentName: '연가희', archetype: 'solid', monthsEnrolled: 17, monthlyFee: 400_000 },
  { name: '독고민', classId: 'class-6', parentName: '독고윤', archetype: 'steady', monthsEnrolled: 11, monthlyFee: 400_000 },
];

// ---------------------------------------------------------------------------
// Behaviour tags — the coach's entire vocabulary. No free text on mobile.
// ---------------------------------------------------------------------------

export const behaviorTags: BehaviorTag[] = [
  { id: 'tag-1', label: '#드리블우수', dimension: 'skill', polarity: 'positive' },
  { id: 'tag-2', label: '#패스정확', dimension: 'skill', polarity: 'positive' },
  { id: 'tag-3', label: '#슈팅과감', dimension: 'skill', polarity: 'positive' },
  { id: 'tag-4', label: '#퍼스트터치', dimension: 'skill', polarity: 'positive' },
  { id: 'tag-5', label: '#적극적수비', dimension: 'skill', polarity: 'positive' },
  { id: 'tag-6', label: '#시야확보', dimension: 'skill', polarity: 'positive' },

  { id: 'tag-7', label: '#끝까지집중', dimension: 'attitude', polarity: 'positive' },
  { id: 'tag-8', label: '#자신감상승', dimension: 'attitude', polarity: 'positive' },
  { id: 'tag-9', label: '#질문많음', dimension: 'attitude', polarity: 'positive' },
  { id: 'tag-10', label: '#즐겁게참여', dimension: 'attitude', polarity: 'positive' },

  { id: 'tag-11', label: '#팀워크좋음', dimension: 'teamwork', polarity: 'positive' },
  { id: 'tag-12', label: '#동생챙김', dimension: 'teamwork', polarity: 'positive' },
  { id: 'tag-13', label: '#리더십발휘', dimension: 'teamwork', polarity: 'positive' },
  { id: 'tag-14', label: '#격려하기', dimension: 'teamwork', polarity: 'positive' },

  { id: 'tag-15', label: '#체력향상', dimension: 'physical', polarity: 'positive' },
  { id: 'tag-16', label: '#스피드좋음', dimension: 'physical', polarity: 'positive' },
  { id: 'tag-17', label: '#밸런스안정', dimension: 'physical', polarity: 'positive' },

  { id: 'tag-18', label: '#컨디션저하', dimension: 'caution', polarity: 'watch' },
  { id: 'tag-19', label: '#집중력흔들림', dimension: 'caution', polarity: 'watch' },
  { id: 'tag-20', label: '#소극적참여', dimension: 'caution', polarity: 'watch' },
  { id: 'tag-21', label: '#통증호소', dimension: 'caution', polarity: 'watch' },
];

export const TAG_DIMENSION_LABEL: Record<BehaviorTag['dimension'], string> = {
  skill: '기술',
  attitude: '태도',
  teamwork: '팀워크',
  physical: '피지컬',
  caution: '주의',
};

// ---------------------------------------------------------------------------
// Training blocks — the drag-and-drop library
// ---------------------------------------------------------------------------

export const trainingBlocks: TrainingBlock[] = [
  // --- Warm-up -----------------------------------------------------------
  {
    id: 'block-w1',
    title: '콘 슬라럼 러닝',
    category: 'warmup',
    durationMin: 10,
    description: '콘 8개를 2m 간격으로 배치. 지그재그 러닝 → 사이드 스텝 → 백페달 3세트.',
    ageGroups: ['U7', 'U9', 'U11'],
    equipment: ['콘 8개'],
    usageCount: 142,
    isCoreCurriculum: true,
  },
  {
    id: 'block-w2',
    title: '술래잡기 볼 태그',
    category: 'warmup',
    durationMin: 10,
    description: '전원 공 소유 상태로 술래잡기. 심박수를 놀이로 올려 U7~U9 몰입도 확보.',
    ageGroups: ['U7', 'U9'],
    equipment: ['공 인원수', '마커 4개'],
    usageCount: 118,
    isCoreCurriculum: false,
  },
  {
    id: 'block-w3',
    title: '다이내믹 스트레칭 루틴',
    category: 'warmup',
    durationMin: 8,
    description: '레그 스윙 · 런지 워크 · 하이니 · 힙 오프너. 부상 예방 표준 루틴.',
    ageGroups: ['U11', 'U13', 'U15'],
    equipment: [],
    usageCount: 96,
    isCoreCurriculum: true,
  },
  {
    id: 'block-w4',
    title: '2인 1조 패스 릴레이',
    category: 'warmup',
    durationMin: 12,
    description: '10m 간격 인사이드 패스 → 원터치 전환. 좌우 발 균등 사용 강제.',
    ageGroups: ['U9', 'U11', 'U13'],
    equipment: ['공 2인당 1개'],
    usageCount: 87,
    isCoreCurriculum: true,
  },
  {
    id: 'block-w5',
    title: '반응 속도 컬러콘',
    category: 'warmup',
    durationMin: 10,
    description: '코치가 외친 색 콘으로 스프린트. 인지-반응 능력 자극.',
    ageGroups: ['U9', 'U11', 'U13', 'U15'],
    equipment: ['컬러콘 4색'],
    usageCount: 64,
    isCoreCurriculum: false,
  },
  {
    id: 'block-w6',
    title: 'GK 핸들링 워밍업',
    category: 'warmup',
    durationMin: 12,
    description: '캐칭 자세 · 로우 다이브 · 리바운드 처리. 골키퍼 전용.',
    ageGroups: ['U13', 'U15'],
    equipment: ['공 3개', '골대'],
    usageCount: 31,
    isCoreCurriculum: false,
  },

  // --- Skill -------------------------------------------------------------
  {
    id: 'block-s1',
    title: '드리블 돌파 B',
    category: 'skill',
    durationMin: 20,
    description: '1:1 상황에서 바디페인트 후 아웃사이드 터치 돌파. 수비수 반응 유도 후 가속.',
    ageGroups: ['U9', 'U11', 'U13'],
    equipment: ['콘 6개', '조끼'],
    usageCount: 134,
    isCoreCurriculum: true,
  },
  {
    id: 'block-s2',
    title: '코너킥 패턴 A',
    category: 'skill',
    durationMin: 20,
    description: '니어포스트 쇄도 + 세컨볼 대기 배치. 3가지 신호 약속.',
    ageGroups: ['U11', 'U13', 'U15'],
    equipment: ['공 5개', '마네킹 3개'],
    usageCount: 78,
    isCoreCurriculum: false,
  },
  {
    id: 'block-s3',
    title: '인사이드 패스 정확도',
    category: 'skill',
    durationMin: 18,
    description: '5m·10m·15m 게이트 통과 패스. 성공률 기록해 개인 지표화.',
    ageGroups: ['U7', 'U9', 'U11'],
    equipment: ['콘 12개', '공 인원수'],
    usageCount: 121,
    isCoreCurriculum: true,
  },
  {
    id: 'block-s4',
    title: '퍼스트터치 컨트롤',
    category: 'skill',
    durationMin: 20,
    description: '공중볼·바운드볼 받아 1터치로 진행 방향 전환. 좌우 발 교대.',
    ageGroups: ['U9', 'U11', 'U13', 'U15'],
    equipment: ['공 2인당 1개', '콘 4개'],
    usageCount: 109,
    isCoreCurriculum: true,
  },
  {
    id: 'block-s5',
    title: '슈팅 마무리 트레이닝',
    category: 'skill',
    durationMin: 22,
    description: '컷백 크로스 → 원터치 마무리. 좌우 측면 번갈아 진행.',
    ageGroups: ['U11', 'U13', 'U15'],
    equipment: ['공 8개', '골대 2개'],
    usageCount: 95,
    isCoreCurriculum: false,
  },
  {
    id: 'block-s6',
    title: '수비 압박 & 커버',
    category: 'skill',
    durationMin: 20,
    description: '2:2 상황 압박-커버 로테이션. 접근 각도와 거리 유지 반복.',
    ageGroups: ['U11', 'U13', 'U15'],
    equipment: ['조끼', '콘 8개'],
    usageCount: 72,
    isCoreCurriculum: true,
  },
  {
    id: 'block-s7',
    title: '론도 4:1 볼 소유',
    category: 'skill',
    durationMin: 18,
    description: '8m 원형 그리드. 2터치 제한 → 1터치 제한으로 상향.',
    ageGroups: ['U9', 'U11', 'U13'],
    equipment: ['공 1개', '마커 6개'],
    usageCount: 156,
    isCoreCurriculum: true,
  },
  {
    id: 'block-s8',
    title: '헤딩 기초 안전 지도',
    category: 'skill',
    durationMin: 15,
    description: '소프트볼로 목 고정·이마 정면 접촉 학습. 안전 프로토콜 필수.',
    ageGroups: ['U13', 'U15'],
    equipment: ['소프트볼 6개'],
    usageCount: 24,
    isCoreCurriculum: false,
  },
  {
    id: 'block-s9',
    title: '볼 마스터리 기초',
    category: 'skill',
    durationMin: 15,
    description: '토탭·인사이드롤·풀백 각 30회. U7 기본기 정착용.',
    ageGroups: ['U7', 'U9'],
    equipment: ['공 인원수'],
    usageCount: 103,
    isCoreCurriculum: true,
  },

  // --- Game --------------------------------------------------------------
  {
    id: 'block-g1',
    title: '4:4 미니게임 (2골대)',
    category: 'game',
    durationMin: 25,
    description: '20x15m 그리드. 3분 경기 후 로테이션. 득점자 전원 하이파이브 룰.',
    ageGroups: ['U7', 'U9', 'U11'],
    equipment: ['미니골대 2개', '조끼'],
    usageCount: 187,
    isCoreCurriculum: true,
  },
  {
    id: 'block-g2',
    title: '3:3 트랜지션 게임',
    category: 'game',
    durationMin: 22,
    description: '공 뺏기면 즉시 역습. 전환 속도 체득 목적.',
    ageGroups: ['U11', 'U13', 'U15'],
    equipment: ['미니골대 4개', '조끼'],
    usageCount: 112,
    isCoreCurriculum: true,
  },
  {
    id: 'block-g3',
    title: '포지션별 8:8 실전',
    category: 'game',
    durationMin: 30,
    description: '풀 피치 축소판. 포지션 역할 지정 후 하프타임 피드백.',
    ageGroups: ['U13', 'U15'],
    equipment: ['정규골대 2개', '조끼'],
    usageCount: 68,
    isCoreCurriculum: false,
  },
  {
    id: 'block-g4',
    title: '득점왕 서바이벌',
    category: 'game',
    durationMin: 20,
    description: '개인전 슈팅 토너먼트. 탈락자는 GK 로테이션으로 계속 참여.',
    ageGroups: ['U7', 'U9', 'U11'],
    equipment: ['공 10개', '골대 1개'],
    usageCount: 141,
    isCoreCurriculum: false,
  },
  {
    id: 'block-g5',
    title: '핸디캡 매치',
    category: 'game',
    durationMin: 25,
    description: '실력 격차 반영해 인원/터치 제한 부여. 전원 성공 경험 설계.',
    ageGroups: ['U9', 'U11', 'U13'],
    equipment: ['미니골대 2개', '조끼'],
    usageCount: 74,
    isCoreCurriculum: false,
  },
  {
    id: 'block-g6',
    title: '학부모 오픈 매치',
    category: 'game',
    durationMin: 25,
    description: '월 1회 공개 수업용. 학부모 관전 동선과 촬영 포인트 사전 안내.',
    ageGroups: ['U7', 'U9', 'U11', 'U13', 'U15'],
    equipment: ['미니골대 2개', '조끼', '관전 매트'],
    usageCount: 19,
    isCoreCurriculum: false,
  },
];

// ---------------------------------------------------------------------------
// Attendance history generation
// ---------------------------------------------------------------------------

const HISTORY_DAYS = 56; // 8 weeks

/** Probability a student shows up, given archetype and how recent the session is. */
function attendanceOdds(archetype: Archetype, daysBack: number): number {
  // `recency` runs 0 (oldest session) → 1 (most recent).
  const recency = 1 - daysBack / HISTORY_DAYS;
  switch (archetype) {
    case 'solid':
      return 0.95;
    case 'steady':
      return 0.88;
    case 'wobbly':
      return 0.74;
    case 'fading':
      // Was fine two months ago, has been sliding since — the pattern the
      // churn engine is meant to catch before the parent calls to quit.
      return 0.92 - recency * 0.72;
    case 'ghost':
      return recency > 0.72 ? 0.02 : 0.86;
    case 'injured':
      return recency > 0.6 ? 0.15 : 0.9;
    default:
      return 0.85;
  }
}

function sessionDatesFor(cls: Class): ISODate[] {
  const dates: ISODate[] = [];
  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const d = new Date(NOW);
    d.setDate(d.getDate() - back);
    if (cls.schedule.days.includes(d.getDay() as Weekday)) dates.push(toISODate(d));
  }
  return dates;
}

const POSITIVE_TAGS = behaviorTags.filter((t) => t.polarity === 'positive');
const WATCH_TAGS = behaviorTags.filter((t) => t.polarity === 'watch');

const COMMENT_POOL = [
  '오늘 슈팅 타이밍이 눈에 띄게 좋아졌습니다.',
  '수비 전환 시 위치 선정이 안정적이었습니다.',
  '친구들 격려하는 모습이 인상적이었어요.',
  '후반부 체력 관리가 필요해 보입니다.',
  '지난주 피드백을 바로 적용했습니다.',
  '패스 선택지가 넓어지고 있습니다.',
];

interface GeneratedHistory {
  logs: AttendanceLog[];
  students: Student[];
}

function generateHistory(): GeneratedHistory {
  const rand = makeRandom(20260801);
  const logs: AttendanceLog[] = [];
  const students: Student[] = [];

  const classById = new Map(classes.map((c) => [c.id, c]));
  let logSeq = 0;

  studentSeeds.forEach((seed, index) => {
    const cls = classById.get(seed.classId)!;
    const studentId = `stu-${`${index + 1}`.padStart(3, '0')}`;
    const dates = sessionDatesFor(cls);

    let lastPresent: ISODate | null = null;

    dates.forEach((date) => {
      const daysBack = diffDays(TODAY, date);
      const odds = attendanceOdds(seed.archetype, daysBack);
      const roll = rand();

      let status: AttendanceLog['status'];
      if (roll < odds) {
        status = 'present';
      } else if (seed.archetype === 'injured' && rand() < 0.75) {
        status = 'injured';
      } else {
        status = 'absent';
      }

      const tags: string[] = [];
      if (status === 'present') {
        lastPresent = date;
        const tagCount = 1 + Math.floor(rand() * 3);
        for (let i = 0; i < tagCount; i++) {
          const pool = rand() < 0.86 ? POSITIVE_TAGS : WATCH_TAGS;
          const tag = pick(rand, pool).label;
          if (!tags.includes(tag)) tags.push(tag);
        }
      } else if (status === 'injured') {
        tags.push('#통증호소');
      }

      logs.push({
        id: `log-${`${++logSeq}`.padStart(5, '0')}`,
        studentId,
        classId: cls.id,
        date,
        status,
        tags,
        // Coaches type rarely — most logs carry tags only.
        coachComment: status === 'present' && rand() < 0.18 ? pick(rand, COMMENT_POOL) : '',
        coachId: cls.coachId,
        loggedAt: `${date}T${cls.schedule.startTime}:00`,
      });
    });

    const enrolledAt = daysAgo(seed.monthsEnrolled * 30);
    const lastAttendanceDate = lastPresent ?? enrolledAt;

    // Parent contact cadence degrades for the archetypes we want flagged —
    // "the coach stopped reporting" is itself a churn signal.
    const contactGapDays =
      seed.archetype === 'ghost' || seed.archetype === 'fading'
        ? 18 + Math.floor(rand() * 22)
        : 2 + Math.floor(rand() * 12);

    students.push({
      id: studentId,
      name: seed.name,
      ageGroup: cls.ageGroup,
      status: 'active', // recomputed below by the churn engine
      lastAttendanceDate,
      churnScore: 0, // recomputed below
      classId: cls.id,
      parentName: seed.parentName,
      parentPhone: `010-${`${1000 + Math.floor(rand() * 8999)}`}-${`${1000 + Math.floor(rand() * 8999)}`}`,
      enrolledAt,
      monthlyFee: seed.monthlyFee,
      lastParentContactDate: daysAgo(contactGapDays),
      memo: seed.memo,
    });
  });

  return { logs, students };
}

const history = generateHistory();

export const attendanceLogs: AttendanceLog[] = history.logs;

/**
 * Students with `status` / `churnScore` still at their placeholder values —
 * `createInitialState` runs the churn engine over these before first render.
 */
export const students: Student[] = history.students;

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  active: '정상',
  at_risk: '이탈 위험',
  inactive: '휴원',
};

// ---------------------------------------------------------------------------
// Session plans — a little history so the coach portfolio isn't empty
// ---------------------------------------------------------------------------

export const sessionPlans: SessionPlan[] = [
  {
    id: 'plan-1',
    classId: 'class-1',
    coachId: 'coach-1',
    date: daysAgo(2),
    slots: { warmup: 'block-w2', skill: 'block-s9', game: 'block-g4' },
    createdAt: `${daysAgo(2)}T15:40:00`,
    status: 'completed',
  },
  {
    id: 'plan-2',
    classId: 'class-2',
    coachId: 'coach-1',
    date: daysAgo(4),
    slots: { warmup: 'block-w4', skill: 'block-s7', game: 'block-g1' },
    createdAt: `${daysAgo(4)}T16:45:00`,
    status: 'completed',
  },
  {
    id: 'plan-3',
    classId: 'class-3',
    coachId: 'coach-2',
    date: daysAgo(3),
    slots: { warmup: 'block-w3', skill: 'block-s1', game: 'block-g2' },
    createdAt: `${daysAgo(3)}T17:50:00`,
    status: 'completed',
  },
  {
    id: 'plan-4',
    classId: 'class-1',
    coachId: 'coach-1',
    date: daysAgo(9),
    slots: { warmup: 'block-w1', skill: 'block-s3', game: 'block-g1' },
    createdAt: `${daysAgo(9)}T15:35:00`,
    status: 'completed',
  },
  {
    id: 'plan-5',
    classId: 'class-6',
    coachId: 'coach-4',
    date: daysAgo(5),
    slots: { warmup: 'block-w6', skill: 'block-s5', game: 'block-g3' },
    createdAt: `${daysAgo(5)}T19:10:00`,
    status: 'completed',
  },
];

export const csActions: CsAction[] = [];
