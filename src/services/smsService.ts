/**
 * SMS Gateway Service for Indian Mobile Numbers & International Telecoms
 * Dispatches real SMS OTPs via Fast2SMS / Twilio.
 */

export interface SmsSendResult {
  success: boolean;
  message: string;
  provider?: string;
  rawResponse?: any;
}

export async function sendRealSmsOtp(
  phone: string, 
  otp: string, 
  apiKey?: string
): Promise<SmsSendResult> {
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const storedKey = apiKey || localStorage.getItem('fast2sms_api_key') || '';

  try {
    const res = await fetch('/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: cleanPhone,
        otp,
        apiKey: storedKey,
        provider: 'fast2sms',
      }),
    });

    const data = await res.json();
    return {
      success: data.success || false,
      message: data.message || 'SMS dispatched',
      provider: data.provider,
      rawResponse: data,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to connect to SMS gateway',
    };
  }
}
