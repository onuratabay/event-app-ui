/**
 * Password rules, the same as the server's: at least 8 characters, an upper and a lower case letter (Turkish
 * letters included), a digit and a special character (anything that is not a letter or a digit).
 */
export const PASSWORD_RULES = [
  ["length", "En az 8 karakter"],
  ["upper", "Bir büyük harf"],
  ["lower", "Bir küçük harf"],
  ["digit", "Bir rakam"],
  ["special", "Bir özel karakter (! ? @ # _ -)"],
] as const
export type PasswordRule = typeof PASSWORD_RULES[number][0]
export function passwordRules(password: string): Record<PasswordRule, boolean> {
  return {
    length: password.length >= 8,
    upper: /\p{Lu}/u.test(password),
    lower: /\p{Ll}/u.test(password),
    digit: /\p{Nd}/u.test(password),
    special: /[^\p{L}\p{N}]/u.test(password),
  }
}
export const isStrongPassword = (password: string) => Object.values(passwordRules(password)).every(Boolean)
/** Short placeholder; the full rules show under the field as the password is typed. */
export const PASSWORD_HINT = "Güçlü bir şifre oluştur"
export const PASSWORD_ERROR = "Şifren en az 8 karakter olmalı; büyük harf, küçük harf, rakam ve özel karakter (örn. ! ? @ # _ -) içermeli."
