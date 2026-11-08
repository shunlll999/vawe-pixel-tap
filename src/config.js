/** Gateway endpoint. Override with ?api=<url> (saved to localStorage) for testing. */
const PROD_GATEWAY = 'https://wch0984.wiiwave.com';
const LOCAL_GATEWAY = 'http://localhost:3000';
function resolve() {
  try {
    const q = new URLSearchParams(location.search).get('api');
    if (q) localStorage.setItem('vawe.api', q);
    const saved = localStorage.getItem('vawe.api');
    if (saved) return saved;
  } catch {}
  const host = location.hostname;
  return host === 'localhost' || host === '127.0.0.1' ? LOCAL_GATEWAY : PROD_GATEWAY;
}
export const GATEWAY_URL = resolve().replace(/\/+$/, '');
