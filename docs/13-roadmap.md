# 13 — 향후 작업 / 로드맵 (참고용)

> ⚠ **이 문서는 참고용입니다.** 여기 적힌 항목은 **무조건 해야 하는 작업이 아닙니다**. 다음에 어디부터 손댈지 막막할 때 후보 목록으로 활용하세요. 우선순위와 채택은 인수자/오너의 판단입니다.

## 우선순위 분류

- 🔴 **High** — 사용자 체감 큰 가치 / 빠른 작업
- 🟡 **Medium** — 가치는 있지만 작업량이 있거나 사용자가 우회 가능
- 🟢 **Low** — nice-to-have, 시간 남을 때

---

## 🔴 High Priority

### 1. 한·영 엔티티 동일시 (BLACKPINK ↔ 블랙핑크)

**문제**: 같은 인물·그룹의 한국어/영문 표기가 다르면 클러스터링이 분리됨. 사용자가 ⇄ Move로 매번 수동 보정 필요.

**해결안**:
- 작은 동의어 사전 만들기 (~50개 K-pop 그룹/유명인): `BLACKPINK`/`블랙핑크`/`블핑` 등
- `extractEntities`에서 매칭되면 canonical form으로 변환
- 사전을 ⚙ 설정에서 사용자가 추가/편집 가능하게

**작업량**: ~2시간 + 사전 유지 부담

**파일**: `src/lib/clustering.ts`, 새 `src/lib/aliasMap.ts`, SettingsModal 확장

### 2. 발행 자동화 - Webhook 옵션

**문제**: 현재 클립보드만. 자주 발행하면 매번 복사·붙여넣기 번거로움.

**해결안 (가벼운 버전)**:
- ⚙ 설정에 채널별 Webhook URL 입력 칸
- "보내기" 버튼 누르면 채널 콘텐츠를 webhook으로 POST
- 사용자가 Zapier / Make / n8n 워크플로우를 만들어 X/Medium/CMS에 자동 게시

**해결안 (헤비)**:
- X API / Medium API 직접 호출 (사용자가 토큰 입력)
- OAuth flow는 복잡 → MVP는 webhook이 적당

**작업량**: webhook 1~2시간, 직접 API 4~6시간

**파일**: 새 `src/lib/publishWebhook.ts`, SettingsModal + OutputTabs 버튼 추가

### 3. 이력 dedupe 정책

**문제**: 한 사건을 가치 평가 → 번역 → 채널 생성하면서 같은 id의 entry가 이력에 3번 prepend됨. 화면 어수선.

**해결안**: `HistoryContext.addEntry`에서 같은 id 있으면 기존 항목 위치에 갱신 (replace) 또는 가장 앞으로 이동 + 기존 제거.

**작업량**: 30분

**파일**: `src/state/HistoryContext.tsx`

### 4. 단축키

**문제**: 마우스로 매번 클릭. 비개발자라도 ↑↓로 클러스터 넘기기 등 기본 단축키 도움 됨.

**해결안**:
- `↑/↓`: 클러스터 선택 이동
- `Space`: 펼침/접기
- `Enter`: 가치 평가 트리거
- `Cmd/Ctrl + 1/2/3`: 본 사이트 / X / Medium 탭 전환
- `Cmd/Ctrl + Shift + C`: 현재 탭 [복사]

**작업량**: 1~2시간 (Keyboard shortcuts hook + 화면별 매핑)

---

## 🟡 Medium Priority

### 5. 클러스터링 알고리즘 개선

**현재 한계** (10-clustering.md 케이스 스터디 참조):
- 인물 1명만 잡힌 짧은 제목들이 다른 사건도 묶음
- 시간 윈도우 24h 고정

**개선안**:
- "이벤트 동사" 가중치 추가 (컴백/결혼/입대/사망 등 명시적 키워드 매칭 시 weight ↑)
- 본문 일부 토큰도 가중치 적게 추가
- 시간 윈도우를 ⚙ 설정에서 6/12/24/48시간 선택

**작업량**: 2~3시간

**파일**: `src/lib/clustering.ts`, `src/types.ts` (Settings에 windowHours 필드)

### 6. LLM 기반 클러스터링 (대체 모드)

**아이디어**: 규칙 기반 알고리즘 한계 보완. LLM에게 article 리스트를 batch로 주고 같은 사건끼리 묶으라고 시킴.

**장점**: 의미 기반이라 정확도 높음. "BLACKPINK 결혼" vs "BLACKPINK 컴백" 자연스럽게 분리.

**단점**: 추가 LLM 호출 비용. Gemini 무료라면 부담 적음.

**구현**: ⚙ 설정에 "클러스터링 모드" 라디오 (자동 규칙 / LLM). LLM 모드 선택 시 articles를 50개씩 batch로 LLM에 보냄.

**작업량**: 3~4시간

### 7. 위법/명예훼손 위험 키워드 자동 하이라이트

**문제**: 사용자가 영문 / 한국어 검수 시 위법 가능 문구를 놓칠 수 있음.

**해결안**: 키워드 사전 (실명+의혹/혐의/추측/사생활) 매칭 → textarea에서 해당 부분 노란 하이라이트 + 우측에 경고 카운트.

**작업량**: 2~3시간

**파일**: 새 `src/lib/legalRiskScan.ts`, Workbench/OutputTabs에 인디케이터 추가

