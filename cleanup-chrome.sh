#!/bin/bash

# Script de limpieza para Chrome en Linux
# Elimina todos los procesos y archivos temporales

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info "=== LIMPIEZA DE CHROME ==="

# 1. Matar todos los procesos de Chrome
print_info "1. Matando procesos de Chrome..."

# Matar procesos de Chrome
pkill -f "google-chrome" 2>/dev/null || print_warning "No se encontraron procesos de google-chrome"
pkill -f "chromium" 2>/dev/null || print_warning "No se encontraron procesos de chromium"
pkill -f "chrome" 2>/dev/null || print_warning "No se encontraron procesos de chrome"

# Matar procesos de Xvfb
pkill -f "Xvfb" 2>/dev/null || print_warning "No se encontraron procesos de Xvfb"

# Esperar un momento para que los procesos se cierren
sleep 2

# Verificar si quedaron procesos
CHROME_PROCESSES=$(ps aux | grep -i chrome | grep -v grep | wc -l)
if [ $CHROME_PROCESSES -gt 0 ]; then
    print_warning "Quedaron $CHROME_PROCESSES procesos de Chrome"
    ps aux | grep -i chrome | grep -v grep
    print_info "Forzando cierre de procesos restantes..."
    pkill -9 -f "chrome" 2>/dev/null || true
else
    print_success "Todos los procesos de Chrome terminados"
fi

# 2. Limpiar archivos temporales
print_info "2. Limpiando archivos temporales..."

# Eliminar directorios temporales de Chrome
rm -rf /tmp/chrome-debug-linux 2>/dev/null || print_warning "No se pudo eliminar /tmp/chrome-debug-linux"
rm -rf /tmp/chrome-test 2>/dev/null || print_warning "No se pudo eliminar /tmp/chrome-test"
rm -rf /tmp/.org.chromium.Chromium.* 2>/dev/null || print_warning "No se pudo eliminar archivos de Chromium"

# Eliminar archivos PID
rm -f /tmp/chrome-linux.pid 2>/dev/null || print_warning "No se pudo eliminar /tmp/chrome-linux.pid"
rm -f /tmp/chrome-*.pid 2>/dev/null || print_warning "No se pudo eliminar archivos PID de Chrome"

# Limpiar archivos de usuario de Chrome
rm -rf ~/.config/google-chrome/Default/Cache 2>/dev/null || print_warning "No se pudo limpiar cache de Chrome"
rm -rf ~/.config/chromium/Default/Cache 2>/dev/null || print_warning "No se pudo limpiar cache de Chromium"

# 3. Verificar puertos
print_info "3. Verificando puertos..."

# Verificar puerto 9222
PORT_9222=$(netstat -tlnp 2>/dev/null | grep :9222 || echo "Puerto 9222 libre")
if [[ $PORT_9222 == *"9222"* ]]; then
    print_warning "Puerto 9222 aún en uso:"
    echo "$PORT_9222"
    print_info "Intentando liberar puerto 9222..."
    sudo lsof -ti:9222 | xargs kill -9 2>/dev/null || print_warning "No se pudo liberar puerto 9222"
else
    print_success "Puerto 9222 libre"
fi

# Verificar puerto 9223
PORT_9223=$(netstat -tlnp 2>/dev/null | grep :9223 || echo "Puerto 9223 libre")
if [[ $PORT_9223 == *"9223"* ]]; then
    print_warning "Puerto 9223 aún en uso:"
    echo "$PORT_9223"
    print_info "Intentando liberar puerto 9223..."
    sudo lsof -ti:9223 | xargs kill -9 2>/dev/null || print_warning "No se pudo liberar puerto 9223"
else
    print_success "Puerto 9223 libre"
fi

# 4. Limpiar memoria cache
print_info "4. Limpiando memoria cache..."

# Limpiar cache del sistema
sudo sync 2>/dev/null || print_warning "No se pudo sincronizar"
echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null 2>&1 || print_warning "No se pudo limpiar cache del sistema"

# 5. Verificar espacio en disco
print_info "5. Verificando espacio en disco..."

# Verificar espacio en /tmp
TMP_SPACE=$(df /tmp -h | tail -1 | awk '{print $4}')
print_info "Espacio disponible en /tmp: $TMP_SPACE"

# Verificar espacio en /dev/shm
if [ -d "/dev/shm" ]; then
    SHM_SPACE=$(df /dev/shm -h | tail -1 | awk '{print $4}')
    print_info "Espacio disponible en /dev/shm: $SHM_SPACE"
else
    print_warning "/dev/shm no disponible"
fi

# 6. Verificar permisos
print_info "6. Verificando permisos..."

# Verificar permisos de /tmp
if [ -w "/tmp" ]; then
    print_success "Permisos de escritura en /tmp OK"
else
    print_error "Sin permisos de escritura en /tmp"
fi

# Verificar permisos de /dev/shm
if [ -w "/dev/shm" ]; then
    print_success "Permisos de escritura en /dev/shm OK"
else
    print_warning "Sin permisos de escritura en /dev/shm"
fi

# 7. Información final
print_info "7. Información del sistema..."

# Memoria disponible
MEMORY=$(free -h | grep Mem | awk '{print "Total: " $2 ", Usado: " $3 ", Libre: " $4}')
print_info "Memoria: $MEMORY"

# Procesos activos
ACTIVE_PROCESSES=$(ps aux | wc -l)
print_info "Procesos activos: $ACTIVE_PROCESSES"

# 8. Resumen
print_success "=== LIMPIEZA COMPLETADA ==="
print_info "Ahora puedes ejecutar el bot:"
print_info "node test-simplycodes-linux.js"
print_info ""
print_info "O probar Chrome simple:"
print_info "node test-chrome-simple.js" 