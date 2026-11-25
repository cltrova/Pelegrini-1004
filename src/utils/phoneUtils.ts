/**
 * Normaliza um número de telefone para o formato E.164 brasileiro
 * @param phone - Número de telefone em qualquer formato
 * @returns Número no formato E.164 (+5511999999999) ou null se inválido
 */
export function normalizePhoneE164(phone: string): string | null {
  if (!phone) return null;
  
  // Remove tudo que não é número
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  
  // Se começar com 55 e tiver 12-13 dígitos, já está correto
  if (cleanPhone.startsWith('55') && cleanPhone.length >= 12 && cleanPhone.length <= 13) {
    return '+' + cleanPhone;
  }
  
  // Se tiver 10-11 dígitos (DDD + número), adicionar +55
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    return '+55' + cleanPhone;
  }
  
  // Retornar como está (com +) se não se encaixar nos padrões
  if (cleanPhone.length > 0) {
    return '+' + cleanPhone;
  }
  
  return null;
}

/** Formata telefones brasileiros com DDD, incluindo números recebidos com DDI 55. */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';

  const value = phone.trim();
  if (!/^\+?[\d\s().-]+$/.test(value)) return phone;

  const digits = value.replace(/\D/g, '');
  if (/^55\d{10,11}$/.test(digits)) return applyPhoneMask(digits.slice(2));
  if (!value.startsWith('+') && /^\d{10,11}$/.test(digits)) return applyPhoneMask(digits);

  return phone;
}

/**
 * Valida se um telefone está em formato válido
 * @param phone - Número de telefone em qualquer formato
 * @returns true se válido, false caso contrário
 */
export function isValidBrazilianPhone(phone: string): boolean {
  if (!phone) return false;
  
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  
  // Aceita: 10-11 dígitos (sem DDI) ou 12-13 dígitos (com DDI 55)
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    return true;
  }
  
  if (cleanPhone.startsWith('55') && cleanPhone.length >= 12 && cleanPhone.length <= 13) {
    return true;
  }
  
  return false;
}

/**
 * Aplica máscara de telefone brasileiro durante digitação
 * @param value - Valor atual do input
 * @returns Valor com máscara aplicada
 */
export function applyPhoneMask(value: string): string {
  const cleanValue = value.replace(/\D/g, '');
  
  if (cleanValue.length === 0) return '';
  if (cleanValue.length <= 2) return `(${cleanValue}`;
  if (cleanValue.length <= 6) return `(${cleanValue.substring(0, 2)}) ${cleanValue.substring(2)}`;
  if (cleanValue.length <= 10) {
    return `(${cleanValue.substring(0, 2)}) ${cleanValue.substring(2, 6)}-${cleanValue.substring(6)}`;
  }
  // Celular com 9 dígitos
  return `(${cleanValue.substring(0, 2)}) ${cleanValue.substring(2, 7)}-${cleanValue.substring(7, 11)}`;
}
