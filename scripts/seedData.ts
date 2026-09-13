/**
 * Demo dataset — 원생 100명 규모의 중형 축구교실.
 *
 * Classes, coaches and blocks are hand-authored. The roster is part
 * hand-authored (the students who carry a story) and part generated from name
 * pools, and the ~8 weeks of attendance history behind everyone comes from a
 * seeded PRNG. Same seed, same dataset, every run — so churn scores, margins
 * and retention always agree with each other while demoing.
 *
 * This used to be `src/data/mockData.ts`, loaded straight into the reducer.
 * It now feeds `scripts/seed.ts`, which writes it into a real Supabase project.
 * The distinction matters: the demo is no longer a special code path in the
 * app, it is just an academy that happens to be fictional. Whatever the sales
 * demo exercises is therefore the same code a paying customer runs.
 *
 * The shapes below are deliberately *not* imported from `@/types`. Seed rows
 * are pre-tenant (no `academyId` — the seeder assigns it) and pre-split (the
 * owner-only figures sit inline here, and the seeder distributes them to
 * `student_billing`, `class_finances` and `coach_evaluations`). Sharing the app
 * types would force this file to lie about one or the other.
 */

type ID = string;
type ISODate = string;
type AgeGroup = 'U7' | 'U9' | 'U11' | 'U13' | 'U15';
type StudentStatus = 'active' | 'at_risk' | 'inactive';
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface Coach {
  id: ID;
  name: string;
  /** Goes to `coach_evaluations` — owner-only. */
  satisfactionScore: number;
  certifications: string[];
}

interface Class {
  id: ID;
  title: string;
  coachId: ID;
  schedule: { days: Weekday[]; startTime: string; durationMin: number };
  ageGroup: AgeGroup;
  capacity: number;
  venue: string;
  /** The standard curriculum this class runs. */
  curriculumId: ID;
  /** Derived from the roster's tuition; kept here so the seed stays readable. */
  monthlyRevenue: number;
  /** Both go to `class_finances` — owner-only. */
  monthlyCost: number;
  retentionRate: number;
}

type CurriculumTrack =
  | 'kinder'
  | 'foundation'
  | 'skill'
  | 'tactical'
  | 'elite'
  | 'physical'
  | 'club';

interface Curriculum {
  id: ID;
  title: string;
  ageGroup: AgeGroup;
  track: CurriculumTrack;
  objective: string;
  focusAreas: string[];
  cycleWeeks: number;
}

interface SessionTemplate {
  id: ID;
  curriculumId: ID;
  title: string;
  week: number;
  goal: string;
  blockIds: ID[];
  status: 'published' | 'pending' | 'rejected';
  /** `null` when the owner authored it. */
  proposedBy: ID | null;
  reviewNote: string;
  usageCount: number;
}

interface Student {
  id: ID;
  name: string;
  ageGroup: AgeGroup;
  status: StudentStatus;
  lastAttendanceDate: ISODate;
  churnScore: number;
  classId: ID;
  parentName: string;
  parentPhone: string;
  enrolledAt: ISODate;
  /** Goes to `student_billing` — owner-only. */
  monthlyFee: number;
  lastParentContactDate: ISODate | null;
  memo?: string;
}

interface BehaviorTag {
  id: ID;
  label: string;
  dimension: 'skill' | 'attitude' | 'teamwork' | 'physical' | 'caution';
  polarity: 'positive' | 'watch';
}

interface TrainingBlock {
  id: ID;
  title: string;
  category: 'warmup' | 'skill' | 'game';
  durationMin: number;
  description: string;
  ageGroups: AgeGroup[];
  equipment: string[];
  usageCount: number;
  isCoreCurriculum: boolean;
  status: 'published' | 'pending' | 'rejected';
  proposedBy: ID | null;
}

interface SessionItem {
  category: 'warmup' | 'skill' | 'game';
  blockId: ID;
  durationMin: number | null;
}

interface SessionPlan {
  id: ID;
  classId: ID;
  coachId: ID;
  date: ISODate;
  items: SessionItem[];
  templateId: ID | null;
  createdAt: string;
  status: 'draft' | 'scheduled' | 'completed';
}

interface AttendanceLog {
  id: ID;
  studentId: ID;
  classId: ID;
  date: ISODate;
  status: 'present' | 'absent' | 'injured';
  tags: string[];
  coachComment: string;
  sessionPlanId?: ID;
  coachId?: ID;
  loggedAt?: string;
}

interface CsAction {
  id: ID;
  studentId: ID;
  actedAt: string;
  actorId: ID;
  note: string;
}

export type {
  AttendanceLog,
  BehaviorTag,
  Class,
  Coach,
  CsAction,
  Curriculum,
  SessionPlan,
  SessionTemplate,
  Student,
  TrainingBlock,
};

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

/** Deterministic PRNG (mulberry32). */
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
  { id: 'coach-1', name: '김도현', satisfactionScore: 4.7, certifications: ['AFC C급', '유소년 지도자 1급', '응급처치'] },
  { id: 'coach-2', name: '박서준', satisfactionScore: 4.4, certifications: ['AFC C급', '생활체육지도사 2급'] },
  { id: 'coach-3', name: '이지훈', satisfactionScore: 3.9, certifications: ['생활체육지도사 2급'] },
  { id: 'coach-4', name: '최유나', satisfactionScore: 4.8, certifications: ['AFC C급', '유소년 지도자 1급', 'GK 스페셜리스트'] },
  { id: 'coach-5', name: '정민석', satisfactionScore: 4.5, certifications: ['AFC C급', '유아체육 지도자'] },
  { id: 'coach-6', name: '한지원', satisfactionScore: 4.2, certifications: ['생활체육지도사 2급', '피지컬 트레이너'] },
  { id: 'coach-7', name: '오태양', satisfactionScore: 4.6, certifications: ['AFC B급', '전술 분석 과정'] },
];

/** The coach whose phone we're simulating in the Coach App. */
export const CURRENT_COACH_ID: ID = 'coach-1';

/** The owner account behind the Admin Dashboard. */
export const OWNER_ID: ID = 'owner-1';

// ---------------------------------------------------------------------------
// Curricula — the centre's offering, as the owner describes it
// ---------------------------------------------------------------------------

