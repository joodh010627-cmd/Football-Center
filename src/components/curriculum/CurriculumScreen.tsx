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
 * Reading order is deliberately top-down — 철학 → 트랙 구성 → 표준 세션 → 블록 —
 * because that is the direction the owner's interview goes. The app runs the
 * same chain in reverse at the end of every class.
 */

import { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  ChevronRight,
  Clock,
  Layers,
  Lightbulb,
  PencilLine,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  Users,
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
import { AGE_CAPTION, AGE_ORDER, APPROVAL_LABEL, TRACK_META, TRACK_ORDER } from './curriculumMeta';
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

      {/* --- Philosophy ------------------------------------------------- */}
      <header className="relative overflow-hidden border-b border-hairline bg-canvas px-5 pb-9 pt-10 sm:px-8 lg:px-12 lg:pb-11 lg:pt-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(115%_150%_at_92%_-10%,#EDF2EE_0%,transparent_60%)]" />

        <div className="relative max-w-3xl">
          <p className="eyebrow-ink">Curriculum</p>
          <h1 className="mt-3.5 text-[27px] font-semibold leading-[1.16] tracking-tightest text-ink lg:text-[40px]">
            수업 세션이 모여 하루가 되고,
            <br />
            하루가 이어져 커리큘럼이 됩니다.
          </h1>
          <p className="mt-4 text-[14px] leading-[1.75] text-slate lg:text-[15px]">
            나이대와 클래스 목적마다 도달해야 할 지점이 다릅니다. 아래 트랙은 그 지점을 정의하고,
            각 트랙의 표준 세션은 코치가 어느 날 무엇을 해야 하는지까지 내려갑니다.
            {canEdit
              ? ' 여기서 추가·수정한 내용은 즉시 코치의 설계 화면에 반영됩니다.'
              : ' 새 세션이나 블록이 필요하면 제안해 주세요. 대표 승인 시 등재됩니다.'}
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            <Chip icon={Layers} label={`트랙 ${curricula.length}개`} />
            <Chip icon={Sparkles} label={`표준 세션 ${state.sessionTemplates.filter((t) => t.status === 'published').length}개`} />
            <Chip
              icon={Users}
              label={`블록 ${state.trainingBlocks.filter((b) => b.status === 'published').length}종`}
            />
          </div>
        </div>
      </header>

      <div className="space-y-9 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        {/* --- Track × age matrix -------------------------------------- */}
        <section>
          <div className="mb-3.5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="eyebrow-ink">클래스 · 나이대 구성</h2>
              <p className="mt-1.5 text-[13px] text-slate">
                가로는 나이대, 세로는 클래스 목적입니다. 같은 U9라도 목적이 다르면 다른 커리큘럼입니다.
              </p>
            </div>
            {canEdit && <span className="text-[12px] text-stone">셀을 눌러 표준 세션 보기</span>}
          </div>

          <CurriculumMatrix
            curricula={visible.length > 0 ? visible : curricula}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
        </section>

        {/* --- Selected curriculum ------------------------------------- */}
        {selected && (
          <section>
            <div className="rounded-lg border border-hairline bg-canvas">
              <header
                className={cn(
                  'flex flex-wrap items-start justify-between gap-4 rounded-t-lg border-b border-hairline px-5 py-5 sm:px-6',
                  TRACK_META[selected.track].tint,
                )}
              >
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-[11px] font-semibold uppercase tracking-label',
                      TRACK_META[selected.track].accent,
                    )}
                  >
                    {TRACK_META[selected.track].label} · {selected.ageGroup}
                  </p>
                  <h3 className="mt-1.5 text-[20px] font-semibold leading-[1.3] tracking-[-0.02em] text-ink lg:text-[24px]">
                    {selected.title}
                  </h3>
                  <p className="mt-2 flex items-start gap-1.5 text-[13.5px] leading-[1.6] text-charcoal">
                    <Target size={14} className="mt-[3px] shrink-0" />
                    {selected.objective}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[26px] font-semibold tracking-[-0.04em] text-ink">
                    {selected.cycleWeeks}
                    <span className="ml-0.5 text-[13px] font-medium text-charcoal">주 1주기</span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-charcoal/70">
                    표준 세션 {published.length}개
                  </p>
                </div>
              </header>

              <div className="space-y-5 px-5 py-5 sm:px-6">
                {/* Focus areas + classes on this track */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-label text-steel">
                      이 트랙이 책임지는 역량
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
                      이 커리큘럼을 도는 클래스
                    </p>
                    {classesOn.length === 0 ? (
                      <p className="text-[13px] text-stone">배정된 클래스가 없습니다.</p>
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
                <div className="border-t border-hairline-soft pt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-[15px] font-semibold text-ink">표준 수업 세션</h4>
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
                        내가 제안한 세션
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
// Matrix
// ---------------------------------------------------------------------------

/**
 * The centre's offering as a grid: purpose down, age across.
 *
 * A flat list of curricula reads as eight unrelated products. Laid out this way
 * the gaps are visible — and a gap in this grid is either a deliberate choice or
 * a class the centre cannot yet sell.
 */
function CurriculumMatrix({
  curricula,
  selectedId,
  onSelect,
}: {
  curricula: Curriculum[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const tracks = TRACK_ORDER.filter((t) => curricula.some((c) => c.track === t));

  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-canvas">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr>
            <th className="w-[150px] border-b border-r border-hairline-soft bg-surface-soft px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-label text-steel">
              클래스 목적
            </th>
            {AGE_ORDER.map((age) => (
              <th
                key={age}
                className="border-b border-hairline-soft bg-surface-soft px-3 py-3 text-center"
              >
                <span className="block text-[14px] font-semibold text-ink">{age}</span>
                <span className="mt-0.5 block text-[11px] font-normal text-stone">
                  {AGE_CAPTION[age]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tracks.map((track) => {
            const meta = TRACK_META[track];
            return (
              <tr key={track}>
                <th className="border-b border-r border-hairline-soft px-4 py-3 text-left align-top">
                  <span className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.bar)} />
                    <span className="text-[13.5px] font-semibold text-ink">{meta.label}</span>
                  </span>
                  <span className="mt-1 block text-[11.5px] font-normal leading-[1.45] text-steel">
                    {meta.purpose}
                  </span>
                </th>

                {AGE_ORDER.map((age) => {
                  const cell = curricula.find((c) => c.track === track && c.ageGroup === age);
                  if (!cell) {
                    return (
                      <td
                        key={age}
                        className="border-b border-hairline-soft px-2 py-3 text-center align-middle"
                      >
                        <span className="text-[13px] text-muted">—</span>
                      </td>
                    );
                  }
                  const active = cell.id === selectedId;
                  return (
                    <td key={age} className="border-b border-hairline-soft px-2 py-2 align-middle">
                      <button
                        type="button"
                        onClick={() => onSelect(cell.id)}
                        className={cn(
                          'w-full rounded-md px-2.5 py-2.5 text-left transition-all duration-150',
                          active
                            ? 'bg-primary text-white shadow-card'
                            : cn(meta.tint, 'hover:shadow-card'),
                        )}
                      >
                        <span
                          className={cn(
                            'block text-[12.5px] font-semibold leading-[1.35]',
                            active ? 'text-white' : 'text-ink',
                          )}
                        >
                          {cell.title.replace(/^.*—\s*/, '')}
                        </span>
                        <span
                          className={cn(
                            'mt-1 block text-[11px]',
                            active ? 'text-white/70' : 'text-charcoal/65',
                          )}
                        >
                          {cell.cycleWeeks}주 주기
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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

function Chip({ icon: Icon, label }: { icon: typeof Layers; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface-soft px-3.5 py-2 text-[13px] font-semibold text-charcoal">
      <Icon size={13} className="text-primary" />
      {label}
    </span>
  );
}
