/**
 * The application.
 *
 * One structure for both roles. 대표 and 코치 get the same five tabs, the same
 * home screen and the same session flow; the owner's extra — finance, coach
 * evaluation, the churn queue — hangs off 세부 관리 inside 클럽. The old
 * `RoleRouter` shipped two different applications and made "권한" mean "a
 * different product", which is why an owner could not see the thing they
 * actually spend their evenings doing.
 *
 * Navigation is a stack per tab, and tapping a tab in the bar empties that
 * tab's stack — you always land on the tab's own home screen. Preserving each
 * tab's position sounded more respectful of the user's place and was worse to
 * use: a coach who left 클럽 four screens deep inside a student profile comes
 * back an hour later, taps 클럽 expecting the hub, and gets a stranger's page
 * with no memory of how they got there. Five predictable front doors beat five
 * resumed sessions. A drill-down still pushes rather than replaces, so 뒤로
 * inside a tab means one step back rather than "wherever the state machine
 * decides". The phone's own back button does the same thing as the 뒤로 on the
 * screen — see `useSystemBack`.
 *
 * A drill-down never changes tab. Opening a 체험 from 일정 used to jump to 폼
 * and push the lead there, so 뒤로 popped 폼's stack and dropped the user on the
 * 문의 list — a screen they had never been on. Now the lead opens on top of
 * 일정, the bar keeps pointing where the user is, and 뒤로 is always the screen
 * they just left. Only a *tab tap* (or an alert, which is a tab tap) moves
 * between tabs, and that always lands on the tab's home.
 */

import { useMemo, useState } from 'react';
import { CalendarDays, FileText, Home, Newspaper, Users } from 'lucide-react';
import type { Class, ID, ISODate, Student } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { useSession } from '@/store/AuthContext';
import { isOwner } from '@/lib/permissions';
import { EXIT_WINDOW, useSystemBack } from '@/lib/systemBack';
import { TODAY } from '@/data/dates';
import { buildDay, summarise } from '@/data/today';
import { countLeads } from '@/data/crm';
import { progressOf } from '@/data/surveys';
import { PHASE_LABEL, todayQueue, type Phase } from '@/data/onboarding';
import { planFor } from '@/data/selectors';
import { Shell, Toast, type Alert, type TabItem } from '@/components/shell/Shell';
import { ClassHomeScreen } from '@/components/home/ClassHomeScreen';
import { ScheduleScreen } from '@/components/schedule/ScheduleScreen';
import { FormsScreen } from '@/components/forms/FormsScreen';
import { FamilyScreen } from '@/components/forms/FamilyScreen';
import { PhaseScreen } from '@/components/forms/PhaseScreen';
import { InviteScreen } from '@/components/forms/InviteScreen';
import { SentScreen } from '@/components/forms/SentScreen';
import { SurveyDetailScreen } from '@/components/forms/SurveyDetailScreen';
import { ClubScreen } from '@/components/club/ClubScreen';
import { OwnerConsole } from '@/components/club/OwnerConsole';
import { ActivityScreen } from '@/components/club/ActivityScreen';
import { StudentProfileScreen } from '@/components/club/StudentProfileScreen';
import { FeedScreen } from '@/components/feed/FeedScreen';
import { ArticleScreen } from '@/components/feed/ArticleScreen';
import { AlimtalkScreen } from '@/components/club/AlimtalkScreen';
import { AttendanceScreen } from '@/components/coach/AttendanceScreen';
import { ClassDetailScreen } from '@/components/session/ClassDetailScreen';
import { SessionScreen } from '@/components/session/SessionScreen';
import { LessonPrepScreen } from '@/components/session/LessonPrepScreen';
import { SessionLibraryScreen } from '@/components/session/SessionLibraryScreen';
import { PortfolioScreen } from '@/components/coach/PortfolioScreen';
import { RosterScreen } from '@/components/club/RosterScreen';

export type Tab = 'club' | 'forms' | 'class' | 'schedule' | 'feed';

/** One screen on a tab's stack. The tab root is the empty stack. */
export type Route =
  | { name: 'class'; classId: ID }
  | { name: 'session'; classId: ID; date: ISODate }
  | { name: 'pick'; classId: ID; date: ISODate }
  | { name: 'attendance'; classId: ID; date: ISODate }
  | { name: 'lead'; leadId: ID }
  | { name: 'family'; key: string; queue?: boolean }
  | { name: 'phase'; phase: Phase }
  | { name: 'invite' }
  | { name: 'sent' }
  | { name: 'survey'; surveyId: ID; notice?: string | null }
  | { name: 'student'; studentId: ID }
  | { name: 'roster' }
  | { name: 'library' }
  | { name: 'portfolio' }
  | { name: 'activity' }
  | { name: 'owner' }
  | { name: 'article'; articleId: string }
  | { name: 'alimtalk' };

