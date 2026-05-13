@echo off
chcp 65001 > nul
echo.
echo  ╔════════════════════════════════════════╗
echo  ║   GianQR — Crear base de datos        ║
echo  ╚════════════════════════════════════════╝
echo.

set /p PGPASS=Ingresá tu contraseña de PostgreSQL (usuario postgres):

echo.
echo Creando base de datos "gianqr"...
set PGPASSWORD=%PGPASS%
psql -U postgres -c "CREATE DATABASE gianqr;" 2>nul
IF ERRORLEVEL 1 (
    echo [!] La base de datos puede que ya exista, continuando...
)

echo Ejecutando schema...
psql -U postgres -d gianqr -f "%~dp0database\schema.sql"
IF ERRORLEVEL 1 (
    echo.
    echo [ERROR] No se pudo crear el schema.
    echo Verificá que PostgreSQL esté corriendo y la contraseña sea correcta.
    pause
    exit /b 1
)

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   ✅ Base de datos creada exitosamente!             ║
echo  ║                                                      ║
echo  ║   Admin creado:                                      ║
echo  ║   Email:    admin@gianqr.com                        ║
echo  ║   Password: Admin1234!                              ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo Ahora editá backend\.env con tu contraseña de PostgreSQL:
echo   DB_PASSWORD=%PGPASS%
echo.
pause
