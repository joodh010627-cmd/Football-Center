/**
 * 3-Touch Fast Logging.
 *
 * Everyone starts marked present, so a clean session is zero taps. The coach
 * taps only the exceptions, taps a student to drop 1–2 behaviour tags, and
 * hits 제출. No keyboard is ever summoned.
 *
 * Mobile expands tags inline under the card; desktop keeps a sticky tag panel
 * beside the roster so the list never reflows while tagging.
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, ListChecks, MousePointerClick, Send } from 'lucide-react';
import type { AttendanceStatus, Class, ParentNotification } from '@/types';
import { useApp } from '@/store/AppContext';
import { TODAY } from '@/data/dates';
import { attendanceRateForStudent, studentsInClass } from '@/data/selectors';
import { composeParentNotification } from '@/lib/notification';
import { ATTENDANCE_LABEL, formatDateKo } from '@/lib/format';
import { NEXT_STATUS, StudentLogCard } from './StudentLogCard';
import { NotificationPreviewModal } from './NotificationPreviewModal';
import { TagRail } from './TagRail';

interface AttendanceScreenProps {
  cls: Class;
  onDone: () => void;
  onBack: () => void;
}

export function AttendanceScreen({ cls, onDone, onBack }: AttendanceScreenProps) {
  const { state, dispatch, getBlock, getCoach } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ParentNotification[] | null>(null);

  const draft = state.attendanceDraft;
  const roster = useMemo(() => studentsInClass(state.students, cls.id), [state.students, cls.id]);

  /** The plan committed a moment ago in the builder — used in the report text. */
  const todaysPlan = state.sessionPlans.find((p) => p.classId === cls.id && p.date === TODAY);
  const sessionSummary = todaysPlan
    ? (Object.values(todaysPlan.slots).filter(Boolean) as string[])
        .map((id) => getBlock(id)?.title)
        .filter((t): t is string => Boolean(t))
    : [];

  if (!draft) {
    return (
      <div className="px-5 py-20 text-center text-sm text-slate">
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
  const selected = roster.find((s) => s.id === selectedId) ?? null;
  const selectedEntry = selected ? draft.entries[selected.id] : undefined;

  const handleSubmit = () => {
    const coachName = getCoach(state.currentCoachId ?? '')?.name ?? '코치';

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

  const submitBar = (
    <>
      <div className="mb-2 flex items-center justify-center gap-1.5 text-[12px] text-steel">
        <CheckCircle2 size={13} className="text-brand-green" />
        {roster.length}명 기록 · {taggedCount}명 행동 태그 부착
      </div>
      <button type="button" onClick={handleSubmit} className="btn-primary w-full py-3.5 text-[15px]">
        <Send size={16} strokeWidth={2.4} />
        제출하고 학부모 리포트 발송
      </button>
    </>
  );

  return (
    <div>
      <header className="border-b border-hairline bg-canvas px-5 pb-4 pt-6 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-[13px] font-medium text-steel transition-colors hover:text-ink"
        >
          ← 훈련 설계
        </button>

        <h1 className="text-[25px] font-semibold leading-[1.2] tracking-tightest text-ink lg:text-[32px]">
          출결 &amp; 행동 기록
        </h1>
        <p className="mt-1 text-[13px] text-slate lg:text-sm">
          {cls.title} · {formatDateKo(draft.date)}
        </p>

        <div className="mt-4 flex gap-2 lg:max-w-md">
          <span className="flex-1 rounded-md bg-tint-mint px-2 py-2 text-center text-[13px] font-semibold text-brand-green">
            출석 {counts.present}
          </span>
          <span className="flex-1 rounded-md bg-tint-alert px-2 py-2 text-center text-[13px] font-semibold text-error">
            결석 {counts.absent}
          </span>
          <span className="flex-1 rounded-md bg-tint-peach px-2 py-2 text-center text-[13px] font-semibold text-brand-orange-deep">
            부상 {counts.injured}
          </span>
        </div>
      </header>

      <div className="px-5 py-6 sm:px-8 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
          {/* Roster */}
          <div>
            <div className="mb-3 flex items-center gap-1.5 text-[12px] text-stone">
              <ListChecks size={13} />
              전원 출석으로 시작합니다. 예외만 탭하세요.
            </div>

            <div className="grid gap-2 xl:grid-cols-2">
              {roster.map((student) => {
                const entry = draft.entries[student.id] ?? { status: 'present' as const, tags: [] };
                return (
                  <StudentLogCard
                    key={student.id}
                    student={student}
                    status={entry.status}
                    tags={entry.tags}
                    selected={selectedId === student.id}
                    onSelect={() =>
                      setSelectedId((prev) => (prev === student.id ? null : student.id))
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

          {/* Desktop tag panel + submit */}
          <div className="hidden lg:sticky lg:top-6 lg:block">
            <div className="rounded-lg border border-hairline bg-canvas p-5">
              {selected && selectedEntry ? (
                <>
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-semibold text-ink">{selected.name}</p>
                      <p className="text-[12px] text-steel">
                        {selected.ageGroup} · {ATTENDANCE_LABEL[selectedEntry.status]}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-sm bg-tint-lavender px-2 py-1 text-[12px] font-semibold text-brand-purple-800">
                      태그 {selectedEntry.tags.length}
                    </span>
                  </div>

                  {selectedEntry.status === 'present' ? (
                    <TagRail
                      selected={selectedEntry.tags}
                      onToggle={(tag) =>
                        dispatch({ type: 'attendance/toggleTag', studentId: selected.id, tag })
                      }
                    />
                  ) : (
                    <p className="py-6 text-center text-[13px] leading-[1.5] text-slate">
                      {ATTENDANCE_LABEL[selectedEntry.status]} 처리된 원생은
                      <br />
                      행동 태그를 기록하지 않습니다.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <MousePointerClick size={22} className="text-stone" />
                  <p className="text-[14px] font-semibold text-ink">원생을 선택하세요</p>
                  <p className="max-w-[220px] text-[13px] leading-[1.5] text-slate">
                    카드를 클릭하면 여기에 행동 태그 칩이 나타납니다.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-hairline bg-canvas p-4">{submitBar}</div>
          </div>
        </div>
      </div>

      {/* Mobile submit */}
      <div className="sticky bottom-14 z-30 border-t border-hairline bg-canvas px-5 py-3 shadow-[0_-4px_12px_rgba(14,19,16,0.06)] sm:px-8 lg:hidden">
        {submitBar}
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