type Stacks = Record<Tab, Route[]>;

const EMPTY_STACKS: Stacks = { club: [], forms: [], class: [], schedule: [], feed: [] };

/**
 * How the next screen arrives, by what the user just did.
 *
 * The motion is the answer to "where am I now". Deeper comes in from the right,
 * shallower from the left, a tab tap rises in place, and a replace (준비 → 수업)
 * only cross-fades because the user did not move — the thing they were looking
 * at changed form.
 */
/**
 * Names for the 뒤로 link. Back labels used to be written into each screen
 * ("← 달력", "문의 목록"), which was true for the one path each screen was
 * first built for and wrong for every other way in.
 */
const TAB_TITLE: Record<Tab, string> = {
  club: '클럽',
  forms: '폼',
  class: '오늘의 수업',
  schedule: '일정',
  feed: '피드',
};

const ROUTE_TITLE: Record<Route['name'], string> = {
  class: '클래스',
  session: '수업',
  pick: '수업 준비',
  attendance: '수업 기록',
  lead: '문의',
  family: '가족',
  phase: '단계',
  invite: '체험 초대',
  sent: '보낸 안내',
  survey: '안내 결과',
  student: '원생 프로필',
  roster: '원생 명단',
  library: '수업 라이브러리',
  portfolio: '내 기록',
  activity: '활동 기록',
  owner: '세부 관리',
  article: '칼럼',
  alimtalk: '알림톡',
};

type Motion = 'push' | 'pop' | 'tab' | 'swap';

const MOTION: Record<Motion, string> = {
  push: 'animate-screen-push',
  pop: 'animate-screen-pop',
  tab: 'animate-tab-in',
  swap: 'animate-swap-in',
};

