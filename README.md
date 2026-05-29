# TokenBank / SecurePay

Backend Flask del proyecto SecurePay. Maneja usuarios, sesiones, saldos y pagos entre un pagador y un comercio usando MongoDB.

## Requisitos

- Docker Desktop
- Docker Compose

## Correr el proyecto

Desde la carpeta `TokenBank`:

```powershell
docker compose up --build
```

La API queda disponible en:

```text
http://127.0.0.1:5000
```

Para verificar que el backend esta corriendo:

```powershell
curl http://127.0.0.1:5000/health
```

## Cargar datos demo

En otra terminal:

```powershell
docker compose exec token_bank python scripts/seed_demo.py
```

Esto crea:

- Usuario pagador: `payer_demo` / `demo123`
- Usuario comercio: `merchant_demo` / `demo123`
- Tokens demo: `PAYER_DEMO` y `MERCHANT_DEMO`
- Saldos iniciales para probar pagos

## Como funcionan los tokens

En este proyecto hay tres conceptos importantes:

1. `tokenId`

   Es el identificador publico de cada usuario dentro del sistema.

   Por ejemplo:

   ```text
   PAYER_DEMO
   MERCHANT_DEMO
   ```

   El pagador usa el `tokenId` del comercio para saber a quien pagar. Ese token puede llegar por QR, NFC o ingreso manual. El backend lo usa para buscar al usuario en MongoDB.

2. Token de sesion

   Es el token que devuelve el login. Sirve para demostrar que un usuario ya inicio sesion.

   Se obtiene con:

   ```text
   POST /auth/login
   ```

   Ejemplo de body:

   ```json
   {
     "username": "payer_demo",
     "password": "demo123"
   }
   ```

   La respuesta incluye algo como:

   ```json
   {
     "sessionToken": "TOKEN_GENERADO",
     "tokenId": "PAYER_DEMO",
     "role": "payer"
   }
   ```

   Para usar endpoints protegidos, se envia en el header:

   ```text
   Authorization: Bearer TOKEN_GENERADO
   ```

3. Nonce de V2

   Es un valor aleatorio de un solo uso. Se pide antes de hacer un pago seguro V2:

   ```text
   POST /payments/v2/nonce
   ```

   El nonce expira a los 5 minutos y queda marcado como usado despues del pago.

## Flujo de pago V1

V1 es el flujo simple. No necesita login, nonce ni firma. El backend recibe los tokens de usuario y el monto:

```json
{
  "payerTokenId": "PAYER_DEMO",
  "merchantTokenId": "MERCHANT_DEMO",
  "amount": 50,
  "captureMethod": "QR"
}
```

Luego valida saldo, resta saldo al pagador, suma saldo al comercio y registra la transaccion.

Para probarlo en Postman:

```text
POST http://127.0.0.1:5000/payments/v1
```

Body:

```json
{
  "payerTokenId": "PAYER_DEMO",
  "merchantTokenId": "MERCHANT_DEMO",
  "amount": 50,
  "captureMethod": "QR"
}
```

Respuesta esperada:

```json
{
  "message": "Pago V1 aprobado",
  "payerBalanceAfter": 950.0,
  "merchantBalanceAfter": 150.0
}
```

## Flujo de pago V2

V2 agrega seguridad con sesion, nonce y firma RSA:

1. El pagador inicia sesion con `/auth/login`.
2. El pagador solicita un nonce con `/payments/v2/nonce`.
3. La app firma los datos del pago con la clave privada del pagador.
4. El backend verifica la firma usando la `publicKey` guardada del usuario.
5. Si la firma y el nonce son validos, mueve el saldo y marca el nonce como usado.

Body esperado para `POST /payments/v2`:

```json
{
  "merchantTokenId": "MERCHANT_DEMO",
  "amount": 50,
  "captureMethod": "QR",
  "nonce": "NONCE_GENERADO",
  "signature": "FIRMA_RSA_EN_BASE64"
}
```

El backend no guarda claves privadas. Solo guarda la `publicKey` del usuario para verificar firmas.

## Mostrar V2 funcionando

Para una demostracion rapida del pago V2 completo:

```powershell
docker compose exec token_bank python scripts/seed_demo.py
docker compose exec token_bank python scripts/v2_demo_payment.py
```

Ese script hace el flujo completo:

1. Inicia sesion como `payer_demo`.
2. Pide un nonce.
3. Firma el pago con la clave privada demo.
4. Envia el pago a `/payments/v2`.
5. Muestra la respuesta aprobada del backend.

