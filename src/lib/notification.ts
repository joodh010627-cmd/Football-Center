/**
 * Parent notification (알림톡) composer.
 *
 * The coach never writes these. The message is assembled entirely from the
 * tapped attendance status and behaviour tags, which is the whole point: the
 * report is a by-product of logging, not extra work.
 */

import type { AttendanceStatus, ParentNotification, Student } from '@/types';
import { formatDateKo } from './format';

const OPENING: Record<AttendanceStatus, (name: string) => string> = {
  present: (name) => `${name} 학생, 오늘 수업 참여 완료했습니다! ⚽`,
  absent: (name) => `${name} 학생, 오늘 수업에 참석하지 못했습니다.`,
  injured: (name) => `${name} 학생, 오늘은 컨디션 이슈로 훈련을 조정했습니다.`,
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
  className: string;
  coachName: string;
  /** Attendance rate over the last 30 days, 0–1. */
  attendanceRate: number;
  sessionSummary: string[];
}

export function composeParentNotification(input: NotificationInput): ParentNotification {
  const { student, status, tags, date, className, coachName, attendanceRate, sessionSummary } =
    input;

  const lines: string[] = [
    `[${className}] ${formatDateKo(date)} 수업 리포트`,
    '',
    OPENING[status](student.name),
  ];

  if (sessionSummary.length > 0) {
    lines.push('', `▪ 오늘의 훈련: ${sessionSummary.join(' → ')}`);
  }

  if (tags.length > 0) {
    lines.push('', '▪ 오늘의 관찰 기록', ...tags.map((t) => `  · ${t}`));
  }

  lines.push(
    '',
    `▪ 최근 30일 출석률: ${Math.round(attendanceRate * 100)}%`,
    '',
    CLOSING[status],
    '',
    `— ${coachName} 코치 드림`,
  );

  return {
    studentId: student.id,
    studentName: student.name,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    message: lines.join('\n'),
  };
}
