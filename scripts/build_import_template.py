"""
원생 명단 임포트 양식(.xlsx) 생성기.

명세: docs/IMPORT-SPEC.md
산출: docs/templates/FC_원생명단_양식_v1.xlsx

양식은 영업 자리에서 대표에게 그대로 건네는 물건이라 레포에 커밋하지만,
바이너리를 손으로 고치면 명세와 어긋난다. 항상 이 스크립트로만 재생성한다.

    py scripts/build_import_template.py

폰트는 Arial 대신 맑은 고딕을 쓴다. 내용이 전부 한글이고, Arial은
Windows Excel에서 한글을 대체 폰트로 떨어뜨려 자간이 깨진다.
"""

from __future__ import annotations

import os
from datetime import date

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

# 납부 그리드 예시 컬럼의 기준월. 재생성 시점이 아니라 고정값으로 두어
# 스크립트를 다시 돌려도 산출물이 바뀌지 않게 한다(diff 소음 방지).
REFERENCE_MONTH = (2026, 9)
PAYMENT_MONTHS_BACK = 3

FONT = "맑은 고딕"

# --- 등급별 헤더 색 (docs/IMPORT-SPEC.md의 등급과 1:1) ----------------------
GRADE_FILL = {
    "required": PatternFill("solid", fgColor="C00000"),   # 필수 — 빨강
    "recommended": PatternFill("solid", fgColor="BF8F00"),  # 권장 — 호박
    "optional": PatternFill("solid", fgColor="808080"),   # 선택 — 회색
    "payment": PatternFill("solid", fgColor="2F5597"),    # 납부 — 파랑
}
GRADE_LABEL = {
    "required": "필수",
    "recommended": "권장",
    "optional": "선택",
    "payment": "납부(선택)",
}

SAMPLE_FILL = PatternFill("solid", fgColor="FFF9E6")
SAMPLE_FONT = Font(name=FONT, size=10, italic=True, color="7F6000")
HEADER_FONT = Font(name=FONT, size=10, bold=True, color="FFFFFF")
BODY_FONT = Font(name=FONT, size=10)

THIN = Side(style="thin", color="D9D9D9")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def payment_columns() -> list[str]:
    """기준월 직전 N개월을 'YYYY-MM'으로."""
    year, month = REFERENCE_MONTH
    out = []
    for i in range(PAYMENT_MONTHS_BACK, 0, -1):
        m = month - i
        y = year
        while m <= 0:
            m += 12
            y -= 1
        out.append(f"{y}-{m:02d}")
    return out


# --- 시트 1: 원생명단 -------------------------------------------------------
# (헤더, 등급, 너비, 셀 주석, 표시형식)
ROSTER_COLUMNS = [
    ("이름", "required", 12,
     "필수. 원생 실명 1~20자.", None),
    ("클래스", "required", 16,
     "필수. '클래스' 시트의 클래스명과 같게 적어주세요.\n"
     "시트가 없으면 여기 적힌 이름으로 자동 생성됩니다.", None),
    ("보호자연락처", "required", 16,
     "필수. 010-0000-0000 형식.\n숫자만 붙여 써도 자동 변환됩니다.", None),
    ("월수강료", "required", 12,
     "필수. 원 단위 숫자.\n150,000 / 15만원 형태도 인식합니다.", "#,##0"),
    ("등록일", "recommended", 13,
     "권장. YYYY-MM-DD.\n등록 개월차 계산과 납부 이력 판정에 씁니다.", "yyyy-mm-dd"),
    ("생년월일", "recommended", 13,
     "권장. YYYY-MM-DD.\n연령대를 자동으로 산출합니다.\n"
     "※ 주민등록번호는 절대 적지 마세요.", "yyyy-mm-dd"),
    ("연령대", "optional", 10,
     "선택. U7/U9/U11/U13/U15 중 선택.\n"
     "비우면 생년월일에서 자동 산출합니다.\n"
     "직접 적으면 자동 산출보다 우선합니다.", None),
    ("보호자성명", "optional", 12,
     "선택. 알림톡 인사말에 사용합니다.", None),
    ("최근출석일", "optional", 13,
     "선택. 비워두셔도 됩니다 — 대부분 비어 있는 것이 정상입니다.\n"
     "출결 기록을 3주 쌓으면 이탈 경보가 자동으로 켜집니다.", "yyyy-mm-dd"),
    ("메모", "optional", 24,
     "선택. 특이사항, 부상 이력 등 자유 입력.", None),
]

ROSTER_SAMPLES = [
    ["홍길동", "U9 화목반", "010-0000-0001", 150000,
     date(2025, 3, 4), date(2017, 5, 20), "U9", "홍판서", None,
     "예시 행입니다 — 사용 전 삭제하세요"],
    ["김민준", "U9 화목반", "010-0000-0002", 150000,
     date(2026, 6, 15), date(2017, 11, 2), None, "김철수", None,
     "연령대를 비우면 생년월일에서 자동 산출됩니다"],
    ["이서연", "U11 월수금반", "01000000003", 180000,
     date(2024, 9, 1), date(2015, 2, 8), None, "이영희", None,
     "연락처는 숫자만 적어도 자동 변환됩니다"],
]

