// Proveedor de pago SIMULADO para la demo. No mueve dinero real.
// Misma interfaz que tendra el proveedor MercadoPago real, para enchufarlo
// despues sin tocar el service.
const simulatedProvider = {
  name: 'SIMULATED',

  async createIntent(payment) {
    return { externalRef: payment.id, status: 'PENDING' };
  },

  async confirm(payment) {
    return { status: 'PAID', paidAt: new Date(), externalRef: payment.externalRef || payment.id };
  },
};

module.exports = simulatedProvider;
