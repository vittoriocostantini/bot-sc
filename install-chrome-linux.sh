#!/bin/bash

# Script de instalación de Chrome para Linux
# Compatible con Ubuntu, Debian, CentOS, RHEL, Arch Linux

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

# Detectar distribución de Linux
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION=$VERSION_ID
    else
        print_error "No se pudo detectar la distribución de Linux"
        exit 1
    fi
}

# Verificar si Chrome ya está instalado
check_chrome_installed() {
    if command -v google-chrome >/dev/null 2>&1; then
        print_success "Google Chrome ya está instalado"
        google-chrome --version
        return 0
    elif command -v chromium-browser >/dev/null 2>&1; then
        print_success "Chromium ya está instalado"
        chromium-browser --version
        return 0
    else
        return 1
    fi
}

# Instalar dependencias para Ubuntu/Debian
install_ubuntu_deps() {
    print_info "Instalando dependencias para Ubuntu/Debian..."
    sudo apt update
    sudo apt install -y wget curl gnupg2 software-properties-common
}

# Instalar dependencias para CentOS/RHEL
install_centos_deps() {
    print_info "Instalando dependencias para CentOS/RHEL..."
    sudo yum install -y wget curl
}

# Instalar dependencias para Arch Linux
install_arch_deps() {
    print_info "Instalando dependencias para Arch Linux..."
    sudo pacman -Sy --noconfirm wget curl
}

# Instalar Google Chrome en Ubuntu/Debian
install_chrome_ubuntu() {
    print_info "Instalando Google Chrome en Ubuntu/Debian..."
    
    # Descargar e instalar la clave GPG
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
    
    # Agregar el repositorio de Google Chrome
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
    
    # Actualizar e instalar
    sudo apt update
    sudo apt install -y google-chrome-stable
    
    print_success "Google Chrome instalado exitosamente"
}

# Instalar Google Chrome en CentOS/RHEL
install_chrome_centos() {
    print_info "Instalando Google Chrome en CentOS/RHEL..."
    
    # Crear archivo de repositorio
    sudo tee /etc/yum.repos.d/google-chrome.repo << EOF
[google-chrome]
name=google-chrome
baseurl=http://dl.google.com/linux/chrome/rpm/stable/x86_64
enabled=1
gpgcheck=1
gpgkey=https://dl.google.com/linux/linux_signing_key.pub
EOF
    
    # Instalar
    sudo yum install -y google-chrome-stable
    
    print_success "Google Chrome instalado exitosamente"
}

# Instalar Google Chrome en Arch Linux
install_chrome_arch() {
    print_info "Instalando Google Chrome en Arch Linux..."
    
    # Instalar desde AUR usando yay (si está disponible)
    if command -v yay >/dev/null 2>&1; then
        yay -S --noconfirm google-chrome
    else
        print_warning "yay no está instalado. Instalando Chromium como alternativa..."
        sudo pacman -S --noconfirm chromium
    fi
    
    print_success "Navegador instalado exitosamente"
}

# Instalar Chromium como alternativa
install_chromium() {
    print_info "Instalando Chromium como alternativa..."
    
    case $DISTRO in
        ubuntu|debian)
            sudo apt install -y chromium-browser
            ;;
        centos|rhel|fedora)
            sudo yum install -y chromium
            ;;
        arch)
            sudo pacman -S --noconfirm chromium
            ;;
        *)
            print_error "Distribución no soportada para Chromium"
            return 1
            ;;
    esac
    
    print_success "Chromium instalado exitosamente"
}

# Instalar Xvfb para modo headless
install_xvfb() {
    print_info "Instalando Xvfb para modo headless..."
    
    case $DISTRO in
        ubuntu|debian)
            sudo apt install -y xvfb
            ;;
        centos|rhel|fedora)
            sudo yum install -y xorg-x11-server-Xvfb
            ;;
        arch)
            sudo pacman -S --noconfirm xorg-server-xvfb
            ;;
        *)
            print_warning "No se pudo instalar Xvfb en esta distribución"
            return 1
            ;;
    esac
    
    print_success "Xvfb instalado exitosamente"
}

# Verificar instalación
verify_installation() {
    print_info "Verificando instalación..."
    
    if command -v google-chrome >/dev/null 2>&1; then
        print_success "Google Chrome instalado correctamente"
        google-chrome --version
        return 0
    elif command -v chromium-browser >/dev/null 2>&1; then
        print_success "Chromium instalado correctamente"
        chromium-browser --version
        return 0
    elif command -v chromium >/dev/null 2>&1; then
        print_success "Chromium instalado correctamente"
        chromium --version
        return 0
    else
        print_error "No se pudo verificar la instalación"
        return 1
    fi
}

# Función principal
main() {
    print_info "=== Instalador de Chrome para Linux ==="
    
    # Detectar distribución
    detect_distro
    print_info "Distribución detectada: $DISTRO $VERSION"
    
    # Verificar si ya está instalado
    if check_chrome_installed; then
        print_success "Chrome ya está instalado. No es necesario instalar."
        exit 0
    fi
    
    # Instalar dependencias según la distribución
    case $DISTRO in
        ubuntu|debian)
            install_ubuntu_deps
            install_chrome_ubuntu
            ;;
        centos|rhel|fedora)
            install_centos_deps
            install_chrome_centos
            ;;
        arch)
            install_arch_deps
            install_chrome_arch
            ;;
        *)
            print_warning "Distribución no soportada directamente. Intentando instalar Chromium..."
            install_chromium
            ;;
    esac
    
    # Instalar Xvfb para modo headless
    install_xvfb
    
    # Verificar instalación
    if verify_installation; then
        print_success "=== Instalación completada exitosamente ==="
        print_info "Ahora puedes ejecutar el bot de cupones:"
        print_info "node test-simplycodes-linux.js"
    else
        print_error "=== Error en la instalación ==="
        print_info "Intenta instalar manualmente:"
        print_info "Ubuntu/Debian: sudo apt install google-chrome-stable"
        print_info "CentOS/RHEL: sudo yum install google-chrome-stable"
        print_info "Arch: sudo pacman -S google-chrome"
        exit 1
    fi
}

# Ejecutar función principal
main "$@" 