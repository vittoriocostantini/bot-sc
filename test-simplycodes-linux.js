import puppeteer from 'puppeteer';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

const execAsync = promisify(exec);

const log = {
  info: (msg) => console.log(chalk.hex('#FFFFFF').bgBlack.bold(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green.bold.bgBlack(`[SUCCESS] ${msg}`)),
  error: (msg) => console.log(chalk.red.bold.bgBlack(`[ERROR] ${msg}`)),
  warning: (msg) => console.log(chalk.yellow.bold.bgBlack(`[WARNING] ${msg}`)),
};

class SimplyCodesLinuxTester {
  constructor(coupon, percentage) {
    this.browser = null;
    this.page = null;
    this.retryCount = 0;
    this.maxRetries = Infinity;
    this.coupon = coupon;
    this.percentage = percentage;
    this.basePercentage = percentage;
    this.keepRunning = true;
    this.successfulSubmissions = 0;
    this.percentageIncrementCount = 0;
    this.chromeProcess = null;
    this.chromePath = null;
  }

  // ===== DETECCIÓN DE NAVEGADORES EN LINUX =====
  
  async detectChromeBrowsers() {
    const possibleBrowsers = [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
      'chrome',
      'chromium-browser-sandbox',
      'google-chrome-beta',
      'google-chrome-unstable'
    ];

    const foundBrowsers = [];
    
    for (const browser of possibleBrowsers) {
      try {
        const { stdout } = await execAsync(`which ${browser}`);
        if (stdout.trim()) {
          foundBrowsers.push({
            name: browser,
            path: stdout.trim(),
            version: await this.getBrowserVersion(stdout.trim())
          });
        }
      } catch (e) {
        // Browser no encontrado, continuar
      }
    }

    return foundBrowsers;
  }

  async getBrowserVersion(browserPath) {
    try {
      const { stdout } = await execAsync(`${browserPath} --version`);
      return stdout.trim();
    } catch (e) {
      return 'Version unknown';
    }
  }

  async selectBestBrowser() {
    const browsers = await this.detectChromeBrowsers();
    
    if (browsers.length === 0) {
      log.error('No se encontraron navegadores Chrome/Chromium');
      log.error('Instala Google Chrome o Chromium:');
      log.error('  Ubuntu/Debian: sudo apt install google-chrome-stable');
      log.error('  CentOS/RHEL: sudo yum install google-chrome-stable');
      log.error('  Arch: sudo pacman -S google-chrome');
      log.error('  Chromium: sudo apt install chromium-browser');
      throw new Error('No browsers found');
    }

    // Priorizar Google Chrome sobre Chromium
    const chrome = browsers.find(b => b.name.includes('google-chrome'));
    const chromium = browsers.find(b => b.name.includes('chromium'));
    
    const selected = chrome || chromium || browsers[0];
    
    log.success(`Navegador seleccionado: ${selected.name}`);
    log.info(`Ruta: ${selected.path}`);
    log.info(`Versión: ${selected.version}`);
    
    this.chromePath = selected.path;
    return selected;
  }

  // ===== CONFIGURACIÓN DEL SISTEMA =====
  
  async setupSystem() {
    log.info('Configurando sistema para Linux...');
    
    // Verificar si estamos en un entorno headless
    const isHeadless = !process.env.DISPLAY || process.env.DISPLAY === '';
    
    if (isHeadless) {
      log.warning('Ejecutando en modo headless');
      log.info('Configurando entorno virtual...');
      
      try {
        // Intentar configurar Xvfb si está disponible
        const { stdout: xvfbCheck } = await execAsync('which Xvfb 2>/dev/null || echo ""');
        if (xvfbCheck.trim()) {
          log.info('Xvfb encontrado, configurando display virtual...');
          
          // Iniciar Xvfb en background
          const xvfbProcess = spawn('Xvfb', [':99', '-screen', '0', '1024x768x24'], {
            detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
          });
          
          await this.wait(2000);
          process.env.DISPLAY = ':99';
          log.success('Display virtual configurado: :99');
        } else {
          log.warning('Xvfb no encontrado, usando DISPLAY=:0');
          process.env.DISPLAY = ':0';
        }
      } catch (e) {
        log.warning('No se pudo configurar display virtual, usando :0');
        process.env.DISPLAY = ':0';
      }
    } else {
      log.success(`DISPLAY configurado: ${process.env.DISPLAY}`);
    }

    // Verificar que el display funciona
    try {
      const { stdout: xdpyinfo } = await execAsync('xdpyinfo -display ${process.env.DISPLAY} 2>/dev/null || echo "Display no disponible"');
      if (xdpyinfo.includes('Display no disponible')) {
        log.warning('Display no disponible, intentando configuración alternativa...');
        process.env.DISPLAY = ':0';
      }
    } catch (e) {
      log.info('No se pudo verificar display, continuando...');
    }

    // Verificar permisos de /tmp
    try {
      await execAsync('touch /tmp/chrome-debug-test');
      await execAsync('rm /tmp/chrome-debug-test');
      log.success('Permisos de /tmp verificados');
    } catch (error) {
      log.error('Sin permisos de escritura en /tmp');
      throw new Error('No write permission in /tmp');
    }

    // Verificar dependencias necesarias
    const dependencies = ['curl', 'ps', 'netstat', 'free'];
    for (const dep of dependencies) {
      try {
        await execAsync(`which ${dep}`);
        log.info(`✓ ${dep} disponible`);
      } catch (e) {
        log.warning(`⚠ ${dep} no encontrado`);
      }
    }

    // Verificar memoria disponible
    try {
      const { stdout } = await execAsync('free -m');
      const lines = stdout.split('\n');
      const memLine = lines[1];
      const memValues = memLine.split(/\s+/);
      const totalMem = parseInt(memValues[1]);
      const availableMem = parseInt(memValues[6]);

      log.info(`Memoria total: ${totalMem}MB`);
      log.info(`Memoria disponible: ${availableMem}MB`);

      if (availableMem < 512) {
        log.warning('Memoria insuficiente (< 512MB)');
        log.warning('Chrome puede no iniciar correctamente');
      }
    } catch (e) {
      log.info('No se pudo verificar memoria del sistema');
    }

    // Verificar espacio en disco
    try {
      const { stdout } = await execAsync('df /tmp -h');
      log.info('Espacio en disco para /tmp:');
      log.info(stdout);
    } catch (e) {
      log.info('No se pudo verificar espacio en disco');
    }

    // Verificar puerto 9222
    try {
      const { stdout: portCheck } = await execAsync('netstat -tlnp 2>/dev/null | grep :9222 || echo "Puerto libre"');
      if (portCheck.includes('9222')) {
        log.warning('Puerto 9222 ya está en uso');
        log.info('Intentando liberar puerto...');
        await execAsync('pkill -f "chrome.*9222" 2>/dev/null || true');
        await this.wait(2000);
      }
    } catch (e) {
      log.info('No se pudo verificar puerto 9222');
    }

    log.success('Configuración del sistema completada');
  }

  // ===== INICIO DE CHROME OPTIMIZADO PARA LINUX =====
  
  async startChromeLinux() {
    try {
      log.info('Iniciando Chrome optimizado para Linux...');
      
      // Limpiar procesos anteriores
      await this.cleanupChromeProcesses();
      
      // Crear directorio temporal
      await execAsync('mkdir -p /tmp/chrome-debug-linux');
      
      // Construir comando de Chrome optimizado (sin duplicados)
      const chromeArgs = [
        '--remote-debugging-port=9222',
        '--user-data-dir=/tmp/chrome-debug-linux',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
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
        '--disable-setuid-sandbox',
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
      ];

      // Verificar que Chrome existe
      if (!this.chromePath) {
        log.error('Ruta de Chrome no configurada');
        return false;
      }

      // Verificar permisos de ejecución
      try {
        await execAsync(`test -x "${this.chromePath}"`);
      } catch (e) {
        log.error(`Chrome no tiene permisos de ejecución: ${this.chromePath}`);
        return false;
      }

      log.info('Lanzando Chrome con argumentos optimizados...');
      log.info(`Comando: ${this.chromePath} ${chromeArgs.slice(0, 5).join(' ')}...`);
      
      // Lanzar Chrome en background con mejor manejo de errores
      this.chromeProcess = spawn(this.chromePath, chromeArgs, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          DISPLAY: process.env.DISPLAY || ':0',
          CHROME_DEVEL_SANDBOX: '/usr/lib/chromium/chrome-sandbox'
        }
      });

      // Verificar que el proceso se inició correctamente
      if (!this.chromeProcess.pid) {
        log.error('No se pudo iniciar el proceso de Chrome');
        return false;
      }

      // Guardar PID
      await execAsync(`echo ${this.chromeProcess.pid} > /tmp/chrome-linux.pid`);
      
      log.info(`Chrome iniciado con PID: ${this.chromeProcess.pid}`);
      
      // Esperar un momento antes de verificar el puerto
      await this.wait(3000);
      
      // Esperar a que el puerto esté disponible
      return await this.waitForDebugPort();
      
    } catch (error) {
      log.error('Error al iniciar Chrome:', error.message);
      
      // Intentar obtener más información del error
      try {
        const { stdout: errorLog } = await execAsync('journalctl -u chrome --no-pager -n 10 2>/dev/null || echo "No logs disponibles"');
        log.info('Logs del sistema:', errorLog);
      } catch (e) {
        log.info('No se pudieron obtener logs del sistema');
      }
      
      return false;
    }
  }

  async cleanupChromeProcesses() {
    try {
      log.info('Limpiando procesos de Chrome anteriores...');
      
      // Matar procesos de Chrome
      await execAsync('pkill -f "google-chrome" 2>/dev/null || true');
      await execAsync('pkill -f "chromium" 2>/dev/null || true');
      await execAsync('pkill -f "chrome" 2>/dev/null || true');
      
      // Limpiar directorios temporales
      await execAsync('rm -rf /tmp/chrome-debug-linux 2>/dev/null || true');
      await execAsync('rm -f /tmp/chrome-linux.pid 2>/dev/null || true');
      
      // Esperar un momento
      await this.wait(2000);
      
      log.success('Limpieza completada');
    } catch (e) {
      log.info('Limpieza parcial completada');
    }
  }

  async waitForDebugPort() {
    log.info('Esperando puerto de debug de Chrome...');
    
    const maxAttempts = 30;
    const waitTime = 2000;
    
    for (let i = 0; i < maxAttempts; i++) {
      await this.wait(waitTime);
      log.info(`Intento ${i + 1}/${maxAttempts}...`);
      
      if (await this.checkDebugPort()) {
        log.success('Puerto de debug de Chrome disponible');
        return true;
      }
      
      // Verificar si el proceso sigue ejecutándose
      try {
        const { stdout: pidContent } = await execAsync('cat /tmp/chrome-linux.pid 2>/dev/null || echo ""');
        if (pidContent.trim()) {
          const pid = parseInt(pidContent.trim());
          const { stdout: processCheck } = await execAsync(`ps -p ${pid} -o pid= 2>/dev/null || echo ""`);
          if (!processCheck.trim()) {
            log.error('Proceso de Chrome terminado inesperadamente');
            return false;
          }
        }
      } catch (e) {
        log.error('No se pudo verificar proceso de Chrome');
        return false;
      }
      
      // Información de diagnóstico cada 5 intentos
      if (i % 5 === 0 && i > 0) {
        try {
          const { stdout: memInfo } = await execAsync('free -m | grep Mem');
          log.info('Uso de memoria:', memInfo);
          
          const { stdout: portInfo } = await execAsync('netstat -tlnp 2>/dev/null | grep :9222 || echo "Puerto 9222 no encontrado"');
          log.info('Estado del puerto 9222:', portInfo);
        } catch (e) {
          log.info('No se pudo obtener información de diagnóstico');
        }
      }
    }
    
    log.error(`Conexión de debug de Chrome falló después de ${maxAttempts} intentos`);
    return false;
  }

  async checkDebugPort() {
    try {
      const { stdout } = await execAsync('curl -s http://localhost:9222/json/version');
      return stdout.includes('Chrome') || stdout.includes('Chromium');
    } catch {
      return false;
    }
  }

  async connectToChrome() {
    try {
      log.info('Conectando a Chrome...');
      
      // Si ya tenemos un browser de Puppeteer, no necesitamos conectar
      if (this.browser && this.page) {
        log.success('Chrome ya está conectado via Puppeteer');
        return true;
      }
      
      const debugAvailable = await this.checkDebugPort();
      if (!debugAvailable) {
        log.error('Puerto de debug 9222 no disponible');
        log.info('Verificando estado del proceso de Chrome...');
        
        try {
          const { stdout: pidContent } = await execAsync('cat /tmp/chrome-linux.pid 2>/dev/null || echo ""');
          if (pidContent.trim()) {
            const pid = parseInt(pidContent.trim());
            const { stdout: processCheck } = await execAsync(`ps -p ${pid} -o pid= 2>/dev/null || echo ""`);
            if (processCheck.trim()) {
              log.info(`Proceso de Chrome ejecutándose con PID: ${pid}`);
              log.info('Esperando a que el puerto esté disponible...');
              await this.wait(5000);
              
              // Reintentar verificación del puerto
              if (await this.checkDebugPort()) {
                log.success('Puerto de debug ahora disponible');
              } else {
                log.error('Puerto de debug sigue sin estar disponible');
                log.info('Intentando método alternativo con Puppeteer...');
                return await this.startChromeWithPuppeteer();
              }
            } else {
              log.error('Proceso de Chrome no encontrado');
              log.info('Intentando método alternativo con Puppeteer...');
              return await this.startChromeWithPuppeteer();
            }
          } else {
            log.error('No se encontró PID de Chrome');
            log.info('Intentando método alternativo con Puppeteer...');
            return await this.startChromeWithPuppeteer();
          }
        } catch (e) {
          log.error('Error al verificar proceso de Chrome:', e.message);
          log.info('Intentando método alternativo con Puppeteer...');
          return await this.startChromeWithPuppeteer();
        }
      }
      
      // Intentar conexión con timeout extendido
      log.info('Iniciando conexión a Chrome...');
      
      try {
        this.browser = await puppeteer.connect({
          browserURL: 'http://localhost:9222',
          defaultViewport: null,
          protocolTimeout: 600000, // 10 minutos
          ignoreHTTPSErrors: true
        });
        
        // Verificar que la conexión fue exitosa
        const version = await this.browser.version();
        log.success(`Chrome conectado exitosamente - Versión: ${version}`);
        
        // Obtener páginas existentes o crear una nueva
        const pages = await this.browser.pages();
        this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
        
        // Configurar timeouts de la página
        this.page.setDefaultTimeout(60000);
        this.page.setDefaultNavigationTimeout(60000);
        
        log.success('Página configurada y lista para usar');
        return true;
        
      } catch (connectError) {
        log.error('Error al conectar a Chrome existente:', connectError.message);
        log.info('Intentando método alternativo con Puppeteer...');
        return await this.startChromeWithPuppeteer();
      }
      
    } catch (error) {
      log.error('Error de conexión a Chrome:', error.message);
      
      // Intentar obtener más información del error
      try {
        const { stdout: chromeLogs } = await execAsync('tail -n 20 /tmp/chrome-debug-linux/chrome_debug.log 2>/dev/null || echo "No logs disponibles"');
        log.info('Logs de Chrome:', chromeLogs);
      } catch (e) {
        log.info('No se pudieron obtener logs de Chrome');
      }
      
      log.info('Intentando método alternativo con Puppeteer...');
      return await this.startChromeWithPuppeteer();
    }
  }

  async ensureChromeRunning() {
    try {
      log.info('Verificando si Chrome está ejecutándose...');
      
      const debugPortAvailable = await this.checkDebugPort();
      if (debugPortAvailable) {
        log.success('Chrome ya está ejecutándose en modo debug');
        return true;
      }
      
      log.info('Chrome no está ejecutándose, iniciando proceso de inicialización...');
      
      // Detectar y seleccionar navegador
      log.info('Paso 1: Detectando navegador...');
      await this.selectBestBrowser();
      
      // Configurar sistema
      log.info('Paso 2: Configurando sistema...');
      await this.setupSystem();
      
      // Iniciar Chrome
      log.info('Paso 3: Iniciando Chrome...');
      const chromeStarted = await this.startChromeLinux();
      
      if (!chromeStarted) {
        log.error('Falló al iniciar Chrome');
        log.info('Intentando método alternativo...');
        
        // Método alternativo: usar Puppeteer directamente
        return await this.startChromeWithPuppeteer();
      }
      
      log.success('Chrome iniciado exitosamente');
      return true;
      
    } catch (error) {
      log.error('Error en ensureChromeRunning:', error.message);
      log.info('Intentando método alternativo con Puppeteer...');
      return await this.startChromeWithPuppeteer();
    }
  }

  async startChromeWithPuppeteer() {
    try {
      log.info('Iniciando Chrome usando Puppeteer directamente...');
      
      // Limpiar procesos anteriores
      await this.cleanupChromeProcesses();
      
      // Lanzar Chrome con Puppeteer (nuevo modo headless)
      this.browser = await puppeteer.launch({
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
      
      // Obtener página
      this.page = await this.browser.newPage();
      
      // Configurar timeouts
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);
      
      log.success('Chrome iniciado con Puppeteer exitosamente');
      return true;
      
    } catch (error) {
      log.error('Error al iniciar Chrome con Puppeteer:', error.message);
      return false;
    }
  }

  // ===== MÉTODOS DE SIMPLYCODES (IGUAL QUE EL ORIGINAL) =====
  
  async navigateToSimplyCodes() {
    log.info('Navegando a SimplyCodes...');
    
    await this.page.goto('https://simplycodes.com/editor/add/fitzgerald', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    log.success('Página cargada exitosamente');
    await this.wait(1000);
  }

  async fillCouponCode() {
    const codeInput = await this.page.$('input[name="code"]');
    if (!codeInput) {
      log.error('Campo de código no encontrado');
      return false;
    }
    log.success('Campo de código encontrado');
    await codeInput.type(this.coupon);
    log.info(`Código ingresado: ${this.coupon}`);
    await this.wait(2000);
    return true;
  }

  async clickContinueButton() {
    const selectors = [
      '#check-code',
      'span[class*="pointer"][id*="check"]',
      'span.gr8.fs15.pointer',
      'span:contains("Continue")'
    ];
    
    for (const selector of selectors) {
      const button = await this.page.$(selector);
      if (button) {
        log.success('Botón Continue encontrado');
        log.success(`Selector: ${selector}`);
        await button.click();
        log.info('Botón Continue clickeado');
        await this.wait(3000);
        return true;
      }
    }
    
    log.error('Botón Continue no encontrado');
    return false;
  }

  async selectDiscountType() {
    log.info('Seleccionando tipo de descuento...');
    
    const typeSelect = await this.page.$('select[name="type"]');
    if (!typeSelect) {
      log.error('Select de tipo de descuento no encontrado');
      return false;
    }
    
    log.success('Campo de tipo de descuento encontrado');
    
    await typeSelect.select('type-pct');
    log.info('Seleccionado: % Off');
    await this.wait(1000);
    
    const selectedValue = await typeSelect.evaluate(el => el.value);
    if (selectedValue === 'type-pct') {
      log.success('Tipo de descuento seleccionado');
      return true;
    } else {
      log.error('Error al seleccionar tipo de descuento');
      return false;
    }
  }

  async fillPercentageValue() {
    log.info('Ingresando porcentaje de descuento...');
    
    await this.wait(1000);
    
    const percentageInput = await this.page.$('#type-pct-input');
    if (!percentageInput) {
      log.error('Campo de porcentaje no encontrado');
      return false;
    }
    
    log.success('Campo de porcentaje encontrado');
    
    await percentageInput.click();
    await percentageInput.evaluate(el => el.value = '');
    await percentageInput.type(this.percentage);
    log.info(`Porcentaje ingresado: ${this.percentage}%`);
    await this.wait(1000);
    
    const inputValue = await percentageInput.evaluate(el => el.value);
    if (inputValue === this.percentage) {
      log.success('Porcentaje ingresado exitosamente');
      return true;
    } else {
      log.error('Error al ingresar porcentaje');
      return false;
    }
  }

  async selectWhatOption() {
    log.info('Seleccionando "On what?"...');
    
    const whatSelect = await this.page.$('select[name="what"]');
    if (!whatSelect) {
      log.error('Select "On what?" no encontrado');
      return false;
    }
    
    log.success('Campo "On what?" encontrado');
    
    await whatSelect.select('what-sw');
    log.info('Seleccionado: Store-wide deal');
    await this.wait(1000);
    
    const selectedValue = await whatSelect.evaluate(el => el.value);
    if (selectedValue === 'what-sw') {
      log.success('"On what?" seleccionado');
      return true;
    } else {
      log.error('Error al seleccionar "On what?"');
      return false;
    }
  }

  async selectRestrictions() {
    log.info('Seleccionando restricciones...');
    
    const restrictionsSelect = await this.page.$('select[name="restrictions"]');
    if (!restrictionsSelect) {
      log.error('Select de restricciones no encontrado');
      return false;
    }
    
    log.success('Campo de restricciones encontrado');
    
    await restrictionsSelect.select('restrictions-card');
    log.info('Seleccionado: Must use store credit card');
    await this.wait(1000);
    
    const selectedValue = await restrictionsSelect.evaluate(el => el.value);
    if (selectedValue === 'restrictions-card') {
      log.success('Restricciones seleccionadas');
      return true;
    } else {
      log.error('Error al seleccionar restricciones');
      return false;
    }
  }

  async uploadScreenshot(filePath = './cap-util.png') {
    log.info('Subiendo imagen de evidencia...');
    const absPath = resolve(filePath);
    const fileInput = await this.page.$('#screenshot-valid');
    if (!fileInput) {
      log.error('Campo de archivo no encontrado');
      return false;
    }
    await fileInput.uploadFile(absPath);
    log.success('Imagen subida exitosamente');
    log.success(`Ruta: ${absPath}`);
    await this.wait(1000);
    return true;
  }

  async clickFinalContinueButton() {
    log.info('Clickeando botón Continue final...');
    const continueBtn = await this.page.$('span.btn.btn--grey.btn--s1.preview-title.pointer');
    if (!continueBtn) {
      log.error('Botón Continue final no encontrado');
      return false;
    }
    await continueBtn.click();
    log.success('Continue final exitoso');
    await this.wait(2000);
    return true;
  }

  async checkFormResponse() {
    const codeInfoSection = await this.page.$('#code-info');
    if (!codeInfoSection) {
      log.error('Formulario de detalles no mostrado');
      return false;
    }
    
    log.success('Formulario de detalles mostrado');
    
    const codeExists = await this.page.$('#code-exists');
    if (codeExists) {
      const isVisible = await codeExists.evaluate(el => {
        return window.getComputedStyle(el).display !== 'none';
      });
      
      if (isVisible) {
        log.error('Este código ya existe en SimplyCodes');
        return false;
      }
    }
    
    log.success('Código nuevo, continuando...');
    return true;
  }

  async takeScreenshot() {
    await this.page.screenshot({ path: 'simplycodes-linux-test.png', fullPage: true });
    log.info('Screenshot guardado');
    log.info('simplycodes-linux-test.png');
  }

  async getPageInfo() {
    const pageInfo = await this.page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      formFields: Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
        name: el.name || el.id,
        type: el.type,
        disabled: el.disabled
      }))
    }));

    log.info('Información de la página:');
    log.info('Título: ' + pageInfo.title);
    log.info('URL: ' + pageInfo.url);
    log.info('Campos del formulario: ' + pageInfo.formFields.length); 
  }

  async clickSubmitButton() {
    log.info('Clickeando botón Submit final...');
    const submitBtn = await this.page.$('#submit');
    if (!submitBtn) {
      log.error('Botón Submit no encontrado');
      return false;
    }
    await this.page.evaluate(el => { el.style.display = 'inline-block'; }, submitBtn);
    await submitBtn.click();
    log.success('Botón Submit exitoso');
    await this.wait(2000);
    return true;
  }

  async codeExistsVisible() {
    const codeExists = await this.page.$('#code-exists');
    if (!codeExists) return false;
    const isVisible = await codeExists.evaluate(el => window.getComputedStyle(el).display !== 'none' && el.style.display === 'block');
    return isVisible;
  }

  async reloadPage() {
    log.info('Recargando página...');
    await this.page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await this.wait(1000);
  }

  // ===== MÉTODO PRINCIPAL =====
  
  async testPage() {
    log.info('Iniciando bot de cupones para Linux...');
    
    // Inicializar Chrome
    if (!await this.ensureChromeRunning() || !await this.connectToChrome()) {
      log.error('Falló la inicialización de Chrome');
      log.error('Abortando...');
      return;
    }

    try {
      while (this.keepRunning) {
        this.retryCount = 0;
        while (this.retryCount < this.maxRetries) {
          await this.navigateToSimplyCodes();
          
          let codeOk = await this.fillCouponCode();
          if (!codeOk) break;
          let continueOk = await this.clickContinueButton();
          if (!continueOk) break;

          await this.wait(2000);
          if (await this.codeExistsVisible()) {
            this.retryCount++;
            log.error('Código ya existe');
            log.error(`Reintentando... (${this.retryCount})`);
            await this.wait(60000);
            await this.reloadPage();
            continue;
          }

          if (await this.checkFormResponse()) {
            if (await this.selectDiscountType()) {
              if (await this.fillPercentageValue()) {
                if (await this.selectWhatOption()) {
                  if (await this.selectRestrictions()) {
                    if (await this.uploadScreenshot()) {
                      if (await this.clickFinalContinueButton()) {
                        await this.clickSubmitButton();
                        log.success('Cupón subido exitosamente');
                        log.success('Esperando 1 minuto...');
                        await this.wait(60000);
                        
                        await this.reloadPage();
                        await this.navigateToSimplyCodes();
                        await this.fillCouponCode();
                        await this.clickContinueButton();
                        await this.wait(2000);
                        
                        if (await this.codeExistsVisible()) {
                          log.error('Aún existe después de subir');
                          log.error('Reintentando...');
                          this.retryCount++;
                          await this.wait(60000);
                          await this.reloadPage();
                          continue;
                        } else {
                          this.successfulSubmissions++;
                          this.percentageIncrementCount++;
                          
                          log.success(`Cupón subido exitosamente!`);
                          log.success(`(${this.successfulSubmissions} veces)`);
                          
                          if (this.percentageIncrementCount >= 5) {
                            this.percentageIncrementCount = 0;
                            this.percentage = Math.min(35, this.percentage + 1);
                            if (this.percentage > 35) {
                              this.percentage = this.basePercentage;
                            }
                            log.info(`Nuevo descuento: ${this.percentage}%`);
                          }
                          
                          await this.wait(60000);
                          await this.reloadPage();
                          break;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          break;
        }
      }
      
      await this.takeScreenshot();
      await this.getPageInfo();
      
    } catch (error) {
      log.error('Error en prueba de página');
      log.error(`${error.message}`);
    }
  }

  // ===== UTILIDADES =====
  
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      log.info('Desconectando navegador...');
      await this.browser.disconnect();
    }
    
    // Mantener Chrome ejecutándose en Linux
    if (this.chromeProcess) {
      log.info('Manteniendo Chrome ejecutándose...');
      this.chromeProcess = null;
    }
    
    // Limpiar archivos temporales
    try {
      await execAsync('rm -f /tmp/chrome-linux.pid 2>/dev/null || true');
    } catch (e) {
      // Ignorar errores de limpieza
    }
  }
}

// Variable global para el tester
let globalTester = null;

// Manejador de señales
process.on('SIGINT', async () => {
  log.info('Recibido SIGINT, limpiando...');
  if (globalTester) {
    await globalTester.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.info('Recibido SIGTERM, limpiando...');
  if (globalTester) {
    await globalTester.close();
  }
  process.exit(0);
});

// Ejecutar el test
async function runTest() {
  console.clear();
  log.info('#########################################');
  log.info('#  BOT DE CUPONES - SIMPLYCODES LINUX  #');
  log.info('#########################################'); 
  
  let coupon = process.env.COUPON;
  let percentage = process.env.PERCENTAGE;
  let answers;
  
  if (coupon && percentage) {
    answers = { coupon, percentage };
  } else {
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'coupon',
        message: 'Ingresa el código de cupón a subir:',
        default: '',
        validate: v => v.trim() !== ''
      },
      {
        type: 'input',
        name: 'percentage',
        message: 'Ingresa el porcentaje de descuento (solo números):',
        default: '25',
        validate: v => /^\d+$/.test(v)
      }
    ]);
  }
  
  globalTester = new SimplyCodesLinuxTester(answers.coupon, answers.percentage);
  
  try {
    await globalTester.testPage();
  } catch (error) {
    log.error('Error en el test');
    log.error(`${error.message}`);
  } finally {
    await globalTester.close();
  }
}

runTest();