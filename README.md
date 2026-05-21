# 🎓 Bolsa de Trabajo — Instituto Leonardo Da Vinci
**Sistema completo de bolsa de trabajo para el ITS Leonardo Da Vinci, Trujillo - Perú**

---

## 📁 Estructura del proyecto

```
bolsa-trabajo-ldv/
├── public/
│   ├── css/
│   │   └── global.css          ← Estilos globales
│   ├── js/
│   │   └── global.js           ← JS utilitario global
│   └── pages/
│       ├── index.html          ← Página principal (landing)
│       ├── login.html          ← Inicio de sesión
│       ├── registro.html       ← Registro (empresa/estudiante)
│       ├── ofertas.html        ← Ofertas públicas
│       ├── dashboard-empresa.html   ← Panel empresa
│       ├── dashboard-estudiante.html ← Panel estudiante
│       └── dashboard-admin.html     ← Panel administrador
├── backend/
│   ├── server.js               ← Servidor Express principal
│   └── db.js                   ← Conexión MySQL
├── database.sql                ← Script SQL completo
├── package.json
└── .env.example                ← Variables de entorno de ejemplo
```

---

## 🧰 Requisitos previos

Asegúrate de tener instalados los siguientes componentes en la computadora destino (Windows/Linux/macOS):

- **Node.js 18 LTS o superior** (incluye `npm`).<br>Comprueba con: `node -v` y `npm -v`.
- **Git** para clonar el repositorio (o descarga el ZIP desde GitHub).
- **MySQL Server 8.x** y un cliente de línea de comandos para ejecutar `SOURCE database.sql`.
- **Google Chrome / Chromium** (Puppeteer descargará su propio binario, pero en Windows ayuda tener Chrome instalado).
- Acceso a Internet para que `npm install` descargue dependencias y Puppeteer baje Chromium (~100 MB).

> En Windows, ejecuta la terminal como Administrador la primera vez para permitir que `npm` cree las carpetas necesarias.

## 🚀 Instalación paso a paso

1. **Clonar o copiar el proyecto**
	```bash
	git clone https://github.com/<tu-usuario>/bolsa-trabajo-ldv.git
	cd bolsa-trabajo-ldv
	```

2. **Instalar dependencias de Node** (esto crea la carpeta `node_modules` y descarga Chromium para Puppeteer)
	```bash
	npm install
	```

3. **Crear y completar las variables de entorno**
	```bash
	cp .env.example .env        # En PowerShell: Copy-Item .env.example .env
	```
	Luego edita `.env` y define:
	- `PORT=5500` (o el puerto que prefieras)
	- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
	- `JWT_SECRET` (puede ser cualquier cadena segura)
	- Opcional: `PUPPETEER_EXECUTABLE_PATH` si quieres usar un Chrome instalado manualmente.

4. **Crear la base de datos y las tablas**
	```sql
	-- Dentro del cliente de MySQL
	CREATE DATABASE bolsa_trabajo_ldv CHARACTER SET utf8mb4;
	USE bolsa_trabajo_ldv;
	SOURCE database.sql;
	```

5. **Verificar conexión** (opcional pero recomendado)
	```bash
	npm run dev   # inicia el servidor y revisa la consola por errores de conexión
	```
	Si todo está bien, detén el proceso con `Ctrl + C` y continúa con el paso 6.

6. **Iniciar el servidor**
	```bash
	npm run dev   # Hot reload con nodemon
	# o
	npm start     # Modo producción
	```
	El backend sirve también los archivos estáticos de `public/`, por lo que basta abrir:
	**http://localhost:5500**

7. **Ingresar con las credenciales de prueba** (ver tabla más abajo) o crear usuarios nuevos.

> Si necesitas reiniciar Puppeteer porque el navegador quedó bloqueado, elimina la carpeta `node_modules/.cache/puppeteer` y vuelve a ejecutar `npm install`.

---

## 🔑 Credenciales de prueba

| Rol | Correo | Contraseña |
|-----|--------|------------|
| **Administrador** | admin@ldv.edu.pe | Admin2024@LDV |

---

## ✨ Funcionalidades

### 🎓 Estudiantes / Egresados
- Registro como **Practicante**, **Egresado** o **Titulado**
- Búsqueda y filtrado de ofertas (tipo, modalidad, búsqueda)
- Postulación con **subida de CV en PDF**
- Carta de presentación
- Seguimiento del estado de postulaciones
- Notificación cuando es seleccionado

### 🏢 Empresas
- Registro con aprobación del administrador
- Panel de gestión de ofertas
- Publicación especificando: tipo (prácticas/trabajo) y a quién va dirigido
- Revisión de postulantes con CV descargable
- Selección y rechazo de candidatos

### 🛡️ Administrador
- Dashboard con estadísticas en tiempo real
- Aprobación/rechazo de empresas
- Gestión de estudiantes, ofertas y postulaciones
- Vista de candidatos seleccionados
- **Generación de Carta de Aceptación en PDF** con diseño profesional

---

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Backend**: Node.js + Express.js
- **Base de datos**: MySQL + mysql2
- **Autenticación**: JWT (jsonwebtoken)
- **Contraseñas**: bcryptjs
- **Subida de archivos**: Multer
- **Generación PDF**: PDFKit
