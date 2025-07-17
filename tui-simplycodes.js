// tui-simplycodes.js
import blessed from 'blessed';
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear pantalla principal
const screen = blessed.screen({
  smartCSR: true,
  title: 'Bot de Cupones - SimplyCodes',
  style: { bg: 'blue' }
});

// Crear box principal que ocupa toda la terminal
const mainBg = blessed.box({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  style: { bg: 'blue' },
});

screen.append(mainBg);

// Menú superior
const menuBar = blessed.listbar({
  parent: mainBg,
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  style: {
    bg: 'blue',
    item: { bg: 'blue', fg: 'white', hover: { bg: 'cyan' } },
    selected: { bg: 'cyan', fg: 'black' },
    border: { fg: 'white' }
  },
  mouse: true,
  keys: true,
  autoCommandKeys: true,
  border: 'line',
  items: {
    'Archivo': {},
    'Opciones': {},
    'Ayuda': {},
  },
});

// Panel central (formulario)
const form = blessed.box({
  parent: mainBg,
  top: 3,
  left: 'center',
  width: 70,
  height: 11,
  border: { type: 'line' },
  style: { bg: 'blue', border: { fg: 'white' } },
});

const couponLabel = blessed.text({
  parent: form,
  top: 2,
  left: 3,
  content: '010010101 01 001010101:',
  style: { fg: 'yellow', bg: 'blue' },
});

const couponInput = blessed.textbox({
  parent: form,
  name: 'coupon',
  top: 2,
  left: 22,
  width: 40,
  height: 3,
  inputOnFocus: true,
  style: { fg: 'white', bg: 'blue', focus: { bg: 'blue' } },
  border: { type: 'line', fg: 'white' },
});

const percentLabel = blessed.text({
  parent: form,
  top: 5,
  left: 3,
  content: '011010101 00 0101010101:',
  style: { fg: 'yellow', bg: 'blue' },
});

const percentInput = blessed.textbox({
  parent: form,
  name: 'percentage',
  top: 5,
  left: 27,
  width: 12,
  height: 3,
  inputOnFocus: true,
  style: { fg: 'white', bg: 'blue', focus: { bg: 'blue' } },
  border: { type: 'line', fg: 'white' },
});

const startButton = blessed.button({
  parent: form,
  mouse: true,
  keys: true,
  shrink: true,
  padding: { left: 4, right: 4 },
  left: 3,
  top: 8,
  name: 'start',
  content: 'Iniciar',
  style: {
    bg: 'blue',
    fg: 'black',
    focus: { bg: 'yellow', fg: 'black' },
    hover: { bg: 'yellow', fg: 'black' },
    border: { fg: 'white' }
  },
  border: { type: 'line', fg: 'white' },
});

// Área de logs
const logBox = blessed.log({
  parent: mainBg,
  top: 14,
  left: 'center',
  width: '90%',
  height: '60%',
  label: 'Logs',
  border: { type: 'line' },
  style: { fg: 'white', bg: 'blue', border: { fg: 'white' } },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: { bg: 'blue' },
});

// Menú inferior
const bottomBar = blessed.box({
  parent: mainBg,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  style: { bg: 'blue', fg: 'white' },
  content: ' F5 Iniciar | F10 Salir ',
});

// Agregar elementos a la pantalla
screen.append(menuBar);
screen.append(form);
screen.append(logBox);
screen.append(bottomBar);

let child = null;
let running = false;
let logCleanupInterval = null;

// Función para limpiar secuencias ANSI
function limpiarAnsi(str) {
  return str.replace(/[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

// Función para limpiar logs antiguos
function limpiarLogsAntiguos() {
  const maxLines = 100; // Mantener solo las últimas 100 líneas
  const lines = logBox.getLines();
  if (lines.length > maxLines) {
    // Limpiar el logBox y agregar solo las últimas líneas
    logBox.setContent('');
    const linesToKeep = lines.slice(-maxLines);
    linesToKeep.forEach(line => {
      logBox.log(line.content);
    });
    logBox.log('--- Logs limpiados automáticamente ---');
    screen.render();
  }
}

// Iniciar limpieza automática cada 10 minutos
function iniciarLimpiezaAutomatica() {
  if (logCleanupInterval) {
    clearInterval(logCleanupInterval);
  }
  logCleanupInterval = setInterval(limpiarLogsAntiguos, 10 * 60 * 1000); // 10 minutos
}

function bloquearFormulario(bloquear) {
  couponInput.readOnly = bloquear;
  percentInput.readOnly = bloquear;
  startButton.setContent(bloquear ? 'En ejecución...' : 'Iniciar');
  if (bloquear) {
    startButton.style.bg = 'gray';
  } else {
    startButton.style.bg = 'green';
  }
  screen.render();
}

function iniciarBot(cupon, porcentaje) {
  if (running) return;
  running = true;
  bloquearFormulario(true);
  logBox.log('----------------------------------------');
  logBox.log('Iniciando bot real...');
  // Ejecutar el bot como proceso hijo usando spawn y desactivar colores
  child = spawn('node', [path.resolve(__dirname, 'test-simplycodes.js')], {
    env: { ...process.env, COUPON: cupon, PERCENTAGE: porcentaje, FORCE_COLOR: 0 }
  });
  child.stdout.on('data', (data) => {
    logBox.log(limpiarAnsi(data.toString().replace(/\n$/, '')));
    screen.render();
  });
  child.stderr.on('data', (data) => {
    logBox.log('[ERROR] ' + limpiarAnsi(data.toString().replace(/\n$/, '')));
    screen.render();
  });
  child.on('exit', (code) => {
    logBox.log('Bot finalizado. Código de salida: ' + code);
    running = false;
    bloquearFormulario(false);
    screen.render();
  });
}

// Eventos
startButton.on('press', () => {
  if (running) return;
  const cupon = couponInput.getValue().trim() || '';
  const porcentaje = percentInput.getValue().trim() || '25';
  iniciarBot(cupon, porcentaje);
});

screen.key(['f5'], () => {
  if (running) return;
  const cupon = couponInput.getValue().trim() || '';
  const porcentaje = percentInput.getValue().trim() || '25';
  iniciarBot(cupon, porcentaje);
});

couponInput.key('enter', () => {
  percentInput.focus();
});
percentInput.key('enter', () => {
  startButton.focus();
});

screen.key(['f10', 'q', 'C-c'], () => {
  if (child && running) {
    child.kill('SIGINT');
    running = false;
  }
  if (logCleanupInterval) {
    clearInterval(logCleanupInterval);
  }
  return process.exit(0);
});

// Iniciar limpieza automática al arrancar
iniciarLimpiezaAutomatica();

couponInput.focus();
screen.render(); 