export function FootballApp() {
  const { state, slice, dispatch } = useApp();
  const { leads, surveys, recipients, families, getFamily } = useWorkspace();
  const queue = useMemo(() => todayQueue(families), [families]);
  const session = useSession();
  const owner = isOwner(session);

  const [tab, setTab] = useState<Tab>('class');
  const [stacks, setStacks] = useState<Stacks>(EMPTY_STACKS);
  const [leaving, setLeaving] = useState(false);
  const [motion, setMotion] = useState<Motion>('tab');

  const stack = stacks[tab];
  const route = stack.length > 0 ? stack[stack.length - 1] : null;

  /** What 뒤로 on the current screen returns to, named. */
  const below = stack.length >= 2 ? stack[stack.length - 2] : null;
  const backLabel = below
    ? below.name === 'phase'
      ? PHASE_LABEL[below.phase]
      : below.name === 'family'
        ? (getFamily(below.key)?.name ?? ROUTE_TITLE.family)
        : ROUTE_TITLE[below.name]
    : TAB_TITLE[tab];

  // An owner has no `coaches` row, so `currentCoachId` is null and the day
  // builder widens to the whole centre. That is the right default for them and
  // the reason this is one number rather than a role check at each call site.
  const coachId = state.currentCoachId;

  const today = useMemo(() => buildDay(slice, TODAY, TODAY, coachId), [slice, coachId]);
  const summary = useMemo(() => summarise(today), [today]);
  const leadCounts = useMemo(() => countLeads(leads), [leads]);

  // --- Navigation ---------------------------------------------------------

  const top = () => window.scrollTo({ top: 0 });

  const push = (next: Route) => {
    setStacks((s) => ({ ...s, [tab]: [...s[tab], next] }));
    setMotion('push');
    top();
  };

  const pop = () => {
    setStacks((s) => ({ ...s, [tab]: s[tab].slice(0, -1) }));
    setMotion('pop');
    top();
  };

  const replace = (next: Route) => {
    setStacks((s) => ({ ...s, [tab]: [...s[tab].slice(0, -1), next] }));
    setMotion('swap');
    top();
  };

  /**
   * Go to a tab's home screen, dropping whatever was open on it.
   *
   * This is what the bottom bar and the alert sheet both do, and it is the
   * only way to change tab — `push` always stays on the tab it was called from.
   */
  const resetTo = (next: Tab) => {
    setStacks((s) => (s[next].length === 0 ? s : { ...s, [next]: [] }));
    setTab(next);
    setMotion('tab');
    top();
  };

  /**
   * Leave the top screen the way that screen's own 뒤로 would.
   *
   * The phone's back button and the 뒤로 drawn on the screen have to agree, and
   * two of these screens hold a draft that must be thrown away on the way out.
   * So the cleanup lives here, at the one place that owns the stack, rather
   * than in each button's `onClick` where only the visible one would run it.
   */
  const dismiss = () => {
    if (route?.name === 'attendance') dispatch({ type: 'attendance/discard' });
    pop();
  };

  useSystemBack(stack.length, dismiss, () => {
    setLeaving(true);
    window.setTimeout(() => setLeaving(false), EXIT_WINDOW);
  });

  // --- Session flow -------------------------------------------------------
  //
  // Opening, picking and wrapping up a session are reachable from the home
  // hero, the day list, 일정 and a class page, so they live here rather than
  // in whichever screen happened to be on top.

  const openSession = (cls: Class, date: ISODate) =>
    push({ name: 'session', classId: cls.id, date });

  const pick = (cls: Class, date: ISODate) => push({ name: 'pick', classId: cls.id, date });

  const record = (cls: Class, date: ISODate) => {
    dispatch({ type: 'attendance/start', classId: cls.id, date });
    push({ name: 'attendance', classId: cls.id, date });
  };

  const getClass = (id: ID): Class | null => state.classes.find((c) => c.id === id) ?? null;

  // --- Alerts -------------------------------------------------------------
  //
  // The bell is the one place the app is allowed to interrupt, so it carries
  // only things with a deadline attached: a session nobody logged, and an
  // enquiry going cold. Both are reversible today and unrecoverable next week.

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];

    if (summary.needsLog > 0) {
      out.push({
        id: 'needs-log',
        label: `기록하지 않은 수업 ${summary.needsLog}개`,
        detail: '출석을 남기지 않으면 이탈 신호를 계산할 수 없습니다',
        tone: 'urgent',
        onOpen: () => resetTo('class'),
      });
    }

    // New families first: the whole business turns on the first reply and the
    // first month, and both are a phone call that's either made today or late.
    if (queue.length > 0) {
      const late = queue.filter((f) => f.next!.late).length;
      out.push({
        id: 'onboarding',
        label: `연락할 새 가족 ${queue.length}`,
        detail: `${queue[0].name} · ${queue[0].next!.label}${late > 0 ? ` · 늦은 연락 ${late}` : ''}`,
        tone: late > 0 ? 'urgent' : 'normal',
        onOpen: () => resetTo('forms'),
      });
    }

    // A flagged answer is a family that asked, in effect, for a conversation.
    const toTalk = surveys.reduce((n, v) => n + progressOf(v, recipients).toCall.length, 0);
    if (toTalk > 0) {
      out.push({
        id: 'survey-talk',
        label: `상담이 필요한 답변 ${toTalk}`,
        detail: '폼 → 보낸 안내에서 확인하세요',
        tone: 'normal',
        onOpen: () => resetTo('forms'),
      });
    }

    if (leadCounts.upcomingTrials > 0) {
      out.push({
        id: 'trials',
        label: `예정된 체험 ${leadCounts.upcomingTrials}건`,
        detail: '담당 코치에게 미리 공유되어 있는지 확인하세요',
        tone: 'normal',
        onOpen: () => resetTo('schedule'),
      });
    }

    return out;
  }, [summary.needsLog, leadCounts, queue, surveys, recipients]);

  const tabs: TabItem[] = [
    { key: 'club', label: '클럽', icon: Users },
    { key: 'forms', label: '폼', icon: FileText, badge: queue.length },
    { key: 'class', label: '수업', icon: Home, badge: summary.needsLog },
    { key: 'schedule', label: '일정', icon: CalendarDays },
    { key: 'feed', label: '피드', icon: Newspaper },
  ];

  return (
    <>
      <Shell tabs={tabs} active={tab} onSelect={(key) => resetTo(key as Tab)} alerts={alerts}>
        {/* Keyed by position so every move remounts — and so a push from one
            student to another never inherits the first one's local state. */}
        <div key={`${tab}/${stack.length}/${route?.name ?? 'root'}`} className={MOTION[motion]}>
          {route ? renderRoute() : renderTab()}
        </div>
      </Shell>
      {leaving && <Toast>한 번 더 누르면 종료됩니다</Toast>}
    </>
  );

  // --- Rendering ----------------------------------------------------------

  function renderTab() {
    switch (tab) {
      case 'club':
        return (
          <ClubScreen
            owner={owner}
            onOpen={(next) => push(next)}
            onOpenStudent={(s: Student) => push({ name: 'student', studentId: s.id })}
          />
        );

      case 'forms':
        return (
          <FormsScreen
            onOpenFamily={(key, queue) => push({ name: 'family', key, queue })}
            onOpenPhase={(phase) => push({ name: 'phase', phase })}
            onOpenInvite={() => push({ name: 'invite' })}
            onOpenSent={() => push({ name: 'sent' })}
            onOpenSurvey={(surveyId, notice) => push({ name: 'survey', surveyId, notice })}
          />
        );

      case 'schedule':
        return (
          <ScheduleScreen
            coachId={coachId}
            onOpenSession={openSession}
            onPick={pick}
            onRecord={record}
            onOpenLead={(leadId) => push({ name: 'lead', leadId })}
          />
        );

      case 'feed':
        return <FeedScreen onOpenArticle={(articleId) => push({ name: 'article', articleId })} />;

      case 'class':
      default:
        return (
          <ClassHomeScreen
            entries={today}
            showCoach={coachId === null}
            onOpenSession={openSession}
            onPick={pick}
            onRecord={record}
            onSeeSchedule={() => resetTo('schedule')}
            onOpenArticle={(articleId) => push({ name: 'article', articleId })}
          />
        );
    }
  }

  function renderRoute() {
    if (!route) return null;

    switch (route.name) {
      case 'class': {
        const cls = getClass(route.classId);
        if (!cls) return null;
        return (
          <ClassDetailScreen
            cls={cls}
            backLabel={backLabel}
            onBack={dismiss}
            onOpenSession={(date) => openSession(cls, date)}
          />
        );
      }

      case 'session': {
        const cls = getClass(route.classId);
        if (!cls) return null;
        return (
          <SessionScreen
            cls={cls}
            date={route.date}
            backLabel={backLabel}
            onBack={dismiss}
            onPrepare={() => pick(cls, route.date)}
            onRecord={() => record(cls, route.date)}
            onOpenClass={() => push({ name: 'class', classId: cls.id })}
          />
        );
      }

      case 'pick': {
        const cls = getClass(route.classId);
        if (!cls) return null;
        return (
          <LessonPrepScreen
            cls={cls}
            date={route.date}
            backLabel={backLabel}
            onBack={dismiss}
            // Came from the lesson page: go back to it. Came straight from a
            // list: show the day you just prepared.
            onDone={() =>
              below?.name === 'session'
                ? pop()
                : replace({
                    name: 'session',
                    classId: cls.id,
                    date: route.date,
                  })
            }
          />
        );
      }

      case 'attendance': {
        const cls = getClass(route.classId);
        if (!cls) return null;
        return (
          <AttendanceScreen
            cls={cls}
            date={route.date}
            backLabel={backLabel}
            onDone={() => {
              const plan = planFor(state.sessionPlans, cls.id, route.date);
              if (plan) dispatch({ type: 'plan/complete', planId: plan.id });
              pop();
            }}
            onBack={dismiss}
          />
        );
      }

      case 'lead':
      case 'family':
        return (
          <FamilyScreen
            // Keyed by family: "다음 가족" replaces in place, and one family's
            // half-typed note or "기록했어요" must not carry over to the next.
            key={route.name === 'lead' ? `lead:${route.leadId}` : route.key}
            familyKey={route.name === 'lead' ? `lead:${route.leadId}` : route.key}
            queue={route.name === 'family' && route.queue}
            backLabel={backLabel}
            onBack={dismiss}
            onNext={(key) => replace({ name: 'family', key, queue: true })}
          />
        );

      case 'phase':
        return (
          <PhaseScreen
            phase={route.phase}
            backLabel={backLabel}
            onBack={dismiss}
            onOpenFamily={(key) => push({ name: 'family', key })}
          />
        );

      case 'invite':
        return <InviteScreen backLabel={backLabel} onBack={dismiss} />;

      case 'sent':
        return (
          <SentScreen
            backLabel={backLabel}
            onBack={dismiss}
            onOpenSurvey={(surveyId) => push({ name: 'survey', surveyId })}
          />
        );

      case 'survey':
        return (
          <SurveyDetailScreen
            surveyId={route.surveyId}
            notice={route.notice}
            backLabel={backLabel}
            onBack={dismiss}
          />
        );

      case 'student':
        return (
          <StudentProfileScreen
            studentId={route.studentId}
            backLabel={backLabel}
            onBack={dismiss}
          />
        );

      case 'roster':
        return (
          <RosterScreen
            owner={owner}
            onBack={dismiss}
            onOpenStudent={(s) => push({ name: 'student', studentId: s.id })}
          />
        );

      case 'library':
        return <SessionLibraryScreen backLabel={backLabel} onBack={dismiss} />;

      case 'portfolio':
        return <PortfolioScreen onBack={dismiss} />;

      case 'activity':
        return <ActivityScreen onBack={dismiss} />;

      case 'alimtalk':
        return <AlimtalkScreen onBack={dismiss} />;

      case 'owner':
        return (
          <OwnerConsole
            onBack={dismiss}
            onOpenStudent={(s) => push({ name: 'student', studentId: s.id })}
          />
        );

      case 'article':
        return (
          <ArticleScreen
            articleId={route.articleId}
            backLabel={backLabel}
            onBack={dismiss}
            onOpenArticle={(articleId) => push({ name: 'article', articleId })}
          />
        );

      default:
        return null;
    }
  }
}
