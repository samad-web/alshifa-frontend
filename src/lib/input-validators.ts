const NAME_ALLOWED = /[^A-Za-zÀ-ɏͰ-ϿЀ-ӿ؀-ۿऀ-ॿ஀-௿ఀ-౿ ''\-.]/g;
const PHONE_ALLOWED = /[^\d+]/g;
const DIGITS_ONLY = /[^\d]/g;

export function sanitizeName(input: string): string {
  return input.replace(NAME_ALLOWED, "").replace(/\s{2,}/g, " ").trimStart();
}

export function sanitizePhone(input: string): string {
  const cleaned = input.replace(PHONE_ALLOWED, "");
  const plusCount = (cleaned.match(/\+/g) || []).length;
  if (plusCount === 0) return cleaned;
  return "+" + cleaned.replace(/\+/g, "");
}

export function sanitizeDigits(input: string): string {
  return input.replace(DIGITS_ONLY, "");
}

export function stripLeadingSpaces(input: string): string {
  return input.replace(/^\s+/, "");
}

export function stripEdgeSpaces(input: string): string {
  return input.replace(/^\s+|\s+$/g, "");
}

export function isValidPhone(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

export function checkPassword(pwd: string): PasswordCheck[] {
  return [
    { label: "At least 8 characters", ok: pwd.length >= 8 },
    { label: "At least one uppercase letter", ok: /[A-Z]/.test(pwd) },
    { label: "At least one lowercase letter", ok: /[a-z]/.test(pwd) },
    { label: "At least one number", ok: /\d/.test(pwd) },
    { label: "At least one symbol", ok: /[^A-Za-z0-9]/.test(pwd) },
  ];
}

export function passwordStrengthScore(pwd: string): number {
  return checkPassword(pwd).filter(c => c.ok).length;
}

export function isPasswordAcceptable(pwd: string): boolean {
  return passwordStrengthScore(pwd) >= 5;
}