## Flujo para mostrar en Postman

Antes de abrir Postman, deja Docker corriendo y carga los datos demo:

```powershell
docker compose up --build
docker compose exec token_bank python scripts/seed_demo.py
```

En Postman usa esta base:

```text
http://127.0.0.1:5000
```

### 1. Verificar que la API esta viva

```text
GET http://127.0.0.1:5000/health
```

Respuesta esperada:

```json
{
  "message": "token_bank corriendo",
  "status": "ok"
}
```

### 2. Ver usuarios demo

```text
GET http://127.0.0.1:5000/users
```

Debe mostrar `payer_demo` y `merchant_demo` con sus saldos.

### 3. Probar pago V1

```text
POST http://127.0.0.1:5000/payments/v1
```

Body:

```json
{
  "payerTokenId": "PAYER_DEMO",
  "merchantTokenId": "MERCHANT_DEMO",
  "amount": 50,
  "captureMethod": "QR"
}
```

Luego revisa saldos:

```text
GET http://127.0.0.1:5000/users
```

### 4. Crear usuario manualmente

```text
POST http://127.0.0.1:5000/users
```

Body para crear un pagador:

```json
{
  "name": "Pagador Manual",
  "username": "payer_manual",
  "password": "demo123",
  "role": "payer",
  "balance": 500,
  "tokenId": "PAYER_MANUAL"
}
```

Body para crear un comercio:

```json
{
  "name": "Comercio Manual",
  "username": "merchant_manual",
  "password": "demo123",
  "role": "merchant",
  "balance": 0,
  "tokenId": "MERCHANT_MANUAL"
}
```

Notas:

- `role` solo puede ser `payer` o `merchant`.
- `username` no se puede repetir.
- `tokenId` no se puede repetir.
- Para pagos V2, el pagador necesita `publicKey`; los usuarios creados por `seed_demo.py` ya la tienen.

### 5. Iniciar sesion como pagador

```text
POST http://127.0.0.1:5000/auth/login
```

Body:

```json
{
  "username": "payer_demo",
  "password": "demo123"
}
```

Copia el valor de `sessionToken` de la respuesta.

### 6. Solicitar nonce para V2

```text
POST http://127.0.0.1:5000/payments/v2/nonce
```

Header:

```text
Authorization: Bearer SESSION_TOKEN
```

Body:

```json
{}
```

Copia el valor de `nonce` de la respuesta.

### 7. Generar el body firmado

En PowerShell, reemplaza `NONCE_GENERADO` por el nonce copiado:

```powershell
docker compose exec -e NONCE=NONCE_GENERADO token_bank python scripts/sign_v2_postman_body.py
```

El comando imprime un JSON con `merchantTokenId`, `amount`, `captureMethod`, `nonce` y `signature`.

### 8. Enviar pago V2

```text
POST http://127.0.0.1:5000/payments/v2
```

Header:

```text
Authorization: Bearer SESSION_TOKEN
```

Body:

Copia el JSON que genero el comando anterior.

Respuesta esperada:

```json
{
  "message": "Pago V2 aprobado",
  "payerBalanceAfter": 950.0,
  "merchantBalanceAfter": 150.0
}
```

### 9. Confirmar saldos y transacciones

Usuarios:

```text
GET http://127.0.0.1:5000/users
```

Transacciones:

```text
GET http://127.0.0.1:5000/payments
```

## Flujo Postman resumido

Si ya entiendes el flujo, estos son los pasos cortos:

1. Hacer login en `POST /auth/login`.
2. Copiar el `sessionToken`.
3. Pedir nonce en `POST /payments/v2/nonce` usando `Authorization: Bearer TOKEN`.
4. Generar el body firmado para Postman:

```powershell
docker compose exec -e NONCE=NONCE_GENERADO token_bank python scripts/sign_v2_postman_body.py
```

5. Copiar el JSON generado y enviarlo a:

```text
POST http://127.0.0.1:5000/payments/v2
```

con el mismo header:

```text
Authorization: Bearer TOKEN
```

## Endpoints principales

```text
POST /auth/login
POST /users
GET  /users
POST /payments/v1
POST /payments/v2/nonce
POST /payments/v2
GET  /payments
```

## Comandos utiles

Apagar contenedores:

```powershell
docker compose down
```

Ver logs:

```powershell
docker compose logs -f
```

Reconstruir despues de cambios:

```powershell
docker compose up --build
```
