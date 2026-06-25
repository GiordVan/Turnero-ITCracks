// Mensajes (texto plano) para WhatsApp. Puras: testeables sin DB ni red.
function confirmationMessage(turn) {
  const profe = turn.professional?.name ? ` con ${turn.professional.name}` : '';
  return `¡Hola ${turn.customerName || ''}! ✂️ Confirmamos tu turno${profe} el ${turn.scheduledDate} a las ${turn.scheduledTime}. ¡Te esperamos! 💈`;
}

function reminderMessage(turn) {
  const profe = turn.professional?.name ? ` con ${turn.professional.name}` : '';
  return `Hola ${turn.customerName || ''} 👋 Te recordamos tu turno${profe} el ${turn.scheduledDate} a las ${turn.scheduledTime}. Respondé OK para confirmar, o avisanos si no podés venir.`;
}

module.exports = { confirmationMessage, reminderMessage };
