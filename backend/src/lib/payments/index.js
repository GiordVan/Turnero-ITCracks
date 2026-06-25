const config = require('../../config');
const simulated = require('./simulated.provider');

// Selector de proveedor de pago segun config. Hoy solo SIMULATED.
// MercadoPago real se agrega aca cuando se implemente (misma interfaz).
function getPaymentProvider() {
  switch (config.payments.provider) {
    case 'simulated':
      return simulated;
    // case 'mercadopago': return require('./mercadopago.provider');
    default:
      throw new Error('Unknown payment provider: ' + config.payments.provider);
  }
}

module.exports = { getPaymentProvider };
