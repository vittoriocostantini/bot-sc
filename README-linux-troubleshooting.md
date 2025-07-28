# Solución de Problemas de Chrome en Linux

Este documento te ayudará a solucionar los problemas de conexión a Chrome en el bot de cupones para Linux.

## 🔍 Diagnóstico Rápido

Antes de empezar, ejecuta el script de diagnóstico para identificar problemas específicos:

```bash
node chrome-diagnostic-linux.js
```

Este script verificará:
- ✅ Instalación de Chrome/Chromium
- ✅ Dependencias del sistema
- ✅ Configuración de display
- ✅ Permisos del sistema
- ✅ Puertos disponibles
- ✅ Capacidad de lanzar Chrome

## 🚀 Instalación Automática

Si Chrome no está instalado, usa el script de instalación automática:

```bash
./install-chrome-linux.sh
```

Este script:
- Detecta tu distribución de Linux
- Instala Google Chrome o Chromium
- Instala Xvfb para modo headless
- Verifica la instalación

## 🔧 Problemas Comunes y Soluciones

### 1. "No se encontraron navegadores Chrome/Chromium"

**Síntomas:**
```
[ERROR] No se encontraron navegadores Chrome/Chromium
```

**Solución:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install google-chrome-stable

# CentOS/RHEL
sudo yum install google-chrome-stable

# Arch Linux
sudo pacman -S google-chrome

# Alternativa: Chromium
sudo apt install chromium-browser  # Ubuntu/Debian
sudo yum install chromium          # CentOS/RHEL
sudo pacman -S chromium           # Arch
```

### 2. "Error de conexión a Chrome"

**Síntomas:**
```
[ERROR] Error de conexión a Chrome: timeout
[ERROR] Puerto de debug 9222 no disponible
```

**Soluciones:**

#### A. Limpiar procesos anteriores
```bash
# Matar todos los procesos de Chrome
pkill -f "google-chrome"
pkill -f "chromium"
pkill -f "chrome"

# Limpiar directorios temporales
rm -rf /tmp/chrome-debug-linux
rm -f /tmp/chrome-linux.pid
```

#### B. Verificar puerto 9222
```bash
# Verificar si el puerto está en uso
netstat -tlnp | grep :9222

# Si está en uso, matar el proceso
sudo lsof -ti:9222 | xargs kill -9
```

#### C. Configurar display virtual
```bash
# Instalar Xvfb
sudo apt install xvfb  # Ubuntu/Debian
sudo yum install xorg-x11-server-Xvfb  # CentOS/RHEL
sudo pacman -S xorg-server-xvfb  # Arch

# Iniciar display virtual
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99
```

### 3. "Sin permisos de escritura en /tmp"

**Síntomas:**
```
[ERROR] Sin permisos de escritura en /tmp
```

**Solución:**
```bash
# Verificar permisos
ls -la /tmp

# Corregir permisos si es necesario
sudo chmod 1777 /tmp

# Verificar espacio disponible
df /tmp -h
```

### 4. "Proceso de Chrome terminado inesperadamente"

**Síntomas:**
```
[ERROR] Proceso de Chrome terminado inesperadamente
```

**Soluciones:**

#### A. Verificar memoria disponible
```bash
free -h
```

Si hay menos de 1GB disponible:
```bash
# Limpiar memoria cache
sudo sync && sudo echo 3 > /proc/sys/vm/drop_caches
```

#### B. Verificar librerías faltantes
```bash
# Verificar librerías de Chrome
ldd $(which google-chrome) | grep "not found"

# Instalar librerías faltantes
sudo apt install libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2
```

### 5. "Variable DISPLAY no configurada"

**Síntomas:**
```
[WARNING] Variable DISPLAY no configurada
```

**Solución:**
```bash
# Configurar display
export DISPLAY=:0

# O usar display virtual
export DISPLAY=:99
```

## 🛠️ Configuración Avanzada

### Modo Headless (Sin Interfaz Gráfica)

Para servidores sin interfaz gráfica:

```bash
# Instalar Xvfb
sudo apt install xvfb

# Iniciar display virtual
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99

# Ejecutar el bot
node test-simplycodes-linux.js
```

### Configuración de Memoria

Si tienes problemas de memoria:

```bash
# Aumentar swap si es necesario
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Hacer permanente
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Configuración de Firewall

Si tienes problemas de conectividad:

```bash
# Permitir puerto 9222
sudo ufw allow 9222

# O para iptables
sudo iptables -A INPUT -p tcp --dport 9222 -j ACCEPT
```

## 📋 Checklist de Verificación

Antes de ejecutar el bot, verifica:

- [ ] Chrome/Chromium instalado: `google-chrome --version`
- [ ] Permisos de /tmp: `touch /tmp/test && rm /tmp/test`
- [ ] Puerto 9222 libre: `netstat -tlnp | grep :9222`
- [ ] Memoria disponible: `free -h`
- [ ] Display configurado: `echo $DISPLAY`
- [ ] Dependencias instaladas: `which curl ps netstat`

## 🚨 Comandos de Emergencia

Si el bot se queda colgado:

```bash
# Matar todos los procesos de Chrome
pkill -f "chrome"

# Limpiar archivos temporales
rm -rf /tmp/chrome-debug-linux
rm -f /tmp/chrome-linux.pid

# Reiniciar display si es necesario
pkill Xvfb
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99
```

## 📞 Obtener Ayuda

Si los problemas persisten:

1. Ejecuta el diagnóstico: `node chrome-diagnostic-linux.js`
2. Revisa los logs del sistema: `journalctl -u chrome --no-pager -n 20`
3. Verifica la versión de Node.js: `node --version`
4. Verifica la versión de npm: `npm --version`

## 🔄 Reinstalación Completa

Si todo falla, reinstala todo:

```bash
# Desinstalar Chrome
sudo apt remove google-chrome-stable  # Ubuntu/Debian
sudo yum remove google-chrome-stable  # CentOS/RHEL
sudo pacman -R google-chrome         # Arch

# Limpiar archivos residuales
rm -rf ~/.config/google-chrome
rm -rf /tmp/chrome-debug-linux

# Reinstalar usando el script
./install-chrome-linux.sh
```

## 📝 Notas Importantes

- El bot funciona mejor con al menos 1GB de RAM disponible
- En modo headless, asegúrate de que Xvfb esté ejecutándose
- El puerto 9222 debe estar libre antes de ejecutar el bot
- Los archivos temporales se guardan en `/tmp/chrome-debug-linux`
- El bot mantiene Chrome ejecutándose para mejor rendimiento 