/**
 * Seven tracks over five age bands. The grid is deliberately sparse: 킨더 only
 * exists at U7, 엘리트 only at U15, and the weekend club runs at U9 and U11 where
 * the parents who want one session a week actually are. A full matrix would be a
 * fiction — no centre teaches 35 different things.
 *
 * `track` is what the block-ranking function sorts on, so it is doing real work
 * rather than labelling: a drill from 주말 U9 클럽 surfaces first for 주말 U11
 * 리그반 and only later for the weekday U9 foundation class, because purpose
 * transfers further than age does.
 */
export const curricula: Curriculum[] = [
  {
    id: 'cur-kinder-u7',
    title: '킨더 U7 — 놀이로 배우는 첫 축구',
    ageGroup: 'U7',
    track: 'kinder',
    objective: '공이 무섭지 않고, 다음 주에 또 오고 싶은 아이로 만든다.',
    focusAreas: ['공 친화', '놀이 몰입', '규칙 인지', '성공 경험'],
    cycleWeeks: 8,
  },
  {
    id: 'cur-foundation-u9',
    title: 'U9 기초 — 두 발과 첫 터치',
    ageGroup: 'U9',
    track: 'foundation',
    objective: '왼발로도 멈추고 보낸다. 여기서 만든 습관이 이후 전부를 결정한다.',
    focusAreas: ['양발 사용', '퍼스트터치', '인사이드 패스', '기본 볼 마스터리'],
    cycleWeeks: 8,
  },
  {
    id: 'cur-skill-u11',
    title: 'U11 스킬 — 1:1 돌파와 볼 소유',
    ageGroup: 'U11',
    track: 'skill',
    objective: '압박을 받은 상태에서 스스로 해결할 선택지를 갖게 한다.',
    focusAreas: ['1:1 돌파', '론도 볼 소유', '수비 압박 입문', '마무리 정확도'],
    cycleWeeks: 10,
  },
  {
    id: 'cur-tactical-u13',
    title: 'U13 전술 — 역할과 전환',
    ageGroup: 'U13',
    track: 'tactical',
    objective: '개인 기술을 팀의 약속으로 옮긴다. 공을 잃은 순간부터가 전술이다.',
    focusAreas: ['공수 전환', '압박·커버', '포지션 역할', '세트피스 패턴'],
    cycleWeeks: 10,
  },
  {
    id: 'cur-elite-u15',
    title: 'U15 엘리트 — 경기력과 진학',
    ageGroup: 'U15',
    track: 'elite',
    objective: '경기 기록이 그대로 진학 자료가 되도록 만든다.',
    focusAreas: ['경기 체력', '마무리 결정력', '수비 조직', '세트피스 완성'],
    cycleWeeks: 12,
  },
  {
    id: 'cur-physical-u15',
    title: 'U15 피지컬 · GK — 몸과 골문',
    ageGroup: 'U15',
    track: 'physical',
    objective: '성장기 부상을 막고, 전문 포지션을 따로 가르친다.',
    focusAreas: ['GK 핸들링', '밸런스·몸싸움', '부상 예방 루틴', '헤딩 안전'],
    cycleWeeks: 8,
  },
  {
    id: 'cur-club-u9',
    title: '주말 U9 클럽 — 즐기는 축구',
    ageGroup: 'U9',
    track: 'club',
    objective: '주 1회로는 진도를 못 뺀다. 출석 동기를 먼저 지킨다.',
    focusAreas: ['경기 시간 확보', '전원 득점 경험', '학부모 관전', '지루하지 않은 90분'],
    cycleWeeks: 6,
  },
  {
    id: 'cur-club-u11',
    title: '주말 U11 리그 — 경기로 배우기',
    ageGroup: 'U11',
    track: 'club',
    objective: '리그 경기 자체를 교재로 쓴다. 설명보다 반복된 상황이 남는다.',
    focusAreas: ['실전 경기 운영', '세트피스 리허설', '역습 전환', '포지션 경험'],
    cycleWeeks: 6,
  },
];

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

