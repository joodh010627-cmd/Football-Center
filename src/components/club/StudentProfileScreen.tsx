/**
 * One student, as a shape.
 *
 * This is where the two halves of the app finally meet. A coach taps behaviour
 * tags at the end of every session; those tags carry an axis; the axes are the
 * same five a training block is classified on. So the pentagon here is not a
 * separate evaluation exercise bolted onto the product — it is the arithmetic
 * on taps that were already happening, and the 추천 훈련 underneath it points
 * back at blocks on the flattest side.
 *
 * The one rule the screen must not break: a child nobody has tagged is shown as
 * *unobserved*, greyed and captioned, never as a child who scored zero. The
 * dashboard learned this lesson once already with `ChurnSignal.computable`.
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, PencilLine, Sparkles } from 'lucide-react';
import type { ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import {
  AXES,
  AXIS_META,
  axisForBlock,
  buildAxisProfile,
  emptyScores,
  isUnobserved,
  scoresOf,
  weakestAxis,
  type AxisScores,
  type DevelopmentAxis,
} from '@/lib/axes';
import { STUDENT_STATUS_LABEL } from '@/data/dates';
import {
  attendanceRateForStudent,
  logsForStudent,
  publishedBlocks,
  studentsInClass,
} from '@/data/selectors';
import { formatDateKo, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/ui/Modal';
import { Pentagon, PentagonEditor } from '@/components/ui/Pentagon';
import { ScreenBody, Section } from '@/components/shell/Shell';

export function StudentProfileScreen({
  studentId,
  onBack,
  backLabel = '뒤로',
}: {
  studentId: ID;
  onBack: () => void;
  /** Name of the screen 뒤로 returns to. */
  backLabel?: string;
}) {
  const { state, getStudent, getClass, churnSignals } = useApp();
  const { overrides, saveEvaluation } = useWorkspace();
  const [editing, setEditing] = useState(false);

  const student = getStudent(studentId);

  const profile = useMemo(
    () => buildAxisProfile(state.attendanceLogs, studentId, state.behaviorTags),
    [state.attendanceLogs, studentId, state.behaviorTags],
  );

  /**
   * The class's pentagon, averaged. Read against it, a 62 means "ahead of the
   * other eleven children in the room" rather than a number with no scale.
   */
  const classAverage = useMemo<AxisScores | undefined>(() => {
    if (!student) return undefined;
    const peers = studentsInClass(state.students, student.classId).filter(
      (s) => s.id !== student.id,
    );
    if (peers.length === 0) return undefined;

    const total = emptyScores(0);
    for (const peer of peers) {
      const peerScores = scoresOf(
        buildAxisProfile(state.attendanceLogs, peer.id, state.behaviorTags),
      );
      for (const axis of AXES) total[axis] += peerScores[axis];
    }
    for (const axis of AXES) total[axis] = Math.round(total[axis] / peers.length);
    return total;
  }, [student, state.students, state.attendanceLogs, state.behaviorTags]);

  const weakest = weakestAxis(profile);

  // What to run next: published blocks that move the flattest axis, most-used
  // first. The library is already ordered by usage, so this is a filter rather
  // than a recommendation engine — and it is honest about being one.
  //
  // Computed before the missing-student guard below: every hook on this screen
  // has to run on every render, and an early return above a `useMemo` is the
  // one way to break that.
  const suggested = useMemo(
    () =>
      publishedBlocks(state.trainingBlocks)
        .filter((b) => axisForBlock(b) === weakest)
        .filter(
          (b) =>
            !student || b.ageGroups.length === 0 || b.ageGroups.includes(student.ageGroup),
        )
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 3),
    [state.trainingBlocks, weakest, student],
  );

  if (!student) {
    return (
      <ScreenBody>
        <BackLink onBack={onBack} label={backLabel} />
        <p className="py-10 text-center text-[14px] text-steel">원생을 찾을 수 없습니다.</p>
      </ScreenBody>
    );
  }

  const override = overrides[studentId];
  const derived = scoresOf(profile);
  const scores = override?.scores ?? derived;
  const unobserved = isUnobserved(profile) && !override;

  const cls = getClass(student.classId);
  const signal = churnSignals.get(student.id);
  const logs = logsForStudent(state.attendanceLogs, student.id);
  const attendance = attendanceRateForStudent(state.attendanceLogs, student.id);

  return (
    <>
      <header className="px-5 pb-1 pt-5 sm:px-7 lg:px-10 lg:pt-8">
        <BackLink onBack={onBack} label={backLabel} />

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[27px] font-bold leading-[1.15] tracking-tightest text-ink">
              {student.name}
              <span className="ml-2 text-[17px] font-semibold text-slate">{student.ageGroup}</span>
            </h1>
            <p className="mt-1.5 text-[13.5px] text-steel">
              {cls?.title ?? '미배정'} · 최근 30일 출석 {formatPercent(attendance)}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold',
              student.status === 'at_risk'
                ? 'bg-tint-alert text-error'
                : student.status === 'inactive'
                  ? 'bg-surface text-steel'
                  : 'bg-tint-mint text-brand-green',
            )}
          >
            {STUDENT_STATUS_LABEL[student.status]}
          </span>
        </div>
      </header>

      <ScreenBody>
        {/* --- Churn ------------------------------------------------------ */}
        {signal && signal.computable && signal.score >= 55 && (
          <div className="rounded-lg border border-tint-alert bg-tint-alert-soft px-4 py-3.5">
            <p className="text-[13px] font-bold text-error">
              이탈 위험 {signal.score} · {signal.severity === 'critical' ? '즉시 연락' : '관찰 필요'}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {signal.reasons.map((reason) => (
                <li key={reason} className="text-[13px] leading-[1.5] text-slate">
                  · {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* --- Pentagon ---------------------------------------------------- */}
        <Section
          title="성장 평가"
          action={
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-semibold text-primary transition-colors hover:bg-primary-wash"
            >
              <PencilLine size={14} strokeWidth={2.3} />
              직접 조정
            </button>
          }
        >
          <div className="rounded-xl border border-hairline bg-canvas px-3 py-4">
            <Pentagon
              scores={scores}
              compare={classAverage}
              unobserved={unobserved}
              className="mx-auto max-w-[360px]"
            />

            {unobserved ? (
              <p className="mt-2 rounded-md bg-surface px-3.5 py-3 text-[12.5px] leading-[1.6] text-steel">
                아직 이 원생에게 기록된 행동 태그가 없습니다. 출결을 기록할 때 태그를 남기면 다섯
                영역이 채워집니다 — 지금 보이는 도형은 점수가 아니라 <strong>기본값</strong>입니다.
              </p>
            ) : (
              <p className="mt-2 px-1 text-[12.5px] leading-[1.6] text-steel">
                {override
                  ? `${override.ratedBy} 코치가 직접 조정한 평가입니다.`
                  : '출결 기록에 남긴 행동 태그에서 자동 계산되었습니다.'}
              </p>
            )}
          </div>

          {/* --- Axis breakdown ------------------------------------------- */}
          <ul className="mt-3 space-y-2">
            {AXES.map((axis) => {
              const reading = profile[axis];
              const meta = AXIS_META[axis];
              const value = scores[axis];

              return (
                <li key={axis} className="rounded-lg border border-hairline bg-canvas px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[14.5px] font-bold text-ink">
                      {meta.label}
                      <span className="ml-2 text-[12px] font-normal text-stone">
                        {meta.meaning}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-[16px] font-bold tabular-nums',
                        unobserved ? 'text-stone' : 'text-primary',
                      )}
                    >
                      {unobserved ? '—' : value}
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-500 ease-smooth',
                        unobserved ? 'bg-hairline-strong' : 'bg-primary',
                      )}
                      style={{ width: `${unobserved ? 0 : value}%` }}
                    />
                  </div>

                  {reading.evidence.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {reading.evidence.slice(0, 4).map(([label, count]) => (
                        <span
                          key={label}
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11.5px] font-medium',
                            meta.wash,
                            meta.tone,
                          )}
                        >
                          {label}
                          {count > 1 && ` ×${count}`}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11.5px] text-stone">{meta.items.join(' · ')}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>

        {/* --- What to run next -------------------------------------------- */}
        {!unobserved && suggested.length > 0 && (
          <Section title={`다음 훈련 제안 — ${AXIS_META[weakest].label}`}>
            <div className="rounded-lg border border-hairline bg-canvas p-4">
              {/* The icon is a sibling of the paragraph, not a child of it: a
                  flex container turns every text run into its own flex item,
                  which breaks the sentence into columns. */}
              <div className="flex items-start gap-2">
                <Sparkles size={15} className="mt-[3px] shrink-0 text-primary" strokeWidth={2.2} />
                <p className="min-w-0 text-[13px] leading-[1.6] text-slate">
                  가장 낮은 영역은{' '}
                  <strong className="whitespace-nowrap font-semibold text-ink">
                    {AXIS_META[weakest].label}
                  </strong>
                  입니다. 이 영역을 다루는 블록 중 많이 쓰인 순입니다.
                </p>
              </div>
              <ul className="mt-3 space-y-1.5">
                {suggested.map((block) => (
                  <li
                    key={block.id}
                    className="flex items-center gap-2.5 rounded-md bg-surface-soft px-3.5 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">
                        {block.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-steel">
                        {block.durationMin}분 · {block.usageCount}회 사용
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        )}

        {/* --- Attendance history -------------------------------------------- */}
        <Section title="출결 기록" meta={`${logs.length}회`}>
          {logs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-hairline-strong bg-canvas px-4 py-8 text-center text-[13px] text-steel">
              기록된 출결이 없습니다.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
              {logs.slice(0, 12).map((log) => (
                <li
                  key={log.id}
                  className="flex items-start gap-3 border-b border-hairline-soft px-4 py-3 last:border-b-0"
                >
                  <span
                    className={cn(
                      'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                      log.status === 'present'
                        ? 'bg-tint-mint text-brand-green'
                        : log.status === 'injured'
                          ? 'bg-tint-yellow text-primary-deep'
                          : 'bg-tint-alert text-error',
                    )}
                  >
                    {log.status === 'present' ? '출석' : log.status === 'injured' ? '부상' : '결석'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-charcoal">
                      {formatDateKo(log.date)}
                    </span>
                    {log.tags.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {log.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-slate"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </ScreenBody>

      <EvaluationEditor
        key={`${studentId}-${override?.ratedAt ?? ''}`}
        open={editing}
        initial={scores}
        derived={derived}
        onClose={() => setEditing(false)}
        onSave={(next, note) => {
          saveEvaluation(studentId, student.name, next, note);
          setEditing(false);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function EvaluationEditor({
  open,
  initial,
  derived,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: AxisScores;
  derived: AxisScores;
  onClose: () => void;
  onSave: (scores: AxisScores, note: string) => void;
}) {
  const [scores, setScores] = useState<AxisScores>(initial);
  const [note, setNote] = useState('');

  const set = (axis: DevelopmentAxis, value: number) =>
    setScores((prev) => ({ ...prev, [axis]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title="성장 평가 조정"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScores(derived)}
            className="btn-secondary shrink-0 py-3 text-[14px]"
          >
            자동값으로
          </button>
          <button
            type="button"
            onClick={() => onSave(scores, note.trim())}
            className="btn-primary flex-1 py-3 text-[15px]"
          >
            저장
          </button>
        </div>
      }
    >
      <p className="text-[13px] leading-[1.65] text-slate">
        기본값은 출결에 남긴 행동 태그에서 계산됩니다. 태그가 담지 못한 부분만 손으로 고치세요 —
        조정한 사실과 사유는 활동 기록에 남습니다.
      </p>

      <div className="mt-5">
        <PentagonEditor scores={scores} onChange={set} />
      </div>

      <label className="mt-5 block">
        <span className="text-[13px] font-semibold text-charcoal">조정 사유</span>
        <textarea
          className="input-field mt-1.5 min-h-[72px] resize-none"
          placeholder="예: 최근 두 달 경기에서 압박 대응이 눈에 띄게 늘었음"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
    </Modal>
  );
}

function BackLink({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1 text-[13.5px] font-medium text-steel transition-colors hover:text-ink"
    >
      <ArrowLeft size={15} strokeWidth={2.2} />
      {label}
    </button>
  );
}
