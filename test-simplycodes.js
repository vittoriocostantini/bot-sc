import puppeteer from 'puppeteer';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import { spawn } from 'child_process';

const execAsync = promisify(exec);

const log = {
  info: (msg) => console.log(chalk.hex('#FFFFFF').bgBlack.bold(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green.bold.bgBlack(`[SUCCESS] ${msg}`)),
  error: (msg) => console.log(chalk.red.bold.bgBlack(`[ERROR] ${msg}`)),
};

class SimplyCodesTester {
  constructor(coupon, percentage) {
    this.browser = null;
    this.page = null;
    this.retryCount = 0;
    this.maxRetries = Infinity;
    this.coupon = coupon;
    this.percentage = percentage;
    this.basePercentage = percentage; // Guardar el porcentaje base
    this.keepRunning = true;
    this.successfulSubmissions = 0; // Contador de subidas exitosas
    this.percentageIncrementCount = 0; // Contador para incrementar porcentaje
  }

  // ===== MÉTODOS DE CONEXIÓN =====
  
  async checkChromeRunning() {
    try {
      let cmd;
      if (process.platform === 'darwin') {
        cmd = 'ps aux | grep -i "Google Chrome" | grep -v grep';
      } else if (process.platform === 'linux') {
        // Busca chrome, google-chrome o chromium
        cmd = 'ps aux | grep -E "(chrome|google-chrome|chromium)" | grep -v grep';
      } else {
        cmd = 'ps aux | grep -i "chrome" | grep -v grep';
      }
      const { stdout } = await execAsync(cmd);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async checkDebugPort() {
    try {
      const { stdout } = await execAsync('curl -s http://localhost:9222/json/version');
      return stdout.includes('Chrome');
    } catch {
      return false;
    }
  }

  async getChromeCommand() {
    if (process.env.CHROME_PATH) {
      // Verificar que el comando personalizado existe
      try {
        await execAsync(`which ${process.env.CHROME_PATH}`);
        return process.env.CHROME_PATH;
      } catch (e) {
        log.error(`Chrome path not found: ${process.env.CHROME_PATH}`);
      }
    }
    
    if (process.platform === 'darwin') {
      // Usar 'open' para macOS
      return 'open -a "Google Chrome" --args';
    } else if (process.platform === 'linux') {
      // En Linux, probar diferentes nombres de Chrome/Chromium
      const possibleCommands = [
        'google-chrome',
        'google-chrome-stable',
        'chromium',
        'chromium-browser',
        'chrome'
      ];
      
      // Retornar el primer comando disponible
      for (const cmd of possibleCommands) {
        try {
          await execAsync(`which ${cmd}`);
          log.info(`|    Found Chrome: ${cmd} |`);
          return cmd;
        } catch (e) {
          // Continuar con el siguiente comando
        }
      }
      
      // Si no se encuentra ninguno, mostrar error
      log.error('No Chrome/Chromium installation found');
      log.error('Please install Google Chrome or Chromium');
      throw new Error('Chrome not found');
    } else {
      throw new Error('Unsupported OS for Chrome automation');
    }
  }

  async startChromeWithDebugging() {
    try {
      log.info('|    Chrome Debug Mode Starting...    |');
      
      // Limpiar directorio temporal de Chrome si existe
      try {
        await execAsync('rm -rf /tmp/chrome-debug');
        log.info('|    Cleaned Chrome debug directory |');
      } catch (e) {
        // Ignorar errores si el directorio no existe
      }
      
      // En Linux, intentar primero conectar a una instancia existente
      if (process.platform === 'linux') {
        log.info('|    Checking for existing Chrome... |');
        const isRunning = await this.checkChromeRunning();
        if (isRunning) {
          log.info('|    Chrome is running, trying to connect... |');
          // Intentar conectar sin cerrar Chrome
          const connected = await this.connectToChrome();
          if (connected) {
            log.success('|    Connected to existing Chrome! |');
            return true;
          }
          log.info('|    Could not connect to existing Chrome, will try to restart... |');
        }
      }
      
      // Cerrar Chrome existente solo si es necesario
      if (process.platform === 'darwin') {
        await execAsync('pkill -f "Google Chrome"');
      } else if (process.platform === 'linux') {
        // En Linux, usar killall para asegurar que se cierre completamente
        try {
          await execAsync('killall chrome');
          await execAsync('killall google-chrome');
          await execAsync('killall chromium');
          await execAsync('killall chromium-browser');
        } catch (e) {
          // Ignorar errores si no hay procesos para matar
        }
      }
      
      await this.wait(3000); // Esperar a que se cierre completamente
      
      // Iniciar Chrome con debugging
      const chromeCmd = await this.getChromeCommand();
      
      if (process.platform === 'darwin') {
        const launchCmd = `${chromeCmd} --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug --no-sandbox --disable-gpu`;
        exec(launchCmd);
      } else {
        // En Linux, usar spawn con opciones mínimas para antiX
        const chromeArgs = [
          '--remote-debugging-port=9222',
          '--user-data-dir=/tmp/chrome-debug',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-software-rasterizer',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
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
        
        log.info(`|    Starting Chrome with: ${chromeCmd} |`);
        
        this.chromeProcess = spawn(chromeCmd, chromeArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
          env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
        });
        
        // Manejar eventos del proceso
        this.chromeProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('DevTools listening')) {
            log.success('|    Chrome DevTools started! |');
          }
          process.stdout.write(data);
        });
        
        this.chromeProcess.stderr.on('data', (data) => {
          const output = data.toString();
          // Filtrar mensajes de error comunes que no son críticos
          if (!output.includes('Failed to connect to session bus') && 
              !output.includes('Could not connect to accessibility bus') &&
              !output.includes('Gtk-Message')) {
            process.stderr.write(data);
          }
        });
        
        this.chromeProcess.on('error', (error) => {
          log.error('Chrome process error:', error.message);
        });
        
        this.chromeProcess.on('exit', (code) => {
          if (code !== 0) {
            log.error(`Chrome process exited with code: ${code}`);
          }
        });
      }
      
      // Esperar a que Chrome se inicie
      const success = await this.waitForDebugPort();
      
      // Si falla con spawn, intentar con exec como fallback
      if (!success && process.platform === 'linux') {
        log.info('|    Trying alternative Chrome launch method... |');
        return await this.startChromeWithExec();
      }
      
      return success;
    } catch (error) {
      log.error('Chrome startup error:', error.message);
      return false;
    }
  }
  
  async startChromeWithExec() {
    try {
      log.info('|    Trying Chrome with exec method... |');
      
      const chromeCmd = await this.getChromeCommand();
      const launchCmd = `${chromeCmd} --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-web-security --disable-extensions --disable-plugins --disable-default-apps --disable-sync --disable-translate --disable-logging --disable-background-networking --disable-component-update --disable-client-side-phishing-detection --disable-hang-monitor --disable-prompt-on-repost --disable-domain-reliability --disable-features=AudioServiceOutOfProcess --memory-pressure-off --max_old_space_size=4096 > /dev/null 2>&1 &`;
      
      await execAsync(launchCmd);
      log.info('|    Chrome launched with exec method |');
      
      // Esperar a que se inicie
      return await this.waitForDebugPort();
    } catch (error) {
      log.error('Chrome exec method failed:', error.message);
      return false;
    }
  }

  async waitForDebugPort() {
    log.info('|    Waiting for Chrome debug port... |');
    
    // En antiX, puede tomar más tiempo
    const maxAttempts = process.platform === 'linux' ? 25 : 15;
    const waitTime = process.platform === 'linux' ? 3000 : 2000;
    
    for (let i = 0; i < maxAttempts; i++) {
      await this.wait(waitTime);
      log.info(`|    Attempt ${i + 1}/${maxAttempts}... |`);
      
      if (await this.checkDebugPort()) {
        log.success('|   Chrome Debug Connected    |');
        return true;
      }
      
      // Verificar si el proceso de Chrome sigue ejecutándose
      if (this.chromeProcess) {
        try {
          const { stdout } = await execAsync(`ps -p ${this.chromeProcess.pid} -o pid=`);
          if (!stdout.trim()) {
            log.error('Chrome process died unexpectedly');
            return false;
          }
        } catch (e) {
          log.error('Chrome process not found');
          return false;
        }
      }
      
      // En Linux, verificar si hay errores específicos
      if (process.platform === 'linux' && i > 10) {
        try {
          const { stdout } = await execAsync('dmesg | tail -5 | grep -i chrome || echo "No Chrome errors in dmesg"');
          if (!stdout.includes('No Chrome errors')) {
            log.info('Chrome errors in dmesg:', stdout);
          }
        } catch (e) {
          // Ignorar errores de dmesg
        }
      }
    }
    
    log.error(`Chrome debug connection failed after ${maxAttempts} attempts`);
    
    // Intentar obtener información de diagnóstico
    try {
      const { stdout } = await execAsync('netstat -tlnp 2>/dev/null | grep :9222 || echo "Port 9222 not found"');
      log.info('Port 9222 status:', stdout);
      
      // Verificar procesos de Chrome
      const { stdout: chromeProcs } = await execAsync('ps aux | grep -E "(chrome|chromium)" | grep -v grep || echo "No Chrome processes"');
      log.info('Chrome processes:', chromeProcs);
      
      // Verificar uso de memoria
      const { stdout: memInfo } = await execAsync('free -h || echo "Memory info not available"');
      log.info('Memory usage:', memInfo);
    } catch (e) {
      log.error('Could not get diagnostic information');
    }
    
    return false;
  }

  async connectToChrome() {
    try {
      log.info('|    Connecting to Chrome...   |');
      
      // Verificar que el puerto esté disponible antes de conectar
      const debugAvailable = await this.checkDebugPort();
      if (!debugAvailable) {
        log.error('Debug port 9222 not available');
        return false;
      }
      
      this.browser = await puppeteer.connect({
        browserURL: 'http://localhost:9222',
        defaultViewport: null,
        protocolTimeout: 300000 // 5 minutos
      });
      
      const pages = await this.browser.pages();
      this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
      
      log.success('|   Chrome Connected          |');
      return true;
    } catch (error) {
      log.error('Chrome connection error:', error.message);
      log.error('Error details:', error.stack);
      
      // Intentar obtener más información sobre el estado del puerto
      try {
        const { stdout } = await execAsync('curl -s http://localhost:9222/json/version');
        log.info('Debug port response:', stdout);
      } catch (curlError) {
        log.error('Debug port not responding to curl');
      }
      
      return false;
    }
  }

  async ensureChromeRunning() {
    const debugPortAvailable = await this.checkDebugPort();
    if (debugPortAvailable) {
      log.success('Chrome is already running in debug mode');
      return true;
    }
    
    // En Linux, intentar conectar a Chrome existente sin cerrarlo
    if (process.platform === 'linux') {
      const isRunning = await this.checkChromeRunning();
      if (isRunning) {
        log.info('Chrome is running but debug port not available');
        log.info('Attempting to connect to existing Chrome...');
        
        // Intentar conectar directamente
        try {
          const connected = await this.connectToChrome();
          if (connected) {
            log.success('Successfully connected to existing Chrome!');
            return true;
          }
        } catch (error) {
          log.info('Could not connect to existing Chrome, will restart...');
        }
      } else {
        log.info('Chrome is not running');
      }
    } else {
      // En macOS, comportamiento original
      const isRunning = await this.checkChromeRunning();
      if (isRunning) {
        log.info('Chrome is running but debug port not available');
      } else {
        log.info('Chrome is not running');
      }
    }
    
    return await this.startChromeWithDebugging();
  }

  // ===== MÉTODOS DE SIMPLYCODES =====
  
  async navigateToSimplyCodes() {
    log.info('|   Navigating to ########...      |');
    
    await this.page.goto('https://simplycodes.com/editor/add/fitzgerald', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    log.success('|   Page Loaded Successfully  |');
    await this.wait(1000);
  }

  async fillCouponCode() {
    const codeInput = await this.page.$('input[name="code"]');
    if (!codeInput) {
      log.error('Code input field not found');
      return false;
    }
    log.success('|   Code Input Field Found    |');
    await codeInput.type(this.coupon);
    log.info(`Code entered: ${this.coupon}`);
    await this.wait(2000);
    return true;
  }

  async clickContinueButton() {
    // Intentar múltiples selectores para el botón Continue
    const selectors = [
      '#check-code',
      'span[class*="pointer"][id*="check"]',
      'span.gr8.fs15.pointer',
      'span:contains("Continue")'
    ];
    
    for (const selector of selectors) {
      const button = await this.page.$(selector);
      if (button) {
        log.success(`|   Continue Button Found     |`);
        log.success(`|   Selector: ${selector}     |`);
        await button.click();
        log.info('Continue button clicked');
        await this.wait(3000);
        return true;
      }
    }
    
    log.error('Continue button not found');
    return false;
  }

  async selectDiscountType() {
    log.info('|   Selecting Discount Type...        |');
    
    // Buscar el select de tipo de descuento
    const typeSelect = await this.page.$('select[name="type"]');
    if (!typeSelect) {
      log.error('Discount type select not found');
      return false;
    }
    
    log.success('|   Discount Type Field Found |');
    
    // Seleccionar "% Off"
    await typeSelect.select('type-pct');
    log.info('Selected: % Off');
    await this.wait(1000);
    
    // Verificar que se seleccionó correctamente
    const selectedValue = await typeSelect.evaluate(el => el.value);
    if (selectedValue === 'type-pct') {
      log.success('|   Discount Type Selected     |');
      return true;
    } else {
      log.error('Error selecting discount type');
      return false;
    }
  }

  async fillPercentageValue() {
    log.info('|   Entering Discount Percentage...  |');
    
    // Esperar a que aparezca el campo de porcentaje
    await this.wait(1000);
    
    // Buscar el campo de porcentaje
    const percentageInput = await this.page.$('#type-pct-input');
    if (!percentageInput) {
      log.error('Percentage input field not found');
      return false;
    }
    
    log.success('|   Percentage Field Found     |');
    
    // Limpiar el campo y escribir el valor
    await percentageInput.click();
    await percentageInput.evaluate(el => el.value = '');
    await percentageInput.type(this.percentage);
    log.info(`Percentage entered: ${this.percentage}%`);
    await this.wait(1000);
    
    // Verificar que se escribió correctamente
    const inputValue = await percentageInput.evaluate(el => el.value);
    if (inputValue === this.percentage) {
      log.success('|   Percentage Entered Success |');
      return true;
    } else {
      log.error('Error entering percentage');
      return false;
    }
  }

  async selectWhatOption() {
    log.info('|   Selecting "On what?"...          |');
    
    // Buscar el select "On what?"
    const whatSelect = await this.page.$('select[name="what"]');
    if (!whatSelect) {
      log.error('"On what?" select not found');
      return false;
    }
    
    log.success('|   "On what?" Field Found    |');
    
    // Seleccionar "Store-wide deal"
    await whatSelect.select('what-sw');
    log.info('Selected: Store-wide deal');
    await this.wait(1000);
    
    // Verificar que se seleccionó correctamente
    const selectedValue = await whatSelect.evaluate(el => el.value);
    if (selectedValue === 'what-sw') {
      log.success('|   "On what?" Selected       |');
      return true;
    } else {
      log.error('Error selecting "On what?"');
      return false;
    }
  }

  async selectRestrictions() {
    log.info('|   Selecting Restrictions...         |');
    
    // Buscar el select de restricciones
    const restrictionsSelect = await this.page.$('select[name="restrictions"]');
    if (!restrictionsSelect) {
      log.error('Restrictions select not found');
      return false;
    }
    
    log.success('|   Restrictions Field Found  |');
    
    // Seleccionar "Must use store credit card"
    await restrictionsSelect.select('restrictions-card');
    log.info('Selected: Must use store credit card');
    await this.wait(1000);
    
    // Verificar que se seleccionó correctamente
    const selectedValue = await restrictionsSelect.evaluate(el => el.value);
    if (selectedValue === 'restrictions-card') {
      log.success('|   Restrictions Selected      |');
      return true;
    } else {
      log.error('Error selecting restrictions');
      return false;
    }
  }

  async uploadScreenshot(filePath = './cap-util.png') {
    log.info('|   Uploading Evidence Image...       |');
    const absPath = resolve(filePath);
    const fileInput = await this.page.$('#screenshot-valid');
    if (!fileInput) {
      log.error('File input field not found');
      return false;
    }
    await fileInput.uploadFile(absPath);
    log.success('|   Image Upload Success      |');
    log.success(`|   Path: ${absPath}          |`);
    await this.wait(1000);
    return true;
  }

  async clickFinalContinueButton() {
    log.info('|   Clicking Final Continue Button... |');
    const continueBtn = await this.page.$('span.btn.btn--grey.btn--s1.preview-title.pointer');
    if (!continueBtn) {
      log.error('Final Continue button not found');
      return false;
    }
    await continueBtn.click();
    log.success('|   Final Continue Success    |');
    await this.wait(2000);
    return true;
  }

  async checkFormResponse() {
    const codeInfoSection = await this.page.$('#code-info');
    if (!codeInfoSection) {
      log.error('Details form not displayed');
      return false;
    }
    
    log.success('|   Details Form Displayed    |');
    
    // Verificar si el código ya existe
    const codeExists = await this.page.$('#code-exists');
    if (codeExists) {
      const isVisible = await codeExists.evaluate(el => {
        return window.getComputedStyle(el).display !== 'none';
      });
      
      if (isVisible) {
        log.error('This code already exists in SimplyCodes');
        return false;
      }
    }
    
    log.success('|   New Code, Continuing...   |');
    return true;
  }

  async takeScreenshot() {
    await this.page.screenshot({ path: 'simplycodes-test.png', fullPage: true });
    log.info('|   Screenshot Saved          |');
    log.info('|   simplycodes-test.png      |');
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

    log.info('|   Page Information:         |');
    log.info('|   Title: ' + pageInfo.title);
    log.info('|   URL: ' + pageInfo.url);
    log.info('|   Form Fields: ' + pageInfo.formFields.length); 
  }

  async clickSubmitButton() {
    log.info('|   Clicking Final Submit Button...   |');
    const submitBtn = await this.page.$('#submit');
    if (!submitBtn) {
      log.error('Submit button not found');
      return false;
    }
    // Forzar el display si está oculto
    await this.page.evaluate(el => { el.style.display = 'inline-block'; }, submitBtn);
    await submitBtn.click();
    log.success('|   Submit Button Success     |');
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
    log.info('|   Reloading Page...         |');
    await this.page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await this.wait(1000);
  }

  // ===== MÉTODO PRINCIPAL =====
  
  async checkSystemRequirements() {
    log.info('|   Checking system requirements...   |');
    
    // Verificar que Chrome esté instalado
    try {
      await this.getChromeCommand();
    } catch (error) {
      log.error('|   Chrome not found on system    |');
      log.error('|   Please install Google Chrome  |');
      return false;
    }
    
    // Verificar permisos de escritura en /tmp
    try {
      await execAsync('touch /tmp/chrome-debug-test');
      await execAsync('rm /tmp/chrome-debug-test');
    } catch (error) {
      log.error('|   No write permission in /tmp   |');
      return false;
    }
    
    // Verificar recursos del sistema en Linux
    if (process.platform === 'linux') {
      try {
        // Verificar memoria disponible
        const { stdout: memInfo } = await execAsync('free -m');
        const memLines = memInfo.split('\n');
        const memLine = memLines[1]; // Línea de memoria total
        const memValues = memLine.split(/\s+/);
        const totalMem = parseInt(memValues[1]);
        const availableMem = parseInt(memValues[6]);
        
        log.info(`|   Total RAM: ${totalMem}MB |`);
        log.info(`|   Available RAM: ${availableMem}MB |`);
        
        if (availableMem < 512) {
          log.error('|   Insufficient memory (< 512MB) |');
          log.error('|   Chrome may not start properly |');
        }
        
        // Verificar espacio en disco
        const { stdout: diskInfo } = await execAsync('df /tmp -h');
        log.info('|   Disk space for /tmp:', diskInfo.split('\n')[1]);
        
      } catch (error) {
        log.info('|   Could not check system resources |');
      }
    }
    
    log.success('|   System requirements OK      |');
    return true;
  }
  
  async testPage() {
    log.info('|   Checking Chrome...                |');
    
    // Verificar requisitos del sistema
    if (!await this.checkSystemRequirements()) {
      log.error('|   System requirements failed |');
      log.error('|   Aborting...                |');
      return;
    }
    
    // Inicializar Chrome
    if (!await this.ensureChromeRunning() || !await this.connectToChrome()) {
      log.error('|   Chrome Initialization Failed |');
      log.error('|   Aborting...                |');
      return;
    }

    try {
      while (this.keepRunning) {
        this.retryCount = 0;
        while (this.retryCount < this.maxRetries) {
          // Navegar y probar SimplyCodes
          await this.navigateToSimplyCodes();
          
          let codeOk = await this.fillCouponCode();
          if (!codeOk) break;
          let continueOk = await this.clickContinueButton();
          if (!continueOk) break;

          // Esperar a que se procese el código y aparezca el mensaje si existe
          await this.wait(2000);
          if (await this.codeExistsVisible()) {
            this.retryCount++;
            log.error('|   Code Already Exists       |');
            log.error(`|   Retrying... (${this.retryCount}) |`);
            await this.wait(60000);
            await this.reloadPage();
            continue;
          }

          // Si no existe, continuar flujo normal
          if (await this.checkFormResponse()) {
            if (await this.selectDiscountType()) {
              if (await this.fillPercentageValue()) {
                if (await this.selectWhatOption()) {
                  if (await this.selectRestrictions()) {
                    if (await this.uploadScreenshot()) {
                      if (await this.clickFinalContinueButton()) {
                        await this.clickSubmitButton();
                        log.success('|   Coupon Upload Success      |');
                        log.success('|   Waiting 1 minute...        |');
                        await this.wait(60000);
                        
                        // Verificar si el cupón existe después de subirlo
                        await this.reloadPage();
                        await this.navigateToSimplyCodes();
                        await this.fillCouponCode();
                        await this.clickContinueButton();
                        await this.wait(2000);
                        
                        if (await this.codeExistsVisible()) {
                          log.error('|   Still Exists After Upload |');
                          log.error('|   Retrying...               |');
                          this.retryCount++;
                          await this.wait(60000);
                          await this.reloadPage();
                          continue;
                        } else {
                          // Cupón subido exitosamente y no existe después de 1 minuto
                          this.successfulSubmissions++;
                          this.percentageIncrementCount++;
                          
                          log.success(`|   Coupon Upload Success!     |`);
                          log.success(`|   (${this.successfulSubmissions} times)        |`);
                          
                          // Incrementar porcentaje cada 5 subidas exitosas
                          if (this.percentageIncrementCount >= 5) {
                            this.percentageIncrementCount = 0;
                            this.percentage = Math.min(35, this.percentage + 1);
                            if (this.percentage > 35) {
                              this.percentage = this.basePercentage; // Volver al porcentaje base
                            }
                            log.info(`|   New Discount: ${this.percentage}%        |`);
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
      
      // Capturar información
      await this.takeScreenshot();
      await this.getPageInfo();
      
    } catch (error) {
      log.error('|   Page Test Error           |');
      log.error(`|   ${error.message}          |`);
    }
  }

  // ===== UTILIDADES =====
  
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      log.info('|   Disconnecting Browser...   |');
      await this.browser.disconnect();
    }
    
    // En Linux, no cerrar Chrome al finalizar para mantener la instancia
    if (process.platform === 'linux' && this.chromeProcess) {
      log.info('|   Keeping Chrome running...  |');
      // No matar el proceso, solo desconectarlo
      this.chromeProcess = null;
    }
  }
}

// Variable global para el tester
let globalTester = null;

// Manejador de señales para cerrar Chrome correctamente
process.on('SIGINT', async () => {
  log.info('|   Received SIGINT, cleaning up... |');
  if (globalTester) {
    await globalTester.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.info('|   Received SIGTERM, cleaning up... |');
  if (globalTester) {
    await globalTester.close();
  }
  process.exit(0);
});

// Ejecutar el test
async function runTest() {
  console.clear();
  log.info('|   #################################   |');
  log.info('|   #  BOT DE CUPONES - SIMPLYCODES  #   |');
  log.info('|   #################################   |'); 
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
        message: 'Enter coupon code to upload:',
        default: '',
        validate: v => v.trim() !== ''
      },
      {
        type: 'input',
        name: 'percentage',
        message: 'Enter discount percentage (numbers only):',
        default: '25',
        validate: v => /^\\d+$/.test(v)
      }
    ]);
  }
  globalTester = new SimplyCodesTester(answers.coupon, answers.percentage);
  try {
    await globalTester.testPage();
  } catch (error) {
    log.error('|   Test Error                |');
    log.error(`|   ${error.message}          |`);
  } finally {
    await globalTester.close();
  }
}

runTest(); 