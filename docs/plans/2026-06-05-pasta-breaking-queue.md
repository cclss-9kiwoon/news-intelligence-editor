# Pasta 속보 우선순위 큐

> 일반(시간당 2~3 리듬)과 분리. 속보 = 분단위 골든타임 + 빠른 검수 + 사람 알림 발행.
> 인프라 일부 보유: breakingDetector, Article.isBreaking, articleWindow 'breaking'.

## 판정 (Q1)
- 속보 = (a) breakingDetector 매칭(속보/단독/긴급 등) OR (b) 캠페인 설정 `breakingKeywords` 매칭.
- 캠페인 ① 설정에 속보 키워드 입력칸(비우면 detector만).
- 속보 태스크에 isBreaking 표시(article→task 전파).

## 리듬 (Q2)
- 속보는 **시간당 상한 무시 → 즉시 ①→② 승급**(또는 속보 전용 별도 상한, 기본 무시).
- 골든타임 = **분단위**(일반 articleWindow와 별개로 짧게, 예 30~60분 기본 + 설정).
- 보드 정렬: 속보 항상 최상단.

## 검수 (Q3)
- **block 게이트는 유지**(팩트/소스 N≥2/워터마크 등 — 틀린 속보 더 위험).
- **warn 게이트는 스킵**(표기/클로징 등 사소한 거 — 빠른 통과).
- 속보 검수는 압축하되 안전핀(block)은 안 뺌.

## 발행 (Q4) — 선발행 자동 금지
- 속보 **자동발행 강제 OFF**. 캠페인 autoPublish on이어도 속보는 사람.
- 대신 **사람 알림**: 속보 태스크 생성/④ 도달 시 알림.
  - 칸반 상단 속보 배너(🚨 N건) + 보드 카드 빨강 속보 뱃지.
  - 브라우저 Notification(옵션, 권한) — 자리 비워도 뜨게.
- 사람이 빠른검수 후 발행. (선발행후보정은 위험 → v1 제외)

## 데이터 (분담)
- Task.isBreaking?:boolean (article 전파)
- Campaign.settings.searching.breakingKeywords?:string[]
- Campaign.settings.searching.breakingGoldenMin?:number (속보 골든타임 분, 기본 60)
- 승급 로직: isBreaking이면 maxPerHour 카운트서 제외 + 즉시 승급 + priority 최상.
- 검수 로직: isBreaking이면 warn severity 게이트 스킵, block 유지.
- 발행: isBreaking이면 autoPublish 무시(사람).

## 분담
- NIE_개발(로직): 속보 판정(detector+키워드), 승급 무시/즉시, 골든타임 분단위, 검수 warn 스킵.
- Engineer(UI): 보드 속보 뱃지/최상단 정렬 + 상단 속보 배너 + 브라우저 알림 + 캠페인 속보 키워드/골든타임 설정 UI + 속보 자동발행 차단.

## 범위
v1: 판정·즉시승급·분단위 골든타임·warn스킵·사람알림·자동발행차단. 선발행후보정 제외.
