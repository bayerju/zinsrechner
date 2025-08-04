import { setCookie, getCookie, deleteCookie } from 'cookies-next';

// Cookie utilities for storing form data
const COOKIE_NAME = 'zinsrechner-data';
const COOKIE_EXPIRY_DAYS = 365; // 1 year

export interface FormData {
  kaufpreis: string;
  modernisierungskosten: string;
  tilgungsfreierKredit: string;
  tilgungsFreieZeit: string;
  RückzahlungsfreieZeit: string;
  elternkredit: string;
  eigenkapital: string;
  kaufnebenkosten: string;
  kaufnebenkostenManuell: boolean;
  kaufnebenkostenProzent: string;
  sollzinsbindung: string;
  tilgungssatz: string;
  sollzins: string;
  überbrückungskredit: string;
  laufZeitÜberbrückungskredit: string;
}

export function saveFormData(data: FormData): void {
  console.log('saveFormData', data);
  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + COOKIE_EXPIRY_DAYS);
    
    void setCookie(COOKIE_NAME, JSON.stringify(data), {
      expires: expiryDate,
      path: '/',
      sameSite: 'lax',
    });
  } catch (error) {
    console.error('Failed to save form data to cookie:', error);
  }
}

export function loadFormData(): FormData | null {
  try {
    const cookieValue = getCookie(COOKIE_NAME);
    console.log('cookieValue', cookieValue);
    
    if (!cookieValue) return null;
    
    return JSON.parse(cookieValue as string) as FormData;
  } catch (error) {
    console.error('Failed to load form data from cookie:', error);
    return null;
  }
}

export function clearFormData(): void {
  void deleteCookie(COOKIE_NAME, { path: '/' });
} 