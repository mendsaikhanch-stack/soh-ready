// Input sanitization & validation

// HTML escape — XSS хамгаалалт
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Текст цэвэрлэх — script tag, event handler устгах
export function sanitizeText(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

// Утасны дугаар validation
export function isValidPhone(phone: string): boolean {
  return /^[0-9+\-() ]{8,15}$/.test(phone);
}

// Имэйл validation
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Нэр validation (Монгол, Англи, тоо, зай, цэг)
export function isValidName(name: string): boolean {
  return name.length >= 1 && name.length <= 100 && !/[<>{}]/.test(name);
}

// Тоот validation
export function isValidUnit(unit: string): boolean {
  return unit.length >= 1 && unit.length <= 20 && /^[0-9A-Za-zА-Яа-яҮүӨө\-/ ]+$/.test(unit);
}

// Текст урт шалгах
export function isValidText(text: string, maxLength: number = 2000): boolean {
  return text.length > 0 && text.length <= maxLength;
}

// Дүн validation
export function isValidAmount(amount: number): boolean {
  return !isNaN(amount) && amount >= 0 && amount <= 999999999;
}

// Form data бүхлээр validate хийх
export function validateFormData(
  data: Record<string, unknown>,
  rules: Record<string, { required?: boolean; maxLength?: number; type?: 'phone' | 'email' | 'name' | 'number' }>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors[field] = 'Заавал бөглөнө үү';
      continue;
    }

    if (!value) continue;

    if (typeof value === 'string') {
      if (rule.maxLength && value.length > rule.maxLength) {
        errors[field] = `${rule.maxLength} тэмдэгтээс хэтрэхгүй`;
      }

      if (rule.type === 'phone' && !isValidPhone(value)) {
        errors[field] = 'Утасны дугаар буруу';
      }
      if (rule.type === 'email' && !isValidEmail(value)) {
        errors[field] = 'Имэйл хаяг буруу';
      }
      if (rule.type === 'name' && !isValidName(value)) {
        errors[field] = 'Нэр буруу';
      }
    }

    if (rule.type === 'number' && typeof value === 'number' && !isValidAmount(value)) {
      errors[field] = 'Тоо буруу';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
