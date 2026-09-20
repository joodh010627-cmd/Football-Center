/**
 * The application.
 *
 * One structure for both roles. 대표 and 코치 get the same five tabs, the same
 * home screen and the same session flow; the owner's extra — finance, coach
 * evaluation, the churn queue — hangs off a 상세 보기 inside 클럽. The old
 * `RoleRouter` shipped two different applications and made "권한" mean "a
 * different product", which is why an owner could not see the thing they
 * actually spend their evenings doing.
 *
 * Navigation is a stack per tab. Switching tabs keeps your place in each, and
 * every drill-down pushes rather than replaces, so 뒤로 always means one step
 * back rather than "wherever the state machine decides". That mattered less on
 * a desktop rail; on a phone it is the whole feel of the app.
 */

import { useMemo, useState } from 'react';
import { CalendarDays, FileText, Home, Newspaper, Users } from 'lucide-react';
import type { Class, ID, ISODate, Student } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { useSession } from '@/store/AuthContext';
import { isOwner } from '@/lib/permissions';
import { TODAY } from '@/data/dates';
import { buildDay, summarise } from '@/data/today';
import { countLeads, triage } from '@/data/crm';
import { planFor } from '@/data/selectors';
import { Shell, type Alert, type TabItem } from '@/components/shell/Shell';
import { ClassHomeScreen } from '@/components/home/ClassHomeScreen';
import { ScheduleScreen } from '@/components/schedule/ScheduleScreen';
import { FormsScreen } from '@/components/forms/FormsScreen';
import { LeadDetailScreen } from '@/components/forms/LeadDetailScreen';
import { ClubScreen } from '@/components/club/ClubScreen';
import { OwnerConsole } from '@/components/club/OwnerConsole';
import { ActivityScreen } from '@/components/club/ActivityScreen';
import { StudentProfileScreen } from '@/components/club/StudentProfileScreen';
import { FeedScreen } from '@/components/feed/FeedScreen';
import { ClassCalendarScreen } from '@/components/coach/ClassCalendarScreen';
import { SessionBuilderScreen } from '@/components/coach/SessionBuilderScreen';
import { SessionSheetScreen } from '@/components/coach/SessionSheetScreen';
import { AttendanceScreen } from '@/components/coach/AttendanceScreen';
import { CurriculumScreen } from '@/components/curriculum/CurriculumScreen';
import { PortfolioScreen } from '@/components/coach/PortfolioScreen';
import { RosterScreen } from '@/components/club/RosterScreen';

export type Tab = 'club' | 'forms' | 'class' | 'schedule' | 'feed';

/** One screen on a tab's stack. The tab root is the empty stack. */
export type Route =
  | { name: 'class'; classId: ID }
  | { name: 'builder'; classId: ID; date: ISODate }
  | { name: 'sheet'; classId: ID; date: ISODate }
  | { name: 'attendance'; classId: ID; date: ISODate }
  | { name: 'lead'; leadId: ID }
  | { name: 'student'; studentId: ID }
  | { name: 'roster' }
  | { name: 'curriculum' }
  | { name: 'portfolio' }
  | { name: 'activity' }
  | { name: 'owner' };

type Stacks = Record<Tab, Route[]>;

const EMPTY_STACKS: Stacks = { club: [], forms: [], class: [], schedule: [], feed: [] };

