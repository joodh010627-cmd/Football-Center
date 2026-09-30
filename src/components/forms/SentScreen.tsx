/**
 * 보낸 안내 — everything sent to current families, the live ones first.
 * Each row says how many have answered and whether anyone asked, through
 * their answer, to be called.
 */

import { useState } from 'react';
import type { ID } from '@/types';
import { useApp } from '@/store/AppContext';
import { useWorkspace } from '@/store/WorkspaceContext';
import { SITUATIONS, dueLabel, isOpenSurvey, progressOf, type Survey } from '@/data/surveys';
import { DemoNote, Page, Row, Rows, Section, Tag, TextLink, Title } from './ui';

export function SentScreen({
  backLabel,
  onBack,
  onOpenSurvey,
}: {
  backLabel: string;
  onBack: () => void;
  onOpenSurvey: (id: ID) => void;
}) {
  const { state } = useApp();
  const { surveys, recipients, surveyMode } = useWorkspace();
  const [showPast, setShowPast] = useState(false);

  const sent = surveys.filter((v) => v.kind !== 'enrollment');
  const live = sent.filter((v) => isOpenSurvey(v));
  const past = sent.filter((v) => !isOpenSurvey(v));

  const row = (v: Survey) => {
    const p = progressOf(v, recipients);
    const classes = v.classIds
      .map((id) => state.classes.find((c) => c.id === id)?.title)
      .filter(Boolean);
    return (
      <Row
        key={v.id}
        title={v.title}
        sub={`${SITUATIONS[v.kind].label} · 응답 ${p.answered}/${p.total} · ${dueLabel(v)}${
          classes.length ? ` · ${classes.length > 1 ? `${classes[0]} 외 ${classes.length - 1}` : classes[0]}` : ''
        }`}
        tag={
          p.toCall.length > 0 || (p.daysLeft !== null && p.daysLeft <= 1 && p.pending.length > 0) ? (
            <>
              {p.toCall.length > 0 && <Tag tone="amber">상담 필요 {p.toCall.length}</Tag>}
              {p.daysLeft !== null && p.daysLeft <= 1 && p.pending.length > 0 && (
                <Tag>미응답 {p.pending.length}</Tag>
              )}
            </>
          ) : undefined
        }
        onClick={() => onOpenSurvey(v.id)}
      />
    );
  };

  return (
    <Page>
      <Title
        back={{ label: backLabel, onBack }}
        eyebrow="Sent"
        title="보낸 안내"
        sub="재원생 보호자에게 보낸 참가 신청·동의·의견 듣기."
      />

      <Section title="진행 중" aside={live.length > 0 ? `${live.length}` : undefined}>
        {live.length === 0 ? (
          <p className="py-4 text-[15px] text-steel">지금 받고 있는 안내가 없어요.</p>
        ) : (
          <Rows>{live.map(row)}</Rows>
        )}
      </Section>

      {past.length > 0 && (
        <div className="mt-6 text-center">
          <TextLink tone="gray" onClick={() => setShowPast((v) => !v)}>
            {showPast ? '접기' : `마감된 안내 ${past.length}`}
          </TextLink>
        </div>
      )}
      {showPast && <Rows>{past.map(row)}</Rows>}

      <DemoNote show={surveyMode === 'local'}>
        예시 데이터로 보는 중 · 마이그레이션 0007을 적용하면 실제로 보내집니다.
      </DemoNote>
    </Page>
  );
}