# 납부 그리드 예시값 (O / 미납 / 납부일)
SAMPLE_PAYMENTS = [
    ["O", "O", "O"],
    [None, "O", "O"],
    ["O", "X", None],
]

# --- 시트 2: 클래스 ---------------------------------------------------------
CLASS_COLUMNS = [
    ("클래스명", "required", 18,
     "필수. '원생명단' 시트의 클래스와 정확히 같게 적어주세요.", None),
    ("수업요일", "recommended", 14,
     "권장. 월,수,금 처럼 쉼표로 구분.\n"
     "★ 이 값이 이탈 경보의 정확도를 결정합니다.\n"
     "주 1회 반과 주 3회 반은 '2주 결석'의 의미가 완전히 다릅니다.", None),
    ("담당코치", "recommended", 12,
     "권장. 코치 실명. 없으면 자동 생성됩니다.", None),
    ("정원", "recommended", 8,
     "권장. 정수. 정원 충족률 계산에 씁니다.", None),
    ("시작시간", "optional", 10,
     "선택. HH:MM (24시간).", None),
    ("수업시간(분)", "optional", 12,
     "선택. 정수. 예: 60", None),
    ("장소", "optional", 18,
     "선택. 구장명.", None),
    ("월운영비", "optional", 13,
     "선택. 원 단위. 코치 인건비 + 구장 대관료 + 용품비.\n"
     "공헌이익·마진율 계산에 쓰이며 대표님만 보십니다.", "#,##0"),
]

CLASS_SAMPLES = [
    ["U9 화목반", "화,목", "박성호", 16, "16:00", 60, "성동 풋살파크 A", 2400000],
    ["U11 월수금반", "월,수,금", "김도현", 20, "17:00", 90, "성동 풋살파크 B", 3600000],
    ["U7 토요반", "토", "박성호", 12, "10:00", 60, "성동 풋살파크 A", 1200000],
]


def style_header(ws, columns, row=1):
    for idx, (name, grade, width, note, _fmt) in enumerate(columns, start=1):
        cell = ws.cell(row=row, column=idx, value=name)
        cell.font = HEADER_FONT
        cell.fill = GRADE_FILL[grade]
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
        if note:
            comment = Comment(f"[{GRADE_LABEL[grade]}]\n{note}", "FC GROWTH")
            comment.width = 320
            comment.height = 150
            cell.comment = comment
        ws.column_dimensions[get_column_letter(idx)].width = width
    ws.row_dimensions[row].height = 30


def write_samples(ws, rows, columns, start_row=2):
    for r, values in enumerate(rows, start=start_row):
        for c, value in enumerate(values, start=1):
            cell = ws.cell(row=r, column=c, value=value)
            cell.font = SAMPLE_FONT
            cell.fill = SAMPLE_FILL
            cell.border = BORDER
            fmt = columns[c - 1][4] if c - 1 < len(columns) else None
            if fmt:
                cell.number_format = fmt


def build_roster_sheet(wb):
    ws = wb.create_sheet("원생명단")
    months = payment_columns()

    columns = list(ROSTER_COLUMNS)
    for m in months:
        columns.append((
            m, "payment", 11,
            "선택. 월별 납부 현황.\n"
            "O(납부) / X(미납) / 납부일 / 금액 중 편한 방식으로.\n"
            "등록일 이전 달의 빈칸은 미납으로 세지 않습니다.", None,
        ))

    style_header(ws, columns)

    rows = [
        sample + payments
        for sample, payments in zip(ROSTER_SAMPLES, SAMPLE_PAYMENTS)
    ]
    write_samples(ws, rows, columns)

    # 연령대 드롭다운 — "객관식"을 파일 안에서 강제한다.
    age_col = get_column_letter(7)
    dv = DataValidation(
        type="list",
        formula1='"U7,U9,U11,U13,U15"',
        allow_blank=True,
        showDropDown=False,
    )
    dv.error = "U7 / U9 / U11 / U13 / U15 중에서 선택하거나, 비워두고 생년월일을 채워주세요."
    dv.errorTitle = "연령대 형식"
    dv.prompt = "비워두면 생년월일에서 자동으로 산출합니다."
    dv.promptTitle = "연령대"
    ws.add_data_validation(dv)
    dv.add(f"{age_col}2:{age_col}1000")

    # 빈 행에도 날짜/금액 서식을 미리 입혀 붙여넣기 사고를 줄인다.
    for r in range(2 + len(rows), 1001):
        for c, (_n, _g, _w, _note, fmt) in enumerate(columns, start=1):
            if fmt:
                ws.cell(row=r, column=c).number_format = fmt

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(columns))}1"
    return ws


def build_class_sheet(wb):
    ws = wb.create_sheet("클래스")
    style_header(ws, CLASS_COLUMNS)
    write_samples(ws, CLASS_SAMPLES, CLASS_COLUMNS)
    ws.freeze_panes = "A2"
    return ws


