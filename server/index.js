import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Initialize Supabase Client (if credentials provided in environment)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ==========================================
// 1. Health Check Endpoint
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: supabase ? 'supabase_connected' : 'supabase_unconfigured',
    service: 'TallyAI Fullstack Accounting Workstation'
  });
});

// ==========================================
// 2. Supabase Connection Status
// ==========================================
app.get('/api/supabase/status', async (req, res) => {
  if (!supabase) {
    return res.json({
      configured: false,
      message: 'Supabase URL or Key not configured in environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    });
  }

  try {
    const { error } = await supabase.from('organization_settings').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      return res.json({
        configured: true,
        connected: false,
        error: error.message
      });
    }

    res.json({
      configured: true,
      connected: true,
      message: 'Supabase PostgreSQL connection operational.'
    });
  } catch (err) {
    res.status(500).json({ configured: true, connected: false, error: err.message });
  }
});

// ==========================================
// 3. SMS Gateway OTP Dispatch
// ==========================================
app.post('/api/send-sms', async (req, res) => {
  try {
    const { phone, otp, apiKey, provider = 'fast2sms' } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone number and OTP code are required' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    const activeKey = apiKey || process.env.FAST2SMS_API_KEY;

    // Fast2SMS carrier delivery to Indian cellular networks
    if (activeKey && provider === 'fast2sms') {
      try {
        const fast2smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': activeKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: otp,
            numbers: cleanPhone
          })
        });

        const fast2smsData = await fast2smsRes.json();
        return res.json({ 
          success: fast2smsData.return || false, 
          provider: 'fast2sms',
          gatewayResponse: fast2smsData,
          message: fast2smsData.message ? fast2smsData.message[0] : 'SMS Dispatched'
        });
      } catch (apiErr) {
        return res.status(500).json({ 
          success: false, 
          error: apiErr.message, 
          message: 'Fast2SMS gateway network error' 
        });
      }
    }

    // Default Gateway response when live telecom carrier key is not supplied
    res.json({ 
      success: true, 
      cleanPhone,
      message: `SMS requested for +91 ${cleanPhone}. Live carrier delivery active once FAST2SMS_API_KEY is configured.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. Supabase Profiles / Users API
// ==========================================
app.post('/api/users/sync', async (req, res) => {
  if (!supabase) {
    return res.status(200).json({ success: true, message: 'Local mode active (Supabase not connected)' });
  }

  try {
    const { email, role, name, phone } = req.body;
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        { email, role, full_name: name, phone, last_login: new Date().toISOString() },
        { onConflict: 'email' }
      )
      .select();

    if (error) throw error;
    res.json({ success: true, profile: data?.[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. Serve Built Frontend (Vite Single Page App)
// ==========================================
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback for client-side routing (HTML5 history API)
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 TallyAI Production Server Active on Port ${PORT}`);
  console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👉 Database: ${supabase ? 'Supabase Connected' : 'Local Mock'}`);
  console.log(`===============================================`);
});
