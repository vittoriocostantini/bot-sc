import puppeteer from 'puppeteer';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const log = {
  info: (msg) => console.log(chalk.hex('#FFFFFF').bgBlack.bold(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green.bold.bgBlack(`[SUCCESS] ${msg}`)),
  error: (msg) => console.log(chalk.red.bold.bgBlack(`[ERROR] ${msg}`)),
  warning: (msg) => console.log(chalk.yellow.bold.bgBlack(`[WARNING] ${msg}`)),
};

async function testChromeConnection() {
  console.clear();
  log.info('=== PRUEBA DE CONEXIÓN A CHROME ===');
  
  let browser = null;
  let page = null;
  
  try {
    // Paso 1: Verificar sistema
    log.info('1. Verificando sistema...');
    
    try {
      const { stdout: memInfo } = await execAsync('free -h');
      log.info('Memoria disponible:');
      log.info(memInfo);
    } catch (e) {
      log.warning('No se pudo verificar memoria');
    }
    
    // Paso 2: Limpiar procesos anteriores
    log.info('2. Limpiando procesos anteriores...');
    try {
      await execAsync('pkill -f "chrome" 2>/dev/null || true');
      await execAsync('rm -rf /tmp/chrome-debug-linux 2>/dev/null || true');
      log.success('Limpieza completada');
    } catch (e) {
      log.warning('Error en limpieza:', e.message);
    }
    
    // Paso 3: Iniciar Chrome
    log.info('3. Iniciando Chrome con Puppeteer...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--disable-logging',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-client-side-phishing-detection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
        '--memory-pressure-off',
        '--max_old_space_size=4096',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-features=VizDisplayCompositor',
        '--disable-accelerated-2d-canvas',
        '--disable-accelerated-jpeg-decoding',
        '--disable-accelerated-mjpeg-decode',
        '--disable-accelerated-video-decode',
        '--disable-accelerated-video-encode',
        '--disable-gpu-sandbox',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-popup-blocking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--disable-logging',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-client-side-phishing-detection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
        '--memory-pressure-off',
        '--max_old_space_size=4096'
      ],
      env: { 
        ...process.env, 
        DISPLAY: process.env.DISPLAY || ':0'
      },
      timeout: 60000,
      protocolTimeout: 60000,
      ignoreHTTPSErrors: true
    });
    
    log.success('Chrome iniciado exitosamente');
    
    // Paso 4: Verificar conexión
    log.info('4. Verificando conexión al browser...');
    
    const version = await browser.version();
    log.success(`Versión de Chrome: ${version}`);
    
    const userAgent = await browser.userAgent();
    log.info(`User Agent: ${userAgent.substring(0, 100)}...`);
    
    // Paso 5: Crear página
    log.info('5. Creando página...');
    
    page = await browser.newPage();
    log.success('Página creada exitosamente');
    
    // Paso 6: Configurar página
    log.info('6. Configurando página...');
    
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    await page.setViewport({ width: 1280, height: 720 });
    
    log.success('Página configurada correctamente');
    
    // Paso 7: Probar navegación simple
    log.info('7. Probando navegación simple...');
    
    await page.goto('https://www.google.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    const title = await page.title();
    log.success(`Navegación exitosa - Título: ${title}`);
    
    // Paso 8: Probar navegación a SimplyCodes
    log.info('8. Probando navegación a SimplyCodes...');
    
    await page.goto('https://simplycodes.com/editor/add/fitzgerald', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    const simplyCodesTitle = await page.title();
    const simplyCodesUrl = page.url();
    
    log.success(`SimplyCodes cargado - Título: ${simplyCodesTitle}`);
    log.success(`URL: ${simplyCodesUrl}`);
    
    // Paso 9: Verificar elementos de la página
    log.info('9. Verificando elementos de la página...');
    
    const elements = await page.evaluate(() => {
      return {
        inputs: document.querySelectorAll('input').length,
        buttons: document.querySelectorAll('button').length,
        forms: document.querySelectorAll('form').length,
        bodyText: document.body.innerText.substring(0, 200)
      };
    });
    
    log.success(`Elementos encontrados:`);
    log.info(`  - Inputs: ${elements.inputs}`);
    log.info(`  - Botones: ${elements.buttons}`);
    log.info(`  - Formularios: ${elements.forms}`);
    log.info(`  - Texto inicial: ${elements.bodyText}...`);
    
    // Paso 10: Tomar screenshot
    log.info('10. Tomando screenshot...');
    
    await page.screenshot({ 
      path: 'test-chrome-connection.png', 
      fullPage: true 
    });
    
    log.success('Screenshot guardado como test-chrome-connection.png');
    
    log.success('=== PRUEBA DE CONEXIÓN EXITOSA ===');
    log.info('Chrome y Puppeteer funcionan correctamente');
    
  } catch (error) {
    log.error('Error en la prueba de conexión:', error.message);
    log.error('Stack trace:', error.stack);
    
    // Información adicional de diagnóstico
    try {
      const { stdout: memInfo } = await execAsync('free -h');
      log.info('Memoria disponible:', memInfo);
      
      const { stdout: chromeProcesses } = await execAsync('ps aux | grep -i chrome | grep -v grep || echo "No procesos de Chrome encontrados"');
      log.info('Procesos de Chrome:', chromeProcesses);
      
      const { stdout: portInfo } = await execAsync('netstat -tlnp 2>/dev/null | grep :9222 || echo "Puerto 9222 no encontrado"');
      log.info('Puerto 9222:', portInfo);
      
      const { stdout: displayInfo } = await execAsync('echo $DISPLAY');
      log.info('DISPLAY:', displayInfo);
      
    } catch (diagError) {
      log.error('Error al obtener información de diagnóstico:', diagError.message);
    }
    
  } finally {
    if (page) {
      log.info('Cerrando página...');
      await page.close();
    }
    
    if (browser) {
      log.info('Cerrando navegador...');
      await browser.close();
    }
    
    log.info('Limpieza completada');
  }
}

// Ejecutar prueba
testChromeConnection().catch(console.error); 