'use strict';

/**
 * Instagram API with Instagram Login (2024년 7월 출시)
 * - 페이스북 페이지 없이 인스타그램 프로페셔널(비즈니스/크리에이터) 계정으로 직접 로그인
 * - 문서: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 *
 * 필요한 환경변수 (Meta 앱에서 발급):
 *   IG_APP_ID       인스타그램 앱 ID
 *   IG_APP_SECRET   인스타그램 앱 시크릿
 *   IG_REDIRECT_URI 리디렉트 URI (Meta 앱에 등록한 값과 정확히 일치, https 필수)
 *                   미설정 시 요청 origin + /auth/instagram/callback 로 유추
 */

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
];

const cfg = () => ({
  appId: process.env.IG_APP_ID || '',
  appSecret: process.env.IG_APP_SECRET || '',
  redirectUri: process.env.IG_REDIRECT_URI || '',
});

const isConfigured = () => {
  const c = cfg();
  return Boolean(c.appId && c.appSecret);
};

function redirectUri(req) {
  const c = cfg();
  if (c.redirectUri) return c.redirectUri;
  // 배포/프록시 환경을 고려해 forwarded 헤더 우선
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}/auth/instagram/callback`;
}

// 1) 인증 동의 화면 URL
function authUrl(req, state) {
  const c = cfg();
  const p = new URLSearchParams({
    client_id: c.appId,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: SCOPES.join(','),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${p.toString()}`;
}

// 2) code → 단기 토큰 (+ user_id)
async function exchangeCode(req, code) {
  const c = cfg();
  const body = new URLSearchParams({
    client_id: c.appId,
    client_secret: c.appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(req),
    code,
  });
  const r = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const d = await r.json();
  if (!r.ok || d.error_message || d.error) {
    throw new Error(d.error_message || d.error?.message || '토큰 교환 실패');
  }
  // { access_token, user_id, permissions }
  return d;
}

// 3) 단기 → 장기 토큰 (60일)
async function longLivedToken(shortToken) {
  const c = cfg();
  const p = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: c.appSecret,
    access_token: shortToken,
  });
  const r = await fetch(`https://graph.instagram.com/access_token?${p.toString()}`);
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error?.message || '장기 토큰 교환 실패');
  return d; // { access_token, token_type, expires_in }
}

// 4) 프로필 조회 (username, followers_count 등)
async function getProfile(token) {
  const p = new URLSearchParams({
    fields: 'user_id,username,name,account_type,followers_count,media_count,profile_picture_url',
    access_token: token,
  });
  const r = await fetch(`https://graph.instagram.com/me?${p.toString()}`);
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error?.message || '프로필 조회 실패');
  return d;
}

// 장기 토큰 갱신 (만료 임박 시)
async function refreshToken(token) {
  const p = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token });
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?${p.toString()}`);
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error?.message || '토큰 갱신 실패');
  return d;
}

module.exports = { SCOPES, cfg, isConfigured, redirectUri, authUrl, exchangeCode, longLivedToken, getProfile, refreshToken };
