// Redacta valores sensibles del query string antes de loguear la URL (morgan).
// Evita que un token (p.ej. el efímero del SSE) o params sensibles queden en los
// logs de acceso / proxies. Sólo toca el valor; conserva el resto de la URL.
const SENSITIVE_QUERY_KEYS = ['token', 'access_token', 'apikey', 'api_key', 'password'];

function redactSensitiveQuery(url) {
  if (typeof url !== 'string' || !url.includes('?')) return url;
  const re = new RegExp(`([?&](?:${SENSITIVE_QUERY_KEYS.join('|')})=)[^&#]*`, 'gi');
  return url.replace(re, '$1REDACTED');
}

module.exports = { redactSensitiveQuery, SENSITIVE_QUERY_KEYS };
