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

class ChromeDiagnostic {
  constructor() {
    this.chromePath = null;
  }

  async runDiagnostic() {
    console.clear();
    log.info('==========================================');
    log.info('  DIAGNÓSTICO DE CHROME PARA LINUX');
    log.info('==========================================');
    
    await this.checkSystemInfo();
    await this.checkChromeInstallation();
    await this.checkDependencies();
    await this.checkDisplay();
    await this.checkPermissions();
    await this.checkPorts();
    await this.testChromeLaunch();
    
    log.info('==========================================');
    log.info('  DIAGNÓSTICO COMPLETADO');
    log.info('==========================================');
  }

  async checkSystemInfo() {
    log.info('1. INFORMACIÓN DEL SISTEMA');
    log.info('---------------------------');
    
    try {
      const { stdout: osInfo } = await execAsync('cat /etc/os-release | grep PRETTY_NAME');
      log.info(`Sistema operativo: ${osInfo.split('=')[1].replace(/"/g, '')}`);
    } catch (e) {
      log.warning('No se pudo obtener información del sistema operativo');
    }

    try {
      const { stdout: kernelInfo } = await execAsync('uname -r');
      log.info(`Kernel: ${kernelInfo.trim()}`);
    } catch (e) {
      log.warning('No se pudo obtener información del kernel');
    }

    try {
      const { stdout: archInfo } = await execAsync('uname -m');
      log.info(`Arquitectura: ${archInfo.trim()}`);
    } catch (e) {
      log.warning('No se pudo obtener información de arquitectura');
    }
  }

  async checkChromeInstallation() {
    log.info('2. INSTALACIÓN DE CHROME');
    log.info('-------------------------');
    
    const possibleBrowsers = [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
      'chrome'
    ];

    let found = false;
    
    for (const browser of possibleBrowsers) {
      try {
        const { stdout } = await execAsync(`which ${browser}`);
        if (stdout.trim()) {
          this.chromePath = stdout.trim();
          log.success(`✓ ${browser} encontrado en: ${stdout.trim()}`);
          
          // Verificar versión
          try {
            const { stdout: version } = await execAsync(`${stdout.trim()} --version`);
            log.info(`  Versión: ${version.trim()}`);
          } catch (e) {
            log.warning(`  No se pudo obtener versión de ${browser}`);
          }
          
          // Verificar permisos
          try {
            await execAsync(`test -x "${stdout.trim()}"`);
            log.success(`  ✓ Permisos de ejecución OK`);
          } catch (e) {
            log.error(`  ✗ Sin permisos de ejecución`);
          }
          
          found = true;
          break;
        }
      } catch (e) {
        // Browser no encontrado
      }
    }

    if (!found) {
      log.error('✗ No se encontró Chrome/Chromium instalado');
      log.info('Instalar con:');
      log.info('  Ubuntu/Debian: sudo apt install google-chrome-stable');
      log.info('  CentOS/RHEL: sudo yum install google-chrome-stable');
      log.info('  Arch: sudo pacman -S google-chrome');
      log.info('  Chromium: sudo apt install chromium-browser');
    }
  }

  async checkDependencies() {
    log.info('3. DEPENDENCIAS NECESARIAS');
    log.info('----------------------------');
    
    const dependencies = [
      'curl', 'ps', 'netstat', 'free', 'which', 'test',
      'pkill', 'mkdir', 'rm', 'cat', 'echo'
    ];

    for (const dep of dependencies) {
      try {
        await execAsync(`which ${dep}`);
        log.success(`✓ ${dep} disponible`);
      } catch (e) {
        log.error(`✗ ${dep} no encontrado`);
      }
    }

    // Verificar librerías de Chrome
    if (this.chromePath) {
      log.info('Verificando librerías de Chrome...');
      try {
        const { stdout: lddOutput } = await execAsync(`ldd "${this.chromePath}" | grep "not found"`);
        if (lddOutput.trim()) {
          log.error('Librerías faltantes:');
          log.error(lddOutput);
        } else {
          log.success('✓ Todas las librerías de Chrome disponibles');
        }
      } catch (e) {
        log.success('✓ Librerías de Chrome OK');
      }
    }
  }

  async checkDisplay() {
    log.info('4. CONFIGURACIÓN DE DISPLAY');
    log.info('----------------------------');
    
    const display = process.env.DISPLAY;
    if (display) {
      log.info(`DISPLAY configurado: ${display}`);
    } else {
      log.warning('Variable DISPLAY no configurada');
    }

    // Verificar si Xvfb está disponible
    try {
      const { stdout: xvfbCheck } = await execAsync('which Xvfb');
      log.success('✓ Xvfb disponible para modo headless');
    } catch (e) {
      log.warning('⚠ Xvfb no encontrado (necesario para modo headless)');
    }

    // Verificar si xdpyinfo está disponible
    try {
      const { stdout: xdpyinfoCheck } = await execAsync('which xdpyinfo');
      log.success('✓ xdpyinfo disponible');
    } catch (e) {
      log.warning('⚠ xdpyinfo no encontrado');
    }
  }

