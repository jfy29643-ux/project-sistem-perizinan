@echo off
start "Auth API" /D "%~dp0backend\auth-service" cmd /k node index.js
start "Pengajuan API" /D "%~dp0backend\pengajuan-service" cmd /k node index.js
start "Frontend Vite" /D "%~dp0frontend" cmd /k npm.cmd run dev