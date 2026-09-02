/**
 * Coach App.
 *
 * All layout lives in `AppShell` — a persistent green rail on `lg` and up,
 * a bottom bar below that. The page scrolls normally at every size (no inner
 * scroll containers), so sticky action bars behave predictably.
 */

import { useState } from 'react';
import { CalendarCheck, ClipboardList, Home, User } from 'lucide-react';
import type { Class } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/dates';
import { classesForCoach, studentsInClass } from '@/data/selectors';
import { AppShell, type ShellNavItem } from '@/components/AppShell';
import { TodayScreen } from './TodayScreen';
import { SessionBuilderScreen } from './SessionBuilderScreen';
import { AttendanceScreen } from './AttendanceScreen';
import { PortfolioScreen } from './PortfolioScreen';

type Screen = 'today' | 'builder' | 'attendance' | 'portfolio';

const NAV: Array<Omit<ShellNavItem, 'disabled'> & { key: Screen }> = [
  { key: 'today', label: '오늘', icon: Home },
  { key: 'builder', label: '수업 설계', shortLabel: '설계', icon: CalendarCheck },
  { key: 'attendance', label: '출결 기록', shortLabel: '출결', icon: ClipboardList },
  { key: 'portfolio', label: '내 기록', icon: User },
];

export function CoachApp() {
  const { state, dispatch, getCoach } = useApp();
  const [screen, setScreen] = useState<Screen>('today');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Never null in a coach session — the membership row carries the coach id.
  // The type allows null only because owners have no coach row.
  const coachId = state.currentCoachId ?? '';
  const coach = getCoach(coachId);
  const selectedClass = state.classes.find((c) => c.id === selectedClassId) ?? null;

  // RLS has already narrowed `state.classes` to this coach's classes; filtering
  // again costs nothing and keeps the screen honest if that ever changes.
  const myClasses = classesForCoach(state.classes, coachId);
  const myStudents = myClasses.reduce(
    (sum, c) => sum + studentsInClass(state.students, c.id).length,
    0,
  );

  const pickClass = (cls: Class) => {
    setSelectedClassId(cls.id);
    dispatch({ type: 'builder/selectClass', classId: cls.id });
    dispatch({ type: 'builder/clear' });
    setScreen('builder');
    window.scrollTo({ top: 0 });
  };

  const goTab = (key: string) => {
    const next = key as Screen;
    // Builder and attendance both need a class in hand. Rather than silently
    // bouncing (which reads as "the button is broken"), fall back to the
    // picker so the coach sees why nothing happened.
    if ((next === 'builder' || next === 'attendance') && !selectedClass) {
      setScreen('today');
    } else if (next === 'attendance' && !state.attendanceDraft) {
      // No live session: start one for the selected class. `TODAY` is local
      // time — `toISOString()` would drift a day for KST evenings.
      dispatch({ type: 'attendance/start', classId: selectedClass!.id, date: TODAY });
      setScreen('attendance');
    } else {
      setScreen(next);
    }
    window.scrollTo({ top: 0 });
  };

  const renderScreen = () => {
    switch (screen) {
      case 'builder':
        return selectedClass ? (
          <SessionBuilderScreen
            cls={selectedClass}
            onStartSession={() => {
              setScreen('attendance');
              window.scrollTo({ top: 0 });
            }}
            onBack={() => setScreen('today')}
          />
        ) : (
          <TodayScreen onPickClass={pickClass} />
        );

      case 'attendance':
        return selectedClass ? (
          <AttendanceScreen
            cls={selectedClass}
            onDone={() => {
              setScreen('today');
              window.scrollTo({ top: 0 });
            }}
            onBack={() => setScreen('builder')}
          />
        ) : (
          <TodayScreen onPickClass={pickClass} />
        );

      case 'portfolio':
        return <PortfolioScreen />;

      case 'today':
      default:
        return <TodayScreen onPickClass={pickClass} />;
    }
  };

  const nav: ShellNavItem[] = NAV.map((item) => ({
    ...item,
    disabled: (item.key === 'builder' || item.key === 'attendance') && !selectedClass,
  }));

  return (
    <AppShell
      identity={{
        name: `${coach?.name ?? ''} 코치`,
        meta: `담당 ${myClasses.length}개 반 · 원생 ${myStudents}명`,
      }}
      nav={nav}
      active={screen}
      onSelect={goTab}
      railFooter={
        selectedClass && (
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-label text-gold">
              선택된 클래스
            </p>
            <p className="mt-1.5 text-[14px] font-semibold text-white">{selectedClass.title}</p>
            <p className="text-[12px] text-white/50">{selectedClass.venue}</p>
          </div>
        )
      }
    >
      {renderScreen()}
    </AppShell>
  );
}
