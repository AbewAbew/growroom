# Builds a clean deploy\ copy of the app for uploading to Cloudflare Pages.
# Excludes everything private or server-only — most importantly data\, which
# holds your actual grow log and must never be published.
$root = $PSScriptRoot
$out = Join-Path $root "deploy"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }

robocopy $root $out /E `
  /XD "$root\data" "$root\.claude" "$root\.git" "$root\deploy" "$root\.wrangler" `
  /XF serve.js start.bat make-deploy.ps1 DEPLOY.md README.md .gitignore wrangler.toml | Out-Null

if ($LASTEXITCODE -ge 8) {
  Write-Error "Copy failed (robocopy exit $LASTEXITCODE)"
  exit 1
}
$count = (Get-ChildItem $out -Recurse -File | Measure-Object).Count
Write-Host "Deploy folder ready: $out ($count files)"
Write-Host "Next: npx wrangler pages deploy deploy --project-name grow-room"
exit 0
