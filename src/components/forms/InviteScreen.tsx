/**
 * 체험 초대 — the front door. A link families can open without an account,
 * shared wherever new families already are (the centre's Instagram, a school
 * KakaoTalk room, a flyer's QR code). What comes through it lands in 문의 and
 * starts the journey; the first reply is a phone call, not another form.
 */

import { useState } from 'react';
import { useWorkspace } from '@/store/WorkspaceContext';
import { formUrl, type FormLink } from '@/data/crm';
import { Toast } from '@/components/shell/Shell';
import { NewFormSheet } from './NewFormSheet';
import { LeadComposer } from './sheets';
import {
  DemoNote,
  Page,
  PrimaryButton,
  Row,
  Rows,
  Section,
  SecondaryButton,
  Tag,
  TextLink,
  Title,
} from './ui';

export function InviteScreen({ backLabel, onBack }: { backLabel: string; onBack: () => void }) {
  const { formLinks, toggleFormLink, shareFormLink, addLead, mode } = useWorkspace();
  const [making, setMaking] = useState(0);
  const [composing, setComposing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2000);
  };

  const copy = (link: FormLink) => {
    void navigator.clipboard?.writeText(formUrl(link.slug));
    shareFormLink(link.id);
    flash('복사됨');
  };

  const active = formLinks.filter((l) => l.active);
  const stopped = formLinks.filter((l) => !l.active);

  return (
    <Page>
      <Title
        back={{ label: backLabel, onBack }}
        eyebrow="Invite"
        title="체험 초대"
        sub="신청 링크를 공유하면 신청 내용이 문의로 들어옵니다."
      />

      <Section title="사용 중인 링크" aside={active.length > 0 ? `${active.length}` : undefined}>
        {active.length === 0 ? (
          <p className="py-4 text-[15px] text-steel">없음</p>
        ) : (
          <Rows>
            {active.map((l) => (
              <Row
                key={l.id}
                title={l.title}
                sub={`신청 ${l.submissions}건`}
                tag={
                  <button type="button" onClick={() => toggleFormLink(l.id)}>
                    <Tag tone="gray">중지</Tag>
                  </button>
                }
                trailing={<TextLink onClick={() => copy(l)}>복사</TextLink>}
              />
            ))}
          </Rows>
        )}
      </Section>

      <div className="mt-6 space-y-2">
        <PrimaryButton onClick={() => setMaking((n) => n + 1)}>새 신청 링크 만들기</PrimaryButton>
        <SecondaryButton onClick={() => setComposing(true)}>전화·방문 문의 직접 등록</SecondaryButton>
      </div>

      {stopped.length > 0 && (
        <Section title="중지된 링크">
          <Rows>
            {stopped.map((l) => (
              <Row
                key={l.id}
                title={l.title}
                sub={`신청 ${l.submissions}건`}
                trailing={<TextLink onClick={() => toggleFormLink(l.id)}>재개</TextLink>}
              />
            ))}
          </Rows>
        </Section>
      )}

      <DemoNote show={mode === 'local'}>
        예시 데이터 · 링크 접수 안 됨 (마이그레이션 0006 필요)
      </DemoNote>

      <NewFormSheet
        key={making}
        open={making > 0}
        intake
        onClose={() => setMaking(0)}
        onSent={() => undefined}
        onLinkMade={flash}
      />
      <LeadComposer
        open={composing}
        onClose={() => setComposing(false)}
        onSubmit={(fields) => {
          addLead(fields);
          setComposing(false);
          flash('문의 등록됨');
        }}
      />
      {toast && <Toast>{toast}</Toast>}
    </Page>
  );
}
