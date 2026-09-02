/**
 * 명단 가져오기.
 *
 * Built for one moment: the owner hands over whatever file they actually keep,
 * in a meeting, and it works. So there are three ways in, ordered by how likely
 * each is to survive a real desk —
 *
 *   1. drop the file
 *   2. pick it from a dialog
 *   3. paste (Ctrl+V) whatever table is on screen
 *
 * (3) matters more than it looks. Often the file cannot be shared — it lives on
 * a work PC, or in a KakaoTalk chat, or nobody remembers where it is. If a
 * table is visible anywhere, paste gets it in.
 *
 * Everything stays in this browser. That is a real constraint (children's names
 * and parents' phone numbers), and saying it out loud is also the strongest
 * line in the pitch, so the notice is prominent rather than buried.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CircleAlert,
  ClipboardPaste,
  FileSpreadsheet,
  Info,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import type { StudentFieldKey } from '@/data/importSchema';
import {
  finalizeImport,
  importFromFile,
  importFromText,
  type ImportIssue,
  type ImportResult,
  type SheetInput,
} from '@/lib/import';
import { formatWonCompact } from '@/lib/format';
import { cn } from '@/lib/cn';
import { MappingTable } from './MappingTable';

type Stage = 'idle' | 'busy' | 'review' | 'saving' | 'done';

interface CommitSummary {
  students: number;
  classesCreated: number;
  payments: number;
}

const ISSUE_STYLE: Record<ImportIssue['level'], { icon: typeof Info; cls: string }> = {
  error: { icon: CircleAlert, cls: 'bg-tint-alert text-error' },
  warning: { icon: AlertTriangle, cls: 'bg-tint-yellow-bold text-brand-orange-deep' },
  info: { icon: Info, cls: 'bg-tint-sky text-primary' },
};

interface Props {
  /** Persist the confirmed rows. Rejecting surfaces the reason to the owner. */
  onCommit: (result: ImportResult) => Promise<CommitSummary>;
}

