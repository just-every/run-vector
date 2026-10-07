const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function createUlid(now: Date): string {
  const milliseconds = now.getTime()
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    throw new Error('A valid timestamp is required to create an identifier.')
  }

  let encodedTime = ''
  let remaining = milliseconds
  for (let index = 0; index < 10; index += 1) {
    encodedTime = alphabet[remaining % 32] + encodedTime
    remaining = Math.floor(remaining / 32)
  }

  const random = new Uint8Array(16)
  crypto.getRandomValues(random)
  return encodedTime + Array.from(random, (value) => alphabet[value & 31]).join('')
}
