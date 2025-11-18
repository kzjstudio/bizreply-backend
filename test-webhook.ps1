# Replace with your actual Render URL
$RENDER_URL = "https://your-app-name.onrender.com"

Write-Host "Testing Webhook Verification..." -ForegroundColor Cyan

$url = "$RENDER_URL/webhook?hub.mode=subscribe&hub.verify_token=bizreply_webhook_secret_2024&hub.challenge=test123"

try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host " Webhook verification successful!" -ForegroundColor Green
    Write-Host "Response: $response" -ForegroundColor White
} catch {
    Write-Host " Webhook verification failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}
