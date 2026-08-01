/**
 * Quantitative growth report for one student.
 *
 * This is what the owner reads to the parent on the retention call: an
 * 8-week attendance strip, the behaviour tags that recur, and the churn
 * evidence — all of it a by-product of the coach's taps.
 */

import { useMemo } from 'react';
import { CalendarClock, MessageCircle, Phone, TrendingUp } from 'lucide-react';
import type { Student } from '@/types';
import { useApp } from '@/store/AppContext';
import { attendanceRateForStudent, logsForStudent, tagFrequency } from '@/data/selectors';
import { ATTENDANCE_LABEL, formatDateKo, formatDateShort, formatPercent, formatWon } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

const STRIP_COLOR = {
  present: 'bg-brand-green',
  absent: 'bg-error',
  injured: 'bg-brand-orange',
} as const;

interface StudentDetailModalProps {
  student: Student | null;
  onClose: () => void;
}

export function StudentDetailModal({ student, onClose }: StudentDetailModalProps) {
  const { state, churnSignals, getClass } = useApp();

  const logs = useMemo(
    () => (student ? logsForStudent(state.attendanceLogs, student.id) : []),
    [state.attendanceLogs, student],
  );
  const tags = useMemo(
    () => (student ? tagFrequency(state.attendanceLogs, student.id) : []),
    [state.attendanceLogs, student],
  );

  if (!student) return null;

  const signal = churnSignals.get(student.id);
  const cls = getClass(student.classId);
  const rate30 = attendanceRateForStudent(state.attendanceLogs, student.id, 30);
  const rate90 = attendanceRateForStudent(state.attendanceLogs, student.id, 90);
  const trend = rate30 - rate90;

  // Oldest → newest so the strip reads left-to-right like a timeline.
  const strip = [...logs].reverse().slice(-24);
  const maxTagCount = tags[0]?.[1] ?? 1;

  return (
    <Modal
      open
      onClose={onClose}
      className="max-w-2xl"
      title={
        <span className="flex flex-wrap items-center gap-2">
          {student.name}
          <Badge tone="sky">{student.ageGroup}</Badge>
          <span className="text-sm font-normal text-steel">{cls?.title}</span>
        </span>
      }
    >
      <div className="space-y-6">
        {/* --- Churn evidence ---------------------------------------- */}
        {signal && (
          <section
            className={cn(
              'rounded-lg p-4',
              signal.score >= 55 ? 'bg-[#fef4f4]' : 'bg-surface-soft',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-ink">이탈 위험도</h3>
              <span className="text-[22px] font-semibold tracking-[-0.5px] text-ink">
                {signal.score}
                <span className="text-[13px] font-medium text-steel"> /100</span>
              </span>
            </div>
            <ProgressBar
              className="mt-2.5"
              value={signal.score / 100}
              barClassName={signal.score >= 78 ? 'bg-error' : signal.score >= 55 ? 'bg-brand-orange' : 'bg-brand-green'}
            />
            <ul className="mt-3 space-y-1">
              {signal.reasons.map((r) => (
                <li key={r} className="text-[13px] leading-[1.5] text-charcoal">
                  · {r}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* --- Numbers ------------------------------------------------ */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="30일 출석률" value={formatPercent(rate30)} />
          <Metric
            label="추세 (vs 90일)"
            value={`${trend >= 0 ? '+' : ''}${formatPercent(trend)}`}
            tone={trend >= 0 ? 'up' : 'down'}
          />
          <Metric label="누적 기록" value={`${logs.length}건`} />
          <Metric label="월 수강료" value={formatWon(student.monthlyFee)} />
        </section>

        {/* --- Attendance strip --------------------------------------- */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            <CalendarClock size={15} className="text-primary" />
            최근 출결 흐름
          </h3>
          <div className="flex flex-wrap gap-1">
            {strip.map((log) => (
              <span
                key={log.id}
                title={`${formatDateKo(log.date)} · ${ATTENDANCE_LABEL[log.status]}${log.tags.length ? ` · ${log.tags.join(', ')}` : ''}`}
                className={cn('h-7 w-4 rounded-xs', STRIP_COLOR[log.status])}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-4 text-[12px] text-steel">
            <span>{strip.length > 0 ? formatDateShort(strip[0].date) : ''} →</span>
            <span className="flex items-center gap-1">
              <i className="h-2 w-2 rounded-full bg-brand-green" /> 출석
            </span>
            <span className="flex items-center gap-1">
              <i className="h-2 w-2 rounded-full bg-error" /> 결석
            </span>
            <span className="flex items-center gap-1">
              <i className="h-2 w-2 rounded-full bg-brand-orange" /> 부상
            </span>
          </div>
        </section>

        {/* --- Behaviour profile -------------------------------------- */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            <TrendingUp size={15} className="text-primary" />
            행동 태그 누적
          </h3>
          {tags.length > 0 ? (
            <div className="space-y-2">
              {tags.slice(0, 6).map(([tag, count]) => (
                <div key={tag} className="flex items-center gap-3">
                  <span className="w-[104px] shrink-0 truncate text-[13px] font-medium text-charcoal">
                    {tag}
                  </span>
                  <ProgressBar value={count / maxTagCount} />
                  <span className="w-8 shrink-0 text-right text-[13px] font-semibold text-ink">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate">아직 기록된 태그가 없습니다.</p>
          )}
        </section>

        {/* --- Coach comments ----------------------------------------- */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            <MessageCircle size={15} className="text-primary" />
            코치 코멘트 이력
          </h3>
          <div className="space-y-2">
            {logs
              .filter((l) => l.coachComment)
              .slice(0, 4)
              .map((l) => (
                <div key={l.id} className="rounded-md border border-hairline bg-surface-soft px-3 py-2">
                  <p className="text-[12px] font-semibold text-steel">{formatDateKo(l.date)}</p>
                  <p className="mt-0.5 text-[13px] leading-[1.5] text-charcoal">{l.coachComment}</p>
                </div>
              ))}
            {logs.every((l) => !l.coachComment) && (
              <p className="text-sm text-slate">코멘트 기록이 없습니다.</p>
            )}
          </div>
        </section>

        {/* --- Parent -------------------------------------------------- */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-soft px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-ink">
              {student.parentName} 학부모님
            </p>
            <p className="text-[12px] text-steel">
              최근 소통 {student.lastParentContactDate ? formatDateKo(student.lastParentContactDate) : '기록 없음'}
            </p>
          </div>
          <a href={`tel:${student.parentPhone.replace(/-/g, '')}`} className="btn-secondary">
            <Phone size={14} />
            {student.parentPhone}
          </a>
        </section>
      </div>
    </Modal>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down';
}) {
  return (
    <div className="rounded-lg border border-hairline bg-canvas px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-steel">{label}</p>
      <p
        className={cn(
          'mt-1 text-[18px] font-semibold tracking-[-0.3px]',
          tone === 'up' ? 'text-brand-green' : tone === 'down' ? 'text-error' : 'text-ink',
        )}
      >
        {value}
      </p>
    </div>
  );
}
