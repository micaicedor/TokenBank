# SecurePay

Sistema de pagos móvil que demuestra la diferencia de seguridad entre un protocolo sin protección (V1) y uno con autenticación criptográfica (V2).

```
/
├── backend/    API REST Flask + MongoDB
├── mobile/     App Expo React Native
└── pentest/    Scripts de demostración de ataques
```

---

## Requisitos

- Docker y Docker Compose
- Node.js 18+ y npm
- Expo Go instalado en el dispositivo o emulador Android/iOS

---

## 1. Levantar el backend

```bash
cd backend
docker compose up --build
```

La API queda disponible en `http://127.0.0.1:5000`.

Cargar usuarios demo (solo la primera vez):

```bash
docker compose exec token_bank python scripts/seed_demo.py
```

Esto crea:

| Usuario | Contraseña | Rol | TokenId |
|---|---|---|---|
| `payer_demo` | `demo123` | pagador | `PAYER_DEMO` |
| `merchant_demo` | `demo123` | comercio | `MERCHANT_DEMO` |

---

## 2. Correr la app móvil

```bash
cd mobile
npm install
npm start
```

Escanea el QR con Expo Go o presiona `a` para abrir en el emulador Android.

**Usuarios de prueba:**
- Pagador: `payer_demo / demo123`
- Comercio: `merchant_demo / demo123`

> Si usas un dispositivo físico, la app detecta automáticamente la IP del servidor. Si no conecta, verifica que el dispositivo esté en la misma red WiFi que el computador.

---

## 3. Flujo de la app

### Pago inseguro (V1)

1. Inicia sesión con `payer_demo`
2. Pestaña **Pagar** → busca `merchant_demo`
3. Ingresa el monto → **PAGAR INSEGURO**
4. El pago se envía sin autenticación ni firma — vulnerable a replay attack

### Pago seguro (V2)

1. Inicia sesión con `payer_demo`
2. Pestaña **Pagar** → busca `merchant_demo`
3. Ingresa el monto → **PAGAR SEGURO**
4. La app solicita un nonce al backend, firma el payload con RSA y envía el pago
5. El backend verifica la firma y quema el nonce — el replay attack falla

---

## 4. Demostración de pentesting

Los scripts en `pentest/` muestran los ataques en acción desde la terminal.

### Demo completa del replay attack

```bash
cd backend
docker compose exec token_bank python /pentest/pentest_demo.py
```

O desde fuera del contenedor (requiere `pip install requests cryptography`):

```bash
cd pentest
python pentest_demo.py
```

El script ejecuta tres fases:

**Fase 1 — Intercepción de sessionToken**
Simula la captura del token de sesión en tráfico HTTP y lo usa para acceder a datos protegidos.

**Fase 2 — Replay attack en V1**
Envía el mismo pago 3 veces sin autenticación. Los tres pasan. Demuestra que V1 no tiene ninguna protección contra repetición.

**Fase 3 — V2 resiste el ataque**
- Intenta pagar sin sessionToken → `401`
- Envía el mismo pago dos veces con el mismo nonce → segundo intento: `409 Nonce ya utilizado`
- Envía una firma falsa → `401 Firma inválida`

### Demo de pago V2 legítimo

```bash
cd backend
docker compose exec token_bank python scripts/v2_demo_payment.py
```

Hace el flujo completo: login → nonce → firma → pago aprobado.

---

## Por qué V2 es seguro

| Mecanismo | Qué protege |
|---|---|
| `sessionToken` | Solo el usuario autenticado puede iniciar un pago |
| Nonce de un solo uso | El mismo request no puede reenviarse |
| Firma RSA-PKCS1v15 + SHA256 | El payload no puede alterarse ni falsificarse |

Un atacante que capture el tráfico obtiene un request que ya no puede reutilizar.

---

## Endpoints

```
GET  /health
POST /auth/login
GET  /users
POST /payments/v1
POST /payments/v2/nonce
POST /payments/v2
GET  /payments
```

---

## Comandos útiles

```bash
# Apagar contenedores
docker compose down

# Ver logs
docker compose logs -f

# Reconstruir tras cambios
docker compose up --build
```
