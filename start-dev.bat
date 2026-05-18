@echo off

start "Frontend - npm run dev" cmd /k "cd /d %~dp0frontend && npm run dev"
start "Backend - npm run dev" cmd /k "cd /d %~dp0backend && npm run dev"