/** `monthlyRevenue` is filled in after the roster exists — see `classes`. */
const classSeeds: Array<Omit<Class, 'monthlyRevenue'>> = [
  {
    id: 'class-1', title: '킨더 U7 새싹반', coachId: 'coach-1', curriculumId: 'cur-kinder-u7',
    schedule: { days: [1, 3] as Weekday[], startTime: '16:00', durationMin: 55 },
    monthlyCost: 1_180_000, ageGroup: 'U7', capacity: 12, venue: '본원 A구장', retentionRate: 0.92,
  },
  {
    id: 'class-2', title: 'U9 챌린저반', coachId: 'coach-1', curriculumId: 'cur-foundation-u9',
    schedule: { days: [2, 4] as Weekday[], startTime: '17:00', durationMin: 55 },
    monthlyCost: 1_620_000, ageGroup: 'U9', capacity: 14, venue: '본원 A구장', retentionRate: 0.85,
  },
  {
    id: 'class-3', title: 'U11 스킬 아카데미', coachId: 'coach-2', curriculumId: 'cur-skill-u11',
    schedule: { days: [1, 5] as Weekday[], startTime: '18:00', durationMin: 70 },
    monthlyCost: 2_050_000, ageGroup: 'U11', capacity: 14, venue: '본원 B구장', retentionRate: 0.78,
  },
  {
    id: 'class-4', title: 'U13 엘리트 트랙', coachId: 'coach-2', curriculumId: 'cur-tactical-u13',
    schedule: { days: [2, 4, 6] as Weekday[], startTime: '19:00', durationMin: 80 },
    monthlyCost: 2_480_000, ageGroup: 'U13', capacity: 14, venue: '풋살파크 3구장', retentionRate: 0.71,
  },
  {
    id: 'class-5', title: '주말 U9 클럽', coachId: 'coach-3', curriculumId: 'cur-club-u9',
    schedule: { days: [6] as Weekday[], startTime: '10:00', durationMin: 90 },
    monthlyCost: 1_180_000, ageGroup: 'U9', capacity: 16, venue: '풋살파크 1구장', retentionRate: 0.61,
  },
  {
    id: 'class-6', title: 'U15 피지컬 & GK', coachId: 'coach-4', curriculumId: 'cur-physical-u15',
    schedule: { days: [3, 5] as Weekday[], startTime: '19:30', durationMin: 80 },
    monthlyCost: 1_460_000, ageGroup: 'U15', capacity: 10, venue: '본원 B구장', retentionRate: 0.88,
  },
  {
    id: 'class-7', title: '킨더 U7 햇살반', coachId: 'coach-5', curriculumId: 'cur-kinder-u7',
    schedule: { days: [2, 4] as Weekday[], startTime: '16:00', durationMin: 55 },
    monthlyCost: 1_120_000, ageGroup: 'U7', capacity: 12, venue: '본원 A구장', retentionRate: 0.9,
  },
  {
    id: 'class-8', title: 'U11 주말 리그반', coachId: 'coach-5', curriculumId: 'cur-club-u11',
    schedule: { days: [0, 6] as Weekday[], startTime: '14:00', durationMin: 90 },
    monthlyCost: 1_380_000, ageGroup: 'U11', capacity: 16, venue: '풋살파크 2구장', retentionRate: 0.74,
  },
  {
    id: 'class-9', title: 'U9 파워 트레이닝', coachId: 'coach-6', curriculumId: 'cur-foundation-u9',
    schedule: { days: [1, 5] as Weekday[], startTime: '17:00', durationMin: 60 },
    monthlyCost: 1_340_000, ageGroup: 'U9', capacity: 14, venue: '본원 B구장', retentionRate: 0.82,
  },
  {
    id: 'class-10', title: 'U13 전술 클래스', coachId: 'coach-6', curriculumId: 'cur-tactical-u13',
    schedule: { days: [3, 5] as Weekday[], startTime: '18:30', durationMin: 75 },
    monthlyCost: 1_980_000, ageGroup: 'U13', capacity: 12, venue: '풋살파크 3구장', retentionRate: 0.69,
  },
  {
    id: 'class-11', title: 'U15 입시 대비반', coachId: 'coach-7', curriculumId: 'cur-elite-u15',
    schedule: { days: [2, 4, 6] as Weekday[], startTime: '20:00', durationMin: 90 },
    monthlyCost: 1_880_000, ageGroup: 'U15', capacity: 10, venue: '본원 B구장', retentionRate: 0.86,
  },
  {
    id: 'class-12', title: '유아 축구 놀이터', coachId: 'coach-7', curriculumId: 'cur-kinder-u7',
    schedule: { days: [6] as Weekday[], startTime: '11:00', durationMin: 50 },
    monthlyCost: 1_020_000, ageGroup: 'U7', capacity: 16, venue: '풋살파크 1구장', retentionRate: 0.79,
  },
];

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

/**
 * Attendance archetype driving history generation. `lastAttendanceDate`,
 * `status` and `churnScore` are all derived from the resulting logs — never
 * hand-set — so every Red Alert row is defensible.
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

/** Per-class tuition. Weekend/play classes are cheaper, elite tracks dearer. */
const CLASS_FEE: Record<ID, number> = {
  'class-1': 220_000, 'class-2': 270_000, 'class-3': 320_000, 'class-4': 380_000,
  'class-5': 150_000, 'class-6': 400_000, 'class-7': 220_000, 'class-8': 200_000,
  'class-9': 280_000, 'class-10': 360_000, 'class-11': 450_000, 'class-12': 180_000,
};

/** How many students sit in each class. Sums to 104. */
const CLASS_HEADCOUNT: Record<ID, number> = {
  'class-1': 10, 'class-2': 11, 'class-3': 11, 'class-4': 9,
  'class-5': 8, 'class-6': 7, 'class-7': 9, 'class-8': 11,
  'class-9': 8, 'class-10': 8, 'class-11': 6, 'class-12': 6,
};

/**
 * Students who carry a narrative — these are the ones the owner will actually
 * see in the Red Alert queue, so their memos explain the churn in plain words.
 *
 * The at-risk archetypes (`ghost` / `fading` / `injured`) are capped at ten on
 * purpose: this is a demo, and a queue you can read without scrolling makes the
 * point better than a hundred rows. Everyone else is deliberately healthy.
 */
const featuredSeeds: StudentSeed[] = [
  { name: '정라온', classId: 'class-1', parentName: '정우진', archetype: 'fading', monthsEnrolled: 4, monthlyFee: 220_000, memo: '태권도 학원과 시간 겹침 상담 있었음' },
  { name: '이시온', classId: 'class-1', parentName: '이정민', archetype: 'steady', monthsEnrolled: 5, monthlyFee: 220_000, memo: '땀 알레르기 — 여름철 수분 보충 자주 필요' },
  { name: '박시우', classId: 'class-2', parentName: '박진욱', archetype: 'injured', monthsEnrolled: 8, monthlyFee: 270_000, memo: '발목 인대 염좌 — 지난달부터 재활 중' },
  { name: '신도현', classId: 'class-2', parentName: '신유정', archetype: 'steady', monthsEnrolled: 6, monthlyFee: 270_000 },
  { name: '서지안', classId: 'class-2', parentName: '서동혁', archetype: 'ghost', monthsEnrolled: 5, monthlyFee: 270_000, memo: '3주째 무단 결석 — 학부모 연락 두절' },
  { name: '송재이', classId: 'class-3', parentName: '송기훈', archetype: 'fading', monthsEnrolled: 9, monthlyFee: 320_000, memo: '중학 입시 학원 시작 — 주 1회 전환 문의' },
  { name: '고은성', classId: 'class-3', parentName: '고아름', archetype: 'ghost', monthsEnrolled: 8, monthlyFee: 320_000, memo: '타 아카데미 이적 소문' },
  { name: '표승우', classId: 'class-3', parentName: '표건희', archetype: 'steady', monthsEnrolled: 7, monthlyFee: 320_000, memo: '성장통 — 러닝 볼륨 조절 요청' },
  { name: '차은호', classId: 'class-4', parentName: '차보람', archetype: 'fading', monthsEnrolled: 11, monthlyFee: 380_000, memo: '주 3회 부담 호소 — 학업 병행 어려움' },
  { name: '백승현', classId: 'class-4', parentName: '백지우', archetype: 'ghost', monthsEnrolled: 10, monthlyFee: 380_000, memo: '엘리트 선발 탈락 후 동기 저하' },
  { name: '방시안', classId: 'class-5', parentName: '방규리', archetype: 'steady', monthsEnrolled: 3, monthlyFee: 150_000 },
  { name: '탁이든', classId: 'class-5', parentName: '탁영주', archetype: 'ghost', monthsEnrolled: 3, monthlyFee: 150_000, memo: '체험 후 등록했으나 2주째 미출석' },
  { name: '설가온', classId: 'class-5', parentName: '설민아', archetype: 'steady', monthsEnrolled: 4, monthlyFee: 150_000 },
  { name: '명현서', classId: 'class-6', parentName: '명수철', archetype: 'steady', monthsEnrolled: 6, monthlyFee: 400_000 },
  { name: '천유안', classId: 'class-7', parentName: '천서윤', archetype: 'steady', monthsEnrolled: 4, monthlyFee: 220_000 },
  { name: '봉재하', classId: 'class-8', parentName: '봉세영', archetype: 'steady', monthsEnrolled: 5, monthlyFee: 200_000 },
  { name: '단시우', classId: 'class-8', parentName: '단재훈', archetype: 'steady', monthsEnrolled: 4, monthlyFee: 200_000 },
  { name: '나윤재', classId: 'class-9', parentName: '나경호', archetype: 'steady', monthsEnrolled: 5, monthlyFee: 280_000, memo: '수영 강습으로 요일 변경 요청' },
  { name: '피정후', classId: 'class-10', parentName: '피상현', archetype: 'steady', monthsEnrolled: 6, monthlyFee: 360_000 },
  { name: '옥서진', classId: 'class-10', parentName: '옥진하', archetype: 'injured', monthsEnrolled: 4, monthlyFee: 360_000, memo: '무릎 슬개건염 — 4주 휴식 권고' },
  { name: '변하람', classId: 'class-11', parentName: '변도경', archetype: 'fading', monthsEnrolled: 7, monthlyFee: 450_000, memo: '고입 실기 일정으로 개인 레슨 전환 검토' },
  { name: '두리안', classId: 'class-12', parentName: '두정민', archetype: 'steady', monthsEnrolled: 3, monthlyFee: 180_000 },
];

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍', '유', '고', '문', '양', '손', '배', '백', '허', '남', '심', '노', '하', '곽', '성', '주', '구', '진', '지', '엄', '채'];

