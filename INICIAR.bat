@echo off
echo.
echo  GianQR - Liberando puertos y reiniciando...
echo.

:: Matar procesos en puerto 4000 (backend)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":4000 "') do (
  taskkill /F /PID %%a >nul 2>&1
)

:: Matar procesos en puerto 5173 y 5174 (frontend)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 "') do (
  taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5174 "') do (
  taskkill /F /PID %%a >nul 2>&1
)

echo  Puertos liberados. Iniciando servidores...
echo.

start "GianQR Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 4 /nobreak > nul
start "GianQR Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 5 /nobreak > nul
start http://localhost:5173

echo.
echo  Sistema iniciado!
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:4000
echo  Login: admin@gianqr.com / Admin1234!
echo.
pause
