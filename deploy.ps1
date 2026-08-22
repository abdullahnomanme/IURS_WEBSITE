# ============================================================================
#  IURS website - one-click deploy
#  ---------------------------------------------------------------------------
#  Right-click this file -> "Run with PowerShell".
#
#  It does everything by itself:
#    - checks Node.js
#    - installs the deployment tool
#    - logs you in to Cloudflare in your browser (no password typed here)
#    - creates the photo storage bucket
#    - connects the existing iurs-production database
#    - updates the database tables
#    - publishes the website
#    - creates your administrator account with a strong temporary password
#      and prints it on screen ONCE
#
#  Safe to run again any time. It never deletes anything and it never
#  creates a second database or a second administrator.
# ============================================================================

Set-Location -Path $PSScriptRoot
$ErrorActionPreference = 'Continue'

# Cloudflare needs a real terminal for the login step, and colour output only
# confuses the log file, so keep wrangler quiet and non-interactive-safe.
$env:NO_COLOR = '1'
$env:WRANGLER_SEND_METRICS = 'false'

# Windows PowerShell 5.1 still defaults to old TLS, which Cloudflare refuses.
# Without this line the admin-account step fails with an SSL error.
try {
    [Net.ServicePointManager]::SecurityProtocol =
        [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11
} catch { }

$ADMIN_ID       = 'IURS26'
$ADMIN_NAME     = 'Abdullah Al Noman'
$ADMIN_POSITION = 'Office Secretary'
$DB_NAME        = 'iurs-production'
$BUCKET         = 'iurs-media'
$TOTAL          = 8

function Say($text, $colour) {
    if ($colour) { Write-Host $text -ForegroundColor $colour } else { Write-Host $text }
}
function Step($num, $text) {
    Write-Host ''
    Say "[$num/$TOTAL] $text" 'Cyan'
}
function Stop-Here($message) {
    Write-Host ''
    Say '-------------------------------------------------------------' 'Red'
    Say ' Stopped' 'Red'
    Say '-------------------------------------------------------------' 'Red'
    Say $message 'Red'
    Write-Host ''
    Say 'Nothing was broken. You can fix the point above and run this file again.' 'Yellow'
    Read-Host 'Press Enter to close'
    exit 1
}
# Runs a command and returns its combined output as one string.
function Run($file, $arguments) {
    $text = (& $file @arguments 2>&1 | Out-String)
    return $text
}
# Same, but shows the output live as it happens. Used for the two steps where
# Cloudflare may ask a question - if the output were hidden, the script would
# look frozen while it was actually waiting for an answer.
function RunLoud($file, $arguments) {
    $text = ''
    & $file @arguments 2>&1 | ForEach-Object {
        Write-Host $_
        $text += ("$_" + [Environment]::NewLine)
    }
    return $text
}

Say '=============================================' 'Cyan'
Say '  IURS website - deploying to Cloudflare' 'Cyan'
Say '=============================================' 'Cyan'

# --- 0. Right folder? --------------------------------------------------------
if (-not (Test-Path 'wrangler.jsonc')) {
    Stop-Here 'This file must stay inside the IURS project folder (the folder that contains wrangler.jsonc).'
}

# --- 1. Node.js --------------------------------------------------------------
Step 1 'Checking that Node.js is installed'
$nodeVersion = $null
try { $nodeVersion = (& node --version) } catch { $nodeVersion = $null }
if (-not $nodeVersion) {
    Write-Host ''
    Say 'Node.js is not installed on this computer yet.' 'Red'
    Say 'Install it once from  https://nodejs.org  (click the big LTS button),' 'Yellow'
    Say 'then run this file again. Nothing else is needed.' 'Yellow'
    Read-Host 'Press Enter to close'
    exit 1
}
Say "      Node.js $nodeVersion found." 'Green'

# --- 2. Deployment tool ------------------------------------------------------
Step 2 'Installing the deployment tool (about a minute the first time)'
if (Test-Path 'package-lock.json') { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }
if ($LASTEXITCODE -ne 0) {
    Stop-Here 'The deployment tool could not be installed. Check your internet connection and run this file again.'
}
Say '      Done.' 'Green'

# --- 3. Cloudflare login -----------------------------------------------------
Step 3 'Signing in to Cloudflare'
$who = Run 'npx' @('--yes', 'wrangler', 'whoami')
if ($who -match 'You are logged in' -or $who -match 'Account Name') {
    Say '      Already signed in.' 'Green'
} else {
    Say '      A browser window will open. Sign in to Cloudflare and click Allow.' 'Yellow'
    Say '      Your password is typed into Cloudflare only, never into this window.' 'Yellow'
    npx --yes wrangler login
    $who = Run 'npx' @('--yes', 'wrangler', 'whoami')
    if (-not ($who -match 'You are logged in' -or $who -match 'Account Name')) {
        Stop-Here 'Cloudflare sign-in did not complete. Run this file again and finish the browser step.'
    }
    Say '      Signed in.' 'Green'
}

# --- 4. Database -------------------------------------------------------------
# The database already exists and its id is already written in wrangler.jsonc,
# so this only confirms the account can see it. We never create a second one.
Step 4 "Checking the existing database ($DB_NAME)"
$dbInfo = Run 'npx' @('--yes', 'wrangler', 'd1', 'info', $DB_NAME)
if ($dbInfo -match 'not found' -or $dbInfo -match "Couldn't find") {
    Stop-Here @"
This Cloudflare account cannot see the database named $DB_NAME.

That normally means you signed in with a different Cloudflare account than the
one holding the database. Run this file again and sign in with the account that
owns $DB_NAME.
"@
}
Say "      Found $DB_NAME." 'Green'

# --- 5. Photo storage (optional) --------------------------------------------
# R2 is Cloudflare's file storage, used only for drag-and-drop photo upload in
# the dashboard. It is OFF by default on new accounts. The website is fully
# functional without it, so this step never stops the deployment - it only
# decides whether to switch uploads on.
Step 5 "Checking optional photo storage ($BUCKET)"
$r2Available = $false
$r2 = Run 'npx' @('--yes', 'wrangler', 'r2', 'bucket', 'create', $BUCKET)
if ($r2 -match 'already exists' -or $r2 -match 'already owned' -or $r2 -match '10004') {
    Say "      Photo storage is on. Drag-and-drop upload will be enabled." 'Green'
    $r2Available = $true
} elseif ($r2 -match 'Created bucket' -or $r2 -match 'Success') {
    Say "      Photo storage created. Drag-and-drop upload will be enabled." 'Green'
    $r2Available = $true
} elseif ($r2 -match '10042' -or $r2 -match 'enable R2') {
    Say '      Photo storage (R2) is not switched on for this account - that is fine.' 'Yellow'
    Say '      The website deploys and works normally; only drag-and-drop photo upload' 'Yellow'
    Say '      stays off. You can still add photos by pasting an image path. To enable' 'Yellow'
    Say '      upload later, switch on R2 in the Cloudflare dashboard and run this again.' 'Yellow'
} else {
    Say '      Could not confirm photo storage. The website will still deploy and work;' 'Yellow'
    Say '      only drag-and-drop photo upload stays off. Cloudflare said:' 'Yellow'
    Say ('      ' + $r2.Trim()) 'DarkGray'
}

# --- 6. Database tables ------------------------------------------------------
# The website also creates any missing table by itself on first request, so this
# step is a belt-and-braces measure and a warning here is not fatal.
Step 6 'Updating the database tables'
Say '      If Cloudflare asks "Ok to proceed?", type  y  and press Enter.' 'DarkGray'
$mig = RunLoud 'npx' @('--yes', 'wrangler', 'd1', 'migrations', 'apply', $DB_NAME, '--remote')
if ($mig -match 'No migrations to apply' -or $mig -match 'already applied') {
    Say '      Tables are already up to date.' 'Green'
} elseif ($mig -match 'error' -or $mig -match 'Error') {
    Say '      Could not run the table update from here. The website creates any' 'Yellow'
    Say '      missing table automatically on its first visit, so this is not fatal.' 'Yellow'
    Say ('      ' + $mig.Trim()) 'DarkGray'
} else {
    Say '      Tables updated.' 'Green'
}

# --- 7. Publish --------------------------------------------------------------
# wrangler.jsonc keeps the R2 photo binding deactivated so the site can always
# publish. If R2 turned out to be available above, we deploy from a temporary
# copy that has the binding switched on, so uploads work - without ever leaving
# an R2 requirement in the committed project. The temporary file is deleted
# straight afterwards.
Step 7 'Publishing the website'
$deployConfig = ''
$tempConfig = Join-Path $PSScriptRoot 'wrangler.deploy.jsonc'
if (Test-Path $tempConfig) { Remove-Item $tempConfig -Force -ErrorAction SilentlyContinue }
if ($r2Available) {
    $cfg = Get-Content -Raw -Path (Join-Path $PSScriptRoot 'wrangler.jsonc')
    $commented = @'
  // "r2_buckets": [
  //   { "binding": "MEDIA", "bucket_name": "iurs-media" }
  // ],
'@
    $active = @'
  "r2_buckets": [
    { "binding": "MEDIA", "bucket_name": "iurs-media" }
  ],
'@
    if ($cfg.Contains($commented.Replace("`r`n", "`n")) -or $cfg.Contains($commented)) {
        $cfg = $cfg.Replace($commented, $active).Replace($commented.Replace("`r`n","`n"), $active)
        Set-Content -Path $tempConfig -Value $cfg -Encoding UTF8
        $deployConfig = $tempConfig
        Say '      Photo upload will be switched on for this deployment.' 'DarkGray'
    }
}

if ($deployConfig -ne '') {
    $out = RunLoud 'npx' @('--yes', 'wrangler', 'deploy', '--config', $deployConfig)
} else {
    $out = RunLoud 'npx' @('--yes', 'wrangler', 'deploy')
}
$deployCode = $LASTEXITCODE
if (Test-Path $tempConfig) { Remove-Item $tempConfig -Force -ErrorAction SilentlyContinue }
if ($deployCode -ne 0 -and $out -notmatch 'Deployed|Current Version ID') {
    Stop-Here 'The deployment did not finish. The message above explains why.'
}

$liveUrl = ''
$m = [regex]::Match($out, 'https://[a-zA-Z0-9\-\.]+\.workers\.dev')
if ($m.Success) { $liveUrl = $m.Value }
if ($liveUrl -eq '') {
    # A custom domain instead of a workers.dev address. Ignore the documentation and
    # dashboard links wrangler also prints, so we do not pick up the wrong address.
    foreach ($cand in ([regex]::Matches($out, 'https://[a-zA-Z0-9\-\.]+(/[^\s]*)?') | ForEach-Object { $_.Value })) {
        if ($cand -notmatch 'cloudflare\.com|npmjs|github|developers\.|nodejs') {
            $liveUrl = $cand.TrimEnd('/'); break
        }
    }
}
if ($liveUrl -eq '') {
    Say '      Published, but the address did not appear in the message above.' 'Yellow'
    $liveUrl = Read-Host '      Paste your website address (for example https://iurs.something.workers.dev)'
    $liveUrl = $liveUrl.Trim().TrimEnd('/')
}
Say "      Live at $liveUrl" 'Green'

# --- 8. Administrator account -----------------------------------------------
Step 8 'Creating your administrator account'

# Give the new deployment a moment, then wait for the site to answer.
$ready = $false
for ($i = 1; $i -le 10; $i++) {
    try {
        $h = Invoke-WebRequest -Uri "$liveUrl/api/health" -TimeoutSec 20 -UseBasicParsing
        if ($h.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 3
}
if (-not $ready) {
    Say '      The website is not answering yet. Waiting a little longer...' 'Yellow'
    Start-Sleep -Seconds 10
}

# A strong password, generated on THIS computer. It is never written to any file
# in this project, never sent to GitHub, and it is not stored anywhere in
# readable form - Cloudflare only ever receives it once and stores a hash.
function New-StrongPassword {
    $lower  = 'abcdefghijkmnopqrstuvwxyz'      # no l
    $upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ'       # no I, O
    $digit  = '23456789'                       # no 0, 1
    $symbol = '!@#$%^&*?-_=+'
    $all    = $lower + $upper + $digit + $symbol
    $bytes  = [byte[]]::new(256)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $pick = { param($set, $b) $set[[int]($b % $set.Length)] }
    # Guarantee at least one of each kind, then fill to 20 characters.
    $chars = @(
        (& $pick $lower  $bytes[0]),
        (& $pick $upper  $bytes[1]),
        (& $pick $digit  $bytes[2]),
        (& $pick $symbol $bytes[3])
    )
    for ($i = 4; $i -lt 20; $i++) { $chars += (& $pick $all $bytes[$i]) }
    # Shuffle so the guaranteed characters are not always in front.
    $order = 20
    for ($i = $order - 1; $i -gt 0; $i--) {
        $j = [int]($bytes[100 + $i] % ($i + 1))
        $t = $chars[$i]; $chars[$i] = $chars[$j]; $chars[$j] = $t
    }
    return -join $chars
}

$tempPassword = New-StrongPassword
$payload = @{
    iursId              = $ADMIN_ID
    name                = $ADMIN_NAME
    position            = $ADMIN_POSITION
    password            = $tempPassword
    mustChangePassword  = $true
} | ConvertTo-Json -Compress

$created  = $false
$already  = $false
$failText = ''
try {
    $resp = Invoke-WebRequest -Uri "$liveUrl/api/setup/initial-admin" -Method POST `
        -ContentType 'application/json' -Body $payload -TimeoutSec 40 -UseBasicParsing
    if ([int]$resp.StatusCode -eq 200) { $created = $true }
} catch {
    # PowerShell 5.1 and PowerShell 7 expose the failed response differently,
    # so read the status and the message in a way that works on both.
    $code = 0
    if ($_.Exception.Response) { try { $code = [int]$_.Exception.Response.StatusCode } catch { } }
    if ($code -eq 409) {
        $already = $true
    } else {
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $failText = $_.ErrorDetails.Message
        } else {
            $failText = $_.Exception.Message
        }
    }
}

# Forget the password as soon as it has been shown / is no longer needed.
Write-Host ''
Say '=============================================' 'Green'
Say '  Deployed successfully' 'Green'
Say '=============================================' 'Green'
Say "  Your website:   $liveUrl" 'Green'
Say "  Admin login:    $liveUrl/login.html" 'Green'
Say "  Dashboard:      $liveUrl/admin.html" 'Green'
Write-Host ''

if ($created) {
    Say '  ---------------------------------------------------------' 'Yellow'
    Say '   YOUR TEMPORARY LOGIN - SHOWN ONLY ONCE' 'Yellow'
    Say '  ---------------------------------------------------------' 'Yellow'
    Say "   IURS ID   : $ADMIN_ID" 'White'
    Say "   Password  : $tempPassword" 'White'
    Say '  ---------------------------------------------------------' 'Yellow'
    Write-Host ''
    Say '   Copy it now. It is not saved in any file on this computer,' 'Yellow'
    Say '   not in the project, and not on GitHub.' 'Yellow'
    Write-Host ''
    Say '   The website will ask you to choose your own password the' 'White'
    Say '   moment you log in, and this temporary one stops working.' 'White'
    Write-Host ''
    Say '   The setup route is now closed permanently.' 'Green'
} elseif ($already) {
    Say '  An administrator account already exists, so no new account was' 'Green'
    Say '  created and no password was changed. Log in as usual at:' 'Green'
    Say "     $liveUrl/login.html" 'White'
    Write-Host ''
    Say '  If you have forgotten the password, tell me and I will add a' 'DarkGray'
    Say '  safe reset step - it cannot be read back from the database.' 'DarkGray'
} else {
    Say '  The website is live, but the administrator account could not be' 'Yellow'
    Say '  created automatically. Cloudflare/the site said:' 'Yellow'
    Say ('     ' + $failText.Trim()) 'DarkGray'
    Write-Host ''
    Say '  You can still create it yourself in one minute:' 'White'
    Say "     1. Open  $liveUrl/setup.html" 'White'
    Say "     2. IURS ID $ADMIN_ID, Name $ADMIN_NAME, Position $ADMIN_POSITION" 'White'
    Say '     3. Choose your own password (10+ characters).' 'White'
    Say '     That page closes itself permanently afterwards.' 'White'
}

$tempPassword = $null
$payload = $null
[System.GC]::Collect()

Write-Host ''
Read-Host 'Press Enter to close'
