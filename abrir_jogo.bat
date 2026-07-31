@echo off
title Abrindo Laboratorio 3D...
cd /d "%~dp0"
echo.
echo =========================================
echo   Iniciando o servidor do jogo...
echo =========================================
echo.
call npm run dev -- --open
