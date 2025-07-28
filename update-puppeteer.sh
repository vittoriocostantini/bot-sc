#!/bin/bash

# Script para actualizar Puppeteer y solucionar advertencias de deprecación

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

print_info "=== ACTUALIZACIÓN DE PUPPETEER ==="

# Verificar si estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    print_error "No se encontró package.json en el directorio actual"
    print_info "Asegúrate de estar en el directorio del proyecto"
    exit 1
fi

# Verificar versión actual de Puppeteer
print_info "1. Verificando versión actual de Puppeteer..."
CURRENT_VERSION=$(npm list puppeteer 2>/dev/null | grep puppeteer || echo "No instalado")

if [[ $CURRENT_VERSION == *"No instalado"* ]]; then
    print_warning "Puppeteer no está instalado"
    print_info "Instalando Puppeteer..."
    npm install puppeteer
else
    print_info "Versión actual: $CURRENT_VERSION"
fi

# Verificar versión de Node.js
print_info "2. Verificando versión de Node.js..."
NODE_VERSION=$(node --version)
print_info "Node.js: $NODE_VERSION"

# Verificar versión de npm
print_info "3. Verificando versión de npm..."
NPM_VERSION=$(npm --version)
print_info "npm: $NPM_VERSION"

# Actualizar Puppeteer
print_info "4. Actualizando Puppeteer..."
print_info "Esto puede tomar unos minutos..."

# Hacer backup del package.json
cp package.json package.json.backup
print_info "Backup creado: package.json.backup"

# Actualizar Puppeteer
npm update puppeteer

# Verificar la nueva versión
print_info "5. Verificando nueva versión..."
NEW_VERSION=$(npm list puppeteer | grep puppeteer)
print_success "Nueva versión: $NEW_VERSION"

# Verificar si la actualización fue exitosa
if [[ $NEW_VERSION == *"puppeteer@"* ]]; then
    print_success "✓ Puppeteer actualizado exitosamente"
else
    print_error "✗ Error al actualizar Puppeteer"
    print_info "Restaurando backup..."
    cp package.json.backup package.json
    exit 1
fi

# Verificar dependencias
print_info "6. Verificando dependencias..."
npm install

# Verificar si hay conflictos
print_info "7. Verificando conflictos de dependencias..."
npm audit --audit-level=moderate || print_warning "Se encontraron problemas de seguridad menores"

# Limpiar cache de npm
print_info "8. Limpiando cache de npm..."
npm cache clean --force

# Verificar que todo funciona
print_info "9. Verificando que Puppeteer funciona..."
node -e "
const puppeteer = require('puppeteer');
console.log('✓ Puppeteer cargado correctamente');
console.log('✓ Versión:', require('puppeteer/package.json').version);
" || print_error "Error al cargar Puppeteer"

# Información final
print_success "=== ACTUALIZACIÓN COMPLETADA ==="
print_info "Ahora puedes ejecutar el bot sin advertencias de deprecación:"
print_info "node test-simplycodes-linux.js"
print_info ""
print_info "O probar Chrome simple:"
print_info "node test-chrome-simple.js"
print_info ""
print_info "Para verificar la versión:"
print_info "node check-puppeteer-version.js" 