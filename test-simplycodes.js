import puppeteer from 'puppeteer';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';

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
      const { stdout } = await execAsync('ps aux | grep -i "Google Chrome" | grep -v grep');
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

  async startChromeWithDebugging() {
    try {
      log.info('|    Chrome Debug Mode Starting...    |');
      
      // Cerrar Chrome existente
      await execAsync('pkill -f "Google Chrome"');
      await this.wait(2000);
      
      // Iniciar Chrome con debugging
      exec('/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug &');
      
      // Esperar a que Chrome se inicie
      return await this.waitForDebugPort();
    } catch (error) {
      log.error('Chrome startup error:', error.message);
      return false;
    }
  }

  async waitForDebugPort() {
    for (let i = 0; i < 10; i++) {
      await this.wait(1000);
      if (await this.checkDebugPort()) {
        log.success('|   Chrome Debug Connected    |');
        return true;
      }
    }
    log.error('Chrome debug connection failed');
    return false;
  }

  async connectToChrome() {
    try {
      log.info('|    Connecting to Chrome...   |');
      
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
      return false;
    }
  }

  async ensureChromeRunning() {
    const isRunning = await this.checkChromeRunning();
    const debugPortAvailable = await this.checkDebugPort();
    
    if (!isRunning) {
      log.info('Chrome is not running');
      return await this.startChromeWithDebugging();
    } else if (!debugPortAvailable) {
      log.info('Chrome is running but debug port not available');
      return await this.startChromeWithDebugging();
    } else {
      log.success('Chrome is already running in debug mode');
      return true;
    }
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
  
  async testPage() {
    log.info('|   Checking Chrome...                |');
    
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
  }
}

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
  const tester = new SimplyCodesTester(answers.coupon, answers.percentage);
  try {
    await tester.testPage();
  } catch (error) {
    log.error('|   Test Error                |');
    log.error(`|   ${error.message}          |`);
  } finally {
    await tester.close();
  }
}

runTest(); 