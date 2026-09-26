/**
 * send-alimtalk — 발송 대기열을 비우는 Edge Function.
 *
 * 앱은 이 함수를 "우리 아카데미 대기열을 처리해 달라"는 뜻으로만 부른다.
 * 무엇을 보낼지는 대기열(notification_outbox)이 정하고, 어디로 보낼지는
 * enqueue_alimtalk()가 원생·문의 행에서 이미 찾아 두었다.
 *
 * 권한: 호출자의 JWT로 대기열을 먼저 읽는다. RLS가 그 사람에게 보이는 행만
 * 돌려주므로, 남의 아카데미 대기열을 비울 수는 없다. 상태를 바꾸는 쓰기만
 * service_role로 한다 — 클라이언트에는 대기열 update 권한이 없다.
 *
 * 한 행씩 queued → sending 으로 "선점"한 뒤 보낸다. 두 기기에서 동시에
 * 불러도 같은 메시지가 두 번 나가지 않는다.
 *
 * 배포:  supabase functions deploy send-alimtalk
 * 비밀:  supabase secrets set ALIMTALK_PROVIDER=dry_run   (기본값)
 * 자세한 절차는 docs/ALIMTALK.md.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createProvider, templateCodeMap } from './providers.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BATCH = 50;
const MAX_ATTEMPTS = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: '로그인이 필요합니다' }, 401);

  let academyId: string;
  try {
    ({ academyId } = await req.json());
  } catch {
    return json({ error: '잘못된 요청입니다' }, 400);
  }
  if (!academyId) return json({ error: 'academyId가 필요합니다' }, 400);

  let provider;
  try {
    provider = createProvider(Deno.env);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
  const codes = templateCodeMap(Deno.env);

  // Read as the caller: RLS decides which rows exist for them.
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: visible, error: readError } = await asCaller
    .from('notification_outbox')
    .select('id')
    .eq('academy_id', academyId)
    .eq('status', 'queued')
    .order('created_at')
    .limit(BATCH);
  if (readError) return json({ error: readError.message }, 403);

  const admin = createClient(url, serviceKey);
  const tally = { sent: 0, dryRun: 0, failed: 0, skipped: 0 };

  for (const { id } of visible ?? []) {
    // Claim: only one invocation gets to move this row out of `queued`.
    const { data: claimed } = await admin
      .from('notification_outbox')
      .update({ status: 'sending' })
      .eq('id', id)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle();
    if (!claimed) {
      tally.skipped += 1;
      continue;
    }

    const attempts = (claimed.attempts ?? 0) + 1;
    let result;
    try {
      result = await provider.send({
        id: claimed.id,
        templateCode: claimed.template_code,
        providerTemplateCode: codes[claimed.template_code] ?? null,
        recipientPhone: claimed.recipient_phone,
        body: claimed.body,
        variables: claimed.variables ?? {},
      });
    } catch (e) {
      result = { ok: false as const, error: (e as Error).message, retryable: true };
    }

    if (result.ok) {
      await admin
        .from('notification_outbox')
        .update({
          status: result.dryRun ? 'dry_run' : 'sent',
          provider: provider.name,
          provider_message_id: result.providerMessageId ?? null,
          attempts,
          error: null,
          sent_at: result.dryRun ? null : new Date().toISOString(),
        })
        .eq('id', id);
      if (result.dryRun) tally.dryRun += 1;
      else tally.sent += 1;
    } else {
      // Retryable failures go back in the queue until they run out of tries.
      const giveUp = !result.retryable || attempts >= MAX_ATTEMPTS;
      await admin
        .from('notification_outbox')
        .update({
          status: giveUp ? 'failed' : 'queued',
          provider: provider.name,
          attempts,
          error: result.error.slice(0, 300),
        })
        .eq('id', id);
      if (giveUp) tally.failed += 1;
    }
  }

  return json({ provider: provider.name, ...tally });
});