export function ImportPanel({ onCommit }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [dragging, setDragging] = useState(false);
  const [sheets, setSheets] = useState<SheetInput[]>([]);
  const [rejected, setRejected] = useState<ImportIssue | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [saved, setSaved] = useState<CommitSummary | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Overrides are applied by re-running extraction, never by patching the
  // result — so a correction propagates into the counts and the warnings too.
  const result = useMemo(
    () => (sheets.length > 0 ? finalizeImport(sheets, new Date(), sheets.length > 1) : null),
    [sheets],
  );

  const accept = useCallback((r: ImportResult, label: string) => {
    setSourceName(label);
    if (r.rejected) {
      setRejected(r.issues[0] ?? null);
      setSheets([]);
      setStage('idle');
      return;
    }
    setRejected(null);
    setSheets(r.sheets.map((s) => ({ table: s.table, assignments: s.assignments })));
    setStage(r.sheets.length > 0 ? 'review' : 'idle');
    if (r.sheets.length === 0) setRejected(r.issues[0] ?? null);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setStage('busy');
      accept(await importFromFile(file), file.name);
    },
    [accept],
  );

  const handleText = useCallback(
    (text: string) => {
      if (text.trim().length === 0) return;
      setStage('busy');
      accept(importFromText(text), '붙여넣은 표');
    },
    [accept],
  );

  // Paste anywhere on the screen. Skipped while the owner is typing into a
  // field, so correcting a mapping never triggers a re-import.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        e.preventDefault();
        handleText(text);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleText]);

  const reset = () => {
    setSheets([]);
    setRejected(null);
    setSourceName('');
    setSaved(null);
    setSaveError(null);
    setStage('idle');
    if (fileInput.current) fileInput.current.value = '';
  };

  const commit = async () => {
    if (!result) return;
    setStage('saving');
    setSaveError(null);
    try {
      setSaved(await onCommit(result));
      setStage('done');
    } catch (err) {
      // 저장에 실패했는데 화면만 성공처럼 보이면, 대표는 명단이 들어간 줄 알고
      // 넘어간다. 실패는 반드시 되돌아와서 보이게 한다.
      setSaveError((err as { message?: string })?.message ?? '저장하지 못했습니다');
      setStage('review');
    }
  };

  /** One field maps to one column, so claiming it releases it elsewhere. */
  const remap = (sheetIndex: number, columnIndex: number, field: StudentFieldKey | null) => {
    setSheets((prev) =>
      prev.map((sheet, si) => {
        if (si !== sheetIndex) return sheet;
        return {
          ...sheet,
          assignments: sheet.assignments.map((a) => {
            if (a.index === columnIndex) {
              return { ...a, field, confidence: field ? 1 : 0, basis: field ? '직접 지정' : '' };
            }
            if (field && a.field === field) {
              return { ...a, field: null, confidence: 0, basis: '' };
            }
            return a;
          }),
        };
      }),
    );
  };

  const errors = result?.issues.filter((i) => i.level === 'error') ?? [];
  const missing = result?.sheets.flatMap((s) => s.missing) ?? [];
  const blocked = errors.length > 0 || missing.length > 0;
  const revenue = result?.students.reduce((sum, s) => sum + s.monthlyFee, 0) ?? 0;

  return (
    <div className="card overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline px-5 py-5 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em] text-ink">
            <FileSpreadsheet size={17} className="text-primary" />
            명단 가져오기
          </h2>
          <p className="mt-1 text-sm text-slate">
            쓰시던 엑셀 그대로 주세요. 양식을 맞추지 않으셔도 됩니다.
          </p>
        </div>
        {stage === 'review' && (
          <button type="button" onClick={reset} className="btn-secondary">
            <Trash2 size={15} />
            전체 삭제
          </button>
        )}
      </header>

      {/* ------------------------------------------------------------------ */}
      {(stage === 'idle' || stage === 'busy') && (
        <div className="px-5 py-6 sm:px-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors duration-150',
              dragging ? 'border-primary bg-primary-wash' : 'border-hairline-strong bg-surface-soft',
            )}
          >
            {stage === 'busy' ? (
              <>
                <Loader2 size={26} className="animate-spin text-primary" />
                <p className="mt-3 text-sm font-medium text-ink">읽는 중…</p>
              </>
            ) : (
              <>
                <Upload size={26} className="text-primary" />
                <p className="mt-3 text-[15px] font-semibold text-ink">
                  엑셀 파일을 여기에 끌어다 놓으세요
                </p>
                <p className="mt-1 text-sm text-steel">xlsx · csv</p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button type="button" onClick={() => fileInput.current?.click()} className="btn-primary">
                    파일 선택
                  </button>
                  <span className="text-sm text-stone">또는</span>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-charcoal">
                    <ClipboardPaste size={15} className="text-primary" />
                    표를 복사해 <kbd className="rounded-xs border border-hairline-strong bg-canvas px-1.5 py-0.5 text-[12px]">Ctrl</kbd>
                    +
                    <kbd className="rounded-xs border border-hairline-strong bg-canvas px-1.5 py-0.5 text-[12px]">V</kbd>
                  </span>
                </div>

                <input
                  ref={fileInput}
                  type="file"
                  accept=".xlsx,.xlsm,.csv,.tsv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </>
            )}
          </div>

          {rejected && (
            <div className="mt-4 flex items-start gap-2.5 rounded-md bg-tint-alert px-4 py-3">
              <CircleAlert size={16} className="mt-0.5 shrink-0 text-error" />
              <p className="text-sm text-error">{rejected.message}</p>
            </div>
          )}

          <p className="mt-5 flex items-start justify-center gap-2 text-[13px] text-steel">
            <ShieldCheck size={15} className="mt-px shrink-0 text-primary" />
            이 파일은 이 브라우저 안에서만 처리됩니다. 서버로 전송되지 않습니다.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {stage === 'saving' && (
        <div className="flex flex-col items-center px-5 py-16 sm:px-6">
          <Loader2 size={26} className="animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium text-ink">등록하는 중…</p>
        </div>
      )}

      {stage === 'done' && saved && (
        <div className="flex flex-col items-center px-5 py-14 text-center sm:px-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tint-mint">
            <Check size={22} className="text-brand-green" />
          </span>
          <p className="mt-4 text-[19px] font-semibold tracking-tightest text-ink">
            원생 {saved.students}명을 등록했습니다
          </p>
          <p className="mt-1.5 text-sm text-slate">
            반 {saved.classesCreated}개 생성
            {saved.payments > 0 && ` · 납부 기록 ${saved.payments}건`}
          </p>
          <p className="mt-4 max-w-[420px] text-[13px] text-steel">
            매출·정원·미납은 지금 바로 보입니다. 출결을 3주 기록하시면 이탈 경보가 켜집니다.
          </p>
          <button type="button" onClick={reset} className="btn-secondary mt-6">
            다른 파일 올리기
          </button>
        </div>
      )}

      {stage === 'review' && result && (
        <div className="space-y-6 px-5 py-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Stat label="원생" value={`${result.students.length}명`} />
            <Stat label="반" value={`${result.classes.length}개`} />
            <Stat label="월 매출" value={`${formatWonCompact(revenue)}원`} />
            <span className="text-[13px] text-stone">{sourceName}</span>
          </div>

          {result.notes.length > 0 && (
            <ul className="space-y-1 rounded-md bg-surface-soft px-4 py-3">
              {result.notes.map((n, i) => (
                <li key={i} className="text-[13px] text-steel">
                  · {n}
                </li>
              ))}
            </ul>
          )}

          <MappingTable sheets={sheets} showSheetNames={sheets.length > 1} onChange={remap} />

          {missing.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-md bg-tint-alert px-4 py-3">
              <CircleAlert size={16} className="mt-0.5 shrink-0 text-error" />
              <p className="text-sm text-error">
                {[...new Set(missing)].join(' · ')} 열을 찾지 못했습니다. 위에서 지정해 주세요.
              </p>
            </div>
          )}

          {result.issues.length > 0 && (
            <ul className="space-y-2">
              {result.issues.slice(0, 12).map((issue, i) => {
                const { icon: Icon, cls } = ISSUE_STYLE[issue.level];
                return (
                  <li key={i} className={cn('flex items-start gap-2.5 rounded-md px-4 py-2.5', cls)}>
                    <Icon size={15} className="mt-0.5 shrink-0" />
                    <span className="text-[13px]">{issue.message}</span>
                  </li>
                );
              })}
              {result.issues.length > 12 && (
                <li className="px-4 text-[13px] text-steel">외 {result.issues.length - 12}건</li>
              )}
            </ul>
          )}

          {saveError && (
            <div className="flex items-start gap-2.5 rounded-md bg-tint-alert px-4 py-3">
              <CircleAlert size={16} className="mt-0.5 shrink-0 text-error" />
              <p className="text-sm text-error">저장 실패: {saveError}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline pt-5">
            <button type="button" onClick={reset} className="btn-secondary">
              취소
            </button>
            <button
              type="button"
              disabled={blocked || result.students.length === 0}
              onClick={() => void commit()}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              {result.students.length}명 등록하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="micro-label text-stone">{label}</p>
      <p className="mt-0.5 text-[19px] font-semibold tabular-nums tracking-tightest text-ink">{value}</p>
    </div>
  );
}
