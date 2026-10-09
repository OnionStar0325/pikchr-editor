# Pikchr Editor

[English](README_EN.md) | [한국어](README.md)

[Pikchr](https://pikchr.org) 마크업 언어를 직관적으로 확인하고 생성 및 수정하기 위한 시각화 웹 에디터입니다.
본 프로젝트는 Google Antigravity를 사용하여 생성 및 개발되었습니다.

## 1. 개요 및 목적

[Pikchr](https://pikchr.org)(다이어그램 생성용 PIC 언어의 파생 마크업) 스크립트를 작성할 때, 텍스트 편집과 실시간 렌더링, 시각적 속성 인스펙터를 연동하여 다이어그램을 신속하게 설계하고 수정할 수 있도록 지원합니다.

## 2. 동작 환경 (OS Compatibility)

- 테스트 완료 환경: Linux (Ubuntu ARM64 / aarch64 환경에서 개발 및 테스트됨)
- 안내: macOS, Windows, x86_64 등 기타 OS 및 아키텍처 환경에서는 별도의 검증을 수행하지 않았습니다.

## 3. 웹 UI 화면 구성

```
+-----------------------------------------------------------------------------------+
| Top Menu Bar: Brand, File, Edit, Examples, View, Help, Lang, Theme, Status, Export|
+--------------------+------------------------------------+-------------------------+
| Left Sidebar       | Center Stage                       | Right Sidebar           |
| (Palette & Defs)   | (Interactive Canvas)               | (STATEMENTS & PROPERTY) |
|                    |                                    |                         |
| - Basic Shapes     | - Real-time SVG Rendering          | [STATEMENTS]            |
|   (Box, Circle...) | - Pan & Zoom Navigation            | - Object Statement List |
| - Snippets         | - Object Selection                 |                         |
| - Variables        | - Anchor Point Picker              | [PROPERTY]              |
|                    |                                    | - Shape Properties      |
|                    |                                    | - Connector Segments    |
+--------------------+------------------------------------+-------------------------+
| Bottom Panel: Code Editor (code view)                                             |
| - Monaco/Textarea with Line Numbers, Live Syntax Check, Compile Status             |
+-----------------------------------------------------------------------------------+
```

### 영역별 세부 구성

1. **상단 메뉴 바 (Top Menu Bar)**
   - 파일 관리(새 문서, 전체 코드 클립보드 복사, SVG/PNG 내보내기)
   - 편집(Undo, Redo, 전체 지우기), 예제 템플릿 로드([공식 예제 출처](https://pikchr.org/home/doc/trunk/doc/examples.md)), 다국어 전환(KO/EN/JA), 테마 전환(Dark/Light)
2. **좌측 팔레트 (Palette & Definitions Sidebar)**
   - 기본 오브젝트(box, circle, cylinder, diamond, ellipse, file 등) 및 스니펫 원클릭 삽입
   - 스크립트 내 정의된 변수 및 매크로(`define`) 목록 표시
3. **중앙 캔버스 (Center Stage)**
   - [Pikchr](https://pikchr.org) 스크립트의 SVG 실시간 렌더링
   - 마우스 드래그를 통한 뷰 이동(Pan) 및 휠 스크롤을 통한 확대/축소(Zoom)
   - 요소 클릭 시 해당 코드 라인 및 속성 인스펙터 자동 포커스
   - 화살표/선분의 타겟 지정 모드 시 캔버스 내 기준점(Anchor) 직접 선택 지원
4. **우측 사이드바 (STATEMENTS & PROPERTY)**
   - **STATEMENTS**: 소스 코드로부터 파싱된 문장(오브젝트) 목록 트리 및 선택 이동
   - **PROPERTY**: 선택된 객체의 레이블, 크기, 색상, 배치 위치(`at`, `with`), 연결 경로(`from`, `to`, `until` 세그먼트)를 폼 형태로 편집
5. **하단 코드 뷰 (Code Editor - code view)**
   - 소스 코드 직접 입력 및 라인 넘버 표시
   - 구문 검증 상태 및 에러 발생 위치 실시간 진단 표시

## 4. 사용 방법

1. **도형 추가**: 좌측 팔레트에서 원하는 도형을 클릭하여 캔버스에 추가합니다.
2. **속성 편집**: 캔버스의 도형 또는 우측 STATEMENTS 목록에서 객체를 선택한 뒤, 우측 PROPERTY 패널에서 크기, 색상, 텍스트 등을 수정합니다.
3. **선분 및 연결선 편집**:
   - 화살표/라인 객체 선택 후 `+ 구간 추가 (then)` 버튼을 눌러 단계별 경로(Direction, Length, To, Until)를 구성합니다.
   - 포인트 선택 모드(Target Mode)를 켜고 캔버스의 앵커 포인트를 클릭하여 타겟 좌표를 지정할 수 있습니다.
4. **코드 직접 수정**: 하단 `code view`에서 텍스트 코드를 직접 작성하면 캔버스 및 속성 창에 실시간 반영됩니다.
5. **내보내기**: 상단 메뉴의 `File` -> `Export SVG` 또는 `Export PNG`를 클릭하여 결과물을 저장하거나 `코드 복사 (Copy Source)`를 통해 전체 코드를 복사합니다.

## 5. 실행 및 빌드 방법

### 사전 요구 사항
- Node.js (v18 이상 권장)
- npm (v9 이상 권장)

### 의존성 설치
```bash
npm install
```

### 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000`으로 접속합니다.

### 프로덕션 빌드
```bash
npm run build
```
빌드 산출물은 `dist/` 디렉토리에 생성됩니다.

## 6. 라이선스 및 출처

- **라이선스**: 본 프로젝트는 [MIT License](LICENSE) 하에 배포됩니다.
- **예제 출처**: 에디터에 내장된 다이어그램 예제(Examples)는 [Pikchr 공식 예제 문서](https://pikchr.org/home/doc/trunk/doc/examples.md)를 기반으로 작성되었습니다.