const GIVEN_NAMES = ['하준', '서준', '도윤', '시우', '은우', '지호', '예준', '준우', '서진', '지훈', '건우', '우진', '선우', '연우', '유준', '정우', '승우', '지우', '준서', '도현', '이준', '시윤', '준혁', '이안', '유찬', '성민', '지환', '태윤', '민재', '현우', '서우', '지안', '하율', '로운', '한결', '온유', '다온', '가온', '별하', '늘찬', '아라', '미르', '규빈', '시후', '재이', '태오', '윤슬', '새봄', '해찬', '루아'];

const PARENT_GIVEN = ['민석', '예린', '성호', '정민', '다혜', '우진', '소영', '현수', '가영', '준영', '태윤', '혜진', '민서', '유정', '현우', '지아', '채원', '동혁', '은별', '수민', '상우', '선아', '기훈', '보경', '민호', '아름', '지환', '유경', '승철', '소라', '건희', '경민', '보람', '현빈', '지우', '수진', '정한', '혜원', '지훈', '나연'];

/**
 * Fills each class up to its headcount.
 *
 * The generated remainder is intentionally healthy — only `featuredSeeds` may
 * be at risk, which is what keeps the alert queue at ten readable rows. `wobbly`
 * students still land in the 관찰 band, so the score column isn't all green.
 */
function buildRoster(): StudentSeed[] {
  const rand = makeRandom(777_2026);
  const seeds = [...featuredSeeds];
  const used = new Set(featuredSeeds.map((s) => s.name));

  // Weighted archetype pool for the generated remainder.
  const pool: Archetype[] = [
    ...Array<Archetype>(10).fill('solid'),
    ...Array<Archetype>(8).fill('steady'),
    ...Array<Archetype>(2).fill('wobbly'),
  ];

  for (const cls of classSeeds) {
    const target = CLASS_HEADCOUNT[cls.id];
    let have = seeds.filter((s) => s.classId === cls.id).length;

    while (have < target) {
      let name = '';
      for (let tries = 0; tries < 40; tries++) {
        const candidate = `${pick(rand, SURNAMES)}${pick(rand, GIVEN_NAMES)}`;
        if (!used.has(candidate)) {
          name = candidate;
          break;
        }
      }
      if (!name) break; // pool exhausted — shouldn't happen at this scale
      used.add(name);

      seeds.push({
        name,
        classId: cls.id,
        parentName: `${name[0]}${pick(rand, PARENT_GIVEN)}`,
        archetype: pick(rand, pool),
        monthsEnrolled: 2 + Math.floor(rand() * 22),
        monthlyFee: CLASS_FEE[cls.id],
      });
      have += 1;
    }
  }

  return seeds;
}

const studentSeeds = buildRoster();

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

/** Everything here is the owner's own library, hence `published`. Coach
 *  proposals are appended separately below so the approval queue has content. */
