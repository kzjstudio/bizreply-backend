# Fix whatsapp.controller.js to use correct Supabase parameters

$file = "src/controllers/whatsapp.controller.js"
$content = Get-Content $file -Raw

# Fix pattern 1: Normal incoming message (line ~139)
$old1 = @'
  // Normal flow with business found
  await saveMessage({
    messageId,
    businessId: business.id,
    from,
    to: phoneNumberId,
    messageText: message,
    timestamp: new Date(timestamp),
    direction: 'incoming',
    type: 'text'
  });
'@

$new1 = @'
  // Normal flow with business found
  await saveMessage({
    messageSid: messageId,
    businessId: business.id,
    customerPhone: from,
    direction: 'incoming',
    messageText: message,
    fromPhone: from,
    toPhone: phoneNumberId
  });
'@

$content = $content.Replace($old1, $new1)

# Fix pattern 2: Outgoing message (line ~170)
$old2 = @'
  if (sentMessage) {
    await saveMessage({
      messageId: sentMessage.messageId,
      businessId: business.id,
      from: phoneNumberId,
      to: from,
      messageText: aiResponse,
      timestamp: new Date(),
      direction: 'outgoing',
      type: 'text'
    });
  }
'@

$new2 = @'
  if (sentMessage) {
    await saveMessage({
      messageSid: sentMessage.messageId,
      businessId: business.id,
      customerPhone: from,
      direction: 'outgoing',
      messageText: aiResponse,
      fromPhone: phoneNumberId,
      toPhone: from
    });
  }
'@

$content = $content.Replace($old2, $new2)

# Fix pattern 3: Meta webhook incoming (line ~218)
$old3 = @'
          // Save incoming message to database
          await saveMessage({
            messageId,
            businessId: business.id,
            from,
            to: value.metadata.phone_number_id,
            messageText,
            timestamp: new Date(parseInt(message.timestamp) * 1000),
            direction: 'incoming',
            type: messageType
          });
'@

$new3 = @'
          // Save incoming message to database
          await saveMessage({
            messageSid: messageId,
            businessId: business.id,
            customerPhone: from,
            direction: 'incoming',
            messageText,
            fromPhone: from,
            toPhone: value.metadata.phone_number_id
          });
'@

$content = $content.Replace($old3, $new3)

# Fix pattern 4: Meta webhook outgoing (line ~252)
$old4 = @'
            // Save outgoing message to database
            if (sentMessage) {
              await saveMessage({
                messageId: sentMessage.messageId,
                businessId: business.id,
                from: value.metadata.phone_number_id,
                to: from,
                messageText: aiResponse,
                timestamp: new Date(),
                direction: 'outgoing',
                type: 'text'
              });
            }
'@

$new4 = @'
            // Save outgoing message to database
            if (sentMessage) {
              await saveMessage({
                messageSid: sentMessage.messageId,
                businessId: business.id,
                customerPhone: from,
                direction: 'outgoing',
                messageText: aiResponse,
                fromPhone: value.metadata.phone_number_id,
                toPhone: from
              });
            }
'@

$content = $content.Replace($old4, $new4)

# Save the fixed content
Set-Content $file -Value $content

Write-Host "✓ Fixed all saveMessage calls!" -ForegroundColor Green
Write-Host "Changes made:" -ForegroundColor Cyan
Write-Host "  - messageId → messageSid" -ForegroundColor Yellow
Write-Host "  - from → customerPhone (for conversation tracking)" -ForegroundColor Yellow
Write-Host "  - Added fromPhone and toPhone fields" -ForegroundColor Yellow
Write-Host "  - Removed timestamp and type fields (not needed)" -ForegroundColor Yellow
