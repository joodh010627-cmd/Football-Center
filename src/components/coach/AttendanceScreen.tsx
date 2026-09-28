/**
 * 수업 마무리 — one screen, one button.
 *
 * Everyone starts marked present, so a clean session is one tap: [완료]. The
 * coach taps only the exceptions, and taps a student who stood out to drop a
 * tag. Telling parents is a separate, optional step after the record is saved
 * — finishing a session never waits on a message send. No keyboard, ever.
 *
 * Mobile expands tags inline under the card; desktop keeps a sticky tag panel
 * beside the roster so the list never reflows while tagging.
 */

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MousePointerClick, Send } from 'lucide-react';
import type { AttendanceStatus, Class, ISODate, ParentNotification } from '@/types';
import { useApp } from '@/store/AppContext';
import { useSession } from '@/store/AuthContext';
import { attendanceRateForStudent, planFor, studentsInClass } from '@/data/selectors';
import { composeParentNotification } from '@/lib/notification';
import { ATTENDANCE_LABEL, formatDateKo } from '@/lib/format';
import { NEXT_STATUS, StudentLogCard } from './StudentLogCard';
import { NotificationPreviewModal } from './NotificationPreviewModal';
import { TagRail } from './TagRail';
import { DetailHeader } from '@/components/session/parts';
import { blockAsRun } from '@/data/lessonPrep';

interface AttendanceScreenProps {
  cls: Class;
  /** The calendar day being recorded — not necessarily today. */
  date: ISODate;
  onDone: () => void;
  onBack: () => void;
  /** Name of the screen 뒤로 returns to. */
  backLabel: string;
}

export function AttendanceScreen({ cls, date, onDone, onBack, backLabel }: AttendanceScreenProps) {
  const { state, dispatch, getBlock, getCoach } = useApp();
  const session = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ParentNotification[] | null>(null);
  /** Set once saved: the parent messages that *could* go out, if the coach asks. */
  const [saved, setSaved] = useState<ParentNotification[] | null>(null);

  // A change after saving means the saved record is stale: offer [완료] again.
  const entries = state.attendanceDraft?.entries;
  useEffect(() => setSaved(null), [entries]);

  const draft = state.attendanceDraft;
  const roster = useMemo(() => studentsInClass(state.students, cls.id), [state.students, cls.id]);

  /** The plan registered for this day — its blocks go into the parent report. */
  const plan = planFor(state.sessionPlans, cls.id, date);
  const sessionSummary = (plan?.items ?? [])
    .map((item) => {
      const block = item.blockId ? getBlock(item.blockId) : undefined;
      return block && blockAsRun(block, item).title;
    })
    .filter((t): t is string => Boolean(t));

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
    // An owner recording for a class signs as that class's coach, not as "코치".
    const coachName = getCoach(state.currentCoachId ?? cls.coachId)?.name ?? '담당';

    const payload: ParentNotification[] = roster.map((student) => {
      const entry = draft.entries[student.id] ?? { status: 'present' as const, tags: [] };
      return composeParentNotification({
        student,
        status: entry.status,
        tags: entry.tags,
        date: draft.date,
        academyName: session.academy.name,
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

    dispatch({ type: 'attendance/submit', sessionPlanId: plan?.id });
    setSaved(payload);
  };

  const finish = () => {
    dispatch({ type: 'attendance/discard' });
    onDone();
  };

  const submitBar = saved ? (
    <>
      <p className="mb-2.5 flex items-center justify-center gap-1.5 text-[14px] font-semibold text-primary">
        <CheckCircle2 size={16} />
        저장했어요
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setNotifications(saved)}
          className="btn-secondary flex-1 py-3"
        >
          <Send size={15} strokeWidth={2.4} />
          학부모 알림
        </button>
        <button type="button" onClick={finish} className="btn-primary flex-1 py-3">
          닫기
        </button>
      </div>
    </>
  ) : (
    <button type="button" onClick={handleSubmit} className="btn-primary w-full py-3.5 text-[15px]">
      완료{taggedCount > 0 ? ` · 관찰 ${taggedCount}명` : ''}
    </button>
  );

  return (
    <div>
      <DetailHeader
        backLabel={backLabel}
        onBack={onBack}
        title="수업 기록"
        meta={
          <>
            {cls.title} · {formatDateKo(draft.date)}
            <br />
            출석 {counts.present}
            {counts.absent > 0 && ` · 결석 ${counts.absent}`}
            {counts.injured > 0 && ` · 부상 ${counts.injured}`}
          </>
        }
      />

      <div className="px-5 py-5 sm:px-7 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
          {/* Roster */}
          <div>
            <p className="mb-3 text-[13px] text-steel">
              결석만 오른쪽을 눌러 바꾸고, 눈에 띈 선수는 이름을 눌러 남겨요.
            </p>

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
                  <p className="text-[14px] font-semibold text-ink">눈에 띈 선수를 누르세요</p>
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
        academyId={state.academyId}
        dedupeScope={`${cls.id}:${draft?.date ?? ''}`}
        onClose={() => {
          setNotifications(null);
          finish();
        }}
      />
    </div>
  );
}