const blockSeeds: Array<Omit<TrainingBlock, 'status' | 'proposedBy'>> = [
  // --- Warm-up -----------------------------------------------------------
  { id: 'block-w1', title: '콘 슬라럼 러닝', category: 'warmup', durationMin: 10, description: '콘 8개를 2m 간격으로 배치. 지그재그 러닝 → 사이드 스텝 → 백페달 3세트.', ageGroups: ['U7', 'U9', 'U11'], equipment: ['콘 8개'], usageCount: 142, isCoreCurriculum: true },
  { id: 'block-w2', title: '술래잡기 볼 태그', category: 'warmup', durationMin: 10, description: '전원 공 소유 상태로 술래잡기. 심박수를 놀이로 올려 U7~U9 몰입도 확보.', ageGroups: ['U7', 'U9'], equipment: ['공 인원수', '마커 4개'], usageCount: 118, isCoreCurriculum: false },
  { id: 'block-w3', title: '다이내믹 스트레칭 루틴', category: 'warmup', durationMin: 8, description: '레그 스윙 · 런지 워크 · 하이니 · 힙 오프너. 부상 예방 표준 루틴.', ageGroups: ['U11', 'U13', 'U15'], equipment: [], usageCount: 96, isCoreCurriculum: true },
  { id: 'block-w4', title: '2인 1조 패스 릴레이', category: 'warmup', durationMin: 12, description: '10m 간격 인사이드 패스 → 원터치 전환. 좌우 발 균등 사용 강제.', ageGroups: ['U9', 'U11', 'U13'], equipment: ['공 2인당 1개'], usageCount: 87, isCoreCurriculum: true },
  { id: 'block-w5', title: '반응 속도 컬러콘', category: 'warmup', durationMin: 10, description: '코치가 외친 색 콘으로 스프린트. 인지-반응 능력 자극.', ageGroups: ['U9', 'U11', 'U13', 'U15'], equipment: ['컬러콘 4색'], usageCount: 64, isCoreCurriculum: false },
  { id: 'block-w6', title: 'GK 핸들링 워밍업', category: 'warmup', durationMin: 12, description: '캐칭 자세 · 로우 다이브 · 리바운드 처리. 골키퍼 전용.', ageGroups: ['U13', 'U15'], equipment: ['공 3개', '골대'], usageCount: 31, isCoreCurriculum: false },

  // --- Skill -------------------------------------------------------------
  { id: 'block-s1', title: '드리블 돌파 B', category: 'skill', durationMin: 20, description: '1:1 상황에서 바디페인트 후 아웃사이드 터치 돌파. 수비수 반응 유도 후 가속.', ageGroups: ['U9', 'U11', 'U13'], equipment: ['콘 6개', '조끼'], usageCount: 134, isCoreCurriculum: true },
  { id: 'block-s2', title: '코너킥 패턴 A', category: 'skill', durationMin: 20, description: '니어포스트 쇄도 + 세컨볼 대기 배치. 3가지 신호 약속.', ageGroups: ['U11', 'U13', 'U15'], equipment: ['공 5개', '마네킹 3개'], usageCount: 78, isCoreCurriculum: false },
  { id: 'block-s3', title: '인사이드 패스 정확도', category: 'skill', durationMin: 18, description: '5m·10m·15m 게이트 통과 패스. 성공률 기록해 개인 지표화.', ageGroups: ['U7', 'U9', 'U11'], equipment: ['콘 12개', '공 인원수'], usageCount: 121, isCoreCurriculum: true },
  { id: 'block-s4', title: '퍼스트터치 컨트롤', category: 'skill', durationMin: 20, description: '공중볼·바운드볼 받아 1터치로 진행 방향 전환. 좌우 발 교대.', ageGroups: ['U9', 'U11', 'U13', 'U15'], equipment: ['공 2인당 1개', '콘 4개'], usageCount: 109, isCoreCurriculum: true },
  { id: 'block-s5', title: '슈팅 마무리 트레이닝', category: 'skill', durationMin: 22, description: '컷백 크로스 → 원터치 마무리. 좌우 측면 번갈아 진행.', ageGroups: ['U11', 'U13', 'U15'], equipment: ['공 8개', '골대 2개'], usageCount: 95, isCoreCurriculum: false },
  { id: 'block-s6', title: '수비 압박 & 커버', category: 'skill', durationMin: 20, description: '2:2 상황 압박-커버 로테이션. 접근 각도와 거리 유지 반복.', ageGroups: ['U11', 'U13', 'U15'], equipment: ['조끼', '콘 8개'], usageCount: 72, isCoreCurriculum: true },
  { id: 'block-s7', title: '론도 4:1 볼 소유', category: 'skill', durationMin: 18, description: '8m 원형 그리드. 2터치 제한 → 1터치 제한으로 상향.', ageGroups: ['U9', 'U11', 'U13'], equipment: ['공 1개', '마커 6개'], usageCount: 156, isCoreCurriculum: true },
  { id: 'block-s8', title: '헤딩 기초 안전 지도', category: 'skill', durationMin: 15, description: '소프트볼로 목 고정·이마 정면 접촉 학습. 안전 프로토콜 필수.', ageGroups: ['U13', 'U15'], equipment: ['소프트볼 6개'], usageCount: 24, isCoreCurriculum: false },
  { id: 'block-s9', title: '볼 마스터리 기초', category: 'skill', durationMin: 15, description: '토탭·인사이드롤·풀백 각 30회. U7 기본기 정착용.', ageGroups: ['U7', 'U9'], equipment: ['공 인원수'], usageCount: 103, isCoreCurriculum: true },

  // --- Game --------------------------------------------------------------
  { id: 'block-g1', title: '4:4 미니게임 (2골대)', category: 'game', durationMin: 25, description: '20x15m 그리드. 3분 경기 후 로테이션. 득점자 전원 하이파이브 룰.', ageGroups: ['U7', 'U9', 'U11'], equipment: ['미니골대 2개', '조끼'], usageCount: 187, isCoreCurriculum: true },
  { id: 'block-g2', title: '3:3 트랜지션 게임', category: 'game', durationMin: 22, description: '공 뺏기면 즉시 역습. 전환 속도 체득 목적.', ageGroups: ['U11', 'U13', 'U15'], equipment: ['미니골대 4개', '조끼'], usageCount: 112, isCoreCurriculum: true },
  { id: 'block-g3', title: '포지션별 8:8 실전', category: 'game', durationMin: 30, description: '풀 피치 축소판. 포지션 역할 지정 후 하프타임 피드백.', ageGroups: ['U13', 'U15'], equipment: ['정규골대 2개', '조끼'], usageCount: 68, isCoreCurriculum: false },
  { id: 'block-g4', title: '득점왕 서바이벌', category: 'game', durationMin: 20, description: '개인전 슈팅 토너먼트. 탈락자는 GK 로테이션으로 계속 참여.', ageGroups: ['U7', 'U9', 'U11'], equipment: ['공 10개', '골대 1개'], usageCount: 141, isCoreCurriculum: false },
  { id: 'block-g5', title: '핸디캡 매치', category: 'game', durationMin: 25, description: '실력 격차 반영해 인원/터치 제한 부여. 전원 성공 경험 설계.', ageGroups: ['U9', 'U11', 'U13'], equipment: ['미니골대 2개', '조끼'], usageCount: 74, isCoreCurriculum: false },
  { id: 'block-g6', title: '학부모 오픈 매치', category: 'game', durationMin: 25, description: '월 1회 공개 수업용. 학부모 관전 동선과 촬영 포인트 사전 안내.', ageGroups: ['U7', 'U9', 'U11', 'U13', 'U15'], equipment: ['미니골대 2개', '조끼', '관전 매트'], usageCount: 19, isCoreCurriculum: false },
];

