import * as forge from 'node-forge';

function canonicalPayload(
  payerTokenId: string,
  merchantTokenId: string,
  amount: number,
  captureMethod: string,
  nonce: string
): string {
  // Keys in alphabetical order, no spaces — must match Python's json.dumps(sort_keys=True)
  // Python serializes float(50) as "50.0", but JS JSON.stringify(50) produces "50" — fix manually
  const amountStr = Number.isInteger(amount) ? `${amount}.0` : String(amount);
  return `{"amount":${amountStr},"captureMethod":"${captureMethod}","merchantTokenId":"${merchantTokenId}","nonce":"${nonce}","payerTokenId":"${payerTokenId}"}`;
}

export function signPayment(
  privateKeyPem: string,
  payerTokenId: string,
  merchantTokenId: string,
  amount: number,
  captureMethod: string,
  nonce: string
): string {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const md = forge.md.sha256.create();
  md.update(canonicalPayload(payerTokenId, merchantTokenId, amount, captureMethod, nonce), 'utf8');
  const signature = privateKey.sign(md);
  return forge.util.encode64(signature);
}