GUIDE = [
    ("title", "FC GROWTH — 원생 명단 등록 양식 v1"),
    ("body", "이 파일에 명단을 채워 보내주시면 시스템에 그대로 올려 드립니다."),
    ("space", ""),

    ("head", "1. 꼭 채워야 하는 건 4가지뿐입니다"),
    ("body", "이름 · 클래스 · 보호자연락처 · 월수강료"),
    ("body", "이 4개만 있으면 등록됩니다. 나머지는 채우실수록 화면이 풍부해지는 항목입니다."),
    ("space", ""),

    ("head", "2. 색으로 구분했습니다"),
    ("legend_required", "빨강 — 필수. 비면 등록이 안 됩니다."),
    ("legend_recommended", "호박 — 권장. 없어도 되지만 있으면 기능이 켜집니다."),
    ("legend_optional", "회색 — 선택. 편하실 대로."),
    ("legend_payment", "파랑 — 납부 현황(선택). 월별로 O/X만 적으셔도 됩니다."),
    ("body", "각 제목 칸에 마우스를 올리면 설명이 나옵니다."),
    ("space", ""),

    ("head", "3. 노란색 예시 행 3개는 지우고 쓰세요"),
    ("body", "형식을 보여드리려고 넣어둔 가짜 데이터입니다."),
    ("body", "남아 있어도 등록할 때 저희가 잡아내니 걱정하지 않으셔도 됩니다."),
    ("space", ""),

    ("head", "4. 적지 않으셔도 되는 것들"),
    ("body", "상태(정상/위험/휴원) · 이탈위험도 · 출석률 · 재등록률 · 공헌이익"),
    ("body", "전부 시스템이 계산합니다. 매달 손으로 채우시던 칸이라면 이제 안 하셔도 됩니다."),
    ("space", ""),

    ("head", "5. 최근출석일은 비워두셔도 됩니다"),
    ("body", "대부분의 교실이 출결을 엑셀에 남기지 않습니다. 비어 있는 게 정상입니다."),
    ("body", "오늘 올리시면 매출·미납·정원이 바로 보이고,"),
    ("body", "3주만 기록하시면 이탈 경보가 자동으로 켜집니다."),
    ("space", ""),

    ("head", "6. 주민등록번호는 적지 말아 주세요"),
    ("body", "법령상 수집 근거가 없어 저희가 받지 않습니다."),
    ("body", "주민번호 열이 있으면 등록을 중단하고 삭제 후 다시 요청드립니다."),
    ("body", "나이가 필요하면 생년월일 칸만 채워주시면 충분합니다."),
    ("space", ""),

    ("head", "7. '클래스' 시트의 수업요일을 꼭 채워주세요"),
    ("body", "주 1회 반과 주 3회 반은 '2주 결석'의 의미가 완전히 다릅니다."),
    ("body", "이 값이 있어야 이탈 경보가 헛울리지 않습니다."),
    ("space", ""),

    ("head", "문의"),
    ("body", "채우시다 막히시면 그냥 쓰시던 파일 그대로 보내주셔도 됩니다."),
    ("body", "저희가 이 양식으로 옮겨 드립니다."),
]


def build_guide_sheet(wb):
    ws = wb.create_sheet("작성안내")
    ws.column_dimensions["A"].width = 3
    ws.column_dimensions["B"].width = 96
    ws.sheet_view.showGridLines = False

    legend_grades = {
        "legend_required": "required",
        "legend_recommended": "recommended",
        "legend_optional": "optional",
        "legend_payment": "payment",
    }

    row = 2
    for kind, text in GUIDE:
        if kind == "space":
            row += 1
            continue
        cell = ws.cell(row=row, column=2, value=text)
        if kind == "title":
            cell.font = Font(name=FONT, size=16, bold=True, color="1F3864")
            ws.row_dimensions[row].height = 26
        elif kind == "head":
            cell.font = Font(name=FONT, size=11, bold=True, color="C00000")
            ws.row_dimensions[row].height = 20
        elif kind in legend_grades:
            cell.font = Font(name=FONT, size=10, bold=True, color="FFFFFF")
            cell.fill = GRADE_FILL[legend_grades[kind]]
            cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
        else:
            cell.font = BODY_FONT
        row += 1
    return ws


def main():
    wb = Workbook()
    wb.remove(wb.active)

    roster = build_roster_sheet(wb)
    build_class_sheet(wb)
    build_guide_sheet(wb)

    wb.active = wb.index(roster)

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, "docs", "templates")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "FC_원생명단_양식_v1.xlsx")
    wb.save(out)

    # 콘솔은 cp949일 수 있으므로 ASCII만 출력한다.
    print("written:", os.path.relpath(out, root).replace("\\", "/"))
    print("sheets:", len(wb.sheetnames))
    print("payment columns:", ", ".join(payment_columns()))


if __name__ == "__main__":
    main()