export const trainingBlocks: TrainingBlock[] = [
  ...blockSeeds.map((b) => ({ ...b, status: 'published' as const, proposedBy: null })),

  // A coach's block waiting on the owner. It has `usageCount: 0` because the
  // insert policy refuses a proposal that claims otherwise — a pending block has
  // by definition never been run.
  {
    id: 'block-p1',
    title: '3인 삼각 패스 로테이션',
    category: 'skill',
    durationMin: 18,
    description: '삼각 배치에서 패스 후 빈 자리로 이동. 패스와 움직임을 한 동작으로 붙이는 것이 목적.',
    ageGroups: ['U11', 'U13'],
    equipment: ['마커 3개', '공 2개'],
    usageCount: 0,
    isCoreCurriculum: false,
    status: 'pending',
    proposedBy: 'coach-2',
  },
];

// ---------------------------------------------------------------------------
// Standard sessions — the curriculum's smallest unit
// ---------------------------------------------------------------------------

/**
 * Note the shapes. Most are 웜업 → 스킬 → 미니게임, and several deliberately are
 * not: `t-foundation-4` runs two skill blocks, `t-club9-2` opens with a game,
 * `t-club11-2` is a warmup and then nothing but games. Those three are the whole
 * argument for `blockIds` being an ordered list rather than three columns — they
 * are ordinary sessions that the old schema could not hold.
 */
