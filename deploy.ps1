# IURS Cloudflare Worker deployment helper
# Run from PowerShell inside the project folder after installing Node.js.
$ErrorActionPreference = 'Stop'
Write-Host 'IURS Full-Stack Deployment' -ForegroundColor Cyan
Write-Host '1) Authenticate Wrangler if you have not already:'
Write-Host '   npx wrangler login'
Write-Host ''
Write-Host '2) Install dependencies:'
Write-Host '   npm install'
Write-Host ''
Write-Host '3) Create D1 once:'
Write-Host '   npx wrangler d1 create iurs-production'
Write-Host '   Then paste the database_id into wrangler.jsonc.'
Write-Host ''
Write-Host '4) Apply database migration:'
Write-Host '   npx wrangler d1 migrations apply iurs-production --remote'
Write-Host ''
Write-Host '5) Set the setup token secret:'
Write-Host '   npx wrangler secret put SETUP_TOKEN'
Write-Host ''
Write-Host '6) Deploy the site + backend:'
Write-Host '   npx wrangler deploy'
Write-Host ''
Write-Host 'After deployment, attach your domain and open /setup.html once.' -ForegroundColor Green
