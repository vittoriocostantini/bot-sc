import puppeteer from 'puppeteer';
import chalk from 'chalk';

const log = {
  info: (msg) => console.log(chalk.hex('#FFFFFF').bgBlack.bold(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green.bold.bgBlack(`[SUCCESS] ${msg}`)),
  error: (msg) => console.log(chalk.red.bold.bgBlack(`[ERROR] ${msg}`)),
  warning: (msg) => console.log(chalk.yellow.bold.bgBlack(`[WARNING] ${msg}`)),
};

async function testChromeSimple() {
  console.clear();
  log.info('=== PRUEBA SIMPLE DE CHROME ===');
  
  let browser = null;
  let page = null;
  
  try {
    log.info('1. Iniciando Chrome con Puppeteer...');
    
    browser = await puppeteer.launch({
      headless: 'new', // Nuevo modo headless
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
      }
    });
    
    log.success('Chrome iniciado exitosamente');
    
    log.info('2. Obteniendo versión de Chrome...');
    const version = await browser.version();
    log.success(`Versión: ${version}`);
    
    log.info('3. Creando nueva página...');
    page = await browser.newPage();
    log.success('Página creada exitosamente');
    
    log.info('4. Configurando timeouts...');
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    log.success('Timeouts configurados');
    
    log.info('5. Navegando a una página de prueba...');
    await page.goto('https://www.google.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    log.success('Navegación exitosa');
    
    log.info('6. Obteniendo título de la página...');
    const title = await page.title();
    log.success(`Título: ${title}`);
    
    log.info('7. Tomando screenshot...');
    await page.screenshot({ path: 'test-chrome-simple.png', fullPage: true });
    log.success('Screenshot guardado como test-chrome-simple.png');
    
    log.success('=== PRUEBA COMPLETADA EXITOSAMENTE ===');
    log.info('Chrome funciona correctamente');
    
  } catch (error) {
    log.error('Error en la prueba:', error.message);
    log.error('Stack trace:', error.stack);
    
    // Información adicional de diagnóstico
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      log.info('Información de diagnóstico:');
      
      // Verificar memoria
      const { stdout: memInfo } = await execAsync('free -h');
      log.info('Memoria disponible:');
      log.info(memInfo);
      
      // Verificar procesos de Chrome
      const { stdout: chromeProcesses } = await execAsync('ps aux | grep -i chrome | grep -v grep || echo "No procesos de Chrome encontrados"');
      log.info('Procesos de Chrome:');
      log.info(chromeProcesses);
      
      // Verificar puertos
      const { stdout: portInfo } = await execAsync('netstat -tlnp 2>/dev/null | grep :9222 || echo "Puerto 9222 no encontrado"');
      log.info('Puerto 9222:');
      log.info(portInfo);
      
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
testChromeSimple().catch(console.error); 