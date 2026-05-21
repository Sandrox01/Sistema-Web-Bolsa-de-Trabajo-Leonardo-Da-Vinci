#!/usr/bin/env node
/**
 * Auto-login helper para .exe
 * Uso: node scripts/auto-login.js
 * Abre el navegador e inicia sesión automáticamente
 */

const http = require('http');
const open = require('open');

const API_URL = 'http://localhost:5500/api/auth/login';
const APP_URL = 'http://localhost:5500/dashboard-admin';

// Credenciales de admin (CAMBIAR en producción)
const ADMIN_CREDS = {
    correo: 'admin@ldv.edu.pe',
    password: 'Admin2024@LDV'
};

console.log('🚀 Bolsa de Trabajo LDV — Auto-Login Helper\n');

// Esperar a que el servidor esté disponible
async function waitForServer(url, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await new Promise((resolve, reject) => {
                http.get(url, (res) => {
                    resolve();
                }).on('error', reject);
            });
            console.log('✅ Servidor disponible en ' + url);
            return true;
        } catch (err) {
            console.log(`⏳ Esperando servidor... (${i + 1}/${maxAttempts})`);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return false;
}

// Hacer login
async function autoLogin() {
    try {
        const data = JSON.stringify(ADMIN_CREDS);
        
        return new Promise((resolve, reject) => {
            const req = http.request(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                },
                timeout: 5000
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        if (res.statusCode === 200 && json.token) {
                            console.log('✅ Login exitoso');
                            console.log(`📝 Token: ${json.token.substring(0, 20)}...`);
                            resolve(json.token);
                        } else {
                            reject(new Error('Login fallido: ' + json.error));
                        }
                    } catch (e) {
                        reject(new Error('Respuesta inválida: ' + body));
                    }
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Timeout')));
            req.write(data);
            req.end();
        });
    } catch (err) {
        throw err;
    }
}

// Crear un servidor temporal que inyecte el token en localStorage
function createTokenServer(token) {
    const server = http.createServer((req, res) => {
        if (req.url === '/set-token') {
            const html = `
                <!DOCTYPE html>
                <html>
                <head><title>Iniciando sesión...</title></head>
                <body>
                    <script>
                        localStorage.setItem('ldv_token', '${token}');
                        localStorage.setItem('ldv_user', JSON.stringify({
                            tipo: 'admin',
                            nombre: 'Administrador',
                            id: 1
                        }));
                        window.location.href = '${APP_URL}';
                    </script>
                    Iniciando sesión... redirigiendo al dashboard.
                </body>
                </html>
            `;
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
        } else {
            res.writeHead(404);
            res.end();
        }
    });
    
    return server;
}

// Main
(async () => {
    try {
        // 1. Esperar que el servidor esté listo
        console.log('📡 Verificando disponibilidad del servidor...');
        if (!await waitForServer('http://localhost:5500', 30)) {
            console.error('❌ El servidor no está disponible después de 30 intentos');
            console.error('💡 Asegúrate de que el .exe está corriendo');
            process.exit(1);
        }

        // 2. Hacer login
        console.log('\n🔐 Iniciando sesión...');
        const token = await autoLogin();

        // 3. Crear servidor temporal para inyectar token
        console.log('\n⚙️  Configurando sesión de navegador...');
        const tokenServer = createTokenServer(token);
        tokenServer.listen(5501, () => {
            console.log('✅ Servidor temporal corriendo en puerto 5501');
            console.log('\n🌐 Abriendo navegador...');
            
            // Abrir navegador en el endpoint que inyecta el token
            open('http://localhost:5501/set-token').catch(err => {
                console.error('❌ No se pudo abrir el navegador automáticamente');
                console.log('💡 Abre manualmente: http://localhost:5501/set-token');
            });
            
            // Cerrar el servidor temporal después de 5 segundos
            setTimeout(() => {
                tokenServer.close();
                console.log('\n✨ ¡Listo! Usa el navegador abierto para acceder al dashboard');
                process.exit(0);
            }, 5000);
        });

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.log('\n💡 Solución manual:');
        console.log('  1. Abre: http://localhost:5500');
        console.log('  2. Haz clic en "Iniciar sesión"');
        console.log('  3. Usa: admin@ldv.edu.pe / Admin2024@LDV');
        process.exit(1);
    }
})();
