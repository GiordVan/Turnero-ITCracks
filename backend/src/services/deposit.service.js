const prisma = require('../lib/prisma');
const config = require('../config');
const { getPaymentProvider } = require('../lib/payments');
const { sendNotification } = require('../lib/notifications');

// Crea (o devuelve) la sena PENDING para un turno.
const createDeposit = async (turnId, db = prisma) => {
  const turn = await db.turn.findUnique({ where: { id: turnId } });
  if (!turn) {
    const err = new Error('Turno no encontrado');
    err.statusCode = 404;
    throw err;
  }

  // Idempotente: si ya hay un pago para el turno, devolverlo.
  const existing = await db.payment.findFirst({ where: { turnId, status: { not: 'FAILED' } } });
  if (existing) return existing;

  const provider = getPaymentProvider();
  const payment = await db.payment.create({
    data: {
      turnId,
      amount: config.payments.depositAmount,
      currency: config.payments.currency,
      provider: provider.name,
      status: 'PENDING',
    },
  });

  const intent = await provider.createIntent(payment);
  if (intent.externalRef) {
    await db.payment.update({ where: { id: payment.id }, data: { externalRef: intent.externalRef } });
    return { ...payment, externalRef: intent.externalRef };
  }
  return payment;
};

// Confirma el pago de la sena (simulado: siempre exitoso).
const confirmDeposit = async (paymentId, db = prisma) => {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    const err = new Error('Pago no encontrado');
    err.statusCode = 404;
    throw err;
  }
  if (payment.status === 'PAID') return payment;

  const provider = getPaymentProvider();
  const result = await provider.confirm(payment);

  return db.payment.update({
    where: { id: paymentId },
    data: { status: result.status, paidAt: result.paidAt, externalRef: result.externalRef },
  });
};

// Envia (fire-and-forget) la confirmacion por WhatsApp tras pagar la sena.
const notifyConfirmation = async (turnId, db = prisma) => {
  const turn = await db.turn.findUnique({
    where: { id: turnId },
    include: { professional: { select: { name: true } } },
  });
  if (!turn) return null;
  return sendNotification({ turn, type: 'CONFIRMATION', db });
};

module.exports = { createDeposit, confirmDeposit, notifyConfirmation };
