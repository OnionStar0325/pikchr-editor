# Pikchr Studio 프로젝트 구조서 (Project Structure)

Pikchr Studio는 Pikchr 다이어그램 마크업 언어를 실시간으로 시각화하고 양방향으로 편집할 수 있는 웹 기반 비주얼 IDE입니다.

---

## 1. 디렉토리 구조 (Directory Tree)

```
pikchr-editor/
├── doc/                            # Pikchr 공식 한글 문법 및 키워드 참조 문서
│   ├── grammar_kr.md               # Pikchr 핵심 문법 명세 (object-class, direction, statements)
│   ├── macro_kr.md                 # 매크로(define) 문법 명세
│   ├── boxobj_kr.md / ...          # 각 도형별 속성 가이드
│   └── userman_kr.md               # 사용자 매뉴얼
├── src/                            # 프론트엔드 소스 코드
│   ├── components/                 # UI 컴포넌트 계층
│   │   ├── MenuBar.tsx             # 상단 데스크톱 IDE 스타일 계층형 메뉴바 (File, Edit, Insert, View, Examples, Help, 🌐 Language)
│   │   ├── PaletteSidebar.tsx      # 좌측 사이드바: 2-Tab 구조 (팔레트[오브젝트/방향/스니펫] + 정의 영역)
│   │   ├── CenterStage.tsx         # 센터 스테이지: 인터랙티브 SVG 캔버스 (Pan/Zoom, 클릭 선택 및 하이라이트)
│   │   ├── ObjectListSidebar.tsx   # 우측 사이드바: 오브젝트 트리 뷰 + 오브젝트별 맞춤 속성 편집기(Conditional Inspector)
│   │   ├── CodeEditorPanel.tsx     # 하단 바: 코드 에디터, 라인 넘버, 실시간 구문 검증 및 에러 진단 콘솔
│   │   └── HelpModal.tsx           # Pikchr 문법 치트시트 및 단축키 안내 팝업 모달
│   ├── lib/                        # 코어 비즈니스 로직 및 컴파일러 엔진
│   │   ├── theme.tsx               # UI 라이트/다크 테마 및 캔버스 용지 배경 모드(Paper-White, Paper-Dark, Transparent) Context
│   │   ├── i18n/                   # 다국어 지원 모듈 (ko, en, ja)
│   │   │   ├── types.ts            # TranslationDictionary 타입 (오브젝트별 맞춤 속성 레이블 포함)
│   │   │   ├── ko.ts / en.ts / ja.ts # 언어별 번역 리소스
│   │   │   └── index.tsx           # useTranslation 훅 및 로케일 스토어
│   │   ├── pikchr.ts               # Pikchr WASM 컴파일러 래퍼(다크 모드 플래그 지원), AST 파서, 정밀 속성 파서, SVG 태거
│   │   ├── types.ts                # TypeScript 데이터 모델 (오브젝트별 특화 속성 인터페이스)
│   │   └── examples.ts             # 기본 예제 템플릿 (3-Tier, Flowchart, Network, State Machine)
│   ├── App.tsx                     # 전역 상태 관리 및 3-Way 동기화 통합 루트 컴포넌트
│   ├── main.tsx                    # React 진입점 (ThemeProvider, I18nProvider 최상위 래핑)
│   ├── index.css                   # Tailwind v4 스타일, 라이트/다크 테마 토큰, 고대비 페이퍼 캔버스 쉐도우
│   └── vite-env.d.ts               # Vite 환경 및 모듈 타입 선언
├── index.html                      # 메인 HTML 템플릿
├── package.json                    # 프로젝트 메타데이터 및 의존성 패키지 정의
├── postcss.config.js               # PostCSS 및 TailwindCSS PostCSS 플러그인 설정
├── tailwind.config.js              # Tailwind CSS 스타일 테마 설정
├── tsconfig.json                   # TypeScript 컴파일 설정
├── vite.config.ts                  # Vite 번들러 및 개발 서버 설정
├── structure.md                    # [본 문서] 프로젝트 구조 및 모듈 명세
└── README.md                       # 프로젝트 소개 및 실행 가이드
```

