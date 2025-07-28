import puppeteer from 'puppeteer';
import chalk from 'chalk';

const log = {
  info: (msg) => console.log(chalk.blue.bold(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green.bold(`[SUCCESS] ${msg}`)),
  error: (msg) => console.log(chalk.red.bold(`[ERROR] ${msg}`)),
  warning: (msg) => console.log(chalk.yellow.bold(`[WARNING] ${msg}`)),
};

class SimplyCodesLoginBot {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    try {
      log.info('Iniciando navegador Chrome...');
      
      this.browser = await puppeteer.launch({
        headless: false, // Mostrar el navegador
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Configurar viewport
      await this.page.setViewport({ width: 1366, height: 768 });
      
      log.success('Navegador iniciado correctamente');
      
    } catch (error) {
      log.error(`Error al iniciar el navegador: ${error.message}`);
      throw error;
    }
  }

  async navigateToLoginPage() {
    try {
      const url = 'https://simplycodes.com/login?redirect=/editor/add/fitzgerald';
      
      log.info(`Navegando a: ${url}`);
      
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      log.success('Página cargada correctamente');
      
      // Tomar una captura de pantalla
      await this.page.screenshot({ 
        path: 'simplycodes-login.png',
        fullPage: true 
      });
      
      log.info('Captura de pantalla guardada como: simplycodes-login.png');
      
    } catch (error) {
      log.error(`Error al navegar a la página: ${error.message}`);
      throw error;
    }
  }

  async waitForUser() {
    log.info('Bot pausado. Presiona Ctrl+C para cerrar el navegador.');
    
    // Mantener el navegador abierto hasta que el usuario lo cierre
    process.on('SIGINT', async () => {
      log.info('Cerrando navegador...');
      await this.close();
      process.exit(0);
    });
    
    // Mantener el proceso vivo
    await new Promise(() => {});
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      log.success('Navegador cerrado');
    }
  }
}

async function main() {
  const bot = new SimplyCodesLoginBot();
  
  try {
    await bot.init();
    await bot.navigateToLoginPage();
    await bot.waitForUser();
  } catch (error) {
    log.error(`Error en el bot: ${error.message}`);
    await bot.close();
    process.exit(1);
  }
}

// Ejecutar el bot
main().catch(console.error); 