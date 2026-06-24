# News Intelligence Editor

비개발자 에디터가 한국 뉴스를 자동 수집하고, **여러 매체를 한 사건으로 묶어 교차검증**한 뒤, 종합 드래프트(한국어 → 영문)를 만들어 **본 사이트 / X / Medium 3개 채널**에 맞게 변환·복사할 수 있는 단일 페이지 브라우저 앱입니다.

- **백엔드 없음** — 모든 처리가 브라우저 단독. API 키는 localStorage에만 저장
- **다중 Provider** — OpenAI / Google Gemini / OpenAI 호환 커스텀
- **자동 클러스터링** — 사이트 무관하게 같은 사건 묶음 + 수동 보정
- **사람 검수 우선** — LLM이 만든 모든 결과를 textarea에서 직접 편집 가능
- **클립보드 발행** — 외부 발행 자동화는 의도적 제외 (검수 단계 강조)

## 빠른 시작

```bash
npm install
npm run dev
# http://localhost:5173
```

⚙ 설정 열고:
1. **AI Provider** 선택 (Gemini 무료 권장)
2. **API 키** 입력 (https://aistudio.google.com 에서 무료 발급)
3. **모델** 선택 (`gemini-2.5-flash` 권장)

### LLM 백엔드 — API 직결 / 에이전트 위임(B 모드, 테스트용)

설정 ▸ AI에서 **LLM 백엔드**를 고를 수 있습니다.
- **완전 자동(API)**: 위 API 키로 직접 호출 (기본).
- **테스트: 내 LLM 위임**: 작성·검수를 내 LLM 에이전트에 Khala로 위임 → API 크레딧 0으로 e2e 테스트. 위임 대상 inbox(예: `akp-rw`)와 응답 수신 inbox를 입력.
  - dev 서버 env **`KHALA_API_KEY`** 필요(`/api/khala` 프록시 인증 주입, 브라우저 비노출). 없으면 프록시 401.
  - 규약: [`docs/agent-llm-protocol.md`](./docs/agent-llm-protocol.md)

```bash
KHALA_API_KEY=<키> npm run dev   # 에이전트 위임(B) 모드 사용 시
```

## 핵심 흐름

```
RSS 자동 수집 ─→ 자동 클러스터링 ─→ 수동 보정 (선택)
   ↓
[가치 평가] → 한국어 종합 드래프트
   ↓
검수·편집 → [EN 토글] → 영문 번역 → 검수·편집
   ↓
[채널 생성] → KO 또는 EN의 본사이트/X/Medium → 복사 → 외부 발행
```

LLM 호출은 사건 하나당 최대 4번 (가치평가 1 + 번역 1 + KO 채널 1 + EN 채널 1). Gemini 무료 한도 안에서 하루 수백 건 처리 가능.

## 인수자 문서

상세 개발/운영 문서는 [`docs/`](./docs/README.md) 폴더 참조. 처음 인수받았다면 이 순서로:

1. [`docs/01-overview.md`](./docs/01-overview.md) — 프로젝트 무엇·왜
2. [`docs/02-getting-started.md`](./docs/02-getting-started.md) — 환경 세팅·키 발급
3. [`docs/03-architecture.md`](./docs/03-architecture.md) — 시스템 구조
4. [`docs/07-screens.md`](./docs/07-screens.md) — 화면별 기능
5. [`docs/13-roadmap.md`](./docs/13-roadmap.md) — 다음 작업 후보

## 명령어

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드 (dist/)
npm run preview      # 빌드 결과 미리보기
npm test             # 단위 테스트 1회
npm run test:watch   # 테스트 watch 모드
```

## 라이선스 / 저작권

내부 프로젝트. 외부 공개 전 LICENSE 추가 필요.
