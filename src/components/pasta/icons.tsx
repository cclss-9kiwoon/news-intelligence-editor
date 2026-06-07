/**
 * Pasta 공용 라인 아이콘 — 이모지 대체. 서비스 톤(미니멀 스트로크).
 * stroke=currentColor 라 부모 text-색상 클래스로 색 제어. 크기는 className(h-/w-)로.
 */
import type { ReactElement } from 'react';

type IconProps = { className?: string };

const S = (className: string, children: ReactElement | ReactElement[]) => (
  <svg className={`inline-block ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);

export function IconTrash({ className = 'h-4 w-4' }: IconProps) {
  return S(className, [
    <path key="a" d="M4 7h16" />,
    <path key="b" d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />,
    <path key="c" d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />,
    <path key="d" d="M10 11v6M14 11v6" />,
  ]);
}

export function IconCopy({ className = 'h-4 w-4' }: IconProps) {
  return S(className, [
    <rect key="a" x="9" y="9" width="11" height="11" rx="2" />,
    <path key="b" d="M5 15V5a2 2 0 0 1 2-2h8" />,
  ]);
}

export function IconBoard({ className = 'h-4 w-4' }: IconProps) {
  return S(className, [
    <rect key="a" x="3" y="4" width="18" height="16" rx="2" />,
    <path key="b" d="M9 4v16M15 4v16" />,
  ]);
}

export function IconChart({ className = 'h-4 w-4' }: IconProps) {
  return S(className, [
    <path key="a" d="M4 20V4" />,
    <path key="b" d="M4 20h16" />,
    <rect key="c" x="7" y="12" width="3" height="5" />,
    <rect key="d" x="13" y="8" width="3" height="9" />,
  ]);
}

export function IconSend({ className = 'h-4 w-4' }: IconProps) {
  return S(className, [
    <path key="a" d="M12 19V5" />,
    <path key="b" d="M6 11l6-6 6 6" />,
    <path key="c" d="M5 21h14" />,
  ]);
}

export function IconRefresh({ className = 'h-4 w-4' }: IconProps) {
  return S(className, [
    <path key="a" d="M21 12a9 9 0 1 1-2.64-6.36" />,
    <path key="b" d="M21 4v5h-5" />,
  ]);
}

export function IconBolt({ className = 'h-4 w-4' }: IconProps) {
  return S(className, [
    <path key="a" d="M13 3 4 14h7l-1 7 9-11h-7l1-7z" />,
  ]);
}

export function IconSettings({ className = 'h-4 w-4' }: IconProps) {
  return S(className, [
    <circle key="a" cx="12" cy="12" r="3" />,
    <path key="b" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
  ]);
}

export function IconWrench({ className = 'h-4 w-4' }: IconProps) {
  return S(className, [
    <path key="a" d="M14.7 6.3a4 4 0 0 1-5 5L4 17v3h3l5.7-5.7a4 4 0 0 1 5-5l-2.4 2.4-2.6-.4-.4-2.6 2.4-2.4z" />,
  ]);
}

export function IconArrowLeft({ className = 'h-4 w-4' }: IconProps) {
  return S(className, [
    <path key="a" d="M19 12H5" />,
    <path key="b" d="M12 19l-7-7 7-7" />,
  ]);
}
