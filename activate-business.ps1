# Admin Activation Script
# Use this to quickly activate a user's business after they sign up

param(
    [string]$RenderUrl = "https://your-app.onrender.com"
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  Bizreply AI - Activate Business" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Get business ID
$businessId = Read-Host "Enter Business ID (from Firebase Console)"

# Get or use default phone number ID
$defaultPhoneId = "859278693937509"
Write-Host ""
Write-Host "Default Phone Number ID: $defaultPhoneId" -ForegroundColor Yellow
$phoneNumberId = Read-Host "Enter Phone Number ID (or press Enter for default)"

if ([string]::IsNullOrWhiteSpace($phoneNumberId)) {
    $phoneNumberId = $defaultPhoneId
}

# Optional: Assign a specific WhatsApp number
Write-Host ""
Write-Host "Assign a business WhatsApp number (e.g., +1-555-999-8888)" -ForegroundColor Yellow
$assignedNumber = Read-Host "Enter WhatsApp number to assign (or press Enter to skip)"

Write-Host ""
Write-Host "Activating business..." -ForegroundColor Yellow

try {
    # Update business in Firebase via backend API
    $headers = @{
        "Content-Type" = "application/json"
    }

    $body = @{
        phoneNumberId = $phoneNumberId
        isActive = $true
    }

    if (![string]::IsNullOrWhiteSpace($assignedNumber)) {
        $body.whatsappNumber = $assignedNumber
    }

    $bodyJson = $body | ConvertTo-Json

    $response = Invoke-RestMethod `
        -Uri "$RenderUrl/api/businesses/$businessId" `
        -Method PUT `
        -Headers $headers `
        -Body $bodyJson

    Write-Host ""
    Write-Host "✅ Business Activated Successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Details:" -ForegroundColor Cyan
    Write-Host "  Business ID: $businessId"
    Write-Host "  Phone Number ID: $phoneNumberId"
    if (![string]::IsNullOrWhiteSpace($assignedNumber)) {
        Write-Host "  Assigned Number: $assignedNumber"
    }
    Write-Host ""
    Write-Host "The user will now see 'Active' status in their dashboard!" -ForegroundColor Green
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "❌ Error activating business:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual Activation via Firebase Console:" -ForegroundColor Yellow
    Write-Host "1. Go to Firebase Console" -ForegroundColor White
    Write-Host "2. Navigate to Firestore > businesses collection" -ForegroundColor White
    Write-Host "3. Find document: $businessId" -ForegroundColor White
    Write-Host "4. Edit document:" -ForegroundColor White
    Write-Host "   - Set phoneNumberId = '$phoneNumberId'" -ForegroundColor White
    Write-Host "   - Set isActive = true" -ForegroundColor White
    if (![string]::IsNullOrWhiteSpace($assignedNumber)) {
        Write-Host "   - Set whatsappNumber = '$assignedNumber'" -ForegroundColor White
    }
    Write-Host "5. Save" -ForegroundColor White
    Write-Host ""
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
