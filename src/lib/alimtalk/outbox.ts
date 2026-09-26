/**
 * 알림톡 발송 대기열 — the app's side.
 *
 * The app never sends anything itself and never learns a phone number it
 * wasn't already allowed to see. It hands the database a list of "this
 * template, to this student's guardian, with these variables", and
 * `enqueue_alimtalk()` looks the number up and queues the row. Then it pokes
 * the `send-alimtalk` Edge Function, which is the only thing holding provider
 * credentials.
 *
 * Each step can be missing today, and the result says which:
 *
 *   unavailable    — migration 0006 isn't applied. Nothing was stored.
 *   not_connected  — rows are queued, but the Edge Function isn't deployed.
 *   dry_run        — the function ran, but no provider key is configured, so
 *                    rows were marked 드라이런 instead of sent.
 *   sent           — a real provider accepted them.
 *
 * Every state but the first is progress that survives: queued rows go out the
 * moment the function and its keys exist.
 */

import { supabase } from '@/lib/supabase';
import type { ID } from '@/types';
import type { TemplateCode } from './templates';

export type OutboxStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'dry_run' | 'cancelled';

export interface OutboxRow {
  id: ID;
  templateCode: TemplateCode;
  recipientName: string;
  recipientPhone: string;
  studentId: ID | null;
  leadId: ID | null;
  body: string;
  status: OutboxStatus;
  provider: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
}

export interface EnqueueItem {
  templateCode: TemplateCode;
  studentId?: ID;
  leadId?: ID;
  variables: Record<string, string>;
  body: string;
  /** Same key twice is stored once — re-submitting a register can't double-send. */
  dedupeKey?: string;
}

export type Dispatch = 'not_connected' | 'dry_run' | 'sent' | 'partial';

export type EnqueueResult =
  | { state: 'unavailable'; reason: string }
  | { state: 'queued'; queued: number; dispatch: Dispatch; detail?: string };

export const STATUS_META: Record<OutboxStatus, { label: string; pill: string }> = {
  queued: { label: '발송 대기', pill: 'bg-tint-yellow-bold text-charcoal' },
  sending: { label: '발송 중', pill: 'bg-primary-wash text-primary' },
  sent: { label: '발송 완료', pill: 'bg-tint-mint text-brand-green' },
  failed: { label: '실패', pill: 'bg-tint-alert text-error' },
  dry_run: { label: '드라이런', pill: 'bg-tint-sky text-brand-teal' },
  cancelled: { label: '취소', pill: 'bg-surface text-steel' },
};

/**
 * PostgREST's "that table/function isn't there" codes. Seeing one means the
 * migration hasn't been run on this project yet — a setup state, not a bug.
 */
export function isMissingSchema(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  return ['PGRST202', 'PGRST205', '42P01', '42883'].includes(code);
}

export async function enqueue(academyId: ID, items: EnqueueItem[]): Promise<EnqueueResult> {
  if (items.length === 0) return { state: 'queued', queued: 0, dispatch: 'not_connected' };

  const { data, error } = await supabase.rpc('enqueue_alimtalk', {
    p_academy_id: academyId,
    p_items: items.map((i) => ({
      template_code: i.templateCode,
      student_id: i.studentId ?? null,
      lead_id: i.leadId ?? null,
      variables: i.variables,
      body: i.body,
      dedupe_key: i.dedupeKey ?? null,
    })),
  });

  if (error) {
    if (isMissingSchema(error)) {
      return {
        state: 'unavailable',
        reason: '발송 대기열이 아직 설치되지 않았습니다 (마이그레이션 0006)',
      };
    }
    throw error;
  }

  const queued = typeof data === 'number' ? data : 0;
  const dispatch = await flush(academyId);
  return { state: 'queued', queued, ...dispatch };
}

/**
 * Ask the Edge Function to work through this academy's queue.
 *
 * Failing to reach it is not an error to the user — the rows are safe in the
 * queue — so this never throws. It reports what happened instead.
 */
export async function flush(academyId: ID): Promise<{ dispatch: Dispatch; detail?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-alimtalk', {
      body: { academyId },
    });
    if (error) return { dispatch: 'not_connected', detail: '발송 서버가 아직 연결되지 않았습니다' };

    const result = data as { sent?: number; dryRun?: number; failed?: number } | null;
    const sent = result?.sent ?? 0;
    const dry = result?.dryRun ?? 0;
    const failed = result?.failed ?? 0;
    if (failed > 0) return { dispatch: 'partial', detail: `${failed}건 실패` };
    if (sent > 0 && dry === 0) return { dispatch: 'sent' };
    return { dispatch: 'dry_run', detail: '발송 대행사 키가 없어 드라이런으로 처리했습니다' };
  } catch {
    return { dispatch: 'not_connected', detail: '발송 서버가 아직 연결되지 않았습니다' };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromRow(r: Record<string, any>): OutboxRow {
  return {
    id: r.id,
    templateCode: r.template_code,
    recipientName: r.recipient_name ?? '',
    recipientPhone: r.recipient_phone ?? '',
    studentId: r.student_id ?? null,
    leadId: r.lead_id ?? null,
    body: r.body,
    status: r.status,
    provider: r.provider ?? null,
    error: r.error ?? null,
    attempts: r.attempts ?? 0,
    createdAt: r.created_at,
    sentAt: r.sent_at ?? null,
  };
}

export type OutboxList = { state: 'unavailable' } | { state: 'ok'; rows: OutboxRow[] };

export async function listOutbox(academyId: ID, limit = 100): Promise<OutboxList> {
  const { data, error } = await supabase
    .from('notification_outbox')
    .select('*')
    .eq('academy_id', academyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingSchema(error)) return { state: 'unavailable' };
    throw error;
  }
  return { state: 'ok', rows: (data ?? []).map(fromRow) };
}
