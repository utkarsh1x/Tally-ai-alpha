import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'http'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    {
      name: 'sms-gateway-api',
      configureServer(server) {
        server.middlewares.use('/api/send-sms', async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          let bodyStr = '';
          req.on('data', chunk => {
            bodyStr += chunk;
          });

          req.on('end', async () => {
            try {
              const data = JSON.parse(bodyStr || '{}');
              const { phone, otp, apiKey, provider = 'fast2sms' } = data;

              if (!phone || !otp) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, message: 'Phone and OTP are required' }));
                return;
              }

              const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

              // 1. If Fast2SMS API key is provided, send real SMS to Indian mobile number
              if (apiKey && provider === 'fast2sms') {
                try {
                  const fast2smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
                    method: 'POST',
                    headers: {
                      'authorization': apiKey,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      route: 'otp',
                      variables_values: otp,
                      numbers: cleanPhone
                    })
                  });

                  const fast2smsData: any = await fast2smsRes.json();
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ 
                    success: fast2smsData.return || false, 
                    provider: 'fast2sms',
                    gatewayResponse: fast2smsData,
                    message: fast2smsData.message ? fast2smsData.message[0] : 'SMS Dispatched'
                  }));
                  return;
                } catch (apiErr: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ 
                    success: false, 
                    error: apiErr.message, 
                    message: 'Fast2SMS gateway network error' 
                  }));
                  return;
                }
              }

              // 2. Default Gateway Response
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: true, 
                cleanPhone,
                message: `SMS requested for +91 ${cleanPhone}. Please configure Fast2SMS/Twilio API Key for live cellular carrier delivery.`
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        });
      }
    }
  ],
})