export function FootballApp() {
  const { state, slice, dispatch } = useApp();
  const { leads } = useWorkspace();
  const session = useSession();
  const owner = isOwner(session);

  const [tab, setTab] = useState<Tab>('class');
  const [stacks, setStacks] = useState<Stacks>(EMPTY_STACKS);

  const stack = stacks[tab];
  const route = stack.length > 0 ? stack[stack.length - 1] : null;

  // An owner has no `coaches` row, so `currentCoachId` is null and the day
  // builder widens to the whole centre. That is the right default for them and
  // the reason this is one number rather than a role check at each call site.
  const coachId = state.currentCoachId;

  const today = useMemo(
    () => buildDay(slice, TODAY, TODAY, coachId),
    [slice, coachId],
  );
  const summary = useMemo(() => summarise(today), [today]);
  const leadCounts = useMemo(() => countLeads(leads), [leads]);

  // --- Navigation ---------------------------------------------------------

  const top = () => window.scrollTo({ top: 0 });

  const push = (next: Route, onTab: Tab = tab) => {
    setStacks((s) => ({ ...s, [onTab]: [...s[onTab], next] }));
    if (onTab !== tab) setTab(onTab);
    top();
  };

  const pop = () => {
    setStacks((s) => ({ ...s, [tab]: s[tab].slice(0, -1) }));
    top();
  };

  const replace = (next: Route) => {
    setStacks((s) => ({ ...s, [tab]: [...s[tab].slice(0, -1), next] }));
    top();
  };

  const resetTo = (next: Tab) => {
    setTab(next);
    top();
  };

  // --- Session flow -------------------------------------------------------
  //
  // Design and record are reachable from three places (the home hero, the
  // calendar, the schedule list), so they live here rather than in whichever
  // screen happened to be on top.

  const design = (cls: Class, date: ISODate) => {
    dispatch({ type: 'builder/open', classId: cls.id, date });
    push({ name: 'builder', classId: cls.id, date });
  };

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
        label: `기록이 필요한 수업 ${summary.needsLog}개`,
        detail: '출결을 남기지 않으면 이탈 신호를 계산할 수 없습니다',
        tone: 'urgent',
        onOpen: () => resetTo('class'),
      });
    }

    const overdue = triage(leads).filter((l) => leadCounts.overdue > 0 && l.stage === 'inquiry');
    if (leadCounts.overdue > 0) {
      out.push({
        id: 'leads-overdue',
        label: `응대가 늦어진 문의 ${leadCounts.overdue}건`,
        detail: overdue[0]
          ? `${overdue[0].childName} 학부모 외 · 오늘 안에 연락하세요`
          : '오늘 안에 연락하세요',
        tone: 'urgent',
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
  }, [summary.needsLog, leadCounts, leads]);

  const tabs: TabItem[] = [
    { key: 'club', label: '클럽', icon: Users },
    { key: 'forms', label: '폼', icon: FileText, badge: leadCounts.overdue },
    { key: 'class', label: '클래스', icon: Home, badge: summary.needsLog },
    { key: 'schedule', label: '일정', icon: CalendarDays },
    { key: 'feed', label: '피드', icon: Newspaper },
  ];

  return (
    <Shell
      tabs={tabs}
      active={tab}
      onSelect={(key) => setTab(key as Tab)}
      alerts={alerts}
    >
      {route ? renderRoute() : renderTab()}
    </Shell>
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
        return <FormsScreen onOpenLead={(leadId) => push({ name: 'lead', leadId })} />;

      case 'schedule':
        return (
          <ScheduleScreen
            coachId={coachId}
            onOpenClass={(cls) => push({ name: 'class', classId: cls.id })}
            onDesign={design}
            onRecord={record}
            onOpenLead={(leadId) => push({ name: 'lead', leadId }, 'forms')}
          />
        );

      case 'feed':
        return <FeedScreen />;

      case 'class':
      default:
        return (
          <ClassHomeScreen
            entries={today}
            summary={summary}
            owner={owner}
            onOpenClass={(cls) => push({ name: 'class', classId: cls.id })}
            onDesign={design}
            onRecord={record}
            onOpenSheet={(cls, date) => push({ name: 'sheet', classId: cls.id, date })}
            onSeeSchedule={() => resetTo('schedule')}
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
          <ClassCalendarScreen
            cls={cls}
            backLabel={tab === 'schedule' ? '← 일정' : '← 오늘의 클래스'}
            onDesign={(date) => design(cls, date)}
            onRecord={(date) => record(cls, date)}
            onBack={pop}
          />
        );
      }

      case 'builder': {
        const cls = getClass(route.classId);
        if (!cls) return null;
        return (
          <SessionBuilderScreen
            cls={cls}
            date={route.date}
            onDone={() => replace({ name: 'sheet', classId: cls.id, date: route.date })}
            onBack={() => {
              dispatch({ type: 'builder/close' });
              pop();
            }}
          />
        );
      }

      case 'sheet': {
        const cls = getClass(route.classId);
        if (!cls) return null;
        return (
          <SessionSheetScreen
            cls={cls}
            date={route.date}
            onRegister={() => {
              dispatch({ type: 'plan/schedule' });
              pop();
            }}
            onEdit={() => replace({ name: 'builder', classId: cls.id, date: route.date })}
            onDiscard={() => {
              dispatch({ type: 'builder/close' });
              pop();
            }}
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
            onDone={() => {
              // 완료 means the parents were told, not that the register was
              // filled in — the same rule the old coach flow held.
              const plan = planFor(state.sessionPlans, cls.id, route.date);
              if (plan) dispatch({ type: 'plan/complete', planId: plan.id });
              pop();
            }}
            onBack={() => {
              dispatch({ type: 'attendance/discard' });
              pop();
            }}
          />
        );
      }

      case 'lead':
        return (
          <LeadDetailScreen
            leadId={route.leadId}
            onBack={pop}
            onOpenClass={(cls) => push({ name: 'class', classId: cls.id })}
          />
        );

      case 'student':
        return <StudentProfileScreen studentId={route.studentId} onBack={pop} />;

      case 'roster':
        return (
          <RosterScreen
            owner={owner}
            onBack={pop}
            onOpenStudent={(s) => push({ name: 'student', studentId: s.id })}
          />
        );

      case 'curriculum':
        return <CurriculumScreen onBack={pop} />;

      case 'portfolio':
        return <PortfolioScreen onBack={pop} />;

      case 'activity':
        return <ActivityScreen onBack={pop} />;

      case 'owner':
        return (
          <OwnerConsole
            onBack={pop}
            onOpenStudent={(s) => push({ name: 'student', studentId: s.id })}
          />
        );

      default:
        return null;
    }
  }
}
