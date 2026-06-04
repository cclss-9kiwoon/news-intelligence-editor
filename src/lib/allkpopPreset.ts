/**
 * allkpop 캠페인 기본값 프리셋.
 * 출처: RW-guidelines.md(주제선정/표기/HTML/클로징) + contents-review-checklist.md(검수).
 * 설정 4단계 재편 확정 후 CampaignSettings 단계별 기본값으로 매핑 예정.
 * 기존 타입(PromptConfig/FormatRules/ReviewRule) 사용 — 빌드 무영향.
 */
import type { PromptConfig, FormatRules, ReviewRule, CampaignSettings, GroupProfile } from '../types';
import { makeDefaultCampaignSettings } from './defaultCampaign';

// ── ② 주제 검수 (RW 주제선정/중복/소스 규칙) ──
export const ALLKPOP_TOPIC_RULES = {
  selectionCriteria: `1. 현재 시간 기준 최신("오늘자" 원칙). 발표 며칠 지난 건 제외.
2. 영어권 인지도 높은 아티스트 우선 (BTS·BLACKPINK·TWICE·SEVENTEEN·Stray Kids·ENHYPEN·aespa·IVE·LE SSERAFIM·KATSEYE 등).
3. BTS 편중 금지 — 아티스트 다양화.`,
  dedupeRules: `중복 = 아티스트가 아니라 스토리/내용 기준.
- 같은 아티스트 하루 최대 2건, 단 앵글(내용)은 절대 중복 금지.
- allkpop 기보도 스토리 재탕 금지. 다른 앵글(차트결과/마일스톤)이면 별건 OK.
- 컴백 발표류는 allkpop이 빠르게 커버 → 차트결과/마일스톤형이 중복 회피에 유리.`,
  allowedSources: ['디스패치', '네이버', '다음', '스타뉴스', 'OSEN', '스포츠경향', 'Newsen', '한터뉴스'],
  bannedSources: ['Soompi', 'Korea Herald', 'Koreaboo'],
  minMediaCount: 2, // 한국 매체 2곳+ 교차검증
};

// ── ③ 생성 (RW 작성/표기 규칙) ──
export const ALLKPOP_PROMPT_CONFIG: PromptConfig = {
  editorRole: 'K-pop 전문 영문 매체 allkpop의 시니어 에디터',
  publishingGuide: `- 분량: 마일스톤/단신 100~150단어, 발표/이벤트 150~300단어. 압축, 반복 금지.
- 구조: 리드문 → 핵심 팩트 → 부가 정보 → 팩트 클로징.
- 인용: 소개 먼저, 인용문 뒤 "A rep said, ..." 패턴.
- 미확인 사실은 "reportedly", "according to reports"로 표기.`,
  taskInstructions: `1. 한국 매체 2곳+ 교차검증된 팩트만 사용.
2. allkpop 기존 기사와 앵글 중복 확인 (같은 아티스트라도 내용 다르면 OK).
3. 수치(차트/판매량/날짜) 정확성 확인, 헤드라인↔본문 정합성 유지.`,
  bannedExpressions: 'Congratulations, Let us know your thoughts in the comments below, What do you think, exciting, heartwarming, captivating, we are absolutely here for it, delve, furthermore',
};

// ── ③ 표기 규칙 (HTML/마크업) ──
export const ALLKPOP_FORMAT_RULES: FormatRules = {
  quoteSong: 'double',       // 곡명 "double" + 초회 bold
  quoteWork: 'single',       // 앨범/EP/쇼/투어 'single' + 초회 bold
  quoteQuotation: 'double',
  headlineCasing: 'lower-minor', // 전치사/접속사 소문자
  artistMarkup: 'strong',    // <a> 금지 → <strong>
  imageMarkup: 'img-direct', // <figure> 금지
  noEditorialClosing: true,  // 팩트 클로징
  bodyMinChars: 0,
  bodyMaxChars: 0,
};

