# News Intelligence Editor

비개발자 에디터가 한국 뉴스를 자동 수집하고, AI 말투/할루시네이션이 제거된 영문 콘텐츠로 변환해 3개 채널(본 사이트 / X 스레드 / Medium)에 원클릭 복사할 수 있는 무설치형 브라우저 대시보드입니다.

## 빠른 시작 (로컬)

```bash
npm install
npm run dev
```

`http://localhost:5173` 접속 후 ⚙ 설정에서 OpenAI API 키 입력.

## Bolt.new에서 실행

1. 이 리포지토리 전체를 Bolt.new에 업로드 또는 붙여넣기
2. Bolt이 자동으로 `npm install` + `npm run dev` 실행
3. 미리보기에서 ⚙ 설정 → API 키 입력

## 주요 기능

- **자동 수집**: 한국 RSS 다소스 (연합/조선/한겨레/스포츠서울 등) 30초 폴링
- **속보 알림**: 키워드 기반 감지 + 시뮬레이터 (붉은 배너 + 알림음)
- **2콜 LLM 체인**: 가치 평가 & 영문 변환 → 채널별 포맷팅
- **금지어 자동 차단**: delve, in conclusion, furthermore 등 LLM 상투구
- **규칙 기반 팩트 체크**: 사람/숫자/장소/날짜 누락 시 🚨 경고
- **3채널 원클릭 복사**: 본 사이트 / X 스레드 / Medium
- **변환 이력**: localStorage 최근 20건

## 스타일 프리셋

⚙ 설정 → 글 스타일에서 선택:
- **K-pop / 연예 / 가십** (기본) — Soompi / Allkpop 스타일
- **AP / Reuters 통신사**
- **Bloomberg / FT 경제지**
- **TechCrunch / Verge 테크**
- **커스텀** (직접 지침 입력)

## 비용 안내

- 기본 모델 `gpt-4o-mini`: 기사 1건 처리 ≈ $0.001~0.002
- 상위 모델 `gpt-4o`: ≈ $0.01~0.02
- RSS는 rss2json 무료 티어 (10 req/h 한도)

## 테스트

```bash
npm test          # 1회 실행
npm run test:watch # 감시 모드
```

## 폴더 구조

```
src/
├── components/   # 화면 컴포넌트
├── state/        # Context 기반 전역 상태
├── lib/          # 순수 함수 라이브러리
├── types.ts
├── App.tsx
└── main.tsx
```

## 알려진 제한

- 일부 한국 매체는 rss2json 무료 한도/CORS로 실패할 수 있음 → 설정에서 비활성화
- RSS 본문은 요약만 포함되므로 긴 분석이 필요한 경우 URL/텍스트 수동 입력 권장
- 클립보드 API는 HTTPS 또는 localhost에서만 동작 (Bolt.new 미리보기 OK)
