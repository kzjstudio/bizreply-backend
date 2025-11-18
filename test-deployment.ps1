# Replace with your actual Render URL
$RENDER_URL = "https://bizreply-backend.onrender.com"

Write-Host "Testing BizReply Backend Deployment..." -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n1. Testing health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$RENDER_URL/health" -Method Get
    Write-Host " Health check passed!" -ForegroundColor Green
    $health | ConvertTo-Json
} catch {
    Write-Host " Health check failed: $_" -ForegroundColor Red
}

# Test 2: Create Business
Write-Host "`n2. Creating test business..." -ForegroundColor Yellow
$businessData = @{
    name = "Test Coffee Shop"
    phoneNumberId = "859278693937509"
    rules = @{
        businessName = "Coffee Paradise"
        businessHours = "Mon-Fri 8AM-8PM, Sat-Sun 9AM-6PM"
        description = "We serve the best coffee in town!"
        specialInstructions = "Always be friendly and helpful"
    }
    templates = @{
        priceList = "Espresso: $3, Latte: $4.50, Cappuccino: $4, Mocha: $5"
        location = "123 Main Street, Downtown"
    }
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$RENDER_URL/api/business" -Method Post -Body $businessData -ContentType "application/json"
    Write-Host " Business created successfully!" -ForegroundColor Green
    $result | ConvertTo-Json
} catch {
    Write-Host " Business creation failed: $_" -ForegroundColor Red
}

Write-Host "`n Testing complete!" -ForegroundColor Cyan
