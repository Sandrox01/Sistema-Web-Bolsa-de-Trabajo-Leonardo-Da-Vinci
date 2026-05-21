# 🔧 Solución de Errores — Bolsa de Trabajo LDV

## ✅ Problemas Identificados y Solucionados

### 1. **Error: Script Cloudflare 404** ❌ → ✅ SOLUCIONADO
```
GET http://localhost:5500/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js
Error: MIME type 'text/html' is not executable
```

**Causa:** El script `/cdn-cgi/` es inyectado por Cloudflare cuando tu sitio está detrás de su CDN. Cuando ejecutas localmente como .exe, este endpoint no existe.

**Solución aplicada:** 
- ✅ Eliminado el script `data-cfasync` de todos los HTMLs
- ✅ Decodificado y reemplazado el email protegido por Cloudflare
- ✅ Los HTMLs ahora cargan sin referencias a Cloudflare

---

### 2. **Error: 401 Unauthorized — Token inválido o expirado** ❌ → ⚠️ REQUIERE ACCIÓN

```
GET http://localhost:5500/api/admin/postulaciones 401 (Unauthorized)
Error: Token inválido o expirado
```

**Causa:** El dropdown intenta cargar datos de la API sin estar autenticado.  
Esto ocurre porque:
1. Se abre el .exe directamente **sin pasar por login**
2. El `localStorage` está vacío (nueva sesión)
3. No hay token válido guardado

**Solución — Flujo correcto de uso:**

#### Para operadores del .exe, seguir ESTE ORDEN:

```
1. Abre: http://localhost:5500
   └─ Abre la página de inicio (index.html)

2. Haz clic en "Iniciar sesión" 
   └─ Accede a: http://localhost:5500/login

3. Ingresa credenciales de administrador:
   🔑 Correo: admin@ldv.edu.pe
   🔑 Contraseña: Admin2024@LDV

4. Haz clic en "Iniciar sesión"
   └─ El servidor valida las credenciales
   └─ Recibe un JWT token válido
   └─ Se guarda en localStorage de forma LOCAL

5. ¡Listo! Ahora accedes a: http://localhost:5500/dashboard-admin
   └─ Dashboard carga todos los datos correctamente
```

**¿Por qué 401 si ya intenté con credenciales?**
- localStorage es **específico del dominio y protocolo**
- Si pasas de `localhost` a `127.0.0.1` → se pierde sesión
- Si cierras la pestaña/navegador → se pierde sesión
- Necesitas **mantener la ventana del navegador abierta**

---

## 📋 Estados Posibles del Token

| Estado | Descripción | Acción |
|--------|-------------|--------|
| ✅ Válido | Token presente en localStorage | Accedes al dashboard sin problemas |
| ❌ Expirado | Token hace más de 24h que fue generado | Vuelve a hacer login |
| ❌ Ausente | No hay token en localStorage | Haz login por primera vez |
| ❌ Inválido | El token no coincide con la firma del servidor | Borra localStorage y vuelve a login |

---

## 🔍 Cómo Debuggear el Token

**En la consola del navegador (F12), ejecuta:**

```javascript
// Ver si hay token
console.log(localStorage.getItem('ldv_token'));

// Ver datos del usuario
console.log(localStorage.getItem('ldv_user'));

// Borrar la sesión (si necesitas hacer logout)
localStorage.clear();
```

---

## 📦 Configuración del .exe

**Archivo .env actualizado (REVISAR):**
```env
# Para localhost (tu PC):
HOST=localhost
PORT=5500
PUBLIC_BASE_URL=http://localhost:5500

# Para red interna (si otros acceden desde otra PC):
# HOST=0.0.0.0
# PORT=5500
# PUBLIC_BASE_URL=http://[IP-DEL-SERVIDOR]:5500
```

---

## 🚀 Próximos Pasos Recomendados

1. **Probar el login:**
   - Abre http://localhost:5500
   - Haz login con `admin@ldv.edu.pe` / `Admin2024@LDV`
   - Verifica que los datos cargan sin errores 401

2. **Si persisten errores 401:**
   - Abre F12 (DevTools)
   - Pestaña "Console"
   - Busca errores adicionales
   - Revisa que el token esté en localStorage después de login

3. **Si necesitas limpiar localStorage:**
   ```javascript
   localStorage.clear();
   // Luego vuelve a hacer login desde cero
   ```

4. **Para acceso desde otra PC en la red:**
   - Cambiar en `.env`:
     ```env
     HOST=0.0.0.0
     PUBLIC_BASE_URL=http://[TU-IP-LOCAL]:5500
     ```
   - Reiniciar el servidor

---

## 🛠️ Archivos Modificados

- ✅ `public/pages/index.html` — Removido script Cloudflare
- ✅ `public/pages/dashboard-admin.html` — Removido script Cloudflare + email protegido
- ✅ `public/js/global.js` — Sin cambios (funciona correctamente)
- ✅ `backend/server.js` — Sin cambios needed

---

## ❓ Preguntas Frecuentes

**P: ¿Por qué salen errores 401 si tengo las credenciales correctas?**
R: Debes hacer login PRIMERO. El token se genera durante el login y se guarda en localStorage. Sin ese paso, las APIs rechazan la solicitud.

**P: ¿Puedo acceder directamente a /dashboard-admin sin login?**
R: No. El frontend te redirige automáticamente a /login si no tienes un token válido.

**P: ¿El token se pierde si cierro la pestaña?**
R: Sí. localStorage es temporal por sesión de navegador. Versiones futwuras podrían usar sessionStorage con refresh tokens.

**P: ¿Cómo hago logout?**
R: Haz clic en "Cerrar sesión" en el navbar, o ejecuta `localStorage.clear();` en consola.

---

## ✨ Resumen de Cambios

| Archivo | Cambio | Efecto |
|---------|--------|--------|
| index.html | Removido `<script data-cfasync>` | ✅ Sin error 404 Cloudflare |
| dashboard-admin.html | Removido `<script data-cfasync>` | ✅ Sin error 404 Cloudflare |
| dashboard-admin.html | Email desprotegido | ✅ Visible: admin@ldv.edu.pe |
| global.js | Sin cambios | ✅ Autenticación intacta |
| server.js | Sin cambios | ✅ Backend funcional |

---

**Fecha de solución:** 14/04/2026  
**Versión:** 4.0 — Bolsa de Trabajo LDV