const templateSeeds: Array<Omit<SessionTemplate, 'status' | 'proposedBy' | 'reviewNote'>> = [
  // --- 킨더 U7 -----------------------------------------------------------
  { id: 't-kinder-1', curriculumId: 'cur-kinder-u7', week: 1, title: '공과 친해지기', goal: '공을 발에 붙이고 있어도 재미있다는 것을 알게 한다', blockIds: ['block-w2', 'block-s9', 'block-g4'], usageCount: 34 },
  { id: 't-kinder-2', curriculumId: 'cur-kinder-u7', week: 2, title: '첫 터치와 멈추기', goal: '굴러오는 공을 한 번에 멈춰 세운다', blockIds: ['block-w1', 'block-s9', 'block-g1'], usageCount: 28 },
  { id: 't-kinder-3', curriculumId: 'cur-kinder-u7', week: 3, title: '친구에게 보내기', goal: '5m 앞 친구에게 인사이드로 보낸다', blockIds: ['block-w2', 'block-s3', 'block-g1'], usageCount: 26 },
  { id: 't-kinder-4', curriculumId: 'cur-kinder-u7', week: 4, title: '작은 경기, 많은 득점', goal: '전원이 한 번 이상 골을 넣고 끝낸다', blockIds: ['block-w2', 'block-s9', 'block-g1', 'block-g4'], usageCount: 19 },
  { id: 't-kinder-5', curriculumId: 'cur-kinder-u7', week: 5, title: '학부모 공개 수업', goal: '배운 것을 보호자 앞에서 보여준다', blockIds: ['block-w2', 'block-s3', 'block-g6'], usageCount: 8 },

  // --- U9 기초 ------------------------------------------------------------
  { id: 't-foundation-1', curriculumId: 'cur-foundation-u9', week: 1, title: '두 발 패스 정착', goal: '왼발 인사이드 패스를 10회 연속 성공한다', blockIds: ['block-w4', 'block-s3', 'block-g1'], usageCount: 31 },
  { id: 't-foundation-2', curriculumId: 'cur-foundation-u9', week: 2, title: '퍼스트터치 전환', goal: '받는 방향을 한 번에 바꾼다', blockIds: ['block-w1', 'block-s4', 'block-g5'], usageCount: 24 },
  { id: 't-foundation-3', curriculumId: 'cur-foundation-u9', week: 3, title: '볼 소유의 시작', goal: '두 터치 제한에서 공을 잃지 않는다', blockIds: ['block-w5', 'block-s7', 'block-g1'], usageCount: 22 },
  { id: 't-foundation-4', curriculumId: 'cur-foundation-u9', week: 4, title: '돌파 시도 장려 — 스킬 2회', goal: '실패해도 좋으니 1:1을 시도한다', blockIds: ['block-w1', 'block-s9', 'block-s1', 'block-g4'], usageCount: 17 },
  { id: 't-foundation-5', curriculumId: 'cur-foundation-u9', week: 5, title: '즐기는 마무리', goal: '한 주기를 성공 경험으로 닫는다', blockIds: ['block-w2', 'block-s3', 'block-g4'], usageCount: 13 },

  // --- U11 스킬 -----------------------------------------------------------
  { id: 't-skill-1', curriculumId: 'cur-skill-u11', week: 1, title: '1:1 돌파 기본', goal: '바디페인트 후 아웃사이드로 빠져나간다', blockIds: ['block-w3', 'block-s1', 'block-g2'], usageCount: 29 },
  { id: 't-skill-2', curriculumId: 'cur-skill-u11', week: 2, title: '론도로 배우는 소유', goal: '압박 속에서 두 터치로 처리한다', blockIds: ['block-w4', 'block-s7', 'block-g1'], usageCount: 33 },
  { id: 't-skill-3', curriculumId: 'cur-skill-u11', week: 3, title: '터치에서 마무리까지 — 스킬 2회', goal: '받아서 돌아 마무리까지 한 동작으로 잇는다', blockIds: ['block-w5', 'block-s4', 'block-s5', 'block-g2'], usageCount: 18 },
  { id: 't-skill-4', curriculumId: 'cur-skill-u11', week: 4, title: '수비 압박 입문', goal: '접근 각도와 거리를 지킨다', blockIds: ['block-w3', 'block-s6', 'block-g5'], usageCount: 21 },
  { id: 't-skill-5', curriculumId: 'cur-skill-u11', week: 5, title: '세트피스 맛보기', goal: '코너킥 약속 신호 3개를 익힌다', blockIds: ['block-w3', 'block-s2', 'block-g2'], usageCount: 11 },

  // --- U13 전술 -----------------------------------------------------------
  { id: 't-tactical-1', curriculumId: 'cur-tactical-u13', week: 1, title: '전환 속도', goal: '공을 잃은 뒤 3초 안에 형태를 만든다', blockIds: ['block-w3', 'block-s4', 'block-g2'], usageCount: 27 },
  { id: 't-tactical-2', curriculumId: 'cur-tactical-u13', week: 2, title: '압박과 커버', goal: '두 명이 한 몸처럼 움직인다', blockIds: ['block-w5', 'block-s6', 'block-g3'], usageCount: 23 },
  { id: 't-tactical-3', curriculumId: 'cur-tactical-u13', week: 3, title: '세트피스 패턴 — 스킬 2회', goal: '코너킥과 세컨볼 마무리를 붙여 연습한다', blockIds: ['block-w3', 'block-s2', 'block-s5', 'block-g3'], usageCount: 15 },
  { id: 't-tactical-4', curriculumId: 'cur-tactical-u13', week: 4, title: '포지션 역할 이해', goal: '자기 위치에서 해야 할 두 가지를 말할 수 있다', blockIds: ['block-w4', 'block-s7', 'block-g3'], usageCount: 20 },
  { id: 't-tactical-5', curriculumId: 'cur-tactical-u13', week: 5, title: '헤딩 안전 지도', goal: '목을 고정하고 이마 정면으로만 접촉한다', blockIds: ['block-w3', 'block-s8', 'block-g2'], usageCount: 9 },

  // --- U15 엘리트 ---------------------------------------------------------
  { id: 't-elite-1', curriculumId: 'cur-elite-u15', week: 1, title: '경기 체력과 전환', goal: '후반에도 전환 속도가 떨어지지 않는다', blockIds: ['block-w3', 'block-s4', 'block-g3'], usageCount: 22 },
  { id: 't-elite-2', curriculumId: 'cur-elite-u15', week: 2, title: '마무리 결정력', goal: '박스 안 첫 슈팅을 놓치지 않는다', blockIds: ['block-w5', 'block-s5', 'block-g3'], usageCount: 19 },
  { id: 't-elite-3', curriculumId: 'cur-elite-u15', week: 3, title: '수비 조직', goal: '라인을 함께 올리고 함께 내린다', blockIds: ['block-w3', 'block-s6', 'block-g2'], usageCount: 16 },
  { id: 't-elite-4', curriculumId: 'cur-elite-u15', week: 4, title: '세트피스 완성', goal: '공격·수비 세트피스 배치를 외운다', blockIds: ['block-w3', 'block-s2', 'block-g3'], usageCount: 12 },

  // --- U15 피지컬 · GK ----------------------------------------------------
  { id: 't-physical-1', curriculumId: 'cur-physical-u15', week: 1, title: 'GK 핸들링 기본', goal: '캐칭 자세와 로우 다이브를 몸에 붙인다', blockIds: ['block-w6', 'block-s5', 'block-g2'], usageCount: 18 },
  { id: 't-physical-2', curriculumId: 'cur-physical-u15', week: 2, title: '밸런스와 몸싸움', goal: '접촉 상황에서 중심을 잃지 않는다', blockIds: ['block-w3', 'block-s6', 'block-g3'], usageCount: 15 },
  { id: 't-physical-3', curriculumId: 'cur-physical-u15', week: 3, title: '헤딩 안전과 경합', goal: '안전 프로토콜 안에서 공중볼을 다툰다', blockIds: ['block-w6', 'block-s8', 'block-g3'], usageCount: 10 },

  // --- 주말 U9 클럽 -------------------------------------------------------
  { id: 't-club9-1', curriculumId: 'cur-club-u9', week: 1, title: '놀이로 시작', goal: '첫 20분에 아이들이 웃고 있게 만든다', blockIds: ['block-w2', 'block-s9', 'block-g1'], usageCount: 21 },
  { id: 't-club9-2', curriculumId: 'cur-club-u9', week: 2, title: '경기 먼저 90분', goal: '주 1회 수업에서 경기 시간을 최대로 확보한다', blockIds: ['block-w1', 'block-g1', 'block-s3', 'block-g4'], usageCount: 26 },
  { id: 't-club9-3', curriculumId: 'cur-club-u9', week: 3, title: '학부모와 함께', goal: '보호자가 직접 뛰며 다음 달 등록을 결심하게 한다', blockIds: ['block-w2', 'block-s3', 'block-g6'], usageCount: 7 },

  // --- 주말 U11 리그 ------------------------------------------------------
  { id: 't-club11-1', curriculumId: 'cur-club-u11', week: 1, title: '리그 준비', goal: '경기 전 약속 두 가지를 확인한다', blockIds: ['block-w4', 'block-s1', 'block-g2'], usageCount: 20 },
  { id: 't-club11-2', curriculumId: 'cur-club-u11', week: 2, title: '경기, 그리고 또 경기', goal: '설명을 줄이고 상황을 반복해서 겪게 한다', blockIds: ['block-w5', 'block-g5', 'block-g2'], usageCount: 24 },
  { id: 't-club11-3', curriculumId: 'cur-club-u11', week: 3, title: '세트피스 리허설', goal: '코너킥 한 가지 패턴을 경기에서 써 본다', blockIds: ['block-w3', 'block-s2', 'block-g1'], usageCount: 13 },
];

export const sessionTemplates: SessionTemplate[] = [
  ...templateSeeds.map((t) => ({
    ...t,
    status: 'published' as const,
    proposedBy: null,
    reviewNote: '',
  })),

  // Coach proposals awaiting the owner. Both are the kind of session a coach
  // actually needs and the owner never thought to write: one for rain, one for
  // the week a class is half-empty.
  {
    id: 't-club9-proposal',
    curriculumId: 'cur-club-u9',
    week: 4,
    title: '우천 시 실내 세션',
    goal: '좁은 실내에서도 90분을 지루하지 않게 채운다',
    blockIds: ['block-w2', 'block-s9', 'block-g4'],
    status: 'pending',
    proposedBy: 'coach-3',
    reviewNote: '',
    usageCount: 0,
  },
  {
    id: 't-skill-proposal',
    curriculumId: 'cur-skill-u11',
    week: 6,
    title: '소인원 대응 세션',
    goal: '6명 이하로 모인 날에도 강도를 유지한다',
    blockIds: ['block-w5', 'block-s7', 'block-g5'],
    status: 'pending',
    proposedBy: 'coach-2',
    reviewNote: '',
    usageCount: 0,
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
      // Fine two months ago, sliding ever since — the pattern the churn engine
      // exists to catch before the parent calls to quit.
      return 0.92 - recency * 0.72;
    case 'ghost':
      return recency > 0.72 ? 0.02 : 0.86;
    case 'injured':
      return recency > 0.6 ? 0.15 : 0.9;
    default:
      return 0.85;
  }
}

