/**
 * The claim under test: "hand us any file and it just works."
 *
 * Each fixture breaks a different assumption a naive importer makes — the
 * header is not on row 1, the header words are ones we never listed, there is
 * no header at all, the class name only exists as a block label or a tab name.
 * If these pass with zero manual mapping, the demo survives a real meeting.
 *
 * Regenerate fixtures with:  py scripts/build_test_fixtures.py
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readWorkbook } from './grid';
import { importFromText, runImport, type ImportResult } from './index';

const FIXTURES = join(__dirname, '__fixtures__');
const ASOF = new Date('2026-09-02T00:00:00Z');

async function load(file: string): Promise<ImportResult> {
  const buf = readFileSync(join(FIXTURES, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return runImport(await readWorkbook(ab as ArrayBuffer), ASOF);
}

const errors = (r: ImportResult) => r.issues.filter((i) => i.level === 'error');

const CASES: { file: string; expected: number; what: string }[] = [
  { file: '01-clean.xlsx', expected: 12, what: '깔끔한 표 (기준선)' },
  { file: '02-titled.xlsx', expected: 14, what: '제목 2행 + 헤더 4행부터 + 합계/꼬리말' },
  { file: '03-sections.xlsx', expected: 15, what: '반별 블록 세로 적층 + 헤더 반복' },
  { file: '04-headerless.xlsx', expected: 10, what: '헤더 없음 — 내용만으로 판별' },
  { file: '05-payments.xlsx', expected: 12, what: '납부 그리드 + 계산 열 + 왼쪽 빈 열' },
  { file: '06-multisheet.xlsx', expected: 18, what: '시트 하나가 반 하나' },
];

describe('무설정 임포트', () => {
  for (const { file, expected, what } of CASES) {
    it(`${file} — ${what}`, async () => {
      const r = await load(file);

      expect(errors(r), `오류: ${errors(r).map((e) => e.message).join(' / ')}`).toHaveLength(0);
      expect(r.rejected).toBeNull();
      expect(r.students).toHaveLength(expected);

      // 필수 4개가 전부 자동 해결되어야 손대지 않고 넘어간다.
      for (const s of r.sheets) expect(s.missing, `${file}: 미해결 필드`).toEqual([]);

      for (const s of r.students) {
        expect(s.name).toMatch(/^[가-힣]{2,5}$/);
        expect(s.className.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('구조 탐지', () => {
  it('제목·합계·꼬리말을 데이터로 세지 않는다', async () => {
    const r = await load('02-titled.xlsx');
    expect(r.notes.join(' ')).toContain('제목');
    expect(r.students.map((s) => s.name)).not.toContain('합계');
    // 꼬리말 "※ 문의: 010-1111-2222"가 원생으로 새어들면 연락처가 오염된다.
    expect(r.students.every((s) => !s.name.includes('※'))).toBe(true);
  });

  it('헤더가 없으면 내용만으로 4개 필드를 채운다', async () => {
    const r = await load('04-headerless.xlsx');
    expect(r.sheets[0].table.headerRow).toBeNull();
    expect(r.students[0].parentPhone).toMatch(/^010-\d{4}-\d{4}$/);
    expect(r.students[0].monthlyFee).toBeGreaterThan(0);
  });

  it('구분 행에서 반 이름을 가져온다 (첫 블록 포함)', async () => {
    const r = await load('03-sections.xlsx');
    const titles = r.classes.map((c) => c.title).sort();
    expect(titles).toEqual(['U11 월수금반', 'U7 토요반', 'U9 화목반']);
    expect(r.classes.every((c) => c.headcount === 5)).toBe(true);
  });

  it('반 이름이 시트명에만 있어도 인식한다', async () => {
    const r = await load('06-multisheet.xlsx');
    expect(r.classes.map((c) => c.title).sort()).toEqual([
      'U11 월수금반',
      'U13 월수반',
      'U9 화목반',
    ]);
  });

  it('반 이름에서 수업 요일을 뽑아낸다 (이탈 경보 정확도의 입력)', async () => {
    const r = await load('06-multisheet.xlsx');
    const hwamok = r.classes.find((c) => c.title === 'U9 화목반');
    expect(hwamok?.scheduleDays).toEqual([2, 4]); // 화, 목
  });
});

describe('컬럼 분류', () => {
  it('납부 그리드를 월별로 인식한다', async () => {
    const r = await load('05-payments.xlsx');
    const months = r.sheets[0].assignments
      .filter((a) => a.paymentMonth)
      .map((a) => a.paymentMonth);
    expect(months).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(r.students[0].payments.length).toBe(3);
  });

  it('시스템이 계산하는 열(상태·이탈위험도)은 무시한다', async () => {
    const r = await load('05-payments.xlsx');
    const ignored = r.sheets[0].assignments.filter((a) =>
      ['상태', '이탈위험도'].includes(a.header),
    );
    expect(ignored).toHaveLength(2);
    expect(ignored.every((a) => a.field === null)).toBe(true);
  });

  it('생년월일과 등록일을 서로 바꾸지 않는다', async () => {
    const r = await load('02-titled.xlsx');
    for (const s of r.students) {
      expect(Number(s.birthDate!.slice(0, 4))).toBeLessThan(2021);
      expect(Number(s.enrolledAt!.slice(0, 4))).toBeGreaterThan(2023);
    }
  });

  it('연령대가 없으면 생년월일에서 산출한다', async () => {
    const r = await load('02-titled.xlsx');
    expect(r.students.every((s) => s.ageGroup !== null)).toBe(true);
  });
});

describe('콜드 스타트 — 출결 이력이 없는 것이 정상', () => {
  it('최근출석일을 절대 지어내지 않는다', async () => {
    const r = await load('01-clean.xlsx');
    expect(r.students.every((s) => s.lastAttendanceDate === null)).toBe(true);
  });

  it('비어 있는 이유를 안내로 설명한다', async () => {
    const r = await load('01-clean.xlsx');
    const info = r.issues.filter((i) => i.level === 'info').map((i) => i.message).join(' ');
    expect(info).toContain('정상');
    expect(info).toContain('3주');
  });
});

describe('클립보드 붙여넣기', () => {
  it('엑셀에서 긁어온 TSV를 그대로 읽는다', () => {
    const tsv = [
      '이름\t반\t학부모연락처\t수강료',
      '김서준\tU9 화목반\t01012345678\t150,000',
      '이도윤\tU9 화목반\t010-2345-6789\t15만원',
    ].join('\n');

    const r = importFromText(tsv, ASOF);
    expect(errors(r)).toHaveLength(0);
    expect(r.students).toHaveLength(2);
    // 숫자만 적힌 번호도, 만원 표기 금액도 정규화된다.
    expect(r.students[0].parentPhone).toBe('010-1234-5678');
    expect(r.students[1].monthlyFee).toBe(150000);
  });

  it('CSV도 구분자를 알아서 잡는다', () => {
    const csv = '성명,소속,연락처,월회비\n박하준,U11 월수금반,010-3333-4444,180000';
    const r = importFromText(csv, ASOF);
    expect(r.students).toHaveLength(1);
    expect(r.students[0].className).toBe('U11 월수금반');
  });
});

describe('개인정보 가드', () => {
  it('주민등록번호가 있으면 파일 전체를 거부한다', () => {
    const tsv = '이름\t주민등록번호\t연락처\n김서준\t170520-3234567\t010-1111-2222';
    const r = importFromText(tsv, ASOF);
    expect(r.rejected).toBeTruthy();
    expect(r.students).toHaveLength(0);
    expect(errors(r)[0].message).toContain('삭제');
  });
});
// 판별 *근거*를 눈으로 확인하려면:  npm run import:report
// (테스트는 결과만 본다. 근거를 읽는 일은 사람이 하는 일이라 도구를 따로 뒀다.)
