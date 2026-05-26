# 12 — 트러블슈팅

증상별 대처. 앱 내장 가이드(`src/data/guideContent.ts`)에도 비슷한 내용 있음 — 이 문서는 인수자/개발자용 더 자세한 버전.

## LLM 호출 에러

### `OpenAI error (429): You exceeded your current quota`

**의미**: Rate limit이 아니라 **결제 한도/잔액 부족**. 사용량 0이어도 발생.

**원인**:
- OpenAI: 결제 정보 미등록 또는 잔액 $0
- Gemini: 일 1,500건 초과 (드물지만 발생 가능)

**대처**:
1. **OpenAI**: https://platform.openai.com/account/billing/overview → "Add to credit balance" → 최소 $5 충전 후 5~10분 대기
2. **Gemini**: 다음날까지 대기 (자정 reset) 또는 paid 모드
3. ⚙ 설정에서 다른 Provider로 전환 (가장 빠름)

### `OpenAI error (401): ...`

**의미**: API 키 잘못됨 또는 만료.

**대처**: ⚙ 설정에서 키 다시 입력. 키 앞뒤 공백 확인.

### `OpenAI error (404): ...`

**의미**: 모델 ID가 그 Provider에 없거나 base URL이 잘못됨.

**대처**:
- ⚙ 설정 → 모델에서 권장 모델 선택 (`gemini-2.5-flash`, `gpt-4o-mini`)
- 커스텀 Provider 사용 중이면 base URL 확인 (`/chat/completions`까지 가지 말고 base까지만)

### `Response was not valid JSON`

**의미**: LLM이 `response_format: json_object` 지시를 어기고 plain text 응답.

**원인**: 일부 오래된 모델이 JSON mode 미지원 (예: 일부 Llama 변형).

**대처**: `gpt-4o-mini`, `gemini-2.5-flash` 같은 최신 모델로 전환.

### `OpenAI error (0): API key is empty`

**의미**: API 키가 비어 있음.

**대처**: ⚙ 설정에서 키 입력.

## RSS 수집 에러

### `429: Too Many Requests` (rss2json)

**의미**: rss2json 무료 한도(분당 10건) 초과.

**자동 대처**:
- 해당 소스 30분간 백오프 (다른 소스 정상)
- localStorage `nie:rss-backoff:<id>` 마커

**수동 대처**:
- ⚙ 설정 → 폴링 간격 늘림 (10/15/30/60분)
- 활성 RSS 소스 줄이기
- rss2json 회원가입 → API 키 발급 → 설정 입력

### `422: Unprocessable Content`

**의미**: 그 RSS URL이 죽었거나 형식이 바뀌어 rss2json이 파싱 못 함.

**대처**:
- 해당 소스 비활성화/삭제
- 다른 RSS로 교체 — Google News RSS는 항상 살아있음:
  ```
  https://news.google.com/rss/search?q=kpop&hl=ko
  https://news.google.com/rss/search?q=연예&hl=ko
  ```

### RSS 응답이 빈 articles

**확인**: 브라우저에 RSS URL 직접 접속 → XML 보이는지 확인 (HTML 404면 죽은 RSS).

**확인 2**: rss2json 직접 호출 URL을 브라우저에 붙여넣기 → JSON 응답 직접 확인:
```
https://api.rss2json.com/v1/api.json?rss_url=<URL_ENCODED>
```

## UI / 화면 에러

### 좌측 사이드바 스크롤 안 됨

이미 fix됨 (`ArticlePicker → ClusterPicker`의 `min-h-0` + `overflow-hidden` 설정). HMR이 안 됐을 수 있음 → 페이지 새로고침 (Cmd+Shift+R).

### `getFiberRoots is not a function`

React DevTools 브라우저 확장 + React 18.3 호환 문제. 우리 앱 버그 아님.

**대처**:
- chrome://extensions 에서 React Developer Tools 비활성화
- 또는 확장 최신 버전으로 업데이트
- 또는 무시 (앱 동작 영향 없음)

### Favicon 404

이미 fix됨 (`public/favicon.ico` 추가됨). 아직 404 나면 페이지 강력 새로고침.

### 클러스터링이 너무 느슨/엄격

⚙ 설정 → 사건 묶기 민감도 슬라이더 (0.20~0.60). 즉시 재계산.

### 특정 사건이 클러스터로 안 묶임

`docs/10-clustering.md` 케이스 스터디 참조. 보통:
- 한·영 표기 차이 → 수동 ⇄ Move
- 짧은 제목 → 임계값 ↓

### 채널 출력이 너무 짧음/길음

`promptChain.ts`의 `buildChannelsSystem`에서 길이 수치 수정. 예:
```ts
// before
'1. site: ... 400-600 words ...'
// after
'1. site: ... 800-1200 words ...'
```

## 빌드 / 개발 환경 에러

### `npm install` 실패

```bash
rm -rf node_modules package-lock.json
npm install
```

Node 18 이상 필요.

### `tsc --noEmit` 에러

타입 변경 후 따라오는 영향. 메시지 따라 해당 파일 수정. 보통 mock 데이터(테스트)나 사용처 시그니처 불일치.

### `vite` HMR이 변경 반영 안 함

브라우저 강력 새로고침 (Cmd+Shift+R). 그래도 안 되면 dev 서버 재시작 (`Ctrl+C` → `npm run dev`).

### 테스트 일부 실패

```bash
npm test -- <테스트파일이름>     # 특정 파일만
npm run test:watch              # watch 모드
```

대부분 mock Settings 객체가 새 필드 누락. `src/lib/promptChain.test.ts`나 `HistoryContext.test.tsx`의 SETTINGS/make() 함수에서 필드 추가.

## 데이터 / 상태 에러

### 이력이 사라짐

localStorage `nie:history` 키가 비었거나 손상.

**복구 시도**:
```js
// 브라우저 콘솔에서
JSON.parse(localStorage.getItem('nie:history'))
```

손상됐으면 안타깝게도 복구 불가. 백업 권장:
```js
copy(localStorage.getItem('nie:history'))  // 클립보드에 복사
```

### 설정이 리셋됨

브라우저 시크릿 모드 / 다른 브라우저 사용 / localStorage 수동 삭제. 동일 도메인에서만 보존.

### "이동 중" 배너가 안 사라짐

⚙ 설정 ✂ 리셋 버튼 (사이드바 상단) → 모든 수동 보정 리셋.  
또는 페이지 새로고침 (이동 모드는 메모리 only — 새로고침으로 자동 리셋).

## 비용 관련

### Gemini가 갑자기 답이 이상함

무료 한도 끝물에 가까워지면 일부 호출이 실패하거나 더 작은 모델로 라우팅될 수 있음. usage 확인:  
https://aistudio.google.com → Quotas / Usage

### OpenAI 잔액이 빨리 닳음

- 모델 확인 — gpt-4o로 설정되어 있으면 mini로 변경
- 종합 변환 후 textarea에서 충분히 다듬은 뒤 [채널 생성] (반복 호출 줄임)

## 도움이 안 되면

1. 브라우저 콘솔(DevTools) 에러 메시지 전체 복사
2. Network 탭에서 실패한 요청 → Headers / Response 확인
3. `git log --oneline` 으로 최근 변경 사항 확인
4. AI 어시스턴트에 `docs/01-overview.md` + `docs/03-architecture.md` + 에러 메시지 제공
