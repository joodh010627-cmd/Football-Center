/**
 * Coach App.
 *
 * The nav is three destinations — 수업 / 커리큘럼 / 내 기록 — and everything else
 * is a drill-down:
 *
 *   수업 목록 → 달력 → 수업 설계 → 한 장 요약 → (등록) → 달력
 *                    ↘ 수업 완료 → 출결 기록 → 학부모 발송 → 달력
 *
 * The builder and the attendance screen used to be tabs, disabled until a class
 * was picked. That was honest about the state but wrong about the shape: they are
 * steps inside a class, not places you go. Keeping them out of the rail is what
 * makes the calendar the spine of the app rather than a fourth tab.
 *
 * All layout lives in `AppShell` — a persistent green rail on `lg` and up, a
 * bottom bar below that.
 */

import { useState } from 'react';
import { BookOpenCheck, CalendarDays, User } from 'lucide-react';
import type { Class, ISODate } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/dates';
import { classesForCoach, planFor, studentsInClass } from '@/data/selectors';
import { AppShell, type ShellNavItem } from '@/components/AppShell';
import { CurriculumScreen } from '@/components/curriculum/CurriculumScreen';
import { ClassListScreen } from './ClassListScreen';
import { ClassCalendarScreen } from './ClassCalendarScreen';
import { SessionBuilderScreen } from './SessionBuilderScreen';
import { SessionSheetScreen } from './SessionSheetScreen';
import { AttendanceScreen } from './AttendanceScreen';
import { PortfolioScreen } from './PortfolioScreen';

type Tab = 'classes' | 'curriculum' | 'portfolio';

/** Where inside the 수업 tab we are. `null` = the class list. */
type Step =
  | null
  | { name: 'calendar' }
  | { name: 'builder'; date: ISODate }
  | { name: 'sheet'; date: ISODate }
  | { name: 'attendance'; date: ISODate };

const NAV: Array<Omit<ShellNavItem, 'disabled'> & { key: Tab }> = [
  { key: 'classes', label: '수업', icon: CalendarDays },
  { key: 'curriculum', label: '커리큘럼', icon: BookOpenCheck },
  { key: 'portfolio', label: '내 기록', icon: User },
];

export function CoachApp() {
  const { state, dispatch, getCoach } = useApp();
  const [tab, setTab] = useState<Tab>('classes');
  const [openClassId, setOpenClassId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(null);

  // Never null in a coach session — the membership row carries the coach id.
  // The type allows null only because owners have no coach row.
  const coachId = state.currentCoachId ?? '';
  const coach = getCoach(coachId);
  const openClass = state.classes.find((c) => c.id === openClassId) ?? null;

  // RLS has already narrowed `state.classes` to this coach's classes; filtering
  // again costs nothing and keeps the screen honest if that ever changes.
  const myClasses = classesForCoach(state.classes, coachId);
  const myStudents = myClasses.reduce(
    (sum, c) => sum + studentsInClass(state.students, c.id).length,
    0,
  );

  const top = () => window.scrollTo({ top: 0 });

  const goTab = (key: string) => {
    setTab(key as Tab);
    top();
  };

  const openCalendar = (cls: Class) => {
    setOpenClassId(cls.id);
    setStep({ name: 'calendar' });
    top();
  };

  const backToCalendar = () => {
    dispatch({ type: 'builder/close' });
    setStep({ name: 'calendar' });
    top();
  };

  const design = (date: ISODate) => {
    if (!openClass) return;
    dispatch({ type: 'builder/open', classId: openClass.id, date });
    setStep({ name: 'builder', date });
    top();
  };

  const record = (date: ISODate) => {
    if (!openClass) return;
    // Re-recording a day starts from the register as it stands, not from scratch:
    // `attendance/start` defaults everyone present, and the submit path
    // overwrites the day.
    dispatch({ type: 'attendance/start', classId: openClass.id, date });
    setStep({ name: 'attendance', date });
    top();
  };

  const renderClassesTab = () => {
    if (!openClass || !step) return <ClassListScreen onPickClass={openCalendar} />;

    switch (step.name) {
      case 'builder':
        return (
          <SessionBuilderScreen
            cls={openClass}
            date={step.date}
            onDone={() => {
              setStep({ name: 'sheet', date: step.date });
              top();
            }}
            onBack={backToCalendar}
          />
        );

      case 'sheet':
        return (
          <SessionSheetScreen
            cls={openClass}
            date={step.date}
            onRegister={() => {
              dispatch({ type: 'plan/schedule' });
              setStep({ name: 'calendar' });
              top();
            }}
            onEdit={() => {
              setStep({ name: 'builder', date: step.date });
              top();
            }}
            onDiscard={backToCalendar}
          />
        );

      case 'attendance':
        return (
          <AttendanceScreen
            cls={openClass}
            date={step.date}
            onDone={() => {
              // The day is only 완료 once the parents have been told. Marking it
              // on submit would colour the calendar for a report nobody sent.
              const plan = planFor(state.sessionPlans, openClass.id, step.date);
              if (plan) dispatch({ type: 'plan/complete', planId: plan.id });
              setStep({ name: 'calendar' });
              top();
            }}
            onBack={() => {
              dispatch({ type: 'attendance/discard' });
              setStep({ name: 'calendar' });
              top();
            }}
          />
        );

      case 'calendar':
      default:
        return (
          <ClassCalendarScreen
            cls={openClass}
            onDesign={design}
            onRecord={record}
            onBack={() => {
              setOpenClassId(null);
              setStep(null);
              top();
            }}
          />
        );
    }
  };

  const renderScreen = () => {
    switch (tab) {
      case 'curriculum':
        return <CurriculumScreen />;
      case 'portfolio':
        return <PortfolioScreen />;
      case 'classes':
      default:
        return renderClassesTab();
    }
  };

  return (
    <AppShell
      identity={{
        name: `${coach?.name ?? ''} 코치`,
        meta: `담당 ${myClasses.length}개 반 · 원생 ${myStudents}명`,
      }}
      nav={NAV}
      active={tab}
      onSelect={goTab}
      railFooter={
        openClass &&
        tab === 'classes' && (
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-label text-gold">
              열려 있는 클래스
            </p>
            <p className="mt-1.5 text-[14px] font-semibold text-white">{openClass.title}</p>
            <p className="text-[12px] text-white/50">{openClass.venue}</p>
            {step && step.name !== 'calendar' && (
              <p className="mt-1.5 text-[11px] text-white/35">
                {step.date === TODAY ? '오늘' : step.date} ·{' '}
                {step.name === 'attendance' ? '출결 기록' : '수업 설계'}
              </p>
            )}
          </div>
        )
      }
    >
      {renderScreen()}
    </AppShell>
  );
}
