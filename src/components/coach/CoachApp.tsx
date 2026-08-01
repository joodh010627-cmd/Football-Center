/**
 * Coach App shell.
 *
 * PC-first: a persistent left rail on `lg` and up, collapsing to a fixed
 * bottom bar on tablet/phone. The page scrolls normally at every size — no
 * inner scroll containers — so sticky action bars behave predictably.
 */

import { useState } from 'react';
import { CalendarCheck, ClipboardList, Home, User } from 'lucide-react';
import type { Class } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/mockData';
import { cn } from '@/lib/cn';
import { TodayScreen } from './TodayScreen';
import { SessionBuilderScreen } from './SessionBuilderScreen';
import { AttendanceScreen } from './AttendanceScreen';
import { PortfolioScreen } from './PortfolioScreen';

type Screen = 'today' | 'builder' | 'attendance' | 'portfolio';

const NAV: Array<{ key: Screen; label: string; icon: typeof Home }> = [
  { key: 'today', label: '오늘', icon: Home },
  { key: 'builder', label: '수업 설계', icon: CalendarCheck },
  { key: 'attendance', label: '출결 기록', icon: ClipboardList },
  { key: 'portfolio', label: '내 기록', icon: User },
];

export function CoachApp() {
  const { state, dispatch, getCoach } = useApp();
  const [screen, setScreen] = useState<Screen>('today');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const coach = getCoach(state.currentCoachId);
  const selectedClass = state.classes.find((c) => c.id === selectedClassId) ?? null;

  const pickClass = (cls: Class) => {
    setSelectedClassId(cls.id);
    dispatch({ type: 'builder/selectClass', classId: cls.id });
    dispatch({ type: 'builder/clear' });
    setScreen('builder');
    window.scrollTo({ top: 0 });
  };

  const goTab = (key: Screen) => {
    // Builder and attendance both need a class in hand. Rather than silently
    // bouncing (which reads as "the button is broken"), fall back to the
    // picker so the coach sees why nothing happened.
    if ((key === 'builder' || key === 'attendance') && !selectedClass) {
      setScreen('today');
    } else if (key === 'attendance' && !state.attendanceDraft) {
      // No live session: start one for the selected class. `TODAY` is local
      // time — `toISOString()` would drift a day for KST evenings.
      dispatch({ type: 'attendance/start', classId: selectedClass!.id, date: TODAY });
      setScreen('attendance');
    } else {
      setScreen(key);
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

  const isActive = (key: Screen) => screen === key;
  const isDisabled = (key: Screen) => (key === 'builder' || key === 'attendance') && !selectedClass;

  return (
    <div className="min-h-screen bg-surface-soft">
      <div className="mx-auto flex max-w-[1440px]">
        {/* --- Desktop rail ------------------------------------------- */}
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-hairline bg-canvas px-4 py-6 lg:flex">
          <div className="flex items-center gap-2.5 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-pitch text-[15px] font-bold text-white">
              FC
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">{coach?.name} 코치</p>
              <p className="truncate text-[12px] text-steel">코치 앱</p>
            </div>
          </div>

          <nav className="mt-7 space-y-1">
            {NAV.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => goTab(key)}
                disabled={isDisabled(key)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-[14px] font-medium transition-colors duration-150',
                  isActive(key)
                    ? 'bg-tint-lavender text-brand-purple-800'
                    : 'text-slate hover:bg-surface hover:text-ink',
                  isDisabled(key) && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                )}
              >
                <Icon size={17} strokeWidth={isActive(key) ? 2.4 : 2} />
                {label}
              </button>
            ))}
          </nav>

          {selectedClass && (
            <div className="mt-6 rounded-md border border-hairline bg-surface-soft p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[1px] text-stone">
                선택된 클래스
              </p>
              <p className="mt-1 text-[14px] font-semibold text-ink">{selectedClass.title}</p>
              <p className="text-[12px] text-steel">{selectedClass.venue}</p>
            </div>
          )}
        </aside>

        {/* --- Content ------------------------------------------------- */}
        <main className="min-w-0 flex-1 pb-24 lg:pb-0">{renderScreen()}</main>
      </div>

      {/* --- Mobile bottom nav ---------------------------------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-hairline bg-canvas lg:hidden">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => goTab(key)}
            disabled={isDisabled(key)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150',
              isActive(key) ? 'text-primary' : 'text-stone',
              isDisabled(key) && 'opacity-40',
            )}
          >
            <Icon size={19} strokeWidth={isActive(key) ? 2.4 : 2} />
            <span className="text-[11px] font-semibold">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