---

## 2. 테마 및 캔버스 가독성 개선 구조 (`src/lib/theme.tsx`, `CenterStage.tsx`)

1. **앱 UI 테마 (App Theme)**:
   - **라이트 테마 (Light Mode)**: 깔끔하고 현대적인 밝은 인터페이스 (`bg-white`, `text-slate-800`, `border-slate-200`).
   - **다크 테마 (Dark Mode)**: 눈의 피로를 줄여주는 어두운 슬레이트 인터페이스 (`bg-slate-950`, `text-slate-200`, `border-slate-800`).
   - 상단 메뉴바 우측 1-Click 토글 버튼(☀️/🌙) 및 `View -> Theme` 메뉴를 통해 즉시 전환.

2. **고대비 다이어그램 캔버스 용지 모드 (Paper Canvas Modes)**:
   - **화이트 용지 (`paper-white`)**: 전통적인 화이트 용지 시트에 뚜렷한 드롭 섀도우를 적용하여 Pikchr의 기본 검은색 스트로크/텍스트가 극대화된 대비로 식별됨.
   - **다크 용지 (`paper-dark`)**: Pikchr의 다크 모드 컴파일 플래그(`flags: 2`)를 활성화하여 다크 배경에 선명한 흰색 라인과 텍스트로 렌더링.
   - **투명 그리드 (`transparent`)**: 캔버스 모눈종이 그리드 배경 위에 바로 다이어그램 표시.

---

## 3. 오브젝트별 맞춤 속성 인스펙터 구성 (`ObjectListSidebar.tsx`)

| 대상 오브젝트 (Type) | 전용 속성 입력 폼 필드 |
| :--- | :--- |
| **`box` (상자)** | 레이블(식별자), 라벨(텍스트), 너비(`width`), 높이(`height`), 모서리 둥글기(`radius`), 채우기(`fill`), 선 색상(`color`), 맞춤(`fit`), 두께(`thick`), 점선(`dashed`), 투명(`invis`) |
| **`circle` / `dot` (원/점)** | 레이블(식별자), 라벨(텍스트), 반지름(`radius`), 지름(`diameter`), 채우기(`fill`), 선 색상(`color`), 두께(`thick`), 점선(`dashed`), 투명(`invis`) |
| **`cylinder` (원통/DB)** | 레이블(식별자), 라벨(텍스트), 너비(`width`), 높이(`height`), 상단 캡 반지름(`radius`), 채우기(`fill`), 선 색상(`color`), 맞춤(`fit`), 두께(`thick`) |
| **`diamond`, `oval`, `ellipse`, `file`** | 레이블(식별자), 라벨(텍스트), 너비(`width`), 높이(`height`), 채우기(`fill`), 선 색상(`color`), 맞춤(`fit`), 두께(`thick`), 점선(`dashed`), 투명(`invis`) |
| **`arrow`, `line`, `spline`** | 레이블(식별자), 라벨(텍스트), 라벨 위치(`above`/`below`/`center`), 화살표 머리(`->`/`<-`/`<->`/`none`), 방향(`right`/`down`/`left`/`up`), 길이/거리(`length`), 시작점(`from`), 끝점(`to`), 선 색상(`color`), 두께(`thick`), 점선(`dashed`), 다듬기(`chop`) |
| **`arc` (호/곡선)** | 레이블(식별자), 회전 방향(`cw`/`ccw`), 화살표 머리(`->`/`<-`/`<->`/`none`), 반지름(`radius`), 시작점(`from`), 끝점(`to`), 선 색상(`color`), 두께(`thick`), 점선(`dashed`) |
| **`text` (독립 텍스트)** | 레이블(식별자), 텍스트 내용(`label`), 글자 크기(`big`/`normal`/`small`), 글꼴 스타일(`bold`/`italic`/`mono`), 정렬(`center`/`ljust`/`rjust`), 글자 색상(`color`) |
| **`move` (이동)** | 이동 방향(`right`/`down`/`left`/`up`), 이동 거리(`length`), 이동 목적지(`to`) |
