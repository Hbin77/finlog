# 스마트머니랩 디자인 시스템 명세서

> 브랜드 키워드: 신뢰감(Trust), 전문성(Expertise), 깔끔함(Clean)

## 디자인 원칙

1. 이모티콘 사용 금지 - 텍스트와 아이콘만 사용
2. 깔끔하고 세련된 미니멀 디자인
3. 차분하고 자연스러운 톤 유지
4. 충분한 여백(whitespace) 활용
5. 카드와 요소 간 명확한 시각적 계층 구조

---

## 색상 팔레트 (Coolors 확정)

### 5대 핵심 색상

| 색상 코드 | 이름 | 역할 | 용도 |
|-----------|------|------|------|
| #476A6F | Blue Slate | Primary | 헤더, 주요 버튼, 제목 |
| #519E8A | Seagrass | Secondary | 링크, 강조, CTA |
| #7EB09B | Muted Teal | Accent | 호버, 태그, 배지 |
| #C5C9A4 | Dry Sage | Subtle | 배경 구분, 사이드바, 보조 요소 |
| #ECBEB4 | Cotton Rose | Highlight | 특별 강조, 알림, 따뜻한 포인트 |

### 파생 색상

| 용도 | 색상 코드 | 설명 |
|------|-----------|------|
| 배경 | #FAFAF8 | 매우 밝은 따뜻한 화이트 |
| 텍스트 | #2D3A3A | Blue Slate 계열 다크 |
| 서브 텍스트 | #6B7B7B | 미디엄 그레이 |
| 보더 | #E2E5DC | Sage 계열 라이트 |
| 카드 배경 | #FFFFFF | 순수 흰색 |
| 풋터 배경 | #3A5558 | Blue Slate 다크 버전 |
| 풋터 텍스트 | #D1DBD3 | 밝은 세이지 톤 |

### Tailwind 유틸리티 클래스 매핑

각 색상은 50-900 스케일로 확장되어 Tailwind 클래스로 사용 가능:

- `bg-primary-500` = #476A6F (Blue Slate)
- `text-secondary-500` = #519E8A (Seagrass)
- `bg-accent-400` = #7EB09B (Muted Teal)
- `bg-subtle-400` = #C5C9A4 (Dry Sage)
- `bg-highlight-300` = #ECBEB4 (Cotton Rose)
- `text-neutral-800` = #2D3A3A (본문 텍스트)
- `text-neutral-500` = #6B7B7B (서브 텍스트)
- `border-neutral-200` = #E2E5DC (보더)

---

## 컴포넌트 디자인 명세

