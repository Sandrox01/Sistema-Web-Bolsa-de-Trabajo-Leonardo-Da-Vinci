// ============================================================
// BOLSA DE TRABAJO LDV — Backend Principal v4.0
// Express + MySQL2 + JWT + Multer + PDFKit
// ============================================================
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const multer      = require('multer');
const fs          = require('fs');
const { renderPdfFromHtml } = require('./pdf/renderer');
const { buildHtmlTemplate, helpers: templateHelpers } = require('./pdf/templates');
const db          = require('./db');

const app        = express();
app.set('trust proxy', 1);
const HOST       = process.env.HOST || '0.0.0.0'; // Por defecto acepta cualquier IP
const PORT       = process.env.PORT || 5500;
const JWT_SECRET = process.env.JWT_SECRET || 'ldv_jwt_secret_2024';
const UPLOADS_DIR = process.pkg
    ? path.join(path.dirname(process.execPath), 'uploads')
    : path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

// ── Multer para CVs ─────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename:    (req, file, cb) => cb(null, 'cv-' + Date.now() + '-' + Math.round(Math.random()*1e9) + '.pdf')
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => file.mimetype === 'application/pdf'
        ? cb(null, true) : cb(new Error('Solo se permiten PDFs'))
});

// ── Auth Middleware ─────────────────────────────────────────
function authMiddleware(tipos = []) {
    return (req, res, next) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith('Bearer '))
            return res.status(401).json({ error: 'Token requerido' });
        try {
            const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
            req.user = decoded;
            if (tipos.length && !tipos.includes(decoded.tipo))
                return res.status(403).json({ error: 'Acceso no autorizado' });
            next();
        } catch { return res.status(401).json({ error: 'Token inválido o expirado' }); }
    };
}

// ── Helper: leer config ──────────────────────────────────────
async function getConfig(claves) {
    const [rows] = await db.query(
        `SELECT clave, valor FROM configuracion WHERE clave IN (${claves.map(() => '?').join(',')})`,
        claves
    );
    const cfg = {};
    rows.forEach(r => { cfg[r.clave] = r.valor; });
    return cfg;
}

function todayLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function validateFechaLimite(dateStr) {
    if (!dateStr) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
        return 'Formato de fecha inválido. Usa AAAA-MM-DD.';
    if (dateStr <= todayLocalISO())
        return 'La fecha límite debe ser posterior a la fecha actual.';
    return null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const BCRYPT_REGEX = /^\$2[aby]\$\d{2}\$.{53}$/;
const ESTADO_CIVIL_ALLOWED = ['soltero','casado','conviviente','divorciado','viudo'];
const YEAR_MIN = 1990;
const YEAR_MAX = new Date().getFullYear() + 5;

function sanitizeEmail(value) {
    const email = (value || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) throw new Error('Ingresa un correo válido.');
    if (email.length > 120) throw new Error('El correo es demasiado largo.');
    return email;
}

function sanitizePassword(value) {
    const raw = (value || '').trim();
    if (!raw) throw new Error('Ingresa una contraseña válida.');
    if (BCRYPT_REGEX.test(raw)) return raw; // Ya fue sanitizada anteriormente
    if (raw.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    return bcrypt.hashSync(raw, 10);
}

function sanitizeEstadoCivil(value) {
    const clean = (value || '').toString().trim().toLowerCase();
    if (!ESTADO_CIVIL_ALLOWED.includes(clean))
        throw new Error('Selecciona un estado civil válido.');
    return clean;
}

function sanitizeYearValue(value, label) {
    const clean = (value || '').toString().trim();
    if (!/^\d{4}$/.test(clean)) throw new Error(`${label} debe tener el formato AAAA.`);
    const numeric = Number(clean);
    if (numeric < YEAR_MIN || numeric > YEAR_MAX)
        throw new Error(`${label} debe estar entre ${YEAR_MIN} y ${YEAR_MAX}.`);
    return numeric;
}

const EDITABLE_FIELDS = {
    empresa: {
        correo: sanitizeEmail,
        telefono: (value) => {
            const digits = value.replace(/[^0-9+]/g, '');
            if (digits.length < 6) throw new Error('Ingresa un teléfono válido.');
            return digits;
        },
        direccion: (value) => value,
        sitio_web: (value) => {
            const url = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
            return url;
        },
        actividad_economica: (value) => value.toUpperCase(),
        descripcion: (value) => value,
        representante_nombre: (value) => value.toUpperCase(),
        representante_cargo: (value) => value,
        representante_dni: (value) => {
            const clean = value.replace(/[^0-9]/g, '');
            if (!/^\d{8}$/.test(clean)) throw new Error('El DNI del representante debe tener 8 dígitos.');
            return clean;
        },
        password: sanitizePassword
    },
    estudiante: {
        correo: sanitizeEmail,
        telefono: (value) => {
            const digits = value.replace(/[^0-9+]/g, '');
            if (digits.length < 6) throw new Error('Ingresa un teléfono válido.');
            return digits;
        },
        direccion: (value) => value,
        estado_civil: sanitizeEstadoCivil,
        ciclo: (value) => value.toUpperCase(),
        anio_egreso: (value) => sanitizeYearValue(value, 'El año de egreso'),
        anio_titulacion: (value) => sanitizeYearValue(value, 'El año de titulación'),
        habilidades: (value) => value,
        password: sanitizePassword
    }
};

function sanitizeEditablePayload(tipo, payload = {}, { requireChanges = true } = {}) {
    if (!payload || typeof payload !== 'object') return { error: 'Los cambios enviados son inválidos.' };
    const map = EDITABLE_FIELDS[tipo];
    if (!map) return { error: 'Tipo de usuario inválido.' };
    const clean = {};
    for (const [field, sanitizer] of Object.entries(map)) {
        if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;
        let value = payload[field];
        if (typeof value === 'string') value = value.trim();
        if (value === '' || value === null || typeof value === 'undefined') continue;
        try {
            clean[field] = sanitizer(value);
        } catch (err) {
            return { error: err.message || `Dato inválido para ${field}` };
        }
    }
    if (!Object.keys(clean).length && requireChanges)
        return { error: 'No se detectaron cambios nuevos.' };
    return { data: clean };
}

function parseCampos(row) {
    if (!row) return row;
    try {
        row.campos = typeof row.campos === 'string' ? JSON.parse(row.campos) : (row.campos || {});
    } catch {
        row.campos = {};
    }
    return row;
}

function safeDownloadName(name, fallback = 'cv.pdf') {
    const raw = (name || fallback).toString();
    const clean = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
    return clean || fallback;
}

function resolveCvPath(cvUrl) {
    const filename = path.basename(cvUrl || '');
    if (!filename) return null;
    return path.join(UPLOADS_DIR, filename);
}

function toPublicUrl(req, urlPath) {
    if (!urlPath) return urlPath;
    if (/^https?:\/\//i.test(urlPath)) return urlPath;
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const normalized = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
    return `${base}${normalized}`;
}

function normalizeCvUrls(req, rows) {
    if (!Array.isArray(rows)) return rows;
    rows.forEach(row => {
        const cvId = row?.postulacion_id || row?.id;
        if (cvId) {
            row.cv_url = toPublicUrl(req, `/api/cv/${cvId}`);
            return;
        }
        if (row?.cv_url) row.cv_url = toPublicUrl(req, row.cv_url);
    });
    return rows;
}

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
    try {
        const { correo, password } = req.body;
        if (!correo || !password)
            return res.status(400).json({ error: 'Correo y contraseña requeridos' });

        let user = null, tipo = null;

        const [admins] = await db.query('SELECT * FROM administradores WHERE correo = ?', [correo]);
        if (admins.length) { user = admins[0]; tipo = 'admin'; }

        if (!user) {
            const [emps] = await db.query('SELECT * FROM empresas WHERE correo = ?', [correo]);
            if (emps.length) { user = emps[0]; tipo = 'empresa'; }
        }
        if (!user) {
            const [ests] = await db.query('SELECT * FROM estudiantes WHERE correo = ?', [correo]);
            if (ests.length) { user = ests[0]; tipo = 'estudiante'; }
        }

        if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

        // Verificar estado (empresas y estudiantes)
        if ((tipo === 'empresa' || tipo === 'estudiante') && user.estado !== 'aprobado') {
            if (user.estado === 'pendiente')
                return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación por el administrador.' });
            return res.status(403).json({ error: 'Tu cuenta ha sido desactivada. Contacta al administrador.' });
        }

        const nombre = tipo === 'admin'      ? user.nombre
                     : tipo === 'empresa'    ? user.razon_social
                     : `${user.nombres} ${user.apellidos}`;

        const token = jwt.sign({ id: user.id, tipo, nombre }, JWT_SECRET, { expiresIn: '24h' });
        const redirect = { admin: '/dashboard-admin', empresa: '/dashboard-empresa', estudiante: '/dashboard-estudiante' }[tipo];
        res.json({ token, tipo, nombre, id: user.id, redirect });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ── Registro Estudiante (ahora con código + estado pendiente) ─
app.post('/api/auth/registro-estudiante', async (req, res) => {
    try {
        const { nombres, apellidos, dni, codigo_estudiante, telefono, direccion,
            correo, password, fecha_nacimiento, nacionalidad, sexo,
            estado_civil, carrera, ciclo, tipo, anio_egreso, anio_titulacion, habilidades } = req.body;

        if (!nombres || !apellidos || !dni || !codigo_estudiante || !correo || !password || !carrera || !tipo ||
            !direccion || !nacionalidad || !sexo || !estado_civil)
            return res.status(400).json({ error: 'Campos obligatorios faltantes' });

        const [existing] = await db.query(
            'SELECT id FROM estudiantes WHERE correo=? OR dni=? OR codigo_estudiante=?',
            [correo, dni, codigo_estudiante]
        );
        if (existing.length)
            return res.status(409).json({ error: 'Ya existe una cuenta con ese correo, DNI o código de estudiante' });

        const hash = await bcrypt.hash(password, 10);
        const sexoVal = sexo ? sexo.toLowerCase() : null;
        const estadoCivilVal = estado_civil ? estado_civil.toLowerCase() : null;
        const nacionalidadVal = (nacionalidad?.trim() || 'PERUANA').toUpperCase();
        const tipoVal = (tipo || '').toLowerCase();
        const sexoAllowed = ['masculino','femenino','otro'];
        const estadoAllowed = ['soltero','casado','conviviente','divorciado','viudo'];
        const tipoAllowed = ['practicante','egresado','titulado'];
        if (!sexoAllowed.includes(sexoVal))
            return res.status(400).json({ error: 'Selecciona un valor de sexo válido.' });
        if (!estadoAllowed.includes(estadoCivilVal))
            return res.status(400).json({ error: 'Selecciona un estado civil válido.' });
        if (!tipoAllowed.includes(tipoVal))
            return res.status(400).json({ error: 'Selecciona una condición válida (practicante, egresado o titulado).' });

        const YEAR_MIN = 1990;
        const YEAR_MAX = new Date().getFullYear() + 5;
        const yearRegex = /^\d{4}$/;
        const validateYear = (value, label) => {
            if (!value) return { error: `${label} es obligatorio.` };
            const clean = String(value).trim();
            if (!yearRegex.test(clean)) return { error: `${label} debe tener el formato AAAA.` };
            const numeric = Number(clean);
            if (numeric < YEAR_MIN || numeric > YEAR_MAX)
                return { error: `${label} debe estar entre ${YEAR_MIN} y ${YEAR_MAX}.` };
            return { value: numeric };
        };

        let cicloVal = (ciclo || '').trim() || null;
        let anioEgresoVal = null;
        let anioTitVal = null;

        if (tipoVal === 'practicante') {
            if (!cicloVal)
                return res.status(400).json({ error: 'Indica tu ciclo actual si eres practicante.' });
        } else if (tipoVal === 'egresado') {
            cicloVal = null;
            const egresoCheck = validateYear(anio_egreso, 'El año de egreso');
            if (egresoCheck.error) return res.status(400).json({ error: egresoCheck.error });
            anioEgresoVal = egresoCheck.value;
        } else if (tipoVal === 'titulado') {
            cicloVal = null;
            const egresoCheck = validateYear(anio_egreso, 'El año de egreso');
            if (egresoCheck.error) return res.status(400).json({ error: egresoCheck.error });
            const tituloCheck = validateYear(anio_titulacion, 'El año de titulación');
            if (tituloCheck.error) return res.status(400).json({ error: tituloCheck.error });
            if (tituloCheck.value < egresoCheck.value)
                return res.status(400).json({ error: 'El año de titulación no puede ser menor al año de egreso.' });
            anioEgresoVal = egresoCheck.value;
            anioTitVal = tituloCheck.value;
        }

        await db.query(
            `INSERT INTO estudiantes
             (nombres,apellidos,dni,codigo_estudiante,telefono,direccion,correo,password_hash,
              fecha_nacimiento,nacionalidad,sexo,estado_civil,carrera,ciclo,tipo,
              anio_egreso,anio_titulacion,habilidades,estado)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pendiente')`,
            [nombres, apellidos, dni, codigo_estudiante, telefono||null, direccion||null, correo, hash,
             fecha_nacimiento||null, nacionalidadVal, sexoVal, estadoCivilVal, carrera, cicloVal, tipoVal,
             anioEgresoVal, anioTitVal, habilidades||null]
        );
        res.status(201).json({ message: 'Solicitud enviada. La secretaría verificará tu código y aprobará tu cuenta en breve.' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'Correo, DNI o código ya registrado' });
        res.status(500).json({ error: 'Error al registrar' });
    }
});

// ── Registro Empresa ─────────────────────────────────────────
app.post('/api/auth/registro-empresa', async (req, res) => {
    try {
        const { razon_social, ruc, sector, descripcion, direccion, telefono,
                correo, sitio_web, password, nombre_contacto,
                representante_nombre, representante_cargo, representante_dni,
                actividad_economica } = req.body;

        if (!razon_social || !ruc || !correo || !password || !representante_nombre || !representante_dni || !actividad_economica)
            return res.status(400).json({ error: 'Completa los datos requeridos de la empresa y su representante legal.' });

        const [existing] = await db.query(
            'SELECT id FROM empresas WHERE correo=? OR ruc=?', [correo, ruc]);
        if (existing.length)
            return res.status(409).json({ error: 'Ya existe una empresa con ese correo o RUC' });

        const hash = await bcrypt.hash(password, 10);
        const actividadVal = actividad_economica ? actividad_economica.toUpperCase() : null;
        const representanteNombreVal = representante_nombre ? representante_nombre.toUpperCase() : null;
        const representanteDniVal = representante_dni ? representante_dni.trim() : null;
        await db.query(
            `INSERT INTO empresas
             (razon_social,ruc,sector,descripcion,actividad_economica,direccion,telefono,correo,
              sitio_web,password_hash,nombre_contacto,representante_nombre,representante_cargo,representante_dni)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [razon_social, ruc, sector||null, descripcion||null, actividadVal, direccion||null,
             telefono||null, correo, sitio_web||null, hash, nombre_contacto||null,
             representanteNombreVal, representante_cargo||'Gerente General', representanteDniVal]
        );
        res.status(201).json({ message: 'Empresa registrada. Pendiente de aprobación por el administrador.' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'Correo o RUC ya registrado' });
        res.status(500).json({ error: 'Error al registrar empresa' });
    }
});

// ═══════════════════════════════════════════════════════════
// OFERTAS
// ═══════════════════════════════════════════════════════════
app.get('/api/ofertas', async (req, res) => {
    try {
        const { tipo, modalidad, dirigido_a, q } = req.query;
        let sql = `
            SELECT o.*, emp.razon_social AS nombre_empresa, emp.sector,
            (SELECT COUNT(*) FROM postulaciones WHERE oferta_id = o.id) AS total_postulantes
            FROM ofertas o
            JOIN empresas emp ON emp.id = o.empresa_id
            WHERE o.estado = 'activa' AND emp.estado = 'aprobado'`;
        const params = [];
        if (tipo)       { sql += ' AND o.tipo_oferta=?';  params.push(tipo); }
        if (modalidad)  { sql += ' AND o.modalidad=?';    params.push(modalidad); }
        if (dirigido_a) { sql += ' AND (o.dirigido_a=? OR o.dirigido_a="todos")'; params.push(dirigido_a); }
        if (q) {
            sql += ' AND (o.titulo LIKE ? OR o.descripcion LIKE ? OR emp.razon_social LIKE ? OR o.carrera_afin LIKE ?)';
            const like = `%${q}%`;
            params.push(like, like, like, like);
        }
        sql += ' ORDER BY o.creado_en DESC';
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Error al obtener ofertas' }); }
});

app.get('/api/ofertas/empresa/mias', authMiddleware(['empresa']), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT o.*,
            (SELECT COUNT(*) FROM postulaciones WHERE oferta_id=o.id) AS total_postulantes,
            (SELECT COUNT(*) FROM postulaciones WHERE oferta_id=o.id AND estado='seleccionado' AND cerrada=0) AS total_preseleccionados,
            (SELECT COUNT(*) FROM postulaciones WHERE oferta_id=o.id AND estado='seleccionado' AND cerrada=1) AS total_contratados,
            (SELECT COUNT(*) FROM postulaciones WHERE oferta_id=o.id AND estado='en_revision' AND nota_admin IS NOT NULL) AS total_devueltos
            FROM ofertas o WHERE o.empresa_id=? ORDER BY o.creado_en DESC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Error al obtener ofertas' }); }
});

app.post('/api/ofertas', authMiddleware(['empresa']), async (req, res) => {
    try {
        const { titulo, descripcion, requisitos, beneficios, actividades,
            tipo_oferta, dirigido_a, modalidad, vacantes, horario, horario_dias,
            salario_rango, carrera_afin, area_practica, horas_practicas,
            fecha_inicio, fecha_fin, fecha_limite, estado } = req.body;

        const fechaInicioTrim = fecha_inicio ? fecha_inicio.trim() : '';
        const fechaFinTrim = fecha_fin ? fecha_fin.trim() : '';
        const fechaLimiteTrim = fecha_limite ? fecha_limite.trim() : '';
        const horarioDiasTrim = horario_dias ? horario_dias.trim() : '';
        const areaPracticaTrim = area_practica ? area_practica.trim() : '';
        const actividadesTrim = actividades ? actividades.trim() : '';
        const horasValue = horas_practicas ? parseInt(horas_practicas, 10) : 128;
        const isTrabajo = tipo_oferta === 'trabajo';
        const isPracticasContext = !isTrabajo || dirigido_a === 'practicante';

        if (!titulo || !descripcion || !tipo_oferta || !dirigido_a)
            return res.status(400).json({ error: 'Campos obligatorios faltantes' });
        if (!areaPracticaTrim || !horarioDiasTrim || !fechaInicioTrim || (isPracticasContext && !fechaFinTrim)) {
            const errorMsg = isPracticasContext
                ? 'Completa el área, los días y las fechas de la pasantía.'
                : 'Completa el área, los días y la fecha de inicio planificada.';
            return res.status(400).json({ error: errorMsg });
        }

        const fechaLimiteError = validateFechaLimite(fechaLimiteTrim);
        if (fechaLimiteError) return res.status(400).json({ error: fechaLimiteError });

        const [result] = await db.query(`
            INSERT INTO ofertas
              (empresa_id,titulo,descripcion,requisitos,beneficios,actividades,
               tipo_oferta,dirigido_a,modalidad,vacantes,horario,horario_dias,salario_rango,
             carrera_afin,area_practica,horas_practicas,fecha_inicio,fecha_fin,fecha_limite,estado)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [req.user.id, titulo, descripcion, requisitos||null, beneficios||null, actividadesTrim||null,
             tipo_oferta, dirigido_a, modalidad||'presencial', vacantes||1,
             horario||null, horarioDiasTrim||null, salario_rango||null, carrera_afin||null, areaPracticaTrim||null,
             horasValue || 128, fechaInicioTrim || null, fechaFinTrim || null,
             fechaLimiteTrim || null, estado||'activa']
        );
        res.status(201).json({ id: result.insertId, message: 'Oferta publicada exitosamente' });
    } catch (e) { res.status(500).json({ error: 'Error al publicar oferta' }); }
});

app.put('/api/ofertas/:id', authMiddleware(['empresa']), async (req, res) => {
    try {
        const ofertaId = req.params.id;
        const [[oferta]] = await db.query(
            'SELECT id, estado FROM ofertas WHERE id=? AND empresa_id=?',
            [ofertaId, req.user.id]
        );
        if (!oferta) return res.status(404).json({ error: 'Oferta no encontrada' });
        if (oferta.estado === 'cerrada')
            return res.status(400).json({ error: 'No puedes editar una oferta cerrada.' });

        const {
            titulo, descripcion, requisitos, beneficios, actividades,
            tipo_oferta, dirigido_a, modalidad, vacantes, horario, horario_dias,
            salario_rango, carrera_afin, area_practica, horas_practicas,
            fecha_inicio, fecha_fin, fecha_limite, estado
        } = req.body;

        const fechaInicioTrim = fecha_inicio ? fecha_inicio.trim() : '';
        const fechaFinTrim = fecha_fin ? fecha_fin.trim() : '';
        const horarioDiasTrim = horario_dias ? horario_dias.trim() : '';
        const areaPracticaTrim = area_practica ? area_practica.trim() : '';
        const actividadesTrim = actividades ? actividades.trim() : '';
        const isTrabajo = tipo_oferta === 'trabajo';
        const isPracticasContext = !isTrabajo || dirigido_a === 'practicante';

        if (!titulo || !descripcion || !tipo_oferta || !dirigido_a)
            return res.status(400).json({ error: 'Campos obligatorios faltantes' });
        if (!areaPracticaTrim || !horarioDiasTrim || !fechaInicioTrim || (isPracticasContext && !fechaFinTrim)) {
            const errorMsg = isPracticasContext
                ? 'Completa el área, los días y las fechas de la pasantía.'
                : 'Completa el área, los días y la fecha de inicio planificada.';
            return res.status(400).json({ error: errorMsg });
        }
        if (estado && !['activa', 'pausada'].includes(estado))
            return res.status(400).json({ error: 'Estado no permitido' });

        const fechaLimiteTrim = fecha_limite ? fecha_limite.trim() : '';
        const horasValue = horas_practicas ? parseInt(horas_practicas, 10) : (oferta.horas_practicas || 128);
        const fechaLimiteError = validateFechaLimite(fechaLimiteTrim);
        if (fechaLimiteError) return res.status(400).json({ error: fechaLimiteError });

        await db.query(`
            UPDATE ofertas SET
                titulo=?, descripcion=?, requisitos=?, beneficios=?, actividades=?,
                tipo_oferta=?, dirigido_a=?, modalidad=?, vacantes=?,
                horario=?, horario_dias=?, salario_rango=?, carrera_afin=?, area_practica=?,
                horas_practicas=?, fecha_inicio=?, fecha_fin=?, fecha_limite=?, estado=?
            WHERE id=?`,
            [
                titulo, descripcion, requisitos||null, beneficios||null, actividadesTrim||null,
                tipo_oferta, dirigido_a, modalidad||'presencial', vacantes||1,
                horario||null, horarioDiasTrim||null, salario_rango||null, carrera_afin||null, areaPracticaTrim||null,
                horasValue || 128, fechaInicioTrim || null, fechaFinTrim || null, fechaLimiteTrim || null,
                estado || oferta.estado,
                ofertaId
            ]
        );
        res.json({ message: 'Oferta actualizada correctamente' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al actualizar la oferta' });
    }
});

app.patch('/api/ofertas/:id/estado', authMiddleware(['empresa']), async (req, res) => {
    try {
        const { estado } = req.body;
        const [[oferta]] = await db.query(
            'SELECT id, estado FROM ofertas WHERE id=? AND empresa_id=?',
            [req.params.id, req.user.id]
        );
        if (!oferta) return res.status(404).json({ error: 'Oferta no encontrada' });
        if (oferta.estado === 'cerrada')
            return res.status(400).json({ error: 'Una oferta cerrada no puede modificar su estado.' });
        if (!['activa','pausada'].includes(estado))
            return res.status(400).json({ error: 'Solo se permite activa o pausada.' });

        await db.query('UPDATE ofertas SET estado=? WHERE id=?', [estado, req.params.id]);
        res.json({ message: 'Estado actualizado' });
    } catch (e) { res.status(500).json({ error: 'Error al actualizar estado' }); }
});

// ═══════════════════════════════════════════════════════════
// POSTULACIONES
// ═══════════════════════════════════════════════════════════
app.post('/api/postulaciones', authMiddleware(['estudiante']), upload.single('cv'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'CV en PDF requerido' });
        const { oferta_id, carta_presentacion } = req.body;
        if (!oferta_id) return res.status(400).json({ error: 'Oferta requerida' });

        const [ofertas] = await db.query('SELECT * FROM ofertas WHERE id=? AND estado="activa"', [oferta_id]);
        if (!ofertas.length) return res.status(404).json({ error: 'Oferta no disponible' });

        const [dup] = await db.query(
            'SELECT id FROM postulaciones WHERE estudiante_id=? AND oferta_id=?',
            [req.user.id, oferta_id]);
        if (dup.length) return res.status(409).json({ error: 'Ya postulaste a esta oferta' });

        await db.query(
            'INSERT INTO postulaciones (estudiante_id,oferta_id,cv_url,cv_filename,carta_presentacion) VALUES (?,?,?,?,?)',
            [req.user.id, oferta_id, '/uploads/'+req.file.filename, req.file.originalname, carta_presentacion||null]
        );
        res.status(201).json({ message: 'Postulación enviada exitosamente' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya postulaste a esta oferta' });
        res.status(500).json({ error: 'Error al enviar postulación' });
    }
});

app.get('/api/cv/:id', authMiddleware(['admin','empresa','estudiante']), async (req, res) => {
    try {
        const postulacionId = Number(req.params.id);
        if (!Number.isInteger(postulacionId))
            return res.status(400).json({ error: 'Postulación inválida' });

        const [rows] = await db.query(
            `SELECT p.cv_url, p.cv_filename, p.estudiante_id, o.empresa_id
             FROM postulaciones p
             JOIN ofertas o ON o.id = p.oferta_id
             WHERE p.id = ?`,
            [postulacionId]
        );
        if (!rows.length) return res.status(404).json({ error: 'CV no encontrado' });

        const record = rows[0];
        if (req.user.tipo === 'empresa' && record.empresa_id !== req.user.id)
            return res.status(403).json({ error: 'No autorizado' });
        if (req.user.tipo === 'estudiante' && record.estudiante_id !== req.user.id)
            return res.status(403).json({ error: 'No autorizado' });

        const filePath = resolveCvPath(record.cv_url);
        if (!filePath || !fs.existsSync(filePath))
            return res.status(404).json({ error: 'Archivo no disponible' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${safeDownloadName(record.cv_filename)}"`);
        res.setHeader('Cache-Control', 'private, max-age=0, no-store');
        res.sendFile(filePath);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al obtener el CV' });
    }
});

app.get('/api/postulaciones/mias', authMiddleware(['estudiante']), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, o.titulo, o.tipo_oferta, o.id AS oferta_id, emp.razon_social
            FROM postulaciones p
            JOIN ofertas o   ON o.id   = p.oferta_id
            JOIN empresas emp ON emp.id = o.empresa_id
            WHERE p.estudiante_id=? ORDER BY p.fecha_postulacion DESC`,
            [req.user.id]
        );
        res.json(normalizeCvUrls(req, rows));
    } catch (e) { res.status(500).json({ error: 'Error al obtener postulaciones' }); }
});

app.get('/api/postulaciones/oferta/:id', authMiddleware(['empresa']), async (req, res) => {
    try {
        const [ofertas] = await db.query('SELECT id FROM ofertas WHERE id=? AND empresa_id=?', [req.params.id, req.user.id]);
        if (!ofertas.length) return res.status(403).json({ error: 'No autorizado' });

        const [rows] = await db.query(`
            SELECT p.*, e.nombres, e.apellidos, e.dni, e.codigo_estudiante,
                e.carrera, e.tipo, e.correo, e.telefono, e.ciclo, e.habilidades,
                ca.fecha_generacion AS carta_generada, ca.numero_carta
            FROM postulaciones p
            JOIN estudiantes e ON e.id = p.estudiante_id
            LEFT JOIN cartas_aceptacion ca ON ca.postulacion_id = p.id
            WHERE p.oferta_id=?
            ORDER BY FIELD(p.estado,'seleccionado','en_revision','enviada','rechazado'),
                     p.cerrada ASC, p.fecha_postulacion DESC`,
            [req.params.id]
        );
        res.json(normalizeCvUrls(req, rows));
    } catch (e) { res.status(500).json({ error: 'Error al obtener postulantes' }); }
});

app.patch('/api/postulaciones/:id/revision', authMiddleware(['empresa']), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.id, p.estado, p.cerrada FROM postulaciones p
            JOIN ofertas o ON o.id=p.oferta_id WHERE p.id=? AND o.empresa_id=?`,
            [req.params.id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'No autorizado' });
        if (rows[0].cerrada) return res.status(400).json({ error: 'Postulación ya cerrada' });
        if (rows[0].estado !== 'enviada') return res.status(400).json({ error: 'Solo desde estado enviada' });
        await db.query('UPDATE postulaciones SET estado="en_revision" WHERE id=?', [req.params.id]);
        res.json({ message: 'Marcado como en revisión' });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.patch('/api/postulaciones/:id/seleccionar', authMiddleware(['empresa']), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.id, p.estado, p.cerrada FROM postulaciones p
            JOIN ofertas o ON o.id=p.oferta_id WHERE p.id=? AND o.empresa_id=?`,
            [req.params.id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'No autorizado' });
        if (rows[0].cerrada) return res.status(400).json({ error: 'Postulación ya cerrada' });
        if (rows[0].estado === 'seleccionado') return res.status(400).json({ error: 'Candidato ya seleccionado' });
        if (rows[0].estado === 'rechazado') return res.status(400).json({ error: 'No se puede seleccionar un candidato rechazado' });

        await db.query('UPDATE postulaciones SET estado="seleccionado", cerrada=0, nota_admin=NULL WHERE id=?', [req.params.id]);
        res.json({ message: 'Candidato preseleccionado. El administrador generará los documentos oficiales.' });
    } catch (e) { res.status(500).json({ error: 'Error al seleccionar candidato' }); }
});

app.patch('/api/postulaciones/:id/rechazar', authMiddleware(['empresa']), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.id, p.estado, p.cerrada FROM postulaciones p
            JOIN ofertas o ON o.id=p.oferta_id WHERE p.id=? AND o.empresa_id=?`,
            [req.params.id, req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'No autorizado' });
        if (rows[0].cerrada) return res.status(400).json({ error: 'Postulación ya cerrada' });
        if (rows[0].estado === 'seleccionado')
            return res.status(400).json({ error: 'No puedes rechazar un candidato ya seleccionado. Contacta al administrador.' });

        await db.query('UPDATE postulaciones SET estado="rechazado", nota_empresa=?, nota_admin=NULL WHERE id=?',
            [req.body.nota||null, req.params.id]);
        res.json({ message: 'Candidato rechazado' });
    } catch (e) { res.status(500).json({ error: 'Error al rechazar candidato' }); }
});

// ═══════════════════════════════════════════════════════════
// PERFIL
// ═══════════════════════════════════════════════════════════
app.get('/api/estudiantes/perfil', authMiddleware(['estudiante']), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id,nombres,apellidos,dni,codigo_estudiante,correo,telefono,direccion,
                    carrera,ciclo,tipo,habilidades,fecha_nacimiento,nacionalidad,sexo,
                    estado_civil,anio_egreso,anio_titulacion
             FROM estudiantes WHERE id=?`,
            [req.user.id]);
        if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/empresas/perfil', authMiddleware(['empresa']), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id,razon_social,ruc,sector,descripcion,actividad_economica,
                    direccion,telefono,correo,sitio_web,estado,nombre_contacto,
                    representante_nombre,representante_cargo,representante_dni,creado_en
             FROM empresas WHERE id=?`,
            [req.user.id]);
        if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/perfil/solicitudes', authMiddleware(['empresa','estudiante']), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id,campos,motivo,estado,respuesta_admin,creado_en,resuelto_en
             FROM solicitudes_edicion
             WHERE tipo_usuario=? AND registro_id=?
             ORDER BY creado_en DESC`,
            [req.user.tipo, req.user.id]
        );
        res.json(rows.map(r => parseCampos(r)));
    } catch (e) {
        res.status(500).json({ error: 'No pudimos cargar tus solicitudes.' });
    }
});

app.post('/api/perfil/solicitudes', authMiddleware(['empresa','estudiante']), async (req, res) => {
    try {
        const motivo = (req.body?.motivo || '').trim() || null;
        const rawCampos = req.body?.campos || {};
        const { data, error } = sanitizeEditablePayload(req.user.tipo, rawCampos);
        if (error) return res.status(400).json({ error });
        const [[pend]] = await db.query(
            `SELECT COUNT(*) AS total FROM solicitudes_edicion
             WHERE tipo_usuario=? AND registro_id=? AND estado='pendiente'`,
            [req.user.tipo, req.user.id]
        );
        if (pend.total > 0)
            return res.status(409).json({ error: 'Ya tienes una solicitud pendiente. Espera la revisión del administrador.' });

        await db.query(
            `INSERT INTO solicitudes_edicion (tipo_usuario,registro_id,campos,motivo)
             VALUES (?,?,?,?)`,
            [req.user.tipo, req.user.id, JSON.stringify(data), motivo]
        );
        res.status(201).json({ message: 'Solicitud enviada correctamente. El administrador validará los cambios.' });
    } catch (e) {
        res.status(500).json({ error: 'No pudimos registrar tu solicitud.' });
    }
});

// ═══════════════════════════════════════════════════════════
// ADMIN — ESTUDIANTES (aprobación igual que empresas)
// ═══════════════════════════════════════════════════════════
app.get('/api/admin/estudiantes', authMiddleware(['admin']), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id,nombres,apellidos,dni,codigo_estudiante,correo,telefono,direccion,
                    carrera,ciclo,tipo,habilidades,fecha_nacimiento,nacionalidad,
                    estado_civil,anio_egreso,anio_titulacion,estado,nota_admin,creado_en
             FROM estudiantes ORDER BY creado_en DESC`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.patch('/api/admin/estudiantes/:id/estado', authMiddleware(['admin']), async (req, res) => {
    try {
        const { estado, nota_admin } = req.body;
        if (!['aprobado','rechazado','pendiente'].includes(estado))
            return res.status(400).json({ error: 'Estado no válido' });
        await db.query('UPDATE estudiantes SET estado=?, nota_admin=? WHERE id=?',
            [estado, nota_admin||null, req.params.id]);
        res.json({ message: `Estudiante ${estado}` });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});


app.get('/api/admin/ediciones', authMiddleware(['admin']), async (req, res) => {
    try {
        const { estado } = req.query;
        const allowed = ['pendiente','aprobado','rechazado'];
        let sql = `SELECT se.*, se.campos, se.motivo, se.estado,
                          emp.razon_social, emp.correo AS correo_empresa,
                          est.nombres, est.apellidos, est.correo AS correo_estudiante
                   FROM solicitudes_edicion se
                   LEFT JOIN empresas emp ON emp.id = se.registro_id AND se.tipo_usuario='empresa'
                   LEFT JOIN estudiantes est ON est.id = se.registro_id AND se.tipo_usuario='estudiante'`;
        const params = [];
        if (estado && allowed.includes(estado)) {
            sql += ' WHERE se.estado=?';
            params.push(estado);
        }
        sql += ' ORDER BY se.creado_en DESC';
        const [rows] = await db.query(sql, params);
        const mapped = rows.map(r => {
            const row = { ...r };
            parseCampos(row);
            row.solicitante = row.tipo_usuario === 'empresa'
                ? (row.razon_social || 'Empresa sin nombre')
                : `${row.nombres || ''} ${row.apellidos || ''}`.trim();
            row.correo_contacto = row.tipo_usuario === 'empresa'
                ? (row.correo_empresa || '')
                : (row.correo_estudiante || '');
            delete row.razon_social;
            delete row.correo_empresa;
            delete row.nombres;
            delete row.apellidos;
            delete row.correo_estudiante;
            return row;
        });
        res.json(mapped);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'No pudimos cargar las solicitudes de edición.' });
    }
});

app.patch('/api/admin/ediciones/:id', authMiddleware(['admin']), async (req, res) => {
    const { estado, respuesta_admin } = req.body || {};
    if (!['aprobado','rechazado'].includes(estado))
        return res.status(400).json({ error: 'Estado inválido.' });
    try {
        const [[row]] = await db.query('SELECT * FROM solicitudes_edicion WHERE id=?', [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Solicitud no encontrada.' });
        if (row.estado !== 'pendiente')
            return res.status(400).json({ error: 'La solicitud ya fue revisada.' });

        const solicitud = parseCampos({ ...row });
        const { data, error } = sanitizeEditablePayload(solicitud.tipo_usuario, solicitud.campos, { requireChanges: true });
        if (error) return res.status(400).json({ error });

        let conn;
        try {
            conn = await db.getConnection();
            await conn.beginTransaction();

            if (estado === 'aprobado') {
                const entries = Object.entries(data).map(([key, value]) =>
                    key === 'password' ? ['password_hash', value] : [key, value]
                );
                if (!entries.length) throw new Error('No hay campos para actualizar.');
                const table = solicitud.tipo_usuario === 'empresa' ? 'empresas' : 'estudiantes';

                const correoEntry = entries.find(([column]) => column === 'correo');
                if (correoEntry) {
                    const [[exists]] = await conn.query(
                        `SELECT id FROM ${table} WHERE correo=? AND id<>?`,
                        [correoEntry[1], solicitud.registro_id]
                    );
                    if (exists) throw new Error('El correo ya está en uso por otra cuenta.');
                }

                const setClause = entries.map(([column]) => `${column}=?`).join(', ');
                const values = entries.map(([, value]) => value);
                await conn.query(
                    `UPDATE ${table} SET ${setClause}, actualizado_en=NOW() WHERE id=?`,
                    [...values, solicitud.registro_id]
                );
            }

            await conn.query(
                `UPDATE solicitudes_edicion
                 SET estado=?, respuesta_admin=?, aprobado_por=?, resuelto_en=NOW()
                 WHERE id=?`,
                [estado, (respuesta_admin || '').trim() || null, req.user.id, solicitud.id]
            );

            await conn.commit();
            res.json({ message: estado === 'aprobado' ? 'Solicitud aprobada y cambios aplicados.' : 'Solicitud rechazada.' });
        } catch (err) {
            if (conn) await conn.rollback();
            console.error(err);
            res.status(500).json({ error: 'No pudimos resolver la solicitud.' });
        } finally {
            if (conn) conn.release();
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al procesar la solicitud.' });
    }
});

// ═══════════════════════════════════════════════════════════
// ADMIN — CONFIGURACIÓN (responsable bolsa, docente supervisor)
// ═══════════════════════════════════════════════════════════
app.get('/api/admin/configuracion', authMiddleware(['admin']), async (req, res) => {
    try {
        const [rows] = await db.query('SELECT clave, valor, descripcion FROM configuracion');
        const cfg = {};
        rows.forEach(r => { cfg[r.clave] = { valor: r.valor, descripcion: r.descripcion }; });
        res.json(cfg);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/admin/configuracion', authMiddleware(['admin']), async (req, res) => {
    try {
        const entries = Object.entries(req.body);
        for (const [clave, valor] of entries) {
            await db.query(
                'UPDATE configuracion SET valor=? WHERE clave=?',
                [valor, clave]
            );
        }
        res.json({ message: 'Configuración actualizada' });
    } catch (e) { res.status(500).json({ error: 'Error al guardar configuración' }); }
});

// ═══════════════════════════════════════════════════════════
// ADMIN — EMPRESAS
// ═══════════════════════════════════════════════════════════
app.get('/api/stats', async (_req, res) => {
    try {
        const [[stats]] = await db.query('SELECT * FROM v_stats');
        res.json(stats || {});
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/admin/stats', async (req, res) => {
    try {
        const [[stats]] = await db.query('SELECT * FROM v_stats');
        res.json(stats || {});
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/admin/empresas', authMiddleware(['admin']), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id,razon_social,ruc,sector,correo,telefono,estado,
                    nombre_contacto,representante_nombre,representante_cargo,
                    representante_dni,actividad_economica,creado_en
             FROM empresas ORDER BY creado_en DESC`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.patch('/api/admin/empresas/:id/estado', authMiddleware(['admin']), async (req, res) => {
    try {
        await db.query('UPDATE empresas SET estado=? WHERE id=?', [req.body.estado, req.params.id]);
        res.json({ message: 'Estado actualizado' });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/admin/ofertas', authMiddleware(['admin']), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT o.*, emp.razon_social,
            (SELECT COUNT(*) FROM postulaciones WHERE oferta_id=o.id) AS total_postulantes,
            (SELECT COUNT(*) FROM postulaciones WHERE oferta_id=o.id AND estado='seleccionado' AND cerrada=0) AS total_preseleccionados,
            (SELECT COUNT(*) FROM postulaciones WHERE oferta_id=o.id AND estado='seleccionado' AND cerrada=1) AS total_contratados
            FROM ofertas o JOIN empresas emp ON emp.id=o.empresa_id ORDER BY o.creado_en DESC`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/admin/postulaciones', authMiddleware(['admin']), async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM v_postulaciones_completas ORDER BY fecha_postulacion DESC');
        res.json(normalizeCvUrls(req, rows));
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/admin/preseleccionados', authMiddleware(['admin']), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                p.id AS postulacion_id, p.cv_url, p.cerrada,
                p.fecha_postulacion, p.actualizado_en,
                CONCAT(e.nombres,' ',e.apellidos) AS nombre_estudiante,
                e.nombres, e.apellidos, e.dni, e.codigo_estudiante,
                e.carrera, e.tipo AS tipo_estudiante,
                e.correo AS correo_estudiante, e.telefono, e.ciclo,
                o.titulo AS titulo_oferta, o.tipo_oferta, o.modalidad, o.horario,
                o.horas_practicas, o.area_practica, o.actividades,
                o.fecha_inicio AS oferta_fecha_inicio, o.fecha_fin AS oferta_fecha_fin,
                emp.razon_social AS nombre_empresa, emp.id AS empresa_id,
                emp.ruc AS empresa_ruc, emp.direccion AS empresa_direccion,
                emp.telefono AS empresa_telefono, emp.sector AS empresa_sector,
                emp.representante_nombre, emp.representante_cargo,
                ca.fecha_generacion AS carta_generada, ca.numero_carta,
                dge.fecha_generacion AS carta_egresado_generada, dge.numero_documento AS numero_carta_egresado,
                dgt.fecha_generacion AS carta_titulado_generada, dgt.numero_documento AS numero_carta_titulado,
                CASE
                    WHEN e.tipo = 'practicante' THEN ca.id IS NOT NULL
                    WHEN e.tipo = 'egresado' THEN dge.id IS NOT NULL
                    WHEN e.tipo = 'titulado' THEN dgt.id IS NOT NULL
                    ELSE 0
                END AS doc_principal_generada,
                (SELECT GROUP_CONCAT(dg.tipo_documento)
                 FROM documentos_generados dg
                 WHERE dg.postulacion_id = p.id) AS docs_generados
            FROM postulaciones p
            JOIN estudiantes e  ON e.id   = p.estudiante_id
            JOIN ofertas o      ON o.id   = p.oferta_id
            JOIN empresas emp   ON emp.id = o.empresa_id
            LEFT JOIN cartas_aceptacion ca ON ca.postulacion_id = p.id
            LEFT JOIN documentos_generados dge ON dge.postulacion_id = p.id AND dge.tipo_documento='carta_presentacion_egresado'
            LEFT JOIN documentos_generados dgt ON dgt.postulacion_id = p.id AND dgt.tipo_documento='carta_presentacion_titulado'
            WHERE p.estado='seleccionado' AND p.cerrada=0
            ORDER BY p.actualizado_en DESC`);
        res.json(normalizeCvUrls(req, rows));
    } catch (e) { res.status(500).json({ error: 'Error al obtener preseleccionados' }); }
});

app.get('/api/admin/contratados', authMiddleware(['admin']), async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.id AS postulacion_id, p.cv_url, p.fecha_postulacion, p.actualizado_en,
                CONCAT(e.nombres,' ',e.apellidos) AS nombre_estudiante,
                e.nombres, e.apellidos, e.dni, e.codigo_estudiante,
                e.carrera, e.tipo AS tipo_estudiante,
                e.correo AS correo_estudiante, e.telefono,
                o.titulo AS titulo_oferta, o.tipo_oferta,
                emp.razon_social AS nombre_empresa,
                ca.fecha_generacion AS carta_generada, ca.numero_carta
            FROM postulaciones p
            JOIN estudiantes e  ON e.id   = p.estudiante_id
            JOIN ofertas o      ON o.id   = p.oferta_id
            JOIN empresas emp   ON emp.id = o.empresa_id
            LEFT JOIN cartas_aceptacion ca ON ca.postulacion_id = p.id
            WHERE p.estado='seleccionado' AND p.cerrada=1
            ORDER BY p.actualizado_en DESC`);
        res.json(normalizeCvUrls(req, rows));
    } catch (e) { res.status(500).json({ error: 'Error al obtener contratados' }); }
});

// ═══════════════════════════════════════════════════════════
// GENERACIÓN DE DOCUMENTOS PDF
// ═══════════════════════════════════════════════════════════

const DOCUMENT_FILENAME_PREFIX = {
    carta_aceptacion:        'Carta_Aceptacion_EFSRT',
    constancia_efsrt:        'Constancia_EFSRT',
    ficha_supervision:       'Ficha_Supervision',
    carta_presentacion_inst: 'Carta_Presentacion',
    carta_presentacion_egresado: 'Carta_Presentacion_Egresado',
    carta_presentacion_titulado: 'Carta_Presentacion_Titulado',
    certificado_practicas:   'Certificado_Practicas',
    informe_practicas:       'Informe_Practicas'
};

function getDocumentFilename(tipo, nombreEstudiante = 'documento') {
    const prefix = DOCUMENT_FILENAME_PREFIX[tipo] || 'Documento';
    const safeName = (nombreEstudiante || 'documento').toString().trim().replace(/\s+/g, '_') || 'documento';
    return `${prefix}_${safeName}.pdf`;
}

function buildFechasContext(data) {
    return {
        hoyLong: templateHelpers.formatLongDate(new Date()),
        inicioCorto: templateHelpers.formatShortLiteral(data.oferta_fecha_inicio),
        finCorto: templateHelpers.formatShortLiteralEnd(data.oferta_fecha_fin),
        rangoPracticas: templateHelpers.formatRange(data.oferta_fecha_inicio, data.oferta_fecha_fin)
    };
}


// ── GET /api/admin/documentos/:postulacion_id/:tipo ──────────
// Genera uno de los 6 documentos PDF para un preseleccionado
// Tipos: carta_aceptacion | constancia_efsrt | ficha_supervision |
//        carta_presentacion_inst | certificado_practicas | informe_practicas
const PDF_DEBUG_DIR = path.join(UPLOADS_DIR, '_pdf_debug');
const PDF_DEBUG_ENABLED = process.env.PDF_DEBUG === '1';

function persistDebugPdf(tipo, filename, buffer) {
    try {
        if (!PDF_DEBUG_ENABLED) return;
        if (!fs.existsSync(PDF_DEBUG_DIR)) fs.mkdirSync(PDF_DEBUG_DIR, { recursive: true });
        const safeTipo = tipo.replace(/[^a-z0-9_\-]/gi, '_');
        const safeFile = filename.replace(/[^a-z0-9_\-\.]/gi, '_');
        const target = path.join(PDF_DEBUG_DIR, `${safeTipo}__${safeFile}`);
        fs.writeFileSync(target, buffer);
    } catch (err) {
        console.warn('[PDF DEBUG] Error al guardar una copia del PDF generado:', err);
    }
}

app.get('/api/admin/documentos/:postulacion_id/:tipo', authMiddleware(['admin']), async (req, res) => {
    const { postulacion_id, tipo } = req.params;
    const tiposPermitidos = Object.keys(DOCUMENT_FILENAME_PREFIX);

    if (!tiposPermitidos.includes(tipo))
        return res.status(400).json({ error: 'Tipo de documento no soportado.' });

    try {
        const [rows] = await db.query(
            'SELECT * FROM v_postulaciones_completas WHERE postulacion_id=? AND estado_postulacion="seleccionado"',
            [postulacion_id]
        );
        if (!rows.length)
            return res.status(404).json({ error: 'Postulación no encontrada o no preseleccionada' });

        const raw = rows[0];
        const d = {
            ...raw,
            representante_nombre: raw.representante_nombre || raw.empresa_representante_nombre || raw.nombre_empresa,
            representante_cargo:  raw.representante_cargo  || raw.empresa_representante_cargo  || 'Gerente General',
            representante_dni:    raw.representante_dni    || raw.empresa_representante_dni    || null
        };
        const tipoEstudiante = d.tipo_estudiante || d.tipo;
        const esPracticante = tipoEstudiante === 'practicante';
        if (esPracticante && (tipo === 'carta_presentacion_egresado' || tipo === 'carta_presentacion_titulado'))
            return res.status(400).json({ error: 'La Carta de Presentación de egresados/titulados no aplica a practicantes.' });
        if (tipoEstudiante === 'egresado' && tipo !== 'carta_presentacion_egresado')
            return res.status(400).json({ error: 'Solo corresponde la Carta de Presentación para egresados.' });
        if (tipoEstudiante === 'titulado' && tipo !== 'carta_presentacion_titulado')
            return res.status(400).json({ error: 'Solo corresponde la Carta de Presentación para titulados.' });

        const cfg = await getConfig([
            'responsable_bolsa_nombre', 'responsable_bolsa_cargo', 'responsable_bolsa_correo',
            'docente_supervisor_nombre', 'docente_supervisor_cargo',
            'instituto_nombre', 'instituto_direccion', 'instituto_razon_social', 'instituto_ruc',
            'instituto_representante_nombre', 'instituto_representante_dni'
        ]);

        const responsable = {
            nombre: cfg.responsable_bolsa_nombre || 'Responsable de Bolsa de Trabajo',
            cargo:  cfg.responsable_bolsa_cargo  || 'Jefa de la Unidad de Bolsa de Trabajo'
        };
        const docente = {
            nombre: cfg.docente_supervisor_nombre || 'ALCÁNTARA OCAS ERICK RUBÉN',
            cargo:  cfg.docente_supervisor_cargo  || 'Docente Supervisor'
        };
        const institutoCfg = {
            nombre:     cfg.instituto_nombre     || 'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PRIVADO LEONARDO DA VINCI',
            direccion:  cfg.instituto_direccion  || 'Trujillo, La Libertad — Perú',
            razon:      cfg.instituto_razon_social || cfg.instituto_nombre || 'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PRIVADO LEONARDO DA VINCI',
            ruc:        cfg.instituto_ruc        || '20440386092',
            representante:     cfg.instituto_representante_nombre || 'Lic. GLADYS ANGELICA MIYASHIMA ARROYO',
            representante_dni: cfg.instituto_representante_dni    || '10066097'
        };

        const año = new Date().getFullYear();
        const num = String(d.postulacion_id).padStart(4, '0');
        const numEgresado = String(d.postulacion_id).padStart(3, '0');
        const tipoCorto = {
            carta_aceptacion:        'CARTA-ACEPT',
            constancia_efsrt:        'CONST-EFSRT',
            ficha_supervision:       'FICHA-SUP',
            carta_presentacion_inst: 'ID/BT',
            carta_presentacion_egresado: 'ID/BT',
            carta_presentacion_titulado: 'ID/BT',
            certificado_practicas:   'CERT-PRACT',
            informe_practicas:       'INF-PRACT'
        }[tipo] || 'DOC';
        const numeroDoc = (tipo === 'carta_presentacion_inst' || tipo === 'carta_presentacion_egresado' || tipo === 'carta_presentacion_titulado')
            ? `${numEgresado}-${año}-${tipoCorto}`
            : `${tipoCorto}-${año}-${num}`;

        if (tipo === 'carta_aceptacion') {
            await db.query(
                `INSERT INTO cartas_aceptacion (postulacion_id, generada_por, numero_carta)
                 VALUES (?,?,?) ON DUPLICATE KEY UPDATE fecha_generacion=NOW(), numero_carta=?`,
                [postulacion_id, req.user.id, numeroDoc, numeroDoc]
            );
        }
        await db.query(
            `INSERT INTO documentos_generados (postulacion_id, generado_por, tipo_documento, numero_documento)
             VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE fecha_generacion=NOW(), numero_documento=?`,
            [postulacion_id, req.user.id, tipo, numeroDoc, numeroDoc]
        );

        const fechas = buildFechasContext(d);
        const templateContext = {
            d,
            numeroDoc,
            responsable,
            docente,
            instituto: institutoCfg,
            fechas,
            empresaNombre: d.nombre_empresa
        };

        const html = buildHtmlTemplate(tipo, templateContext);
        const pdfBinary = await renderPdfFromHtml(html);
        const pdfBuffer = Buffer.isBuffer(pdfBinary) ? pdfBinary : Buffer.from(pdfBinary);
        const filename = getDocumentFilename(tipo, d.nombre_estudiante);
        persistDebugPdf(tipo, filename, pdfBuffer);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generando documento PDF:', error);
        return res.status(500).json({ error: 'No se pudo generar el documento solicitado.' });
    }
});

// ── GET /api/admin/carta/:id — Compatibilidad hacia atrás ────
app.get('/api/admin/carta/:postulacion_id', authMiddleware(['admin']), (req, res) => {
    res.redirect(`/api/admin/documentos/${req.params.postulacion_id}/carta_aceptacion`);
});

// ═══════════════════════════════════════════════════════════
// CERRAR PROCESO
// ═══════════════════════════════════════════════════════════
app.patch('/api/postulaciones/:id/cerrar', authMiddleware(['admin']), async (req, res) => {
    try {
        const [[post]] = await db.query(`
            SELECT p.id, p.estado, p.cerrada, p.oferta_id, e.tipo AS tipo_estudiante
            FROM postulaciones p
            JOIN estudiantes e ON e.id = p.estudiante_id
            WHERE p.id=?`, [req.params.id]);
        if (!post) return res.status(404).json({ error: 'Postulación no encontrada' });
        if (post.cerrada) return res.status(400).json({ error: 'Este proceso ya fue cerrado' });
        if (post.estado !== 'seleccionado')
            return res.status(400).json({ error: 'Solo se puede cerrar una postulación seleccionada' });

        const tipoEst = post.tipo_estudiante || 'practicante';
        if (tipoEst === 'practicante') {
            const [cartas] = await db.query('SELECT id FROM cartas_aceptacion WHERE postulacion_id=?', [req.params.id]);
            if (!cartas.length)
                return res.status(400).json({ error: 'Primero debe generar la carta de aceptación.' });
        } else if (tipoEst === 'egresado') {
            const [docs] = await db.query(
                'SELECT id FROM documentos_generados WHERE postulacion_id=? AND tipo_documento="carta_presentacion_egresado"',
                [req.params.id]
            );
            if (!docs.length)
                return res.status(400).json({ error: 'Primero debe generar la carta de presentación de egresados.' });
        } else if (tipoEst === 'titulado') {
            const [docs] = await db.query(
                'SELECT id FROM documentos_generados WHERE postulacion_id=? AND tipo_documento="carta_presentacion_titulado"',
                [req.params.id]
            );
            if (!docs.length)
                return res.status(400).json({ error: 'Primero debe generar la carta de presentación de titulados.' });
        }

        await db.query('UPDATE postulaciones SET cerrada=1 WHERE id=?', [req.params.id]);
        await db.query('UPDATE ofertas SET estado="cerrada" WHERE id=?', [post.oferta_id]);
        res.json({ message: 'Proceso de contratación cerrado. El candidato queda como contratado.' });
    } catch (e) {
        console.error(e);
        if (!res.headersSent) res.status(500).json({ error: 'Error al cerrar el proceso' });
    }
});

// ═══════════════════════════════════════════════════════════
// ADMIN — DEVOLVER PRESELECCIONADO
// ═══════════════════════════════════════════════════════════
app.patch('/api/postulaciones/:id/deseleccionar', authMiddleware(['admin']), async (req, res) => {
    const { motivo } = req.body || {};
    try {
        const [[post]] = await db.query(`
            SELECT p.id, p.estado, p.cerrada
            FROM postulaciones p WHERE p.id=?`, [req.params.id]);
        if (!post) return res.status(404).json({ error: 'Postulación no encontrada' });
        if (post.cerrada) return res.status(400).json({ error: 'El proceso ya fue cerrado' });
        if (post.estado !== 'seleccionado')
            return res.status(400).json({ error: 'Solo se pueden devolver candidatos preseleccionados' });

        await db.query('UPDATE postulaciones SET estado="en_revision", nota_admin=?, actualizado_en=NOW() WHERE id=?',
            [motivo || null, req.params.id]);
        res.json({ message: 'El postulante fue devuelto a revisión. La empresa recibirá la nota.' });
    } catch (e) {
        console.error(e);
        if (!res.headersSent) res.status(500).json({ error: 'Error al devolver postulación' });
    }
});

// ── Page routes ─────────────────────────────────────────────
const pages = p => path.join(PUBLIC_DIR, 'pages', p);
app.get('/',                    (req, res) => res.sendFile(pages('index.html')));
app.get('/login',               (req, res) => res.sendFile(pages('login.html')));
app.get('/registro',            (req, res) => res.sendFile(pages('registro.html')));
app.get('/ofertas',             (req, res) => res.sendFile(pages('ofertas.html')));
app.get('/dashboard-empresa',   (req, res) => res.sendFile(pages('dashboard-empresa.html')));
app.get('/dashboard-estudiante',(req, res) => res.sendFile(pages('dashboard-estudiante.html')));
app.get('/dashboard-admin',     (req, res) => res.sendFile(pages('dashboard-admin.html')));

// ── Init admin ───────────────────────────────────────────────
async function initAdmin() {
    try {
        const email = process.env.ADMIN_EMAIL    || 'admin@ldv.edu.pe';
        const pass  = process.env.ADMIN_PASSWORD || 'Admin2024@LDV';
        const [rows] = await db.query('SELECT id FROM administradores WHERE correo=?', [email]);
        if (!rows.length) {
            const hash = await bcrypt.hash(pass, 10);
            await db.query('INSERT INTO administradores (nombre,correo,password_hash) VALUES (?,?,?)',
                ['Administrador LDV', email, hash]);
            console.log('✅ Admin creado:', email);
        }
    } catch (e) { console.log('ℹ️  Admin init:', e.message); }
}

app.listen(PORT, HOST, async () => {
    // Mostrar URL correcta (localhost en lugar de 0.0.0.0)
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
    const serverUrl = `http://${displayHost}:${PORT}`;
    
    console.log(`\n✨ ╔═══════════════════════════════════════════════════════════╗`);
    console.log(`   ║  🚀 Servidor LDV corriendo exitosamente                 ║`);
    console.log(`   ╠═══════════════════════════════════════════════════════════╣`);
    console.log(`   ║  🌐 URL: ${serverUrl.padEnd(48)}║`);
    console.log(`   ╠═══════════════════════════════════════════════════════════╣`);
    console.log(`   ║  ✅ Base de datos conectada                              ║`);
    console.log(`   ╚═══════════════════════════════════════════════════════════╝\n`);
    
    // Abrir navegador automáticamente si es localhost
    if (displayHost === 'localhost' || displayHost === '127.0.0.1') {
        try {
            const open = require('open');
            setTimeout(() => {
                open(serverUrl).catch(err => {
                    console.log(`💡 No se pudo abrir el navegador automáticamente.`);
                    console.log(`   Abre en tu navegador: ${serverUrl}\n`);
                });
            }, 500);
        } catch (e) {
            console.log(`💡 Abre en tu navegador: ${serverUrl}\n`);
        }
    }
    
    await initAdmin();
});