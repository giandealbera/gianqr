@echo off
chcp 65001 > nul
echo.
echo  ╔══════════════════════════════════╗
echo  ║   GianQR — Iniciando sistema    ║
echo  ╚══════════════════════════════════╝
echo.
echo Abriendo Backend y Frontend en ventanas separadas...
echo.

:: Iniciar Backend en nueva ventana
start "GianQR - Backend (puerto 4000)" cmd /k "cd /d "%~dp0backend" && echo Iniciando backend... && npm run dev"

:: Esperar 2 segundos para que el backend levante
timeout /t 2 /nobreak > nul

:: Iniciar Frontend en nueva ventana
start "GianQR - Frontend (puerto 5173)" cmd /k "cd /d "%~dp0frontend" && echo Iniciando frontend... && npm run dev"

:: Esperar y abrir el navegador
timeout /t 4 /nobreak > nul
start http://localhost:5173

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   Sistema iniciado!                                 ║
echo  ║                                                      ║
echo  ║   Frontend: http://localhost:5173                   ║
echo  ║   Backend:  http://localhost:4000                   ║
echo  ║                                                      ║
echo  ║   Login: admin@gianqr.com / Admin1234!              ║
echo  ║                                                      ║
echo  ║   Cerrá las ventanas de consola para apagar.        ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
pause
