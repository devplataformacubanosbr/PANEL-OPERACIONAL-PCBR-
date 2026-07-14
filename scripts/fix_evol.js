const fs = require('fs');
const file = 'c:/Users/Desktop/Documents/FLUJO-TRABAJO-LIMPIO/CUBANOS_BR_MARCOS/DASHBOARDOperacional/workflow_n8n_v17_whatsapp_master.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const textNode = data.nodes.find(n => n.name === 'Enviar Texto a Evolution' || n.name === 'Enviar texto');
if (textNode) {
  textNode.parameters.remoteJid = '={{ $("Webhook (Enviar desde Dashboard)").item.json.body.telefono }}';
  textNode.parameters.messageText = '={{ $("Webhook (Enviar desde Dashboard)").item.json.body.texto }}';
}

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Fixed Evolution node!');