### Header (헤더)
- **위치**: `position: sticky; top: 0; z-index: 50`
- **배경**: 흰색 (`#ffffff`), 스크롤 시 하단 그림자 (`shadow-sm`)
- **높이**: 64px (모바일), 72px (데스크톱)
- **레이아웃**: 로고 좌측, 내비게이션 우측 (가로 배치)
- **로고**: primary-500 (#476A6F), 폰트 크기 1.25rem, bold
- **네비게이션 링크**: neutral-700, 호버 시 secondary-500 (#519E8A) 전환
- **모바일**: 햄버거 아이콘 (우측), 슬라이드 다운 메뉴
- **반응형 전환점**: 768px (md)

### Footer (푸터)
- **배경**: #3A5558 (Blue Slate 다크)
- **텍스트 색상**: #D1DBD3
- **레이아웃**: 3-column grid (데스크톱), 1-column stack (모바일)
  - Column 1: 사이트 소개 + 로고
  - Column 2: 카테고리 링크
  - Column 3: 정책 페이지 링크 (About, 개인정보, 이용약관 등)
- **하단**: 저작권 표시 (border-top으로 구분, border 색 #4a6b6f)
- **패딩**: 상하 3rem, 좌우 컨테이너

### BlogCard (블로그 카드)
- **구조**: 이미지 상단 -> 카테고리 태그 -> 제목 -> 발췌문 -> 날짜/읽기시간
- **이미지**: aspect-ratio 16/9, object-fit cover, rounded-t-lg
- **카테고리 태그**: 이미지 아래 위치, pill 형태
- **제목**: H3, primary-500 (#476A6F), 1.25rem, font-semibold, 2줄 clamp
- **발췌문**: neutral-500 (#6B7B7B), 0.875rem, 3줄 clamp
- **날짜**: neutral-400, 0.75rem
- **카드 자체**: 흰색 bg, rounded-lg, shadow-sm, border 1px solid #E2E5DC
- **호버**: shadow-md로 전환, `translateY(-2px)`, transition 200ms
- **그리드**: 3열 (데스크톱), 2열 (태블릿), 1열 (모바일)

### CategoryTag (카테고리 태그)
- **형태**: pill 형태 (rounded-full), 작은 크기
- **폰트**: 0.75rem, font-medium
- **패딩**: px-3 py-1
- **카테고리별 색상**:
  - 저축/예금: primary-100 bg, primary-700 text
  - 투자 입문: secondary-100 bg, secondary-700 text
  - 세금/연말정산: subtle-100 bg, subtle-700 text
  - 도구 리뷰: accent-100 bg, accent-700 text
  - 절약 팁: highlight-100 bg, highlight-700 text

### Sidebar (사이드바)
- **너비**: 320px 고정 (데스크톱), 모바일에서 숨김
- **섹션 구분**: 각 섹션 간 2rem 간격
- **인기 글 위젯**:
  - 번호 + 제목 리스트 (5개)
  - 호버 시 secondary-500 색상 전환
- **카테고리 리스트**:
  - 카테고리명 + 글 수 배지
  - 각 항목 패딩 py-2, border-bottom (#E2E5DC)
- **뉴스레터 영역**:
  - 배경: subtle-50 (#F8F9F5)
  - 이메일 입력 + 구독 버튼 (secondary-500)
  - 간단한 설명 텍스트

### Breadcrumb (브레드크럼)
- **구분자**: `/` (neutral-400)
- **폰트**: 0.875rem
- **현재 페이지**: neutral-600, font-medium (링크 아님)
- **이전 페이지**: secondary-500, 호버 시 underline
- **구조**: 홈 > 카테고리 > 글 제목

---

## 타이포그래피

### 폰트 패밀리
- **주요 폰트**: Pretendard Variable
- **폴백**: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif

### 타이포 스케일
| Name | Size | Weight | Line-height | 용도 |
|------|------|--------|-------------|------|
| Display | 3rem (48px) | 800 | 1.25 | 히어로 섹션 |
| H1 | 2.25rem (36px) | 700 | 1.3 | 페이지 제목 |
| H2 | 1.875rem (30px) | 700 | 1.35 | 섹션 제목 |
| H3 | 1.5rem (24px) | 600 | 1.4 | 카드 제목 |
| H4 | 1.25rem (20px) | 600 | 1.4 | 소제목 |
| Body | 1rem (16px) | 400 | 1.75 | 본문 텍스트 |
| Small | 0.875rem (14px) | 400 | 1.5 | 보조 텍스트 |
| Caption | 0.75rem (12px) | 400 | 1.5 | 날짜, 메타 |

> 한국어 가독성을 위해 본문 line-height는 1.75 사용

---

## 간격 시스템

4px 기반 단위:
- `space-1`: 0.25rem (4px)
- `space-2`: 0.5rem (8px)
- `space-3`: 0.75rem (12px)
- `space-4`: 1rem (16px)
- `space-5`: 1.25rem (20px)
- `space-6`: 1.5rem (24px)
- `space-8`: 2rem (32px)
- `space-10`: 2.5rem (40px)
- `space-12`: 3rem (48px)
- `space-16`: 4rem (64px)
- `space-20`: 5rem (80px)

---

## 반응형 브레이크포인트

| Name | Width | 용도 |
|------|-------|------|
| sm | 640px | 대형 모바일 |
| md | 768px | 태블릿 |
| lg | 1024px | 소형 데스크톱 |
| xl | 1280px | 대형 데스크톱 |

**컨테이너 최대 너비**: 1200px (centered)

---

## 그림자 시스템

| Name | Value | 용도 |
|------|-------|------|
| shadow-sm | `0 1px 2px rgba(0,0,0,0.05)` | 미세한 구분 |
| shadow-md | `0 4px 6px -1px rgba(0,0,0,0.1)` | 카드 호버 |
| shadow-lg | `0 10px 15px -3px rgba(0,0,0,0.1)` | 모달, 드롭다운 |

---

## 보더 라운드

| Name | Value | 용도 |
|------|-------|------|
| rounded-sm | 4px | 인풋, 작은 요소 |
| rounded-md | 8px | 버튼 |
| rounded-lg | 12px | 카드 |
| rounded-xl | 16px | 큰 카드, 모달 |
| rounded-full | 9999px | 태그, 아바타 |
