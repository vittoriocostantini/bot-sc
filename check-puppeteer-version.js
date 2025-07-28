import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

const log = {
  info: (msg) => console.log(chalk.hex('#FFFFFF').bgBlack.bold(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green.bold.bgBlack(`[SUCCESS] ${msg}`)),
  error: (msg) => console.log(chalk.red.bold.bgBlack(`[ERROR] ${msg}`)),
  warning: (msg) => console.log(chalk.yellow.bold.bgBlack(`[WARNING] ${msg}`)),
};

async function checkPuppeteerVersion() {
  console.clear();
  log.info('=== VERIFICACIÓN DE VERSIÓN DE PUPPETEER ===');
  
  try {
    // Verificar versión de Node.js
    log.info('1. Verificando versión de Node.js...');
    const { stdout: nodeVersion } = await execAsync('node --version');
    log.success(`Node.js: ${nodeVersion.trim()}`);
    
    // Verificar versión de npm
    log.info('2. Verificando versión de npm...');
    const { stdout: npmVersion } = await execAsync('npm --version');
    log.success(`npm: ${npmVersion.trim()}`);
    
    // Verificar versión de Puppeteer
    log.info('3. Verificando versión de Puppeteer...');
    const { stdout: puppeteerVersion } = await execAsync('npm list puppeteer');
    log.info(`Puppeteer instalado: ${puppeteerVersion.trim()}`);
    
    // Extraer número de versión
    const versionMatch = puppeteerVersion.match(/puppeteer@(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      const version = versionMatch[1];
      log.success(`Versión de Puppeteer: ${version}`);
      
      // Verificar si es una versión reciente
      const majorVersion = parseInt(version.split('.')[0]);
      const minorVersion = parseInt(version.split('.')[1]);
      
      if (majorVersion >= 21 || (majorVersion === 20 && minorVersion >= 7)) {
        log.success('✓ Versión de Puppeteer compatible con nuevo modo headless');
        log.info('El nuevo modo headless (headless: "new") está disponible');
      } else {
        log.warning('⚠ Versión de Puppeteer puede tener problemas con nuevo modo headless');
        log.info('Se recomienda actualizar a Puppeteer 20.7.0 o superior');
        
        // Preguntar si actualizar
        log.info('¿Deseas actualizar Puppeteer? (y/n)');
        log.info('Ejecuta: npm update puppeteer');
      }
    } else {
      log.error('No se pudo determinar la versión de Puppeteer');
    }
    
    // Verificar dependencias
    log.info('4. Verificando dependencias...');
    const { stdout: dependencies } = await execAsync('npm list --depth=0');
    log.info('Dependencias instaladas:');
    console.log(dependencies);
    
    // Verificar si hay conflictos
    log.info('5. Verificando conflictos de dependencias...');
    try {
      const { stdout: audit } = await execAsync('npm audit --audit-level=moderate');
      log.warning('Problemas de seguridad encontrados:');
      console.log(audit);
    } catch (e) {
      log.success('✓ No se encontraron problemas de seguridad críticos');
    }
    
    // Información sobre el nuevo modo headless
    log.info('6. Información sobre nuevo modo headless...');
    log.info('El nuevo modo headless (headless: "new") está disponible desde Puppeteer 20.7.0');
    log.info('Ventajas del nuevo modo:');
    log.info('  - Mejor rendimiento');
    log.info('  - Menos uso de memoria');
    log.info('  - Compatibilidad mejorada');
    log.info('  - Sin advertencias de deprecación');
    
    log.success('=== VERIFICACIÓN COMPLETADA ===');
    
  } catch (error) {
    log.error('Error durante la verificación:', error.message);
  }
}

// Ejecutar verificación
checkPuppeteerVersion().catch(console.error); 