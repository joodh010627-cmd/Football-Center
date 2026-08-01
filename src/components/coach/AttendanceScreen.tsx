/**
 * 3-Touch Fast Logging.
 *
 * Everyone starts marked present, so a clean session is zero taps. The coach
 * taps only the exceptions, taps a student to drop 1–2 behaviour tags inline,
 * and hits 제출. No keyboard is ever summoned.
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, ListChecks, Send } from 'lucide-react';
import type { AttendanceStatus, Class, ParentNotification } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/mockData';
import { attendanceRateForStudent, studentsInClass } from '@/data/selectors';
import { composeParentNotification } from '@/lib/notification';
import { formatDateKo } from '@/lib/format';
import { NEXT_STATUS, StudentLogCard } from './StudentLogCard';
import { NotificationPreviewModal } from './NotificationPreviewModal';

interface AttendanceScreenProps {
  cls: Class;
  onDone: () => void;
  onBack: () => void;
}

export function AttendanceScreen({ cls, onDone, onBack }: AttendanceScreenProps) {
  const { state, dispatch, getBlock, getCoach } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ParentNotification[] | null>(null);

  const draft = state.attendanceDraft;
  const roster = useMemo(
    () => studentsInClass(state.students, cls.id),
    [state.students, cls.id],
  );

  /** The plan committed a moment ago in the builder — used in the report text. */
  const todaysPlan = state.sessionPlans.find((p) => p.classId === cls.id && p.date === TODAY);
  const sessionSummary = todaysPlan
    ? (Object.values(todaysPlan.slots).filter(Boolean) as string[])
        .map((id) => getBlock(id)?.title)
        .filter((t): t is string => Boolean(t))
    : [];

  if (!draft) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate">
        진행 중인 출결 기록이 없습니다.
      </div>
    );
  }

  const counts = roster.reduce(
    (acc, s) => {
      const status = draft.entries[s.id]?.status ?? 'present';
      acc[status] += 1;
      return acc;
    },
    { present: 0, absent: 0, injured: 0 } as Record<AttendanceStatus, number>,
  );

  const taggedCount = roster.filter((s) => (draft.entries[s.id]?.tags.length ?? 0) > 0).length;

  const handleSubmit = () => {
    const coachName = getCoach(state.currentCoachId)?.name ?? '코치';

    const payload: ParentNotification[] = roster.map((student) => {
      const entry = draft.entries[student.id] ?? { status: 'present' as const, tags: [] };
      return composeParentNotification({
        student,
        status: entry.status,
        tags: entry.tags,
        date: draft.date,
        className: cls.title,
        coachName,
        attendanceRate: attendanceRateForStudent(state.attendanceLogs, student.id),
        sessionSummary,
      });
    });

    // Spec: submitted data lands in console + context state.
    console.group(`[Football Center] 출결 제출 — ${cls.title} / ${draft.date}`);
    console.table(
      roster.map((s) => ({
        학생: s.name,
        출결: draft.entries[s.id]?.status ?? 'present',
        태그: (draft.entries[s.id]?.tags ?? []).join(', '),
      })),
    );
    console.log('오늘의 훈련 구성:', sessionSummary);
    console.log('발송 예정 알림톡:', payload);
    console.groupEnd();

    dispatch({ type: 'attendance/submit', sessionPlanId: todaysPlan?.id });
    setNotifications(payload);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-hairline bg-canvas px-5 pb-3 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-[13px] font-medium text-steel transition-colors hover:text-ink"
        >
          ← 훈련 설계
        </button>

        <h1 className="truncate text-[22px] font-semibold leading-[1.3] tracking-[-0.3px] text-ink">
          출결 &amp; 행동 기록
        </h1>
        <p className="mt-0.5 text-[13px] text-slate">
          {cls.title} · {formatDateKo(draft.date)}
        </p>

        <div className="mt-3 flex gap-1.5">
          <span className="flex-1 rounded-md bg-tint-mint px-2 py-2 text-center text-[13px] font-semibold text-brand-green">
            출석 {counts.present}
          </span>
          <span className="flex-1 rounded-md bg-[#fde2e2] px-2 py-2 text-center text-[13px] font-semibold text-error">
            결석 {counts.absent}
          </span>
          <span className="flex-1 rounded-md bg-tint-peach px-2 py-2 text-center text-[13px] font-semibold text-brand-orange-deep">
            부상 {counts.injured}
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-soft px-5 py-4 pb-44">
        <div className="mb-3 flex items-center gap-1.5 text-[12px] text-stone">
          <ListChecks size={13} />
          전원 출석으로 시작합니다. 예외만 탭하세요.
        </div>

        <div className="space-y-2">
          {roster.map((student) => {
            const entry = draft.entries[student.id] ?? { status: 'present' as const, tags: [] };
            return (
              <StudentLogCard
                key={student.id}
                student={student}
                status={entry.status}
                tags={entry.tags}
                expanded={expandedId === student.id}
                onToggleExpand={() =>
                  setExpandedId((prev) => (prev === student.id ? null : student.id))
                }
                onCycleStatus={() =>
                  dispatch({
                    type: 'attendance/setStatus',
                    studentId: student.id,
                    status: NEXT_STATUS[entry.status],
                  })
                }
                onToggleTag={(tag) =>
                  dispatch({ type: 'attendance/toggleTag', studentId: student.id, tag })
                }
              />
            );
          })}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[68px] z-20 border-t border-hairline bg-canvas px-5 py-3 shadow-[0_-4px_12px_rgba(15,15,15,0.06)]">
        <div className="mb-2 flex items-center justify-center gap-1.5 text-[12px] text-steel">
          <CheckCircle2 size={13} className="text-brand-green" />
          {roster.length}명 기록 · {taggedCount}명 행동 태그 부착
        </div>
        <button type="button" onClick={handleSubmit} className="btn-primary w-full py-3.5 text-[15px]">
          <Send size={16} strokeWidth={2.4} />
          제출하고 학부모 리포트 발송
        </button>
      </div>

      <NotificationPreviewModal
        open={notifications !== null}
        notifications={notifications ?? []}
        onClose={() => {
          setNotifications(null);
          dispatch({ type: 'attendance/discard' });
          onDone();
        }}
      />
    </div>
  );
}
