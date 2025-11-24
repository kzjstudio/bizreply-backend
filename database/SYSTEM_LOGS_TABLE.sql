-- =====================================================
-- SYSTEM LOGS TABLE FOR ADMIN DASHBOARD
-- Tracks webhooks, errors, sync jobs, and performance metrics
-- =====================================================

-- Create system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_type VARCHAR(50) NOT NULL, -- 'webhook', 'error', 'sync_job', 'performance'
  severity VARCHAR(20) NOT NULL DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
  source VARCHAR(100) NOT NULL, -- 'whatsapp', 'woocommerce', 'fygaro', 'instagram', 'system'
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- Flexible storage for additional data
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(255)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_system_logs_log_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs(source);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_business_id ON system_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_resolved_at ON system_logs(resolved_at);

-- Create RLS policies (admin only)
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all logs"
  ON system_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Admins can insert logs
CREATE POLICY "Admins can insert logs"
  ON system_logs
  FOR INSERT
  WITH CHECK (true); -- No RLS on insert (service role will insert)

-- Admins can update logs (for marking as resolved)
CREATE POLICY "Admins can update logs"
  ON system_logs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Create function to get recent webhook stats
CREATE OR REPLACE FUNCTION get_webhook_stats(hours_back INT DEFAULT 24)
RETURNS TABLE (
  source VARCHAR,
  total_webhooks BIGINT,
  failed_webhooks BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.source,
    COUNT(*) as total_webhooks,
    COUNT(*) FILTER (WHERE sl.severity IN ('error', 'critical')) as failed_webhooks,
    ROUND(
      (COUNT(*) FILTER (WHERE sl.severity NOT IN ('error', 'critical'))::NUMERIC / 
      NULLIF(COUNT(*), 0)::NUMERIC) * 100, 
      2
    ) as success_rate
  FROM system_logs sl
  WHERE sl.log_type = 'webhook'
    AND sl.created_at >= NOW() - (hours_back || ' hours')::INTERVAL
  GROUP BY sl.source;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get sync job status
CREATE OR REPLACE FUNCTION get_sync_job_status()
RETURNS TABLE (
  source VARCHAR,
  last_run TIMESTAMP WITH TIME ZONE,
  status VARCHAR,
  items_synced INT,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.source,
    sl.created_at as last_run,
    CASE 
      WHEN sl.severity IN ('error', 'critical') THEN 'failed'
      ELSE 'success'
    END as status,
    (sl.metadata->>'items_synced')::INT as items_synced,
    CASE 
      WHEN sl.severity IN ('error', 'critical') THEN sl.message
      ELSE NULL
    END as error_message
  FROM system_logs sl
  WHERE sl.log_type = 'sync_job'
  ORDER BY sl.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get error summary
CREATE OR REPLACE FUNCTION get_error_summary(hours_back INT DEFAULT 24)
RETURNS TABLE (
  severity VARCHAR,
  source VARCHAR,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.severity,
    sl.source,
    COUNT(*) as count
  FROM system_logs sl
  WHERE sl.severity IN ('error', 'critical')
    AND sl.created_at >= NOW() - (hours_back || ' hours')::INTERVAL
  GROUP BY sl.severity, sl.source
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample webhook log (for testing)
INSERT INTO system_logs (log_type, severity, source, message, metadata)
VALUES 
  ('webhook', 'info', 'whatsapp', 'Message received from customer', '{"message_id": "test123", "from": "+1234567890"}'::jsonb),
  ('sync_job', 'info', 'woocommerce', 'Daily product sync completed', '{"items_synced": 150, "duration_ms": 2500}'::jsonb),
  ('error', 'error', 'fygaro', 'Failed to sync order status', '{"order_id": "12345", "error_code": "TIMEOUT"}'::jsonb);

-- Verify table creation
SELECT 
  'system_logs' as table_name,
  COUNT(*) as sample_logs
FROM system_logs;
