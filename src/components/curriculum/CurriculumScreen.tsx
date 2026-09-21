/**
 * 커리큘럼 — the layer above session design.
 *
 * One screen, both roles. The owner gets edit affordances and the approval
 * queue; the coach gets the same reading of the same rows plus a [제안] button.
 * Forking it into two components was the obvious move and the wrong one: the
 * coach's whole reason to open this screen is to see the standard they are being
 * measured against, and a coach-flavoured summary of that standard is a second
 * source of truth.
 *
 * The tracks used to be a 7×5 track-by-age matrix. It was the right diagram and
 * the wrong screen: the centre runs eight curricula, so the grid spent 27 of its
 * 35 cells drawing an em dash, and it could not fit a phone without sideways
 * scrolling. A plain list of eight names does the same job in a third of the
 * height — and the empty combinations, which were the matrix's one real
 * argument, are a thing the owner learns when adding a track, not while reading.
 */

import { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  ChevronRight,
  Clock,
  Lightbulb,
  PencilLine,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import type { Curriculum, SessionTemplate } from '@/types';
import { useApp } from '@/store/AppContext';
import { useSession } from '@/store/AuthContext';
import { can } from '@/lib/permissions';
import { studentsInClass, templatesForCurriculum } from '@/data/selectors';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { BackBar } from '@/components/shell/Shell';
import { CATEGORY_META } from '@/components/coach/TrainingBlockCard';
import { AGE_ORDER, APPROVAL_LABEL, TRACK_META, TRACK_ORDER } from './curriculumMeta';
import { SessionTemplateEditor } from './SessionTemplateEditor';
import { BlockProposalModal } from './BlockProposalModal';
import { ApprovalQueuePanel } from './ApprovalQueuePanel';

export function CurriculumScreen({ onBack }: { onBack?: () => void }) {
  const { state } = useApp();
  const session = useSession();
  const canEdit = can(session, 'curriculum:manage');

  const curricula = useMemo(
    () => [...state.curricula].sort((a, b) => a.sortOrder - b.sortOrder),
    [state.curricula],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ template: SessionTemplate | null } | null>(null);
  const [proposingBlock, setProposingBlock] = useState(false);

  // A coach only sees the tracks they actually teach. Showing the U15 elite
  // curriculum to a kinder coach is not a leak, it is noise — and it makes the
  // one grid they need to read three times taller.
  const visible = useMemo(
    () =>
      canEdit
        ? curricula
        : curricula.filter((c) =>
            state.classes.some(
              (cls) => cls.curriculumId === c.id && cls.coachId === state.currentCoachId,
            ),
          ),
    [canEdit, curricula, state.classes, state.currentCoachId],
  );

  // Defaulting off `visible` rather than `curricula` matters: a kinder coach
  // must not land on the U15 elite track just because it sorts first.
  const selected = curricula.find((c) => c.id === selectedId) ?? visible[0] ?? curricula[0] ?? null;

  const templates = selected ? templatesForCurriculum(state.sessionTemplates, selected.id) : [];
  const published = templates.filter((t) => t.status === 'published');
  const mine =
    state.currentCoachId === null
      ? []
      : templates.filter(
          (t) => t.status !== 'published' && t.proposedBy === state.currentCoachId,
        );

  const classesOn = selected
    ? state.classes.filter((cls) => cls.curriculumId === selected.id)
    : [];

  const publishedTemplates = state.sessionTemplates.filter((t) => t.status === 'published').length;
  const publishedBlocks = state.trainingBlocks.filter((b) => b.status === 'published').length;

  // Session count per track, so the list rows can carry a number without each
  // of them filtering the whole template table.
  const sessionCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of state.sessionTemplates) {
      if (t.status !== 'published') continue;
      counts.set(t.curriculumId, (counts.get(t.curriculumId) ?? 0) + 1);
    }
    return counts;
  }, [state.sessionTemplates]);

  if (curricula.length === 0) {
    return (
      <div className="px-5 py-16 sm:px-8 lg:px-12">
        {onBack && <BackBar label="클럽" onBack={onBack} />}
        <EmptyState
          icon={BookOpenCheck}
          title="등록된 커리큘럼이 없습니다"
          description="나이대와 클래스 목적에 따른 표준 커리큘럼을 먼저 만들어야 수업 설계가 기준을 갖습니다."
        />
      </div>
    );
  }

  return (
    <div>
      {onBack && <BackBar label="클럽" onBack={onBack} />}

      {/* --- Header -------------------------------------------------------
          The old hero ran a two-line thesis, a four-line paragraph and three
          count chips before the first tappable thing. On a phone that is a
          full screen of reading to reach a list the user opened this tab to
          see, so it is now one word and one line of counts. */}
      <header className="px-5 pb-1 pt-5 sm:px-8 lg:px-12 lg:pt-8">
        <h1 className="text-[27px] font-bold leading-[1.15] tracking-tightest text-ink">
          커리큘럼
        </h1>
        <p className="mt-2 text-[13.5px] tabular-nums text-steel">
          트랙 {curricula.length} · 세션 {publishedTemplates} · 블록 {publishedBlocks}
        </p>
      </header>

      <div className="space-y-7 px-5 py-5 sm:px-8 lg:px-12 lg:py-8">
        {/* --- Tracks ---------------------------------------------------- */}
        <TrackList
          curricula={visible.length > 0 ? visible : curricula}
          selectedId={selected?.id ?? null}
          sessionCount={sessionCount}
          onSelect={setSelectedId}
        />

        {/* --- Selected curriculum ------------------------------------- */}
        {selected && (
          <section>
            <div className="rounded-lg border border-hairline bg-canvas">
              {/* The track label and age are not repeated here — the user just
                  tapped them one row up. What the panel adds is the objective,
                  the cycle and the sessions.

                  The band used to be filled with the track's tint. On a white
                  page a full-width rose or peach panel is the loudest thing on
                  screen, and it was carrying information the coloured dot in the
                  list row already carries. So the band is near-white and the
                  track colour stays a 8px dot. */}
              <header className="rounded-t-lg border-b border-hairline bg-surface-soft px-5 py-4 sm:px-6">
                <h3 className="flex items-center gap-2 text-[18px] font-bold leading-[1.3] tracking-[-0.02em] text-ink">
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      TRACK_META[selected.track].bar,
                    )}
                  />
                  {selected.title.replace(/^.*—\s*/, '')}
                </h3>
                <p className="mt-1.5 flex items-start gap-1.5 text-[13.5px] leading-[1.55] text-charcoal">
                  <Target size={13} className="mt-[3px] shrink-0" />
                  {selected.objective}
                </p>
                <p className="mt-2 text-[12.5px] tabular-nums text-steel">
                  {selected.cycleWeeks}주 주기 · 세션 {published.length}
                </p>
              </header>

              <div className="space-y-4 px-5 py-4 sm:px-6">
                {/* Focus areas + classes on this track */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-label text-steel">
                      역량
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.focusAreas.map((area) => (
                        <Badge key={area} tone="purple">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-label text-steel">
                      클래스
                    </p>
                    {classesOn.length === 0 ? (
                      <p className="text-[13px] text-stone">없음</p>
                    ) : (
                      <ul className="space-y-1">
                        {classesOn.map((cls) => (
                          <li key={cls.id} className="flex items-center gap-2 text-[13.5px]">
                            <span className="font-medium text-ink">{cls.title}</span>
                            <span className="text-steel">
                              {studentsInClass(state.students, cls.id).length}명
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Standard sessions */}
                <div className="border-t border-hairline-soft pt-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-[15px] font-semibold text-ink">세션</h4>
                    <div className="flex gap-2">
                      {can(session, 'curriculum:propose') && !canEdit && (
                        <button
                          type="button"
                          onClick={() => setProposingBlock(true)}
                          className="btn-secondary !px-3.5 !py-1.5 !text-[13px]"
                        >
                          <Lightbulb size={13} />
                          블록 제안
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing({ template: null })}
                        className="btn-primary !px-3.5 !py-1.5 !text-[13px]"
                      >
                        {canEdit ? <Plus size={14} strokeWidth={2.8} /> : <Send size={13} />}
                        {canEdit ? '세션 추가' : '세션 제안'}
                      </button>
                    </div>
                  </div>

                  {published.length === 0 ? (
                    <EmptyState
                      icon={Sparkles}
                      title="표준 세션이 아직 없습니다"
                      description="세션을 등재하면 코치의 설계 화면에서 한 번에 불러올 수 있습니다."
                    />
                  ) : (
                    <ol className="space-y-2">
                      {published.map((template) => (
                        <TemplateRow
                          key={template.id}
                          template={template}
                          curriculum={selected}
                          canEdit={canEdit}
                          onEdit={() => setEditing({ template })}
                        />
                      ))}
                    </ol>
                  )}

                  {mine.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-label text-steel">
                        내 제안
                      </p>
                      <ol className="space-y-2">
                        {mine.map((template) => (
                          <TemplateRow
                            key={template.id}
                            template={template}
                            curriculum={selected}
                            canEdit={false}
                            onEdit={() => setEditing({ template })}
                          />
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {canEdit && <ApprovalQueuePanel />}
      </div>

      {editing && selected && (
        <SessionTemplateEditor
          open
          onClose={() => setEditing(null)}
          curriculum={selected}
          template={editing.template}
          mode={canEdit ? 'author' : 'propose'}
        />
      )}

      <BlockProposalModal
        open={proposingBlock}
        onClose={() => setProposingBlock(false)}
        defaultAgeGroups={selected ? [selected.ageGroup] : []}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Track list
// ---------------------------------------------------------------------------

/**
 * The centre's tracks, one line each.
 *
 * A row is: name, age group, session count. Nothing else fits on a phone in one
 * line, and nothing else is needed to choose — the objective, the cycle length
 * and the classes on the track are all one tap away in the panel below, which is
 * where the user was heading anyway.
 *
 * Age is a small label beside the name rather than a second axis. Sorting by
 * `TRACK_ORDER` then age keeps the reading order the owner already thinks in
 * (younger and simpler first) without a heading per group.
 */
function TrackList({
  curricula,
  selectedId,
  sessionCount,
  onSelect,
}: {
  curricula: Curriculum[];
  selectedId: string | null;
  sessionCount: Map<string, number>;
  onSelect: (id: string) => void;
}) {
  const rows = useMemo(
    () =>
      [...curricula].sort(
        (a, b) =>
          TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track) ||
          AGE_ORDER.indexOf(a.ageGroup) - AGE_ORDER.indexOf(b.ageGroup),
      ),
    [curricula],
  );

  return (
    <ul className="overflow-hidden rounded-lg border border-hairline bg-canvas">
      {rows.map((c) => {
        const meta = TRACK_META[c.track];
        const active = c.id === selectedId;

        return (
          <li key={c.id} className="border-b border-hairline-soft last:border-b-0">
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors duration-150',
                active ? 'bg-primary-wash' : 'hover:bg-surface-soft',
              )}
            >
              <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.bar)} />
              <span
                className={cn(
                  'shrink-0 text-[15.5px]',
                  active ? 'font-bold text-primary' : 'font-semibold text-ink',
                )}
              >
                {meta.label}
              </span>
              <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-steel">
                {c.ageGroup}
              </span>
              <span className="ml-auto shrink-0 text-[12.5px] tabular-nums text-steel">
                세션 {sessionCount.get(c.id) ?? 0}
              </span>
              <ChevronRight size={15} className="shrink-0 text-stone" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// One standard session
// ---------------------------------------------------------------------------

function TemplateRow({
  template,
  curriculum,
  canEdit,
  onEdit,
}: {
  template: SessionTemplate;
  curriculum: Curriculum;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const { blockMap, dispatch } = useApp();
  const [open, setOpen] = useState(false);

  const blocks = template.blockIds.map((id) => blockMap.get(id));
  const totalMin = blocks.reduce((sum, b) => sum + (b?.durationMin ?? 0), 0);
  const pending = template.status === 'pending';
  const rejected = template.status === 'rejected';

  return (
    <li
      className={cn(
        'rounded-md border bg-canvas transition-colors',
        rejected ? 'border-hairline bg-surface-soft' : 'border-hairline',
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[12px] font-bold tabular-nums',
            TRACK_META[curriculum.track].tint,
            TRACK_META[curriculum.track].accent,
          )}
        >
          {template.week}주
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-semibold text-ink">{template.title}</span>
            {pending && <Badge tone="orange">{APPROVAL_LABEL.pending}</Badge>}
            {rejected && <Badge tone="error">{APPROVAL_LABEL.rejected}</Badge>}
          </span>
          {template.goal && (
            <span className="mt-0.5 block text-[13px] leading-[1.5] text-slate">
              {template.goal}
            </span>
          )}

          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            {blocks.map((block, i) => {
              const meta = block ? CATEGORY_META[block.category] : null;
              return (
                <span
                  key={`${template.blockIds[i]}-${i}`}
                  className={cn(
                    'flex items-center gap-1 rounded-sm px-2 py-[3px] text-[12px] font-medium',
                    meta?.tint ?? 'bg-tint-gray',
                    meta?.accent ?? 'text-slate',
                  )}
                >
                  <span className="tabular-nums opacity-55">{i + 1}</span>
                  {block?.title ?? '삭제된 블록'}
                </span>
              );
            })}
            <span className="flex items-center gap-1 text-[12px] font-semibold tabular-nums text-steel">
              <Clock size={11} />
              {totalMin}분
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {template.usageCount > 0 && (
            <span className="hidden text-[12px] font-medium tabular-nums text-stone sm:inline">
              {template.usageCount}회 진행
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              aria-label="세션 수정"
              onClick={onEdit}
              className="rounded-sm p-2 text-stone transition-colors hover:bg-surface hover:text-primary"
            >
              <PencilLine size={15} />
            </button>
          )}
          {pending && (
            <button
              type="button"
              aria-label="제안 철회"
              onClick={() => dispatch({ type: 'template/withdraw', templateId: template.id })}
              className="rounded-sm p-2 text-stone transition-colors hover:bg-surface hover:text-error"
            >
              <Trash2 size={15} />
            </button>
          )}
          <ChevronRight
            size={16}
            className={cn('text-stone transition-transform', open && 'rotate-90')}
          />
        </div>
      </div>

      {open && (
        <ol className="space-y-2 border-t border-hairline-soft bg-surface-soft px-4 py-3">
          {blocks.map((block, i) =>
            block ? (
              <li key={`${block.id}-${i}`} className="flex gap-3">
                <span
                  className={cn(
                    'mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full',
                    CATEGORY_META[block.category].bar,
                  )}
                />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-ink">
                    {block.title}
                    <span className="ml-2 text-[12px] font-medium text-steel">
                      {block.durationMin}분
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-[1.55] text-slate">
                    {block.description}
                  </p>
                  {block.equipment.length > 0 && (
                    <p className="mt-1 text-[12px] text-stone">
                      준비물 — {block.equipment.join(', ')}
                    </p>
                  )}
                </div>
              </li>
            ) : null,
          )}
          {template.reviewNote && (
            <li className="rounded-sm bg-tint-alert px-3 py-2 text-[12.5px] leading-[1.55] text-error">
              대표 의견 — {template.reviewNote}
            </li>
          )}
        </ol>
      )}
    </li>
  );
}

