# Activa el backend de Curriculo ITSQMET sin alterar Firestore ni los datos PEA.
$ErrorActionPreference = "Stop"
$project = "curriculo-ddfcd"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Activacion del backend de Curriculo ITSQMET" -ForegroundColor Cyan
Write-Host "Proyecto Firebase: $project"
Write-Host "El script NO publica reglas de Firestore ni altera carreras, materias o PEA."
foreach ($cmd in @("node","npm","npx")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Falta $cmd. Instala Node.js LTS 22 y reabre PowerShell." }
}
if (-not (Test-Path (Join-Path $root "firebase.json"))) { throw "Ejecuta el script en la carpeta raiz de curriculopg." }
if (-not (Test-Path (Join-Path $root "functions\index.js"))) { throw "No se encontro functions\index.js." }
Set-Location $root
Write-Host "Instalando dependencias del backend..." -ForegroundColor Cyan
& npm.cmd install --prefix functions --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "Fallo npm install; no se desplego nada." }
Write-Host "Iniciando sesion en Firebase..." -ForegroundColor Cyan
& npx.cmd --yes firebase-tools@latest login
if ($LASTEXITCODE -ne 0) { throw "No fue posible iniciar sesion en Firebase." }
Write-Host "Comprueba que aparece el proyecto curriculo-ddfcd." -ForegroundColor Yellow
& npx.cmd --yes firebase-tools@latest projects:list
if ($LASTEXITCODE -ne 0) { throw "No se pudieron comprobar los proyectos Firebase." }
Write-Host "El proyecto necesita Cloud Functions habilitado (plan Blaze y permisos de despliegue)." -ForegroundColor Yellow
Write-Host "ADVERTENCIA: el PIN 5626 es publico en GitHub; NO protege adecuadamente datos reales." -ForegroundColor Red
$confirm = Read-Host "Para desplegar las funciones en curriculo-ddfcd, escribe ACTIVAR"
if ($confirm -cne "ACTIVAR") { Write-Host "Cancelado. No se desplego nada."; exit 0 }
Write-Host "Desplegando Cloud Functions. No se publicaran reglas ni se cambiara la base..." -ForegroundColor Cyan
& npx.cmd --yes firebase-tools@latest deploy --only functions --project $project
if ($LASTEXITCODE -ne 0) { throw "Despliegue fallido; revisa el error anterior y los permisos de Firebase." }
Write-Host "Verificando funciones..." -ForegroundColor Cyan
& npx.cmd --yes firebase-tools@latest functions:list --project $project
Write-Host "Verifica las reglas de Firestore ANTES de usar datos reales." -ForegroundColor Yellow
Write-Host "Si el acceso falla, revisa logs mediante:"
Write-Host "npx firebase-tools functions:log --only ingresarAdmin --project curriculo-ddfcd"
