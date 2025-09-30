// Utilities for validating Polish phone numbers

/**
 * Validate a Polish phone number allowing formats:
 *  - 123456789
 *  - 123 456 789 / 123-456-789
 *  - +48 123 456 789 / +48123456789
 *  - 48 123 456 789 / 48123456789
 *  - 0048 123 456 789 / 0048123456789
 */
export function isValidPolishPhone(input: string): boolean {
  if (!input) return false
  const digitsOnly = input.replace(/\D/g, '')
  if (digitsOnly.length === 9) return true
  if (digitsOnly.length === 11 && digitsOnly.startsWith('48')) return true
  if (digitsOnly.length === 13 && digitsOnly.startsWith('0048')) return true
  return false
}

// HTML pattern matching common PL formats (9 digits, optionally prefixed with +48/48)
export const polishPhoneHtmlPattern = '^(?:\\+?48\\s*)?(?:\\d{3}[\\s-]?\\d{3}[\\s-]?\\d{3})$'

export const polishPhoneTitle = 'Podaj polski numer telefonu, np. 123 456 789 lub +48 123 456 789'


