const config = require('../../config');

// Canal WhatsApp via Evolution API.
// mode 'simulated' (default demo): NO pega a la red, devuelve SIMULATED.
// mode 'live': POST a Evolution API (/message/sendText/{instance}).
async function send({ to, body }) {
  if (config.whatsapp.mode !== 'live') {
    return { status: 'SIMULATED' };
  }
  const url = `${config.whatsapp.apiUrl}/message/sendText/${config.whatsapp.instance}`;
  const number = String(to).replace(/\D/g, ''); // Evolution API espera E.164 sin '+'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.whatsapp.apiKey },
    body: JSON.stringify({ number, text: body }),
  });
  if (!res.ok) {
    throw new Error(`Evolution API error ${res.status}`);
  }
  return { status: 'SENT' };
}

module.exports = { name: 'WHATSAPP', send };
