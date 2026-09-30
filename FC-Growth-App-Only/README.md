# FC Growth 앱 개발용 소스

앱의 화면·클릭 동작·이미지·폰트와 앱 개발 안내만 들어 있습니다.

## 실행

Python 3가 설치된 컴퓨터에서 이 폴더를 열고 실행하세요.

```sh
python3 scripts/build.py
python3 scripts/serve.py
```

Windows에서는 `python3` 대신 `py`를 사용할 수 있습니다.
브라우저에서 http://127.0.0.1:8000/ 을 여세요.
포트가 사용 중이면 `python3 scripts/serve.py --port 8001`로 실행하세요.
소스 수정 후 빌드를 다시 실행하고 새로고침하면 됩니다.

## Claude Code에서 작업

압축을 푼 이 폴더 전체를 열고 아래 요청을 전달하세요.

> CLAUDE.md와 현재 코드를 읽고 앱을 실행해줘. 현재 디자인을 유지하면서 내가 요청하는 화면 수정과 백엔드 연결을 진행해줘. 구현된 기능과 아직 데모인 기능을 구분해줘.

## 파일 안내

- `src/app-shell.html`: 홈·기본 탭·피드 등 앱 기본 화면.
- `src/club.js`, `src/club.css`: 원생·코치·클래스 상세와 샘플 데이터.
- `src/beyond-*.js`, `src/beyond.css`: 훈련 블록·수업 구성/기록·폼·월간 일정·클럽 소식·앱 안의 협찬 화면.
- `src/embedded-assets/`, `src/embedded-assets.json`: 기존 화면의 내장 사진/폰트와 연결표.
- `src/assets/`: Pretendard 폰트와 라이선스.
- `src/preview-shell.html`: 앱 미리보기용 껍데기.
- `scripts/`: 빌드와 로컬 화면 실행.
- `dist/index.html`: 빌드된 앱.

## 현재 구현 범위

작동하는 HTML/CSS/JavaScript 웹 프로토타입입니다. 로그인·데이터베이스·서버 저장·실제 폼 접수·AI 분석 API는 아직 없습니다. 가상 데이터로 화면을 체험하며 입력 내용은 새로고침하면 초기화됩니다. 미리보기 서버는 제품 백엔드가 아닙니다.

현재 공유 앱과 독립된 개발용 사본입니다. 이 파일을 수정해도 공유 앱은 바뀌지 않습니다. 실제 사진·브랜드의 상업 이용이나 제휴 여부는 별도로 확인해야 합니다.
