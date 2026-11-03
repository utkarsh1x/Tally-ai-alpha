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

        // TallyPrime Test Connection Proxy for Vite Dev Mode
        server.middlewares.use('/api/tally/test', async (req: IncomingMessage, res: ServerResponse) => {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            const data = JSON.parse(bodyStr || '{}');
            const target = `${data.tallyHost || 'http://localhost'}:${data.tallyPort || 9000}/`;
            const pingXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Companies</REPORTNAME>
        <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

            try {
              const tallyRes = await fetch(target, {
                method: 'POST',
                headers: { 'Content-Type': 'text/xml; charset=utf-8' },
                body: pingXml,
                signal: AbortSignal.timeout(5000)
              });
              const body = await tallyRes.text();
              const companies: string[] = [];
              const compRegex = /<COMPANY>[\s\S]*?<NAME>([\s\S]*?)<\/NAME>[\s\S]*?<\/COMPANY>/gi;
              let m: RegExpExecArray | null;
              while ((m = compRegex.exec(body)) !== null) {
                const c = m[1].replace(/<[^>]+>/g, '').trim();
                if (c && !companies.includes(c)) companies.push(c);
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                connected: true,
                tallyRunning: true,
                tallyHost: data.tallyHost || 'http://localhost',
                tallyPort: data.tallyPort || 9000,
                activeCompany: companies[0] || data.companyName || 'Active Company',
                companies,
                message: `TallyPrime XML Server is ONLINE at ${target}`
              }));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                connected: false,
                tallyRunning: false,
                error: `Cannot reach TallyPrime at ${target}: ${err.message}`,
                troubleshooting: [
                  '1. Ensure TallyPrime is running on this computer.',
                  '2. In TallyPrime, press F1 > Settings > Connectivity.',
                  '3. Set Client/Server configuration to Both, and Port to 9000.'
                ]
              }));
            }
          });
        });

        // TallyPrime Push Proxy for Vite Dev Mode
        server.middlewares.use('/api/tally/push', async (req: IncomingMessage, res: ServerResponse) => {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const data = JSON.parse(bodyStr || '{}');
              const { xml, tallyHost = 'http://localhost', tallyPort = 9000, companyName = '', batchId = `SYNC-${Date.now()}` } = data;
              const target = `${tallyHost}:${tallyPort}/`;

              const tallyRes = await fetch(target, {
                method: 'POST',
                headers: { 'Content-Type': 'text/xml; charset=utf-8' },
                body: xml,
                signal: AbortSignal.timeout(30000)
              });
              const body = await tallyRes.text();

              const extractInt = (tag: string) => {
                const match = body.match(new RegExp(`<${tag}>\\s*(\\d+)\\s*<\\/${tag}>`, 'i'));
                return match ? parseInt(match[1], 10) : 0;
              };

              const created = extractInt('CREATED');
              const altered = extractInt('ALTERED');
              const errors = extractInt('ERRORS');

              const errorDetails: string[] = [];
              const lineRegex = /<LINEERROR>([\s\S]*?)<\/LINEERROR>/gi;
              let lm: RegExpExecArray | null;
              while ((lm = lineRegex.exec(body)) !== null) {
                const t = lm[1].replace(/<[^>]+>/g, '').trim();
                if (t && !errorDetails.includes(t)) errorDetails.push(t);
              }

              const status = errors === 0 && (created > 0 || altered > 0)
                ? 'SUCCESS'
                : (errors > 0 && (created > 0 || altered > 0) ? 'PARTIAL' : (errors > 0 ? 'FAILED' : (created === 0 ? 'FAILED' : 'SUCCESS')));

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: status === 'SUCCESS' || status === 'PARTIAL',
                status,
                created,
                altered,
                errors,
                errorDetails,
                rawXml: body,
                batchId,
                companyName,
                timestamp: new Date().toISOString()
              }));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                status: 'FAILED',
                created: 0,
                altered: 0,
                errors: 1,
                errorDetails: [err.message],
                message: `Failed to communicate with TallyPrime: ${err.message}`,
                rawXml: ''
              }));
            }
          });
        });
      }
    }
  ],
})
