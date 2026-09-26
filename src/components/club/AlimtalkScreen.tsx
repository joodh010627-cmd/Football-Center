/**
 * 알림톡 — what has been queued, and what Kakao will be asked to approve.
 *
 * Two halves, because going live is two separate chores. The templates are the
 * paperwork: each one is copied, character for character, into the sending
 * provider's console for Kakao's review, so this screen shows the exact body,
 * its variables and when it fires, with a copy button. The log is the
 * machinery: every row the app has queued, with its status, so that
 * "did the parents get it?" has an answer before the channel is even live.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Copy, Loader2, RefreshCw, Send } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { useSession } from '@/store/AuthContext';
import { isOwner } from '@/lib/permissions';
import {
  flush,
  listOutbox,
  STATUS_META,
  type OutboxList,
  type OutboxRow,
} from '@/lib/alimtalk/outbox';
import { TEMPLATES, variablesOf, type TemplateCode } from '@/lib/alimtalk/templates';
import { formatPhone } from '@/data/crm';
import { cn } from '@/lib/cn';
import { ScreenBody, ScreenHeader, Section } from '@/components/shell/Shell';

export function AlimtalkScreen({ onBack }: { onBack: () => void }) {
  const { state } = useApp();
  const owner = isOwner(useSession());
  const [list, setList] = useState<OutboxList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flushing, setFlushing] = useState(false);
  const [flushNote, setFlushNote] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listOutbox(state.academyId)
      .then(setList)
      .catch(() => setError('발송 기록을 불러오지 못했습니다'));
  }, [state.academyId]);

  useEffect(load, [load]);

  const rows = list?.state === 'ok' ? list.rows : [];
  const queued = rows.filter((r) => r.status === 'queued').length;

  const retry = async () => {
    setFlushing(true);
    const { dispatch, detail } = await flush(state.academyId);
    setFlushing(false);
    setFlushNote(
      dispatch === 'not_connected'
        ? '발송 서버(send-alimtalk)가 아직 배포되지 않았습니다.'
        : dispatch === 'dry_run'
          ? '드라이런으로 처리했습니다. 대행사 키를 넣으면 실제로 나갑니다.'
          : (detail ?? '발송했습니다.'),
    );
    load();
  };

  return (
    <>
      <header className="px-5 pb-1 pt-5 sm:px-7 lg:px-10 lg:pt-8">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[13.5px] font-medium text-steel transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} strokeWidth={2.2} />
          클럽
        </button>
      </header>

      <ScreenHeader
        eyebrow="KakaoTalk"
        title="알림톡"
        meta="카카오 채널 연동 직전 단계까지 준비된 상태입니다. 쌓인 메시지는 발송 서버와 대행사 키가 연결되는 순간부터 나갑니다."
      />

      <ScreenBody>
        <ol className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { label: '템플릿', detail: '심사용 원문 준비됨', ok: true },
            {
              label: '대기열',
              detail: list?.state === 'ok' ? '설치됨' : '설치 필요',
              ok: list?.state === 'ok',
            },
            { label: '카카오 연동', detail: '채널·대행사 계약 필요', ok: false },
          ].map(({ label, detail, ok }) => (
            <li
              key={label}
              className={cn(
                'rounded-lg border px-2 py-3',
                ok ? 'border-primary/30 bg-primary-wash' : 'border-hairline bg-canvas',
              )}
            >
              <span
                className={cn('block text-[13px] font-bold', ok ? 'text-primary' : 'text-slate')}
              >
                {ok ? '✓ ' : ''}
                {label}
              </span>
              <span className="mt-1 block text-[11px] leading-tight text-steel">{detail}</span>
            </li>
          ))}
        </ol>

        {/* --- Log ------------------------------------------------------- */}
        <Section
          title="발송 기록"
          meta={list?.state === 'ok' ? `최근 ${rows.length}건` : undefined}
        >
          {error ? (
            <p className="rounded-lg bg-tint-alert-soft px-4 py-3 text-[13px] text-error">
              {error}
            </p>
          ) : list === null ? (
            <div className="py-8 text-center">
              <Loader2 size={20} className="mx-auto animate-spin text-primary" />
            </div>
          ) : list.state === 'unavailable' ? (
            <p className="rounded-lg border border-dashed border-hairline-strong bg-canvas px-4 py-6 text-[13px] leading-[1.6] text-steel">
              발송 대기열이 아직 설치되지 않았습니다. Supabase SQL Editor에서 마이그레이션 0006을
              적용하면 출결 제출·체험 예약·폼 접수 때 알림톡이 여기에 쌓입니다.
            </p>
          ) : (
            <>
              {owner && queued > 0 && (
                <button
                  type="button"
                  onClick={() => void retry()}
                  disabled={flushing}
                  className="btn-primary mb-3 w-full py-3"
                >
                  {flushing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  대기 중인 {queued}건 발송 시도
                </button>
              )}
              {flushNote && (
                <p className="mb-3 rounded-md bg-surface px-3.5 py-2.5 text-[12.5px] text-slate">
                  {flushNote}
                </p>
              )}

              {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-hairline-strong bg-canvas px-4 py-8 text-center text-[13.5px] text-steel">
                  아직 쌓인 알림톡이 없습니다.
                </p>
              ) : (
                <ul className="stagger space-y-2">
                  {rows.map((row) => (
                    <OutboxItem key={row.id} row={row} />
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={load}
                className="mx-auto mt-3 flex items-center gap-1 text-[12.5px] font-semibold text-steel hover:text-ink"
              >
                <RefreshCw size={12} strokeWidth={2.4} />
                새로고침
              </button>
            </>
          )}
        </Section>

        {/* --- Templates --------------------------------------------------- */}
        <Section title="템플릿" meta="카카오 심사 제출용">
          <div className="space-y-2">
            {(Object.keys(TEMPLATES) as TemplateCode[]).map((code) => (
              <TemplateCard key={code} code={code} />
            ))}
          </div>
        </Section>
      </ScreenBody>
    </>
  );
}

function OutboxItem({ row }: { row: OutboxRow }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[row.status];

  return (
    <li className="overflow-hidden rounded-lg border border-hairline bg-canvas">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold text-ink">
            {TEMPLATES[row.templateCode]?.name ?? row.templateCode} ·{' '}
            {row.recipientName || '보호자'}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-steel">
            {formatPhone(row.recipientPhone) || '연락처 없음'} ·{' '}
            {new Date(row.createdAt).toLocaleString('ko-KR', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {row.error && ` · ${row.error}`}
          </span>
        </span>
        <span
          className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold', meta.pill)}
        >
          {meta.label}
        </span>
        <ChevronDown
          size={15}
          className={cn(
            'shrink-0 text-stone transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <pre className="animate-swap-in whitespace-pre-wrap break-words border-t border-hairline-soft bg-surface-soft px-4 py-3 font-sans text-[12.5px] leading-[1.6] text-charcoal">
          {row.body}
        </pre>
      )}
    </li>
  );
}

function TemplateCard({ code }: { code: TemplateCode }) {
  const template = TEMPLATES[code];
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(template.body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-canvas">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{template.name}</span>
          <span className="mt-0.5 block text-[12px] leading-[1.5] text-steel">
            {template.trigger}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-stone transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="animate-swap-in border-t border-hairline-soft px-4 py-3.5">
          <pre className="whitespace-pre-wrap break-words rounded-md bg-surface-soft p-3 font-sans text-[12.5px] leading-[1.6] text-charcoal">
            {template.body}
          </pre>
          <p className="mt-2.5 text-[12px] text-steel">
            변수 {variablesOf(template.body).length}개 ·{' '}
            {variablesOf(template.body)
              .map((v) => `#{${v}}`)
              .join(' ')}
          </p>
          <button
            type="button"
            onClick={copy}
            className="btn-secondary mt-3 w-full !py-2.5 !text-[13px]"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '복사됨' : '심사 제출용 원문 복사'}
          </button>
        </div>
      )}
    </div>
  );
}
