@echo off
chcp 65001 > nul
title GianQR - Instalacion
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   GianQR — Instalacion automatica       ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ── Verificar Node.js ──────────────────────────────────────
node --version > nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Node.js no esta instalado.
    echo Descargalo de: https://nodejs.org
    pause & exit /b 1
)
echo [OK] Node.js: & node --version

:: ── 1. Instalar dependencias backend ──────────────────────
echo.
echo [1/3] Instalando dependencias del BACKEND...
cd /d "%~dp0backend"
call npm install
IF ERRORLEVEL 1 ( echo [ERROR] Fallo backend. & pause & exit /b 1 )
echo [OK] Backend listo.

:: ── 2. Instalar dependencias frontend ─────────────────────
echo.
echo [2/3] Instalando dependencias del FRONTEND...
cd /d "%~dp0frontend"
call npm install
IF ERRORLEVEL 1 ( echo [ERROR] Fallo frontend. & pause & exit /b 1 )
echo [OK] Frontend listo.

:: ── 3. Crear base de datos SQLite ──────────────────────────
echo.
echo [3/3] Configurando base de datos local (SQLite)...
cd /d "%~dp0backend"
node src/initDb.js
IF ERRORLEVEL 1 (
    echo.
    echo [!] Hubo un problema al inicializar la base de datos.
) ELSE (
    echo [OK] Base de datos 'gianqr.sqlite' lista para usar.
)

:: ── Listo ─────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   ✅ Instalacion completada!                            ║
echo  ║                                                          ║
echo  ║   Ahora ejecuta INICIAR.bat para arrancar el sistema.   ║
echo  ║   Login: admin@gianqr.com / Admin1234!                  ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
pause
