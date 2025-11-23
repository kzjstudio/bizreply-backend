# Test Message Count Increment
# This script:
# 1. Creates the increment_message_count SQL function in Supabase
# 2. Gets your business to check current message count
# 3. Tests the increment function
# 4. Verifies the count increased

Write-Host "📊 Testing Message Count Increment" -ForegroundColor Cyan
Write-Host ""

# Read environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

$SUPABASE_URL = $env:SUPABASE_URL
$SUPABASE_SERVICE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $SUPABASE_URL -or -not $SUPABASE_SERVICE_KEY) {
    Write-Host "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Creating increment_message_count SQL function..." -ForegroundColor Yellow

# Read SQL file
$sql = Get-Content "database\increment_message_count.sql" -Raw

# Execute SQL function creation
$body = @{
    query = $sql
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/exec_sql" -Method Post -Headers @{
        "apikey" = $SUPABASE_SERVICE_KEY
        "Authorization" = "Bearer $SUPABASE_SERVICE_KEY"
        "Content-Type" = "application/json"
    } -Body $body
    
    Write-Host "✅ SQL function created successfully" -ForegroundColor Green
} catch {
    # Function might already exist, that's okay
    Write-Host "⚠️  Note: Function may already exist (this is okay)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 2: Getting your business..." -ForegroundColor Yellow

# Get first active business
try {
    $businessResponse = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/businesses?is_active=eq.true&select=id,business_name,message_count&limit=1" -Method Get -Headers @{
        "apikey" = $SUPABASE_SERVICE_KEY
        "Authorization" = "Bearer $SUPABASE_SERVICE_KEY"
    }
    
    if ($businessResponse.Count -eq 0) {
        Write-Host "❌ No active businesses found" -ForegroundColor Red
        exit 1
    }
    
    $business = $businessResponse[0]
    $businessId = $business.id
    $businessName = $business.business_name
    $currentCount = $business.message_count
    
    Write-Host "✅ Found business: $businessName" -ForegroundColor Green
    Write-Host "   Business ID: $businessId" -ForegroundColor Gray
    Write-Host "   Current message count: $currentCount" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error getting business: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Testing increment function..." -ForegroundColor Yellow

# Test increment
try {
    $incrementBody = @{
        business_id_param = $businessId
    } | ConvertTo-Json
    
    $incrementResponse = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/increment_message_count" -Method Post -Headers @{
        "apikey" = $SUPABASE_SERVICE_KEY
        "Authorization" = "Bearer $SUPABASE_SERVICE_KEY"
        "Content-Type" = "application/json"
        "Prefer" = "return=representation"
    } -Body $incrementBody
    
    Write-Host "✅ Increment function executed" -ForegroundColor Green
} catch {
    Write-Host "❌ Error calling increment function: $_" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 4: Verifying new count..." -ForegroundColor Yellow

# Get updated count
try {
    $verifyResponse = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/businesses?id=eq.$businessId&select=message_count" -Method Get -Headers @{
        "apikey" = $SUPABASE_SERVICE_KEY
        "Authorization" = "Bearer $SUPABASE_SERVICE_KEY"
    }
    
    $newCount = $verifyResponse[0].message_count
    
    Write-Host "✅ Verification complete" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Results:" -ForegroundColor Cyan
    Write-Host "   Before: $currentCount messages" -ForegroundColor Gray
    Write-Host "   After:  $newCount messages" -ForegroundColor Gray
    Write-Host "   Change: +$(($newCount - $currentCount))" -ForegroundColor $(if ($newCount -gt $currentCount) { "Green" } else { "Red" })
    
    if ($newCount -eq ($currentCount + 1)) {
        Write-Host ""
        Write-Host "✅ SUCCESS! Message count incremented correctly" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Run this SQL in Supabase SQL Editor:" -ForegroundColor White
        Write-Host "   " -NoNewline
        Write-Host "CREATE OR REPLACE FUNCTION increment_message_count(business_id_param UUID)" -ForegroundColor Cyan
        Write-Host "   (Full SQL is in database/increment_message_count.sql)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. Deploy backend changes to Render (push to GitHub)" -ForegroundColor White
        Write-Host "3. Send a test WhatsApp message to verify counter updates" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "⚠️  Count did not increase as expected" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error verifying count: $_" -ForegroundColor Red
    exit 1
}
