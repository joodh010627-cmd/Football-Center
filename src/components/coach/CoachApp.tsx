/**
 * Coach App shell — locked to a 430px viewport.
 *
 * On desktop it renders inside a phone frame so the owner can see exactly what
 * the coach sees; on an actual phone the frame collapses to full-bleed.
 */

import { useState } from 'react';
import { CalendarCheck, Home, User } from 'lucide-react';
import type { Class } from '@/types';
import { useApp } from '@/store/AppContext';
import { cn } from '@/lib/cn';
import { TodayScreen } from './TodayScreen';
import { SessionBuilderScreen } from './SessionBuilderScreen';
import { AttendanceScreen } from './AttendanceScreen';
import { PortfolioScreen } from './PortfolioScreen';

type Screen = 'today' | 'builder' | 'attendance' | 'portfolio';

const NAV: Array<{ key: Screen; label: string; icon: typeof Home }> = [
  { key: 'today', label: '오늘', icon: Home },
  { key: 'builder', label: '수업 설계', icon: CalendarCheck },
  { key: 'portfolio', label: '내 기록', icon: User },
];

export function CoachApp() {
  const { state, dispatch } = useApp();
  const [screen, setScreen] = useState<Screen>('today');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const selectedClass = state.classes.find((c) => c.id === selectedClassId) ?? null;

  const pickClass = (cls: Class) => {
    setSelectedClassId(cls.id);
    dispatch({ type: 'builder/selectClass', classId: cls.id });
    dispatch({ type: 'builder/clear' });
    setScreen('builder');
  };

  const goTab = (key: Screen) => {
    // The builder needs a class in hand; bounce back to the picker if none.
    if (key === 'builder' && !selectedClass) {
      setScreen('today');
      return;
    }
    setScreen(key);
  };

  const renderScreen = () => {
    switch (screen) {
      case 'builder':
        return selectedClass ? (
          <SessionBuilderScreen
            cls={selectedClass}
            onStartSession={() => setScreen('attendance')}
            onBack={() => setScreen('today')}
          />
        ) : (
          <TodayScreen onPickClass={pickClass} />
        );

      case 'attendance':
        return selectedClass ? (
          <AttendanceScreen
            cls={selectedClass}
            onDone={() => setScreen('today')}
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-0 py-0 sm:px-6 sm:py-8">
      <div
        className={cn(
          'relative flex h-screen w-full max-w-[430px] flex-col overflow-hidden bg-canvas',
          'sm:h-[880px] sm:max-h-[calc(100vh-64px)] sm:rounded-[36px] sm:border-[10px] sm:border-navy-deep sm:shadow-mockup',
        )}
      >
        <main className="min-h-0 flex-1 overflow-hidden">{renderScreen()}</main>

        <nav className="z-30 flex h-[68px] shrink-0 items-stretch border-t border-hairline bg-canvas">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = screen === key || (key === 'builder' && screen === 'attendance');
            return (
              <button
                key={key}
                type="button"
                onClick={() => goTab(key)}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 pt-1 transition-colors duration-150',
                  active ? 'text-primary' : 'text-stone',
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[11px] font-semibold">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
