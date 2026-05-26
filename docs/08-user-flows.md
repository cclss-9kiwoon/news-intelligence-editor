# 08 — 유저 플로우

대표 시나리오를 단계별로 정리합니다. 각 단계에 어떤 컴포넌트/Context/lib이 작동하는지 표시.

## 플로우 1 — 일반 발행 사이클 (가장 흔한 흐름)

오전에 출근해 RSS로 수집된 사건들 중 가치 있는 것을 골라 한국어+영어 콘텐츠를 만들고 외부에 발행하는 흐름.

```
1. 좌측 사이드바에서 클러스터 훑어보기
   - 매체별 N건 묶음, 가치 있어 보이는 사건 식별
   - 잘못 묶인 거 있으면 ⇄ Move / ✂ Split
   
2. 클러스터 클릭
   ▶ ClustersContext.selectCluster
   ▶ Workbench 헤더에 클러스터 제목, 좌측에 첫 소스 원문 표시
   
3. 원문 확인 — ← → 로 다른 매체 본문 비교
   
4. [✨ 가치 평가 & 종합 (한국어)] 클릭
   ▶ ConversionContext.analyze(selectedArticles)
   ▶ promptChain.analyzeKorean → LLM 1회 호출 (~5초)
   ▶ ConvertedResult 생성, 우측 textarea에 한국어 드래프트 표시
   ▶ FactCheckLog에 추출된 사실 칩 표시
   ▶ HistoryContext.addEntry 자동
   
5. 한국어 드래프트 검수
   - 오타 / 위법 표현 / 추측성 표현 제거
   - 본 매체 코멘트 추가
   - textarea에서 직접 편집 (LLM 호출 없음, 즉시 반영)
   
6. [KO 채널 생성] 클릭
   ▶ ConversionContext.regenerateChannels()
   ▶ promptChain.formatChannels({ language: 'ko' }) → LLM 1회 (~6초)
   ▶ 하단 OutputTabs에 한국어 본 사이트/X/Medium 표시
   
7. 각 탭 검수 + 직접 편집
   - 본 사이트: 800-1200자 줄글
   - X: 5-8 트윗 (각 ≤280자)
   - Medium: H1/H2 마크다운, [미리보기] 토글로 확인
   
8. [본 사이트] 탭 [복사] → 본 사이트 CMS에 붙여넣기 → 발행
   [X 스레드] 탭 [복사] → Typefully/X에 → 발행
   [Medium] 탭 [복사] → medium.com → 발행
   
9. (선택) 영문 버전 만들기
   - 워크벤치 우측 [EN] 클릭
   ▶ ConversionContext.switchLanguage('en')
   ▶ drafts.en 비어있으면 promptChain.translateDraft → LLM 1회 (~3초)
   ▶ activeLanguage='en', 영문 드래프트 textarea에 표시
   - 영문 검수 / 편집
   - [EN 채널 생성] → 영문 본 사이트/X/Medium → 복사 → 외부 발행
```

**LLM 호출 합계**: 한국어만 발행 = 2회. KO + EN = 4회.  
**시간**: 1건당 약 5~10분 (LLM 처리 + 사람 검수 포함).

## 플로우 2 — 속보 대응

```
1. 빨간 배너 상단 등장 + 알림음
   ▶ BreakingContext.alerts 추가
   
2. [지금 변환 →] 클릭
   ▶ BreakingContext.jumpToAlert
   ▶ 그 기사가 속한 클러스터 selectCluster
   ▶ 워크벤치에 자동 로드
   
3. 이후 흐름 1과 동일 (가치 평가 → 검수 → 채널 생성 → 복사)
```

특히 [속보] 접두어 critical 등급은 즉시 처리 권장.

## 플로우 3 — 잘못 묶인 클러스터 보정

자동 클러스터링이 두 사건을 같이 묶었거나, 같은 사건이 두 클러스터로 갈렸을 때.

### 3-A. 같은 사건이 두 클러스터로 갈림 (Merge)

```
1. 사이드바에서 두 클러스터 모두 펼침
2. 옮길 기사 옆 [⇄ Move] 클릭
   ▶ ClustersContext.startMergeMode(articleId)
   ▶ 상단 파란 배너 "이동 중: 기사제목"
   ▶ 다른 클러스터들에 [⬇ 여기로] 버튼 등장
3. 합칠 클러스터의 [⬇ 여기로] 클릭
   ▶ ClustersContext.mergeIntoCluster(targetClusterId)
   ▶ manualMerges에 (sourceArticleId, anchorArticleId) 기록
   ▶ 자동 재계산 → 그 클러스터에 합쳐짐
```