### 8. 채널 출력 미리 보기 (각 채널 실제 렌더)

**아이디어**: Medium은 이미 마크다운 미리보기 있음. X는 트윗 카드 렌더, 본 사이트는 기사 카드 렌더 미리보기 추가.

**작업량**: 2~3시간

### 9. 다중 사용자 / 협업 (가벼운 버전)

**아이디어**: 백엔드 추가하지 않고 export/import:
- 변환 결과를 JSON으로 export → 슬랙/이메일로 공유
- 다른 사람의 export를 import → 자기 이력에 추가

**작업량**: 1~2시간

### 10. 모바일 레이아웃

**현재**: 데스크탑 가정. 모바일에선 사이드바 + 워크벤치 동시 표시 불가.

**개선안**:
- 모바일은 한 화면씩 (사이드바 → 워크벤치 → 출력)
- 또는 모바일 대응 안 한다고 명시 (현재 정책)

**작업량**: 4~6시간

---

## 🟢 Low Priority / Nice-to-have

### 11. 이력에서 비교 모드

같은 사건에 대해 여러 번 변환했을 때 결과 비교 (diff 보기).

### 12. 변환 결과 export → md/zip

본 사이트/X/Medium 출력을 .md 파일로 일괄 다운로드.

### 13. 다국어 UI

UI 자체를 영어로도 표시. 현재 한국어 고정 (의도된 단순화).

### 14. 더 많은 Provider

- Groq (Llama 3.3 70B, 무료 + 매우 빠름)
- OpenRouter (수십 개 모델 통합)
- DeepSeek (저렴한 중국 모델)
- Anthropic Claude (별도 SDK 필요, OpenAI 호환 아님)

→ Groq, OpenRouter, DeepSeek은 OpenAI 호환이라 `PROVIDERS` 추가만 하면 즉시 동작.

### 15. Mock LLM 모드 (개발용)

API 키 없이 데모 가능하도록 가짜 응답 모드. 화면 시연용.

### 16. RSS 폴링 worker로 분리

현재는 메인 스레드 setInterval. Service Worker로 옮기면 백그라운드 탭에서도 폴링 가능.

### 17. 다크 모드

Tailwind dark: 클래스 추가.

### 18. 음성 입력

사용자 코멘트를 음성으로 받아 LLM 결합. (Web Speech API)

### 19. 통계 대시보드

일/주 단위 변환 횟수, 가치 점수 분포, 채널별 발행 횟수 등.

### 20. 가이드 → PDF / 인쇄 가능 형태

GuideModal 내용을 한 페이지 PDF로 export.

---

## 미해결 / 알려진 한계

### 클립보드 권한

- HTTPS 또는 localhost에서만 `navigator.clipboard` 작동
- HTTP 환경에서는 legacy `execCommand('copy')` 폴백 — 일부 브라우저에서 작동 안 할 수 있음

### Bolt.new 미리보기에서 알림음

`public/ping.mp3`가 placeholder (10바이트). 실제 사용 시 CC0 ping 사운드로 교체 권장:
- https://freesound.org (CC0 검색)
- 4KB 이하 권장

### Gemini의 JSON mode

일부 Gemini 모델에서 `response_format: json_object` 지시를 부분적으로만 따름. 대처: system prompt에 "오직 valid JSON만 출력" 명시 (이미 적용됨). 그래도 가끔 실패하면 retry 또는 다른 모델로.

### Polling 비활성 탭 멈춤 (브라우저 정책)

Chrome은 비활성 탭의 setInterval을 1분 이상으로 throttle. 백그라운드에서 30분 비활성 후 복귀 시 한꺼번에 폴링 시도 → 429 위험. 현재 코드는 비활성 탭에서 폴링 간격 × 3 강제하지만 브라우저 throttle은 별도.

### 이력 손실 위험

localStorage는 브라우저 사용자 데이터 정리 시 함께 삭제됨. 시크릿 모드 사용 X. 중요한 이력은 사용자가 직접 export 권장 (현재 export 기능 없음 — Roadmap 12번).

---

## 권장 시작 순서 (시간 적을 때)

가장 효과 큰 1~3시간짜리 작업:

1. **이력 dedupe** (30분) — 화면 깔끔
2. **rss2json 폴백 RSS URL** (30분) — Google News RSS를 디폴트로 추가
3. **단축키** (1~2시간) — 키보드 워크플로우
4. **한·영 alias 사전 (초기 50개)** (2시간) — 클러스터링 체감 큰 개선

추후 큰 작업 후보 (반나절~하루):

1. **발행 webhook** (1~2시간)
2. **LLM 기반 클러스터링 (옵션 모드)** (3~4시간)
3. **위법 키워드 하이라이트** (2~3시간)

---

## 작업 시 참고

- 모든 변경은 `npm test` + `npm run build` 통과 확인
- TypeScript strict 유지 — 새 필드는 type에 반드시 추가
- localStorage 데이터 모델 바뀌면 마이그레이션 코드 고려 (기존 사용자 데이터 손상 방지)
- AI 어시스턴트에 작업 위임 시 이 문서 + `docs/03-architecture.md` + 관련 도메인 문서 (예: `docs/10-clustering.md`) 컨텍스트로 제공

---

이 문서는 살아있는 문서입니다. 새 아이디어나 한계가 발견되면 자유롭게 추가/수정하세요.
