# Test Human Handoff System
# Run this after deploying the backend updates

$RENDER_URL = "https://bizreply-backend.onrender.com"
$BUSINESS_ID = "85732846-c2b4-4c60-b651-08d5f606eef0"  # Replace with your business ID

Write-Host "`n=== Testing Human Handoff System ===" -ForegroundColor Cyan

# Test 1: Get conversation stats
Write-Host "`n1. Getting conversation stats..." -ForegroundColor Yellow
try {
    $stats = Invoke-RestMethod -Uri "$RENDER_URL/api/conversations/$BUSINESS_ID/stats" -Method Get
    Write-Host "✅ Stats retrieved successfully!" -ForegroundColor Green
    $stats | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Failed to get stats: $_" -ForegroundColor Red
}

# Test 2: Get all conversations
Write-Host "`n2. Getting all conversations..." -ForegroundColor Yellow
try {
    $conversations = Invoke-RestMethod -Uri "$RENDER_URL/api/conversations/${BUSINESS_ID}?limit=10" -Method Get
    Write-Host "✅ Conversations retrieved: $($conversations.data.Count)" -ForegroundColor Green
    
    if ($conversations.data.Count -gt 0) {
        Write-Host "Sample conversation:" -ForegroundColor Gray
        $conversations.data[0] | ConvertTo-Json -Depth 2
    }
} catch {
    Write-Host "❌ Failed to get conversations: $_" -ForegroundColor Red
}

# Test 3: Get escalated conversations
Write-Host "`n3. Getting escalated conversations..." -ForegroundColor Yellow
try {
    $escalated = Invoke-RestMethod -Uri "$RENDER_URL/api/conversations/$BUSINESS_ID/escalated" -Method Get
    Write-Host "✅ Escalated conversations: $($escalated.count)" -ForegroundColor Green
    
    if ($escalated.count -gt 0) {
        Write-Host "🚨 Conversations needing attention:" -ForegroundColor Red
        $escalated.data | ForEach-Object {
            Write-Host "  - $($_.customer_phone): $($_.escalation_reason)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✅ No escalated conversations at the moment" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to get escalated conversations: $_" -ForegroundColor Red
}

# Test 4: Manual escalation detection test
Write-Host "`n4. Testing escalation detection..." -ForegroundColor Yellow
Write-Host "Send a WhatsApp message with: 'I want to speak to a human representative'" -ForegroundColor Cyan
Write-Host "Then check the escalated conversations endpoint again." -ForegroundColor Gray

# Test 5: Example takeover (requires conversation ID)
Write-Host "`n5. Example: Taking over a conversation" -ForegroundColor Yellow
Write-Host "POST $RENDER_URL/api/conversations/$BUSINESS_ID/{conversationId}/takeover" -ForegroundColor Gray
Write-Host 'Body: { "userId": "your-user-uuid" }' -ForegroundColor Gray

# Test 6: Example manual message
Write-Host "`n6. Example: Sending manual message" -ForegroundColor Yellow
Write-Host "POST $RENDER_URL/api/conversations/$BUSINESS_ID/{conversationId}/send" -ForegroundColor Gray
Write-Host 'Body: { "message": "Hi! How can I help?", "userId": "your-user-uuid" }' -ForegroundColor Gray

Write-Host "`n=== Testing Complete ===" -ForegroundColor Cyan
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Run database migration: add_conversation_escalation.sql" -ForegroundColor White
Write-Host "2. Send test WhatsApp message requesting human" -ForegroundColor White
Write-Host "3. Check escalated conversations endpoint" -ForegroundColor White
Write-Host "4. Build Flutter inbox UI to display conversations" -ForegroundColor White