// ── ④ 결과물 검수 (Contents 체크리스트) ──
export const ALLKPOP_REVIEW_RULES: ReviewRule[] = [
  {
    id: 'akp-typography',
    label: '표기 규칙',
    instruction: '곡명 "double"+bold, 앨범/투어/쇼명 \'single\'+bold, 아티스트·멤버명 초회 bold·재언급 plain, 차트명 plain. 위반 지적.',
    severity: 'block', enabled: true,
  },
  {
    id: 'akp-html',
    label: 'HTML 규칙',
    instruction: '본문 <a> 태그 금지(Artist Tags 필드 처리), <figure> 금지(<img> 직접), <b> 금지(<strong> 사용), H2/H3 서브헤딩 금지, 빈 <p></p> 유지.',
    severity: 'block', enabled: true,
  },
  {
    id: 'akp-closing',
    label: '클로징 규칙',
    instruction: '팩트로 종료. 축하/응원/질문 클로징("Congratulations!", "Let us know...", "What do you think?") 금지. 과장 형용사 금지.',
    severity: 'block', enabled: true,
  },
  {
    id: 'akp-image-watermark',
    label: '이미지 워터마크',
    instruction: '타 매체 워터마크/로고(STARNEWS, 디스패치, MBC, SBS) 있으면 사용 금지. 공식 프로모·OST 커버아트·allkpop 자체호스팅·소속사 제공분만 허용.',
    severity: 'block', enabled: true,
  },
  {
    id: 'akp-source',
    label: '소스 규칙',
    instruction: '허용: 디스패치/네이버/다음/스타뉴스/스포츠경향/한터뉴스. 금지: Soompi/Korea Herald/Koreaboo(2차 소스).',
    severity: 'block', enabled: true,
  },
  {
    id: 'akp-tone',
    label: '톤·스타일',
    instruction: '기자 개인 의견/감정/에디토리얼 판단 금지. 중립 팩트 서술. 팬심 과잉 금지.',
    severity: 'warn', enabled: true,
  },
  {
    id: 'akp-fact',
    label: '팩트 검수',
    instruction: '수치(차트순위/판매량/날짜) 정확성, 헤드라인↔본문 정합성, 미확인 사실 확정 서술 금지(reportedly 사용).',
    severity: 'block', enabled: true,
  },
];

// allkpop 그룹 배포 맥락 프리셋
export const ALLKPOP_GROUP_PROFILE: GroupProfile = {
  targetType: 'media',
  identity: 'K-pop 전문 영문 매체',
  audience: '글로벌 K-pop 팬 (영어권)',
  toneBase: '팩트 중심, 중립적, 속보형. 에디토리얼·팬심 과잉 금지.',
};

/** allkpop 캠페인 4단계 설정 프리셋 — 기본값에 allkpop 규칙 덮어쓰기 */
export function makeAllkpopCampaignSettings(): CampaignSettings {
  const base = makeDefaultCampaignSettings();
  return {
    ...base,
    searching: {
      ...base.searching,
      naverQueries: ['K-pop 아이돌', '컴백 앨범', '차트 빌보드', '콘서트 투어'],
      minMediaCount: ALLKPOP_TOPIC_RULES.minMediaCount,
    },
    topicReview: {
      selectionCriteria: ALLKPOP_TOPIC_RULES.selectionCriteria,
      dedupeRules: ALLKPOP_TOPIC_RULES.dedupeRules,
      priority: '속보 > 컴백/발표 > 차트/마일스톤 > 일반. BTS 편중 금지, 아티스트 다양화.',
    },
    generation: {
      ...base.generation,
      promptConfig: { ...ALLKPOP_PROMPT_CONFIG },
      formatRules: { ...ALLKPOP_FORMAT_RULES },
      outputLanguage: 'en',
    },
    finalReview: {
      reviewRules: ALLKPOP_REVIEW_RULES.map(r => ({ ...r })),
      allowedMedia: [...ALLKPOP_TOPIC_RULES.allowedSources],
      bannedMedia: [...ALLKPOP_TOPIC_RULES.bannedSources],
    },
  };
}
