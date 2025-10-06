import axios from 'axios';

const SMSAPI_TOKEN = process.env.SMSAPI_TOKEN || 'f5inrfI4tQ9pDQHOT2GzWHsxKFUFMi74F2WIMiHa';
const SMSAPI_BASE_URL = 'https://api.smsapi.pl';

interface SendSMSParams {
  to: string;
  message: string;
}

/**
 * Formatuje datę do polskiego formatu: DD.MM.YYYY
 */
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Formatuje godzinę do formatu: HH:MM
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Wysyła SMS przez SMSAPI.pl
 */
export async function sendSMS({ to, message }: SendSMSParams): Promise<{ success: boolean; error?: string }> {
  if (!SMSAPI_TOKEN) {
    console.error('SMSAPI_TOKEN not configured');
    return { success: false, error: 'SMS API token not configured' };
  }

  // Normalizacja numeru telefonu - usunięcie spacji i znaków specjalnych
  const cleanPhone = to.replace(/[\s\-\(\)]/g, '');
  
  // Jeśli numer nie zaczyna się od +, dodaj +48 (polskie numery)
  let phoneNumber = cleanPhone;
  if (!phoneNumber.startsWith('+')) {
    phoneNumber = `+48${phoneNumber}`;
  }

  try {
    const response = await axios.post(
      `${SMSAPI_BASE_URL}/sms.do`,
      {
        to: phoneNumber,
        message: message,
        format: 'json',
      },
      {
        headers: {
          'Authorization': `Bearer ${SMSAPI_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.count > 0) {
      console.log(`SMS sent successfully to ${phoneNumber}`);
      return { success: true };
    } else {
      console.error('SMS send failed:', response.data);
      return { success: false, error: 'Failed to send SMS' };
    }
  } catch (error: any) {
    console.error('Error sending SMS:', error.response?.data || error.message);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message || 'Unknown error' 
    };
  }
}

/**
 * Wysyła SMS z potwierdzeniem spotkania
 */
export async function sendMeetingConfirmationSMS(phone: string, scheduledAt: Date): Promise<{ success: boolean; error?: string }> {
  const date = formatDate(scheduledAt);
  const time = formatTime(scheduledAt);
  
  const message = `Potwierdzamy spotkanie dnia ${date}, godz. ${time}. Prosze przygotowac fakture za energie.`;
  
  return sendSMS({ to: phone, message });
}

