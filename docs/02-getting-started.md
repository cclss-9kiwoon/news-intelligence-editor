# 02 — 인수자 빠른 시작

이 문서는 코드를 처음 받았을 때 30분 안에 로컬에서 동작시키는 절차입니다.

## 사전 요구사항

- **Node.js 18 이상** (권장: 20 LTS)
- **npm 9 이상** (Node와 함께 설치됨)
- **모던 브라우저** (Chrome / Firefox / Edge / Safari 최신)

확인:
```bash
node --version   # v18.x.x 이상
npm --version    # 9.x.x 이상
```

## 1) 클론 + 의존성 설치

```bash
git clone <REPO_URL>
cd news-intelligence-editor
npm install
```

설치 시간: 약 30초~1분.

## 2) 개발 서버 실행

```bash
npm run dev
```

콘솔에:
```
VITE v5.x  ready in 320 ms
➜  Local:   http://localhost:5173/
```

브라우저로 접속.

## 3) API 키 발급 (필수)

LLM 호출이 필요해서 최소 한 개 Provider 키 필요.

### A. Google Gemini (무료 권장)

1. https://aistudio.google.com 접속 (Google 계정 로그인)
2. 우상단 **Get API key** → **Create API key in new project**
3. 발급된 키 복사 (`AIza...` 형태)

무료 한도: **분당 15건 / 일 1,500건** (Gemini 2.5 Flash 기준). 일반 사용으론 무제한.

### B. OpenAI (유료)

1. https://platform.openai.com 가입
2. **Billing** → **Add to credit balance** → 최소 $5 충전 (선불 prepaid)
3. **API keys** → **Create new secret key** → 복사 (`sk-...`)

OpenAI는 신용카드 등록만으로는 부족하고 **잔액 충전 필수**. 무료 트라이얼 크레딧은 2024년부터 거의 안 줌.

### C. 커스텀 (Groq, OpenRouter 등)

OpenAI 호환 API 제공 서비스라면 base URL 직접 입력으로 사용 가능. 자세한 내용은 [09-llm-prompt-design.md](./09-llm-prompt-design.md#provider-추상화).

## 4) 앱에서 키 등록

브라우저에서:

1. 좌상단 ⚙ **설정** 클릭
2. **AI Provider** 섹션에서 Gemini (또는 OpenAI / 커스텀) 선택
3. **API 키** 칸에 키 붙여넣기
4. **모델** 선택:
   - Gemini: `gemini-2.5-flash` (권장)
   - OpenAI: `gpt-4o-mini` (권장)
5. 모달 닫기 (백드롭 클릭 또는 ESC)

키는 브라우저의 localStorage(`nie:settings`)에만 저장되며 서버로 전송되지 않습니다.

## 5) (선택) rss2json 키 등록

RSS 무료 한도(분당 10건) 도달이 잦으면:

1. https://rss2json.com 회원가입
2. Dashboard → API Key 발급. **API restrictions: HTTP Referrers** 선택 + `http://localhost:5173/*` 등록
3. ⚙ 설정 → **rss2json API 키** 칸에 입력

미입력 상태로도 익명 한도로 동작합니다.

## 6) 첫 변환 시도

1. 좌측 사이드바에 클러스터가 모이는 데 30초~5분 (RSS 폴링 주기) 기다리거나 ▶ 새로고침 클릭
2. 클러스터 클릭 → 워크벤치에 원문 표시
3. 우측 상단 **[✨ 가치 평가 & 종합 (한국어)]** 클릭
4. 한국어 종합 드래프트 생성 (5~10초)
5. textarea에서 편집
6. **[KO 채널 생성]** 클릭 → 하단 탭에 한국어 본사이트/X/Medium 출력
7. 각 탭의 **[복사]** 버튼 → 외부 발행 도구에 붙여넣기

## 7) 테스트 실행

```bash
npm test              # 1회
npm run test:watch    # 파일 변경 시 자동 재실행
```

83개 테스트가 1~2초에 통과해야 정상.

## 8) 프로덕션 빌드

```bash
npm run build         # dist/ 생성
npm run preview       # dist를 로컬 정적 서버로 미리보기
```

`dist/` 폴더를 어느 정적 호스팅(Vercel, Netlify, Cloudflare Pages, GitHub Pages 등)에 올려도 작동.

## 9) Bolt.new에 올리기 (선택)

1. [bolt.new](https://bolt.new) 접속
2. 이 리포지토리 zip을 업로드하거나 코드 통째로 붙여넣기
3. Bolt이 자동으로 `npm install` + `npm run dev` 실행
4. 미리보기에서 ⚙ 설정 → 키 입력

## 10) 환경 변수?

**환경 변수 없음.** 모든 설정은 브라우저 localStorage에 저장. `.env` 파일도 사용하지 않음.

이는 의도된 설계 — 백엔드 없이 단일 사용자가 자기 브라우저에서 모든 키를 관리하는 모델. 배포 시 추가 환경 설정 필요 없음.

## 트러블슈팅

문제가 있다면 [12-troubleshooting.md](./12-troubleshooting.md) 참조.

## 다음

- 시스템 이해: [03-architecture.md](./03-architecture.md)
- 어디에 뭐가 있는지: [04-directory-structure.md](./04-directory-structure.md)
