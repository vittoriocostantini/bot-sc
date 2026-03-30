import blessed from 'blessed';
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear pantalla principal
const screen = blessed.screen({
  smartCSR: true,
  title: 'Bot de Cupones - SimplyCodes (Stealth Mode)',
  style: { bg: 'black' }
});

// Crear box principal que ocupa toda la terminal
const mainBg = blessed.box({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  style: { bg: 'black' },
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
    bg: 'black',
    item: { bg: 'black', fg: 'white', hover: { bg: 'cyan' } },
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
  style: { bg: 'black', border: { fg: 'white' } },
});

const couponLabel = blessed.text({
  parent: form,
  top: 2,
  left: 3,
  content: 'INGRESE EL CODIGO:',
  style: { fg: 'yellow', bg: 'black' },
});

const couponInput = blessed.textbox({
  parent: form,
  name: 'coupon',
  top: 2,
  left: 22,
  width: 40,
  height: 3,
  inputOnFocus: true,
  style: { fg: 'white', bg: 'black', focus: { bg: 'black' } },
  border: { type: 'line', fg: 'white' },
});

const percentLabel = blessed.text({
  parent: form,
  top: 5,
  left: 3,
  content: 'INGRESA EL PORCENTAJE:',
  style: { fg: 'yellow', bg: 'black' },
});

const percentInput = blessed.textbox({
  parent: form,
  name: 'percentage',
  top: 5,
  left: 27,
  width: 12,
  height: 3,
  inputOnFocus: true,
  style: { fg: 'white', bg: 'black', focus: { bg: 'black' } },
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
    bg: 'black',
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
  label: 'Logs de Actividad',
  border: { type: 'line' },
  style: { fg: 'white', bg: 'black', border: { fg: 'white' } },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: { bg: 'black' },
});

// Menú inferior
const bottomBar = blessed.box({
  parent: mainBg,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  style: { bg: 'black', fg: 'white' },
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
let lastError = '';

// Función para limpiar secuencias ANSI (solo si es necesario, pero mantenemos colores)
function limpiarAnsi(str) {
  return str.replace(/[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function limpiarLogsAntiguos() {
  const maxLines = 100;
  const lines = logBox.getLines();
  if (lines.length > maxLines) {
    logBox.setContent('');
    const linesToKeep = lines.slice(-maxLines);
    linesToKeep.forEach(line => { logBox.log(line.content); });
    logBox.log('--- Logs optimizados ---');
    screen.render();
  }
}

function iniciarLimpiezaAutomatica() {
  if (logCleanupInterval) clearInterval(logCleanupInterval);
  logCleanupInterval = setInterval(limpiarLogsAntiguos, 10 * 60 * 1000);
}

function bloquearFormulario(bloquear) {
  couponInput.readOnly = bloquear;
  percentInput.readOnly = bloquear;
  startButton.setContent(bloquear ? 'Corriendo...' : 'Iniciar');
  startButton.style.bg = bloquear ? 'gray' : 'green';
  screen.render();
}

function chromeDebugAvailable() {
  try {
    const result = execSync('curl -s http://localhost:9222/json/version', { encoding: 'utf8' });
    return result.includes('Browser');
  } catch { return false; }
}

function isChromeRunning() {
  try {
    const cmd = process.platform === 'linux'
      ? 'ps aux | grep -E "(chrome|google-chrome|chromium)" | grep -v grep'
      : 'ps aux | grep -i "Google Chrome" | grep -v grep';
    const result = execSync(cmd, { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch { return false; }
}

function iniciarBot(cupon, porcentaje) {
  if (running) return;
  running = true;
  bloquearFormulario(true);
  logBox.log('----------------------------------------');

  if (chromeDebugAvailable()) {
    logBox.log('Usando instancia de Chrome activa (Puerto 9222).');
  } else {
    logBox.log('Iniciando Bot en Modo Sigilo para Linux...');
  }

  lastError = '';
  // CAMBIO CLAVE: FORCE_COLOR: 1 para ver los colores del bot en la TUI
  child = spawn('node', [path.resolve(__dirname, 'test-simplycodes.js')], {
    env: { ...process.env, COUPON: cupon, PERCENTAGE: porcentaje, FORCE_COLOR: 1 },
    stdio: ['inherit', 'pipe', 'pipe']
  });

  child.stdout.on('data', (data) => {
    logBox.log(data.toString().trim());
    screen.render();
  });

  child.stderr.on('data', (data) => {
    const errMsg = data.toString().trim();
    lastError = errMsg;
    logBox.log('[ERROR] ' + errMsg);
    screen.render();
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      logBox.log('Bot se detuvo. Código: ' + code);
      if (lastError.includes('Chrome') || lastError.includes('debug')) {
        logBox.log('--- SOLUCIÓN DE CONEXIÓN ---');
        logBox.log('1. Cierra todas las ventanas de Chrome.');
        logBox.log('2. Si el bot no abre Chrome solo, lánzalo así:');
        logBox.log('   google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug');
        logBox.log('   (SIN las flags --no-sandbox ni --disable-gpu)');
      }
    } else {
      logBox.log('Ciclo completado exitosamente.');
    }
    running = false;
    bloquearFormulario(false);
    screen.render();
  });
}

// Eventos
startButton.on('press', () => {
  const cupon = couponInput.getValue().trim();
  const porcentaje = percentInput.getValue().trim() || '25';
  if (cupon) iniciarBot(cupon, porcentaje);
});

screen.key(['f5'], () => {
  const cupon = couponInput.getValue().trim();
  const porcentaje = percentInput.getValue().trim() || '25';
  if (cupon) iniciarBot(cupon, porcentaje);
});

couponInput.key('enter', () => percentInput.focus());
percentInput.key('enter', () => startButton.focus());

screen.key(['f10', 'q', 'C-c'], () => {
  if (child) child.kill('SIGINT');
  if (logCleanupInterval) clearInterval(logCleanupInterval);
  return process.exit(0);
});

iniciarLimpiezaAutomatica();
couponInput.focus();
screen.render();
