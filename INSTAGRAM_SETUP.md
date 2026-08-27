# 인스타그램 실연동 설정 가이드

MOA는 **Instagram API with Instagram Login**(2024년 7월 출시)으로 인스타그램을 연동합니다.
페이스북 페이지 없이 **인스타그램 프로페셔널(비즈니스/크리에이터) 계정**으로 바로 로그인합니다.

## 사장님(계정 소유자) 준비물
- 인스타그램 계정을 **프로페셔널 계정**으로 전환 (설정 → 계정 유형 → 프로페셔널)

## 앱 소유자(개발자) 설정 — 최초 1회

1. https://developers.facebook.com/apps → **앱 만들기** → 유형 "비즈니스"
2. 좌측 **제품 추가**에서 **Instagram** → "API 설정"
3. **Instagram 앱 ID / 앱 시크릿** 확인 → 서버 `.env`에 입력
   ```
   IG_APP_ID=...
   IG_APP_SECRET=...
   ```
4. **OAuth 리디렉트 URI** 등록 (대시보드 채널 화면 상단에 표시되는 값과 동일하게):
   ```
   https://<배포도메인>/auth/instagram/callback
   ```
   - 로컬 테스트는 https가 필요하므로 ngrok 등 터널을 쓰고 그 https 주소를 등록/`IG_REDIRECT_URI`에 설정
5. 서버 재시작 → 대시보드 → **채널 연결** → "인스타그램 연결" 클릭 → 로그인/동의

## 요청 권한(scope)
- `instagram_business_basic` — 프로필·팔로워 조회
- `instagram_business_content_publish` — 게시물/릴스 발행
- `instagram_business_manage_comments` — 댓글 조회·응답
- `instagram_business_manage_messages` — DM 조회·응답

## 프로덕션(앱 심사)
개발 모드에서는 앱에 **역할로 추가된 계정**만 연결됩니다.
일반 사용자에게 공개하려면 Meta **앱 심사(App Review)**로 위 권한을 승인받고,
비즈니스 인증을 완료해야 합니다.

## 동작 방식(요약)
```
채널연결 → /auth/instagram → instagram.com/oauth/authorize (동의)
  → /auth/instagram/callback?code=...
  → code→단기토큰 (api.instagram.com/oauth/access_token)
  → 단기→장기토큰 60일 (graph.instagram.com/access_token)
  → 프로필 조회 (graph.instagram.com/me)
  → 토큰은 서버 oauth_tokens 테이블에만 저장(클라이언트로 안 나감)
```
토큰은 60일 만료이며 `refresh_access_token`으로 갱신합니다.
