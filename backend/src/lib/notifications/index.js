const prisma = require('../prisma');
const whatsapp = require('./whatsapp.channel');
const { confirmationMessage, reminderMessage } = require('./compose');

const COMPOSERS = {
  CONFIRMATION: confirmationMessage,
  REMINDER: reminderMessage,
};

// Compone el mensaje, lo envía por el canal y lo registra en NotificationLog.
// db y sender inyectables para test. En modo simulado el status queda SIMULATED.
async function sendNotification({ turn, type, db = prisma, sender = whatsapp }) {
  const compose = COMPOSERS[type];
  if (!compose) throw new Error('Tipo de notificacion desconocido: ' + type);

  const body = compose(turn);
  const to = turn.phone || null;

  if (!to) {
    return null;
  }

  let status;
  try {
    const result = await sender.send({ to, body });
    status = result.status || 'SENT';
  } catch (err) {
    try {
      await db.notificationLog.create({
        data: { turnId: turn.id, channel: sender.name, type, status: 'FAILED', toAddress: to, body },
      });
    } catch {
      /* ignorar fallo del log; preservar el error original */
    }
    throw err;
  }

  return db.notificationLog.create({
    data: { turnId: turn.id, channel: sender.name, type, status, toAddress: to, body },
  });
}

module.exports = { sendNotification };
