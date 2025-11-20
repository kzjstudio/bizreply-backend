# Test AI Engine API
# Usage: .\test-ai-api.ps1

Write-Host "Testing AI Engine API..." -ForegroundColor Cyan

# Replace with your actual business ID from Supabase
$businessId = "YOUR-BUSINESS-ID-HERE"
$baseUrl = "https://bizreply-backend.onrender.com"

Write-Host "`n1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "✓ Server is running" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "✗ Server health check failed: $_" -ForegroundColor Red
}

Write-Host "`n2. Testing AI Greeting..." -ForegroundColor Yellow
try {
    $body = @{
        businessId = $businessId
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/ai/greeting" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✓ Greeting generated successfully" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "✗ Greeting generation failed: $_" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
}

Write-Host "`n3. Testing AI Response Generation..." -ForegroundColor Yellow
try {
    $body = @{
        businessId = $businessId
        conversationId = "test-conversation-$(Get-Date -Format 'yyyyMMddHHmmss')"
        message = "Show me your best laptops under $1000"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/ai/generate" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✓ AI response generated successfully" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "✗ AI response generation failed: $_" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
}

Write-Host "`n4. Testing Intent Analysis..." -ForegroundColor Yellow
try {
    $body = @{
        message = "I need help with my order"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/ai/intent" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✓ Intent analyzed successfully" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "✗ Intent analysis failed: $_" -ForegroundColor Red
}

Write-Host "`nDone!" -ForegroundColor Cyan
