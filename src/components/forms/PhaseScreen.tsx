/**
 * One step of the journey — everyone in it, the ones owed a contact first.
 *
 * Each row says who and what's next, in the words of the next action, so the
 * list can be worked top to bottom without opening anything to find out why a
 * family is on it.
 */

import { useMemo, useState } from 'react';
import { useWorkspace } from '@/store/WorkspaceContext';
import { PHASES, isDue, phaseList, type Family, type Phase } from '@/data/onboarding';
import { LeadComposer } from './sheets';
import { DemoNote, Page, Row, Rows, Section, SecondaryButton, Tag, TextLink, Title } from './ui';

const EYEBROW: Record<Phase, string> = {
  inquiry: 'Inquiry',
  trial: 'Trial',
  decision: 'Decision',
  firstMonth: 'First month',
};

export function PhaseScreen({
  phase,
  backLabel,
  onBack,
  onOpenFamily,
}: {
  phase: Phase;
  backLabel: string;
  onBack: () => void;
  onOpenFamily: (key: string) => void;
}) {
  const { families, leads, addLead, advanceLead, mode } = useWorkspace();
  const [composing, setComposing] = useState(false);
  const [showLost, setShowLost] = useState(false);

  const meta = PHASES.find((p) => p.key === phase)!;
  const list = useMemo(() => phaseList(families, phase), [families, phase]);
  const due = list.filter((f) => isDue(f));
  const rest = list.filter((f) => !isDue(f));
  const lost = phase === 'inquiry' ? leads.filter((l) => l.stage === 'lost') : [];

  return (
    <Page>
      <Title
        back={{ label: backLabel, onBack }}
        eyebrow={EYEBROW[phase]}
        title={meta.label}
        sub={`${meta.blurb} · ${list.length}가족`}
      />

      {list.length === 0 && (
        <p className="mt-10 text-center text-[15px] text-steel">지금 이 단계에 있는 가족이 없어요.</p>
      )}

      {due.length > 0 && (
        <Section title="오늘 연락" aside={`${due.length}`}>
          <Rows>
            {due.map((f) => (
              <FamilyRow key={f.key} family={f} onOpen={() => onOpenFamily(f.key)} />
            ))}
          </Rows>
        </Section>
      )}

      {rest.length > 0 && (
        <Section title={due.length > 0 ? '이후' : '진행 중'} aside={`${rest.length}`}>
          <Rows>
            {rest.map((f) => (
              <FamilyRow key={f.key} family={f} onOpen={() => onOpenFamily(f.key)} />
            ))}
          </Rows>
        </Section>
      )}

      {phase === 'inquiry' && (
        <>
          <div className="mt-8">
            <SecondaryButton onClick={() => setComposing(true)}>전화·방문 문의 등록</SecondaryButton>
          </div>

          {lost.length > 0 && (
            <div className="mt-6 text-center">
              <TextLink tone="gray" onClick={() => setShowLost((v) => !v)}>
                {showLost ? '접기' : `함께하지 않기로 한 가족 ${lost.length}`}
              </TextLink>
            </div>
          )}
          {showLost && (
            <Rows>
              {lost.map((l) => (
                <Row
                  key={l.id}
                  title={`${l.childName} · ${l.ageLabel}`}
                  sub={l.lostReason || '이유 없음'}
                  trailing={
                    <TextLink onClick={() => advanceLead(l.id, 'inquiry', '다시 연락하기로 함')}>
                      다시 열기
                    </TextLink>
                  }
                />
              ))}
            </Rows>
          )}

          <LeadComposer
            open={composing}
            onClose={() => setComposing(false)}
            onSubmit={(fields) => {
              addLead(fields);
              setComposing(false);
            }}
          />
        </>
      )}

      <DemoNote show={mode === 'local'}>예시 데이터로 보는 중 · 새로고침하면 초기화됩니다.</DemoNote>
    </Page>
  );
}

export function FamilyRow({ family, onOpen }: { family: Family; onOpen: () => void }) {
  const n = family.next;
  const due = isDue(family);
  return (
    <Row
      title={
        <>
          {family.name}
          {family.ageLabel && (
            <span className="ml-1.5 text-[14px] font-medium text-steel">{family.ageLabel}</span>
          )}
        </>
      }
      sub={n?.reason}
      tag={
        n ? (
          <Tag tone={due ? (n.late ? 'amber' : 'green') : 'gray'}>
            {due ? n.label : `${Number(n.due.slice(5, 7))}/${Number(n.due.slice(8, 10))} ${n.label}`}
          </Tag>
        ) : undefined
      }
      onClick={onOpen}
    />
  );
}
