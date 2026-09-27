/**
 * Dev-only preview: the app, on the demo dataset, with no login and no writes.
 *
 * Open `http://localhost:5173/Football-Center/?preview` (or `?preview=coach`).
 * Gated on `import.meta.env.DEV`, so production builds drop it entirely — a
 * deployed app always goes through Supabase auth and RLS.
 *
 * This exists for building screens, not for demos. The seed rows go through
 * the same mappers the database rows do, so what renders here is what a real
 * academy with that data would see; only persistence is switched off.
 */

import type { Session } from '@/types';
import type { LoadedData } from '@/store/AppContext';
import * as map from '@/data/mappers';

const param = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('preview')
  : null;

/** True when the app is running on the preview dataset. */
export const PREVIEW = param !== null;

const ACADEMY = 'preview-academy';

export function previewSession(): Session {
  const coach = param === 'coach';
  return {
    userId: 'preview-user',
    email: coach ? 'coach1@preview' : 'owner@preview',
    academy: { id: ACADEMY, name: 'FC GROWTH (미리보기)', plan: 'pilot' },
    membership: {
      userId: 'preview-user',
      academyId: ACADEMY,
      role: coach ? 'coach' : 'owner',
      coachId: coach ? 'coach-1' : null,
      displayName: coach ? '김도현' : '박대표',
    },
  };
}

const at = <T extends object>(row: T) => ({ ...row, academy_id: ACADEMY });

/** Loaded lazily so the demo dataset never ships in a production bundle. */
export async function previewData(): Promise<LoadedData> {
  const seed = await import('../../scripts/seedData');
  return {
    coaches: seed.coaches.map((c) =>
      map.toCoach(at({ id: c.id, name: c.name, certifications: c.certifications })),
    ),
    classes: seed.classes.map((c) =>
      map.toClass(
        at({
          id: c.id,
          title: c.title,
          coach_id: c.coachId,
          schedule_days: c.schedule.days,
          start_time: c.schedule.startTime,
          duration_min: c.schedule.durationMin,
          age_group: c.ageGroup,
          capacity: c.capacity,
          venue: c.venue,
          curriculum_id: c.curriculumId,
        }),
      ),
    ),
    students: seed.students.map((s) =>
      map.toStudent(
        at({
          id: s.id,
          name: s.name,
          age_group: s.ageGroup,
          class_id: s.classId,
          parent_name: s.parentName,
          parent_phone: s.parentPhone,
          enrolled_at: s.enrolledAt,
          memo: s.memo ?? null,
          last_attendance_date: s.lastAttendanceDate,
          last_parent_contact_date: s.lastParentContactDate,
          status: s.status,
          churn_score: s.churnScore,
        }),
      ),
    ),
    trainingBlocks: seed.trainingBlocks.map((b) =>
      map.toTrainingBlock(
        at({
          id: b.id,
          title: b.title,
          category: b.category,
          duration_min: b.durationMin,
          description: b.description,
          age_groups: b.ageGroups,
          equipment: b.equipment,
          usage_count: b.usageCount,
          is_core_curriculum: b.isCoreCurriculum,
          status: b.status,
          proposed_by: b.proposedBy,
        }),
      ),
    ),
    behaviorTags: seed.behaviorTags.map((t) => map.toBehaviorTag(at(t))),
    attendanceLogs: seed.attendanceLogs.map((l) =>
      map.toAttendanceLog(
        at({
          id: l.id,
          student_id: l.studentId,
          class_id: l.classId,
          date: l.date,
          status: l.status,
          tags: l.tags,
          coach_comment: l.coachComment,
          coach_id: l.coachId ?? null,
          session_plan_id: l.sessionPlanId ?? null,
        }),
      ),
    ),
    sessionPlans: seed.sessionPlans.map((p) =>
      map.toSessionPlan(
        at({
          id: p.id,
          class_id: p.classId,
          coach_id: p.coachId,
          date: p.date,
          items: p.items,
          template_id: p.templateId,
          status: p.status,
          created_at: p.createdAt,
        }),
      ),
    ),
    sessionTemplates: seed.sessionTemplates.map((t) =>
      map.toSessionTemplate(
        at({
          id: t.id,
          curriculum_id: t.curriculumId,
          ability: t.ability,
          age_groups: [seed.curricula.find((c) => c.id === t.curriculumId)?.ageGroup].filter(
            Boolean,
          ),
          title: t.title,
          goal: t.goal,
          block_ids: t.blockIds,
          status: t.status,
          proposed_by: t.proposedBy,
          review_note: t.reviewNote,
          usage_count: t.usageCount,
          created_at: '',
        }),
      ),
    ),
    csActions: [],
    billing: Object.fromEntries(seed.students.map((s) => [s.id, s.monthlyFee])),
    finances: Object.fromEntries(
      seed.classes.map((c) => [
        c.id,
        {
          classId: c.id,
          academyId: ACADEMY,
          monthlyCost: c.monthlyCost,
          retentionRate: c.retentionRate,
        },
      ]),
    ),
    evaluations: Object.fromEntries(seed.coaches.map((c) => [c.id, c.satisfactionScore])),
  };
}
