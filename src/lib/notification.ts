/**
 * Parent notification (알림톡) composer.
 *
 * The coach never writes these. The message is assembled entirely from the
 * tapped attendance status and behaviour tags, which is the whole point: the
 * report is a by-product of logging, not extra work.
 *
 * The wording itself lives in `lib/alimtalk/templates.ts`, because a 알림톡 can
 * only ever be the approved template with its variables filled in. This file
 * decides what goes *into* the variables.
 */

import type { AttendanceStatus, ParentNotification, Student } from '@/types';
import { render } from './alimtalk/templates';
import { formatDateKo } from './format';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '출석',
  absent: '결석',
  injured: '출석 (컨디션에 맞춰 훈련 조정)',
};

const CLOSING: Record<AttendanceStatus, string> = {
  present: '다음 수업에서도 즐겁게 함께하겠습니다. 감사합니다!',
  absent: '다음 수업에서 만나요! 보강이 필요하시면 편하게 문의 주세요.',
  injured: '무리하지 않도록 강도를 조절했습니다. 회복 후 만나요!',
};

export interface NotificationInput {
  student: Student;
  status: AttendanceStatus;
  tags: string[];
  date: string;
  academyName: string;
  className: string;
  coachName: string;
  /** Attendance rate over the last 30 days, 0–1. */
  attendanceRate: number;
  sessionSummary: string[];
}

export function composeParentNotification(input: NotificationInput): ParentNotification {
  const {
    student,
    status,
    tags,
    date,
    academyName,
    className,
    coachName,
    attendanceRate,
    sessionSummary,
  } = input;

  // Every variable gets a value even when there is nothing to say — an empty
  // line in an approved template reads as a bug, "특이사항 없음" reads as care.
  const variables: Record<string, string> = {
    학원명: academyName,
    반이름: className,
    학생명: student.name,
    수업일: formatDateKo(date),
    출결: STATUS_LABEL[status],
    훈련구성: sessionSummary.length > 0 ? sessionSummary.join(' → ') : '코치 직접 구성',
    관찰기록: tags.length > 0 ? tags.join(', ') : '특이사항 없음',
    출석률: `${Math.round(attendanceRate * 100)}%`,
    맺음말: CLOSING[status],
    코치명: coachName,
  };

  return {
    studentId: student.id,
    studentName: student.name,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    message: render('attendance_report', variables),
    templateCode: 'attendance_report',
    variables,
  };
}
