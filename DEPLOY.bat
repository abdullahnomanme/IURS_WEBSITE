@echo off
REM ============================================================================
REM   IURS website - DOUBLE-CLICK THIS FILE TO PUBLISH THE WEBSITE
REM   ---------------------------------------------------------------------------
REM   This exists because Windows often refuses to run PowerShell scripts by
REM   right-clicking them. Double-clicking this file works regardless of that
REM   setting, for this one script only. It changes no Windows setting at all.
REM ============================================================================
title IURS website - deploy
cd /d "%~dp0"

if not exist "%~dp0deploy.ps1" goto missing

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
if errorlevel 1 goto problem
goto end

:missing
echo.
echo Could not find deploy.ps1 next to this file.
echo Keep DEPLOY.bat and deploy.ps1 together in the same folder.
echo.
pause
goto end

:problem
echo.
echo The deploy script reported a problem. The message above explains it.
echo.
pause

:end
