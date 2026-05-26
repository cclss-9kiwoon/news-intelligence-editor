# 인수인계 문서 패키지

이 폴더는 News Intelligence Editor 프로젝트를 처음 받은 개발자(또는 AI 어시스턴트)가 5~30분 안에 충분한 컨텍스트를 얻고 작업을 이어갈 수 있도록 만든 문서 모음입니다.

## 읽는 순서

### 🟢 처음 인수받았다면 (필독)

| 순서 | 문서 | 목적 | 분량 |
|---|---|---|---|
| 1 | [01-overview.md](./01-overview.md) | 프로젝트가 무엇이고 누구를 위한 것인가 | ~10분 |
| 2 | [02-getting-started.md](./02-getting-started.md) | 환경 세팅 + API 키 발급 + 첫 실행 | ~15분 |
| 3 | [03-architecture.md](./03-architecture.md) | 전체 시스템 구조와 핵심 추상화 | ~15분 |
| 4 | [04-directory-structure.md](./04-directory-structure.md) | 파일별 책임 — 어디서 뭘 찾을지 | ~10분 |

### 🟡 코드 수정 전 (도메인별)

| 영역 | 관련 문서 |
|---|---|
| 상태 관리 변경 | [05-data-model.md](./05-data-model.md), [06-state-management.md](./06-state-management.md) |
| UI 컴포넌트 추가/수정 | [07-screens.md](./07-screens.md) |
| LLM 프롬프트 튜닝 | [09-llm-prompt-design.md](./09-llm-prompt-design.md) |
| 클러스터링 알고리즘 손보기 | [10-clustering.md](./10-clustering.md) |
| 새 기능 흐름 설계 | [08-user-flows.md](./08-user-flows.md) |

### 🔵 참고 / 검색용

| 문서 | 언제 |
|---|---|
| [11-glossary.md](./11-glossary.md) | 모르는 용어 만났을 때 |
| [12-troubleshooting.md](./12-troubleshooting.md) | 에러·버그 만났을 때 |
| [13-roadmap.md](./13-roadmap.md) | "다음에 뭐 할까?" (참고용, 강제 X) |

## AI 어시스턴트를 위한 컨텍스트

Claude Code 같은 AI 어시스턴트와 작업할 때 이 문서를 컨텍스트로 제공하면 빠르게 프로젝트 파악 가능. 권장 프롬프트:

```
이 프로젝트(News Intelligence Editor)의 docs/ 폴더를 읽고
아키텍처와 컨벤션을 파악해주세요. 그 뒤 [작업] 를 진행해주세요.
```

특히 `01-overview.md` → `03-architecture.md` → `05-data-model.md` 순서로
읽으면 큰 그림 빠르게 잡힙니다.

## 이력 문서 (참고용)

`superpowers/` 하위 폴더는 이 프로젝트가 만들어진 과정의 작업 이력입니다:

- `specs/` — 초기 디자인 스펙 + v2 addendum
- `plans/` — 30개 task로 쪼개진 구현 계획 + v2 추가 task

신규 작업 시 필수는 아니지만, "왜 이런 결정을 했나"가 궁금할 때 참고하세요.
역사적 사료라 일부 내용은 현 코드와 어긋날 수 있습니다 — **현 코드와 위의
01~13 문서를 진실의 원천(SOT)으로** 삼으세요.
