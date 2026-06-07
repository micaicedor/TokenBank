@AGENTS.md

# SecurePay — Mobile App

App móvil del proyecto SecurePay. Se conecta al backend `token_bank` (Flask + MongoDB) para autenticar usuarios y procesar pagos V1 y V2.

## Contexto del proyecto

SecurePay es un proyecto universitario que demuestra la diferencia de seguridad entre dos versiones de un protocolo de pago:

- **V1**: pago sin autenticación, vulnerable a replay attack
- **V2**: pago con sesión JWT + nonce de un solo uso + firma RSA. El replay attack falla porque el nonce queda marcado como usado.

**Épica actual:** Épica 4 — Demo y cierre (6–13 jun 2026).

## Stack

- **Expo SDK 56** con Expo Router (file-based routing, ya configurado)
- **React 19 / React Native 0.85**
- **node-forge** para firma RSA en el cliente (puro JS, funciona en Expo Go sin build nativo) — pendiente de instalar
- **@react-native-async-storage/async-storage** para persistir sessionToken y clave privada — pendiente de instalar

Antes de escribir código, leer docs en https://docs.expo.dev/versions/v56.0.0/

## Estructura de directorios objetivo

```
Mobile/
├── app/
│   ├── _layout.tsx          ← root layout + AuthProvider + auth guard
│   ├── login.tsx
│   └── (tabs)/
│       ├── _layout.tsx      ← bottom tab navigator
│       ├── dashboard.tsx    ← saldo actual del usuario logueado
│       ├── pay-v1.tsx       ← formulario pago V1 (sin auth)
│       ├── pay-v2.tsx       ← formulario pago V2 (nonce + firma RSA)
│       ├── transactions.tsx ← historial GET /payments
│       └── settings.tsx     ← URL del backend + clave privada PEM
├── context/
│   └── AuthContext.tsx      ← sessionToken, tokenId, role en AsyncStorage
├── services/
│   └── api.ts               ← wrappers de fetch para cada endpoint
└── utils/
    └── crypto.ts            ← canonicalPayload + signPayment con node-forge
```

## Backend — token_bank

Vive en `../token_bank/`. Corre en `http://localhost:5000`.

```
POST /auth/login              → { sessionToken, tokenId, role }
GET  /users                   → lista de usuarios con balance
POST /payments/v1             → pago sin auth
POST /payments/v2/nonce       → solicitar nonce (requiere Bearer token)
POST /payments/v2             → pago con firma RSA (requiere Bearer token)
GET  /payments                → historial de transacciones
```

Para levantar el backend:
```bash
cd ../token_bank && docker compose up --build
docker compose exec token_bank python scripts/seed_demo.py
```

Usuarios demo: `payer_demo / demo123` y `merchant_demo / demo123`.

## URLs por ambiente

| Ambiente | URL base |
|---|---|
| Android emulador | `http://10.0.2.2:5000` |
| iOS simulador | `http://127.0.0.1:5000` |
| Dispositivo físico | `http://<IP-local>:5000` |

La URL se guarda en AsyncStorage desde la pantalla Settings y se lee antes de cada request.

## Firma RSA — detalle crítico

El backend verifica con **RSA-PKCS1v15 + SHA256**. El payload canónico es JSON con keys ordenadas y sin espacios — ver `../token_bank/app/security.py`.

**Problema:** Python serializa `float(50)` como `50.0`, pero `JSON.stringify(50)` en JS produce `50`. La firma fallaría para montos enteros.

**Solución en `utils/crypto.ts`:**
```typescript
function canonicalPayload(payerTokenId, merchantTokenId, amount, captureMethod, nonce): string {
  // Keys fijas ya en orden alfabético: amount, captureMethod, merchantTokenId, nonce, payerTokenId
  const amountStr = Number.isInteger(amount) ? `${amount}.0` : String(amount);
  return `{"amount":${amountStr},"captureMethod":"${captureMethod}","merchantTokenId":"${merchantTokenId}","nonce":"${nonce}","payerTokenId":"${payerTokenId}"}`;
}

// Con node-forge:
const md = forge.md.sha256.create();
md.update(canonicalPayload(...), 'utf8');
const signature = forge.util.encode64(privateKey.sign(md));
```

## Validar la firma antes de integrarla en la UI

Usar el script Python con un nonce fijo y comparar el base64 resultante con el output JS:
```bash
docker compose exec -e NONCE=test-nonce-123 token_bank python scripts/sign_v2_postman_body.py
```

## Flujo Pago V2 en la app

1. Leer `sessionToken` de AsyncStorage
2. `POST /payments/v2/nonce` con `Authorization: Bearer <sessionToken>`
3. Leer `privateKey` PEM de AsyncStorage (el usuario la pega en Settings)
4. `canonicalPayload(...)` → firma RSA → base64
5. `POST /payments/v2` con `{ merchantTokenId, amount, captureMethod, nonce, signature }`

## Orden de desarrollo sugerido

1. Instalar dependencias adicionales (`node-forge`, `async-storage`)
2. AuthContext + pantalla login
3. Dashboard (GET /users filtrado por tokenId)
4. Transactions (GET /payments)
5. Pay V1 (sin firma, el más simple)
6. `utils/crypto.ts` + validar firma contra script Python
7. Pay V2 usando el util validado
8. Settings (URL del backend + clave privada PEM)

## Instalar dependencias pendientes

```bash
npx expo install @react-native-async-storage/async-storage
npm install node-forge
npm install --save-dev @types/node-forge
```
