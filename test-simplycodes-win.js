const puppeteer = require('puppeteer');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { exec } = require('child_process');
const { promisify } = require('util');
const { resolve } = require('path');

const execAsync = promisify(exec);

const log = {
  info: (msg) => console.log(chalk.hex('#FFFFFF').bgBlack.bold(msg)),
  success: (msg) => console.log(chalk.green.bold.bgBlack(msg)),
  error: (msg) => console.log(chalk.red.bold.bgBlack(msg)),
};

class SimplyCodesTester {
  constructor(coupon, percentage) {
    this.browser = null;
    this.page = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.coupon = coupon;
    this.percentage = percentage;
    this.keepRunning = true;
  }

  async ensureChromeRunning() {
    // En Windows, asumimos que Chrome está abierto con debugging en 9222
    return true;
  }

  async connectToChrome() {
    try {
      log.info('Conectando a Chrome...');
      this.browser = await puppeteer.connect({
        browserURL: 'http://localhost:9222',
        defaultViewport: null,
        protocolTimeout: 120000
      });
      const pages = await this.browser.pages();
      this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
      log.success('Conectado a Chrome');
      return true;
    } catch (error) {
      log.error('Error conectando a Chrome: ' + error.message);
      return false;
    }
  }

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
    log.info(`Código escrito: ${this.coupon}`);
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
        log.success(`Botón Continue encontrado con selector: ${selector}`);
        await button.click();
        log.info('Clic en Continue');
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
    log.success('Select de tipo de descuento encontrado');
    await typeSelect.select('type-pct');
    log.info('Seleccionado: % Off');
    await this.wait(1000);
    const selectedValue = await typeSelect.evaluate(el => el.value);
    if (selectedValue === 'type-pct') {
      log.success('Tipo de descuento seleccionado correctamente');
      return true;
    } else {
      log.error('Error al seleccionar tipo de descuento');
      return false;
    }
  }

  async fillPercentageValue() {
    log.info('Llenando valor de porcentaje...');
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
    log.info(`Porcentaje escrito: ${this.percentage}%`);
    await this.wait(1000);
    const inputValue = await percentageInput.evaluate(el => el.value);
    if (inputValue === this.percentage) {
      log.success('Porcentaje escrito correctamente');
      return true;
    } else {
      log.error('Error al escribir porcentaje');
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
    log.success('Select "On what?" encontrado');
    await whatSelect.select('what-sw');
    log.info('Seleccionado: Store-wide deal');
    await this.wait(1000);
    const selectedValue = await whatSelect.evaluate(el => el.value);
    if (selectedValue === 'what-sw') {
      log.success('"On what?" seleccionado correctamente');
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
    log.success('Select de restricciones encontrado');
    await restrictionsSelect.select('restrictions-card');
    log.info('Seleccionado: Must use store credit card');
    await this.wait(1000);
    const selectedValue = await restrictionsSelect.evaluate(el => el.value);
    if (selectedValue === 'restrictions-card') {
      log.success('Restricciones seleccionadas correctamente');
      return true;
    } else {
      log.error('Error al seleccionar restricciones');
      return false;
    }
  }

  async uploadScreenshot(filePath = '.\\cap-util.png') {
    log.info('Subiendo imagen de evidencia...');
    const absPath = resolve(filePath);
    const fileInput = await this.page.$('#screenshot-valid');
    if (!fileInput) {
      log.error('Input de archivo no encontrado');
      return false;
    }
    await fileInput.uploadFile(absPath);
    log.success('Imagen subida correctamente: ' + absPath);
    await this.wait(1000);
    return true;
  }

  async clickFinalContinueButton() {
    log.info('Pulsando botón Continue final...');
    const continueBtn = await this.page.$('span.btn.btn--grey.btn--s1.preview-title.pointer');
    if (!continueBtn) {
      log.error('Botón Continue final no encontrado');
      return false;
    }
    await continueBtn.click();
    log.success('Botón Continue final pulsado');
    await this.wait(2000);
    return true;
  }

  async checkFormResponse() {
    const codeInfoSection = await this.page.$('#code-info');
    if (!codeInfoSection) {
      log.error('No apareció el formulario de detalles');
      return false;
    }
    log.success('Formulario de detalles apareció');
    const codeExists = await this.page.$('#code-exists');
    if (codeExists) {
      const isVisible = await codeExists.evaluate(el => window.getComputedStyle(el).display !== 'none' && el.style.display === 'block');
      if (isVisible) {
        log.error('El código ya existe en SimplyCodes');
        return false;
      }
    }
    log.success('Código nuevo, continuando...');
    return true;
  }

  async takeScreenshot() {
    await this.page.screenshot({ path: 'simplycodes-test.png', fullPage: true });
    log.info('Screenshot guardado como simplycodes-test.png');
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
    log.info('Pulsando botón Submit final...');
    const submitBtn = await this.page.$('#submit');
    if (!submitBtn) {
      log.error('Botón Submit no encontrado');
      return false;
    }
    await this.page.evaluate(el => { el.style.display = 'inline-block'; }, submitBtn);
    await submitBtn.click();
    log.success('Botón Submit pulsado');
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
    log.info('Recargando la página...');
    await this.page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await this.wait(1000);
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testPage() {
    log.info('Verificando Chrome...');
    if (!await this.ensureChromeRunning() || !await this.connectToChrome()) {
      log.error('No se pudo inicializar Chrome. Abortando...');
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
            log.error('El código ya existe. Reintentando en 1 minuto... (Intento ' + this.retryCount + ')');
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
                        log.success('Cupón subido correctamente. Esperando 1 minuto para volver a intentar...');
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
          break;
        }
      }
    } catch (error) {
      log.error('Error probando la página: ' + error.message);
    }
  }

  async close() {
    if (this.browser) {
      log.info('Desconectando del navegador...');
      await this.browser.disconnect();
    }
  }
}

async function runTest() {
  console.clear();
  log.info('BOT DE CUPONES - SIMPLYCODES (Windows)');
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'coupon',
      message: 'Ingresa el código de cupón a subir:',
      default: 'TALKFHEA02247164242',
      validate: v => v.trim() !== ''
    },
    {
      type: 'input',
      name: 'percentage',
      message: 'Ingresa el porcentaje de descuento (solo número):',
      default: '25',
      validate: v => /^\d+$/.test(v)
    }
  ]);
  const tester = new SimplyCodesTester(answers.coupon, answers.percentage);
  try {
    await tester.testPage();
  } catch (error) {
    log.error('Error en el test: ' + error.message);
  } finally {
    await tester.close();
  }
}

runTest(); 