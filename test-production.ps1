# ========================================
# BizReply Production Testing Script
# ========================================

# STEP 1: Replace with your actual Render URL
$RENDER_URL = "https://your-app-name.onrender.com"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BizReply Backend Testing Suite" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
Write-Host "--------------------" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$RENDER_URL/health" -Method Get
    Write-Host " Server is running!" -ForegroundColor Green
    Write-Host "Status: $($health.status)" -ForegroundColor White
    Write-Host "Message: $($health.message)`n" -ForegroundColor White
} catch {
    Write-Host " Health check failed: $_`n" -ForegroundColor Red
    exit
}

# Test 2: Webhook Verification
Write-Host "Test 2: Webhook Verification (for Meta)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
$webhookUrl = "$RENDER_URL/webhook?hub.mode=subscribe&hub.verify_token=bizreply_webhook_secret_2024&hub.challenge=test123"
try {
    $verify = Invoke-RestMethod -Uri $webhookUrl -Method Get
    Write-Host " Webhook verification successful!" -ForegroundColor Green
    Write-Host "Challenge response: $verify`n" -ForegroundColor White
} catch {
    Write-Host " Webhook verification failed: $_`n" -ForegroundColor Red
}

# Test 3: Create Business
Write-Host "Test 3: Create Business Profile" -ForegroundColor Yellow
Write-Host "--------------------------------" -ForegroundColor Yellow
$businessData = @{
    name = "My Test Business"
    phoneNumberId = "859278693937509"
    rules = @{
        businessName = "Coffee Paradise"
        businessHours = "Monday-Friday: 8AM-8PM, Saturday-Sunday: 9AM-6PM"
        description = "We serve premium coffee and pastries. Known for our friendly service and cozy atmosphere."
        specialInstructions = "Always be warm and friendly. If asked about products not in our price list, offer to check with the manager."
    }
    templates = @{
        priceList = " Coffee Menu:`nEspresso: $3.00`nLatte: $4.50`nCappuccino: $4.00`nMocha: $5.00`nCold Brew: $4.50`n Pastries: $3-$6"
        location = "123 Main Street, Downtown. Easy parking available behind the building."
        contact = "Phone: (555) 123-4567 | Email: hello@coffeeparadise.com"
    }
} | ConvertTo-Json -Depth 10

try {
    $business = Invoke-RestMethod -Uri "$RENDER_URL/api/business" -Method Post -Body $businessData -ContentType "application/json"
    Write-Host " Business created successfully!" -ForegroundColor Green
    Write-Host "Business ID: $($business.data.id)" -ForegroundColor White
    Write-Host "Name: $($business.data.name)`n" -ForegroundColor White
    
    # Save business ID for later
    $businessId = $business.data.id
    
    # Test 4: Get Business Details
    Write-Host "Test 4: Retrieve Business Details" -ForegroundColor Yellow
    Write-Host "----------------------------------" -ForegroundColor Yellow
    try {
        $retrieved = Invoke-RestMethod -Uri "$RENDER_URL/api/business/$businessId" -Method Get
        Write-Host " Business retrieved successfully!" -ForegroundColor Green
        Write-Host "Business Name: $($retrieved.data.rules.businessName)" -ForegroundColor White
        Write-Host "Hours: $($retrieved.data.rules.businessHours)`n" -ForegroundColor White
    } catch {
        Write-Host " Failed to retrieve business: $_`n" -ForegroundColor Red
    }
    
} catch {
    Write-Host " Failed to create business: $_`n" -ForegroundColor Red
}

# Test 5: List All Businesses
Write-Host "Test 5: List All Businesses" -ForegroundColor Yellow
Write-Host "---------------------------" -ForegroundColor Yellow
try {
    $businesses = Invoke-RestMethod -Uri "$RENDER_URL/api/business" -Method Get
    Write-Host " Retrieved businesses list!" -ForegroundColor Green
    Write-Host "Total businesses: $($businesses.data.Count)`n" -ForegroundColor White
} catch {
    Write-Host " Failed to list businesses: $_`n" -ForegroundColor Red
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Configure WhatsApp webhook in Meta for Developers" -ForegroundColor White
Write-Host "   - URL: $RENDER_URL/webhook" -ForegroundColor Gray
Write-Host "   - Verify Token: bizreply_webhook_secret_2024" -ForegroundColor Gray
Write-Host "2. Send a test WhatsApp message to your business number" -ForegroundColor White
Write-Host "3. Check Render logs to see the AI processing the message`n" -ForegroundColor White
