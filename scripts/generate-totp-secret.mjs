import crypto from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function toBase32(buffer) {
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }

  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5);
    if (chunk.length < 5) {
      output += alphabet[Number.parseInt(chunk.padEnd(5, '0'), 2)];
      break;
    }
    output += alphabet[Number.parseInt(chunk, 2)];
  }

  return output;
}

const secret = toBase32(crypto.randomBytes(20));
const email = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const issuer = process.env.ADMIN_TOTP_ISSUER ?? 'Batch 2022-26 Yearbook';
const label = `${issuer}:${email}`;
const uri = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;

console.log(`ADMIN_TOTP_SECRET=${secret}`);
console.log('');
console.log('Add this account to your authenticator app using the URI below:');
console.log(uri);