function sessionDatesFor(cls: Omit<Class, 'monthlyRevenue'>): ISODate[] {
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

function generateHistory() {
  const rand = makeRandom(20260801);
  const logs: AttendanceLog[] = [];
  const generated: Student[] = [];

  const classById = new Map(classSeeds.map((c) => [c.id, c]));
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
          const poolForTag = rand() < 0.86 ? POSITIVE_TAGS : WATCH_TAGS;
          const tag = pick(rand, poolForTag).label;
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
    // "the coach stopped reporting" is itself a churn signal. Injured students
    // count too: a child sitting out is exactly the one who quietly drifts off
    // when nobody calls home.
    const contactGapDays =
      seed.archetype === 'ghost' || seed.archetype === 'fading' || seed.archetype === 'injured'
        ? 18 + Math.floor(rand() * 22)
        : 2 + Math.floor(rand() * 12);

    generated.push({
      id: studentId,
      name: seed.name,
      ageGroup: cls.ageGroup,
      status: 'active', // recomputed by the churn engine
      lastAttendanceDate,
      churnScore: 0, // recomputed by the churn engine
      classId: cls.id,
      parentName: seed.parentName,
      parentPhone: `010-${1000 + Math.floor(rand() * 8999)}-${1000 + Math.floor(rand() * 8999)}`,
      enrolledAt,
      monthlyFee: seed.monthlyFee,
      lastParentContactDate: daysAgo(contactGapDays),
      memo: seed.memo,
    });
  });

  return { logs, students: generated };
}

const history = generateHistory();

export const attendanceLogs: AttendanceLog[] = history.logs;

/**
 * Students with `status` / `churnScore` still at placeholder values —
 * `createInitialState` runs the churn engine over these before first render.
 */
export const students: Student[] = history.students;

/** Class revenue is the sum of its roster's tuition, never a hand-typed figure. */
export const classes: Class[] = classSeeds.map((cls) => ({
  ...cls,
  monthlyRevenue: students
    .filter((s) => s.classId === cls.id)
    .reduce((sum, s) => sum + s.monthlyFee, 0),
}));

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  active: '정상',
  at_risk: '이탈 위험',
  inactive: '휴원',
};

// ---------------------------------------------------------------------------
// Session plans — the calendar
// ---------------------------------------------------------------------------

/**
 * One plan per session day, walking each class's curriculum in a loop.
 *
 * Hand-writing ten plans was enough while the coach app only ever showed today.
 * A month calendar needs every square accounted for, and it needs all three
 * states visible at once — so:
 *
 *   past sessions        → `completed` (attendance already exists for them)
 *   next two sessions    → `scheduled`
 *   everything after     → no row at all, i.e. 미등록
 *
 * That last line is the important one. Seeding the whole future as `scheduled`
 * would make the calendar look finished and hide the state the screen exists to
 * surface: the session nobody has planned yet.
 */
const PLANNED_AHEAD = 2;
const FUTURE_DAYS = 35;

function buildSessionPlans(): SessionPlan[] {
  const templatesByCurriculum = new Map<ID, SessionTemplate[]>();
  for (const t of sessionTemplates) {
    if (t.status !== 'published') continue;
    const list = templatesByCurriculum.get(t.curriculumId) ?? [];
    list.push(t);
    templatesByCurriculum.set(t.curriculumId, list);
  }
  for (const list of templatesByCurriculum.values()) list.sort((a, b) => a.week - b.week);

  const blockById = new Map(trainingBlocks.map((b) => [b.id, b]));
  const plans: SessionPlan[] = [];
  let seq = 0;

  for (const cls of classSeeds) {
    const cycle = templatesByCurriculum.get(cls.curriculumId) ?? [];
    if (cycle.length === 0) continue;

    // A separate stream per class so one class's dates never shift another's.
    const rand = makeRandom(hashString(cls.id));

    const dates: ISODate[] = [];
    for (let offset = -HISTORY_DAYS; offset <= FUTURE_DAYS; offset++) {
      const d = new Date(NOW);
      d.setDate(d.getDate() + offset);
      if (cls.schedule.days.includes(d.getDay() as Weekday)) dates.push(toISODate(d));
    }

    let upcoming = 0;

    dates.forEach((date, index) => {
      const past = diffDays(TODAY, date) > 0;
      if (!past) {
        if (upcoming >= PLANNED_AHEAD) return;
        upcoming += 1;
      }

      const template = cycle[index % cycle.length];

      // Most sessions are the standard one. Roughly one in five is a coach
      // swapping a block out — which is what makes the owner's adherence figure
      // a number worth reading rather than a constant 100%.
      const drifted = rand() < 0.2;
      const blockIds = drifted
        ? template.blockIds.map((id, i) =>
            i === template.blockIds.length - 1 ? substitute(id, rand) : id,
          )
        : template.blockIds;

      plans.push({
        id: `plan-${`${++seq}`.padStart(4, '0')}`,
        classId: cls.id,
        coachId: cls.coachId,
        date,
        items: blockIds.flatMap((blockId) => {
          const block = blockById.get(blockId);
          return block ? [{ category: block.category, blockId, durationMin: null }] : [];
        }),
        // A drifted session is no longer the standard session, so it carries no
        // template link — same rule the reducer applies when a coach swaps a
        // block in the builder.
        templateId: drifted ? null : template.id,
        createdAt: `${date}T${cls.schedule.startTime}:00`,
        status: past ? 'completed' : 'scheduled',
      });
    });
  }

  return plans;
}

/** Swap a block for another in the same category. */
function substitute(blockId: ID, rand: () => number): ID {
  const block = trainingBlocks.find((b) => b.id === blockId);
  if (!block) return blockId;
  const alternatives = trainingBlocks.filter(
    (b) => b.status === 'published' && b.category === block.category && b.id !== blockId,
  );
  return alternatives.length > 0 ? pick(rand, alternatives).id : blockId;
}

/** Stable per-class PRNG seed, so adding a class doesn't reshuffle the others. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const sessionPlans: SessionPlan[] = buildSessionPlans();

export const csActions: CsAction[] = [];
