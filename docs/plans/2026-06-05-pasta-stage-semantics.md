# Pasta 칸반 4단계 의미 확정 (워크플로 코어)

> ⚠️ 이 문서가 2026-06-05 "① 시간당 상한(생성)" 디스패치를 **대체**한다.
> 변경: 시간당 상한 = *생성*이 아니라 *①→② 승급* 속도. 초과분 버림 → ①에 대기.

## 4단계 의미

```
발견(설정 매칭 클러스터) → ① 대기 큐
   ① 기사 찾기 = 대기 큐
      · 자격 클러스터는 전부 ①에 태스크로 쌓임 (즉시 ②로 안 넘김)
      · 우선순위: 최신순 (신선도)
      · 만료: 후보의 기준 기사가 articleWindow 벗어나면 자동 폐기
              (window 24h→24h, 1h→1h. 새 설정 X, 기존 articleWindow 재활용)
      · 효과: 진행 가시성 + 백프레셔(과부하 방지)
        │
        ▼ 시간당 상한(생산 리듬)만큼 승급. 최신 우선.
   ② 주제 검수 = 끌어올린 주제 실제 검수
      · 전문 수집(스크레이퍼) + 제외주제 AI 판단(설정 시)
      · 통과 → ③ / 전문 0건 타임아웃·제외주제 해당 → 탈락
        ▼
   ③ 기사 작성 = 검수 통과분 LLM 작성 (generateStory)
        ▼
   ④ 최종 검수
      · 자동발행 OFF → 사람이 편집/발행/폐기 (현행 워크스페이스)
      · 자동발행 ON  → 검수 통과(review.passed=Verified)만 Hydra 자동 발행
                       차단/경고(block/warn) 건은 자동이어도 사람에게 남김
```

## 신선도 = 본질
- 후보는 신선할 때 처리·발행돼야 의미(오후 3시 주제를 10시에 발행할 이유 없음).
- 그래서 ① 만료를 articleWindow에 묶고, 승급 우선순위를 최신순으로.

## 변경 요약 (이전 디스패치 대체)
| 항목 | 이전 | 확정 |
|---|---|---|
| 시간당 상한 적용점 | 태스크 *생성* | **①→② 승급** |
| 상한 초과분 | 버림 | **①에 대기** |
| ① 컬럼 | 거의 빈 채 통과 | **대기 큐(쌓임)** |
| 후보 만료 | 없음 | **articleWindow 초과 시 폐기** |
| ④ 발행 | 사람만 | 사람 / **자동발행 시 Verified만 Hydra** |

## 데이터/구현 (Engineer)
- ① 즉시전환 제거: 현 SearchingPipeline stage2(searching→topic_review 즉시 이동) 폐기.
  대신 승급 로직: 캠페인별 최근 60분 ②+이후 진입 수 카운트 → 시간당 상한 미만이면
  ① 태스크 중 최신 우선으로 남은 수만큼 ②(topic_review)로 승급.
- 시간당 상한 설정: Campaign.settings.searching.maxPerHour (기본 3).
- ① 만료: 태스크의 기준 기사 pubDate(또는 createdAt)가 articleWindow 벗어나면 자동 삭제/폐기.
- ④ 자동발행: Campaign.settings.finalReview.autoPublish?: boolean (기본 false).
  on이면 ③→④ 진입 후 review.passed면 자동 publish(기존 publish stub/Hydra 훅) + publishedAt.
  passed 아니면 사람 대기.
- 동시 LLM 상한(앞서 디스패치한 ② 견고화의 동시상한)과 함께 ③ 호출량 이중 보호.

## 검증
- 84건 발견돼도 ②엔 시간당 N개만 올라옴. ①에 나머지 대기.
- window 지난 ① 후보 자동 사라짐.
- 자동발행 on + Verified → 발행함으로 자동 이동. 차단 건은 ④에 남음.
- tsc 0 · vitest green.