### 3-B. 다른 사건이 같이 묶임 (Split)

```
1. 클러스터 펼침
2. 분리할 기사 옆 [✂ Split] 클릭
   ▶ ClustersContext.splitArticleOut(articleId)
   ▶ splitOut Set에 추가
   ▶ 그 기사가 단독 클러스터 (id: solo-X) 로 분리됨
```

### 3-C. 임계값 조절 (전역)

```
⚙ 설정 → 사건 묶기 민감도 슬라이더 0.20~0.60
   ▶ SettingsContext.setClusterThreshold
   ▶ ClustersContext가 즉시 재계산
```

### 3-D. 보정 모두 되돌리기

사이드바 상단 [✂] 리셋 → `resetSplits()` + `resetMerges()`.

## 플로우 4 — 이력에서 복원

```
1. Header [📜 이력] 클릭
   ▶ HistoryPanel 슬라이드 열림
   ▶ HistoryContext.history 최근 20건 표시
2. 항목 클릭
   ▶ ConversionContext.loadResult(h)
   ▶ currentResult = h
   ▶ 워크벤치에 그대로 복원 (편집본 + 채널 출력 모두)
   ▶ HistoryPanel 자동 닫힘
3. 이후 [채널 재생성]으로 다시 LLM 호출 가능
   또는 textarea 편집 후 [복사]로 추가 발행
```

이력은 ConvertedResult 통째로 저장되므로 KO 채널·EN 채널·편집본 모두 보존.

## 플로우 5 — 직접 입력 (URL 또는 텍스트)

RSS에 없는 기사를 변환할 때.

```
1. 사이드바 + 버튼 클릭
2. 제목 (선택) / 원본 URL (선택) / 본문 textarea
3. [추가] 클릭
   ▶ ArticlesContext.addManualArticle
   ▶ inputType: 'url' (URL 있으면) or 'paste'
   ▶ articles에 추가 → 자동 클러스터링에 참여
   ▶ 비슷한 기사가 이미 있으면 그 클러스터에 합류 가능
   ▶ 또는 단독 클러스터로 등장
4. 그 클러스터 선택 → 이후 흐름 1과 동일
```

## 플로우 6 — 첫 사용 (튜토리얼)

```
1. Header 타이틀 옆 [?] 아이콘 클릭
   ▶ TutorialOverlay 열림
   ▶ 하단 popover에 1단계 표시
2. [다음] 또는 → 로 7단계 진행
   각 단계마다 해당 UI 영역 indigo ring + dim
3. 7단계 끝에 [상세 가이드 보기] 클릭
   ▶ GuideModal 열림
4. 가이드 좌측 목차에서 자세히 알고 싶은 섹션 클릭
```

## 플로우 7 — Provider 전환

OpenAI 한도 초과 후 Gemini로 바꾸기.

```
1. ⚙ 설정 열기
2. AI Provider → Google Gemini 라디오
   ▶ SettingsContext.setProvider('gemini')
   ▶ apiBaseUrl과 model이 Gemini 기본값으로 리셋
   ▶ apiKey가 비워짐 (보안 — OpenAI 키 그대로 두면 위험)
3. Gemini API 키 붙여넣기
4. 모델 선택 — gemini-2.5-flash 권장
5. 모달 닫기
6. 다음 [가치 평가] 부터 Gemini 호출
```

워크벤치 헤더의 모델 dropdown으로도 빠르게 전환 가능 (단, Provider 자체는 ⚙ 설정에서만).

## 플로우 8 — RSS 한도 초과 (429)

```
1. 콘솔에 429 에러 보임
   ▶ rss.ts가 자동으로 그 소스를 30분간 backoff (localStorage 마커)
   ▶ 다른 소스는 계속 정상 폴링
2. 옵션 a) 30분 대기
   옵션 b) ⚙ 설정 → 폴링 간격 늘림 (10/15/30/60분)
   옵션 c) 활성 RSS 소스 일부 비활성화
   옵션 d) rss2json.com 회원가입 → API 키 발급 → 설정에 입력
3. 5분 캐시 안의 응답은 계속 표시되어 화면이 비지는 않음
```

## 다음

- 컴포넌트 상세: [07-screens.md](./07-screens.md)
- LLM 프롬프트 깊이: [09-llm-prompt-design.md](./09-llm-prompt-design.md)