  async checkPermissions() {
    log.info('5. PERMISOS DEL SISTEMA');
    log.info('-------------------------');
    
    // Verificar permisos de /tmp
    try {
      await execAsync('touch /tmp/chrome-diagnostic-test');
      await execAsync('rm /tmp/chrome-diagnostic-test');
      log.success('✓ Permisos de escritura en /tmp OK');
    } catch (e) {
      log.error('✗ Sin permisos de escritura en /tmp');
    }

    // Verificar permisos de /dev/shm
    try {
      await execAsync('touch /dev/shm/chrome-diagnostic-test');
      await execAsync('rm /dev/shm/chrome-diagnostic-test');
      log.success('✓ Permisos de escritura en /dev/shm OK');
    } catch (e) {
      log.warning('⚠ Sin permisos de escritura en /dev/shm');
    }

    // Verificar si podemos crear procesos
    try {
      const { stdout: processTest } = await execAsync('echo "test"');
      log.success('✓ Permisos de proceso OK');
    } catch (e) {
      log.error('✗ Problemas con permisos de proceso');
    }
  }

  async checkPorts() {
    log.info('6. PUERTOS Y CONECTIVIDAD');
    log.info('---------------------------');
    
    // Verificar puerto 9222
    try {
      const { stdout: portCheck } = await execAsync('netstat -tlnp 2>/dev/null | grep :9222 || echo "Puerto libre"');
      if (portCheck.includes('9222')) {
        log.warning('⚠ Puerto 9222 ya está en uso');
        log.info(portCheck);
      } else {
        log.success('✓ Puerto 9222 libre');
      }
    } catch (e) {
      log.info('No se pudo verificar puerto 9222');
    }

    // Verificar conectividad local
    try {
      await execAsync('curl -s http://localhost:9222/json/version > /dev/null');
      log.warning('⚠ Puerto 9222 responde (Chrome ya ejecutándose?)');
    } catch (e) {
      log.success('✓ Puerto 9222 no responde (libre para uso)');
    }
  }

  async testChromeLaunch() {
    log.info('7. PRUEBA DE LANZAMIENTO DE CHROME');
    log.info('-----------------------------------');
    
    if (!this.chromePath) {
      log.error('✗ No se puede probar Chrome (no encontrado)');
      return;
    }

    log.info('Intentando lanzar Chrome en modo debug...');
    
    try {
      // Crear directorio temporal
      await execAsync('mkdir -p /tmp/chrome-test');
      
      // Lanzar Chrome con argumentos mínimos
      const chromeArgs = [
        '--remote-debugging-port=9223',
        '--user-data-dir=/tmp/chrome-test',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--headless',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps',
        '--no-first-run',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows'
      ];

      const { spawn } = await import('child_process');
      const chromeProcess = spawn(this.chromePath, chromeArgs, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
      });

      log.info(`Chrome iniciado con PID: ${chromeProcess.pid}`);
      
      // Esperar un momento
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verificar si el proceso sigue ejecutándose
      try {
        const { stdout: processCheck } = await execAsync(`ps -p ${chromeProcess.pid} -o pid=`);
        if (processCheck.trim()) {
          log.success('✓ Chrome se inició correctamente');
          
          // Verificar puerto de debug
          try {
            const { stdout: debugCheck } = await execAsync('curl -s http://localhost:9223/json/version');
            if (debugCheck.includes('Chrome') || debugCheck.includes('Chromium')) {
              log.success('✓ Puerto de debug 9223 responde correctamente');
            } else {
              log.warning('⚠ Puerto de debug no responde como esperado');
            }
          } catch (e) {
            log.warning('⚠ Puerto de debug 9223 no responde');
          }
          
          // Terminar proceso de prueba
          await execAsync(`kill ${chromeProcess.pid}`);
          log.info('Proceso de prueba terminado');
        } else {
          log.error('✗ Chrome se cerró inesperadamente');
        }
      } catch (e) {
        log.error('✗ No se pudo verificar proceso de Chrome');
      }
      
      // Limpiar
      await execAsync('rm -rf /tmp/chrome-test');
      
    } catch (error) {
      log.error('✗ Error al lanzar Chrome:', error.message);
    }
  }
}

// Ejecutar diagnóstico
async function runDiagnostic() {
  const diagnostic = new ChromeDiagnostic();
  await diagnostic.runDiagnostic();
}

runDiagnostic().catch(console.error); 