-- ============================================================
-- BOLSA DE TRABAJO LDV — Base de Datos MySQL
-- Instituto Tecnológico Superior Leonardo Da Vinci
-- Versión: 4.0 — Registro con aprobación admin para estudiantes
-- ============================================================
-- CARRERAS LDV (Trujillo):
--   Computación e Informática
--   Contabilidad
--   Administración de Empresas
--   Enfermería Técnica
--   Farmacia
--   Mecánica Automotriz
--   Electrotecnia Industrial
--   Construcción Civil
--   Diseño Gráfico Computarizado
--   Gastronomía y Arte Culinario
--
-- FLUJO REGISTRO ESTUDIANTE:
--   1. Estudiante se registra → estado: 'pendiente' (igual que empresas)
--   2. Admin verifica código de estudiante → aprueba o rechaza
--   3. Solo estudiantes aprobados pueden iniciar sesión
--
-- FLUJO REGISTRO EMPRESA:
--   1. Empresa se registra → estado: 'pendiente'
--   2. Admin aprueba o rechaza
--
-- FLUJO PROCESO PRÁCTICAS/TRABAJO:
--   1. Empresa publica oferta (activa)
--   2. Estudiante postula → enviada
--   3. Empresa revisa → en_revision
--   4. Empresa selecciona → seleccionado, cerrada=0 (preseleccionado)
--   5. Admin genera 6 documentos PDF
--   6. Admin cierra proceso → cerrada=1 (CONTRATADO)
-- ============================================================

CREATE DATABASE IF NOT EXISTS bolsa_trabajo_ldv CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bolsa_trabajo_ldv;

-- ─────────────────────────────────────────────────────────────
-- 1. ADMINISTRADORES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS administradores (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(120) NOT NULL,
    correo        VARCHAR(160) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    creado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 2. CONFIGURACIÓN DEL SISTEMA
-- Almacena datos del responsable de la Bolsa de Trabajo
-- y otros parámetros configurables del sistema.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracion (
    clave       VARCHAR(100) PRIMARY KEY,
    valor       TEXT,
    descripcion VARCHAR(255),
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Datos por defecto del responsable de bolsa de trabajo
INSERT INTO configuracion (clave, valor, descripcion) VALUES
('responsable_bolsa_nombre',    'Responsable de Bolsa de Trabajo',  'Nombre completo del responsable de la Unidad de Bolsa de Trabajo'),
('responsable_bolsa_cargo',     'Jefa de la Unidad de Bolsa de Trabajo', 'Cargo del responsable'),
('responsable_bolsa_correo',    'bolsatrabajo@ldv.edu.pe',           'Correo de la Unidad de Bolsa de Trabajo'),
('docente_supervisor_nombre',   'ALCÁNTARA OCAS ERICK RUBÉN',       'Nombre del docente supervisor de prácticas'),
('docente_supervisor_cargo',    'Docente Supervisor',                'Cargo del docente supervisor'),
('instituto_nombre',            'Instituto Tecnológico Superior Leonardo Da Vinci', 'Nombre oficial del instituto'),
('instituto_direccion',         'Trujillo, La Libertad — Perú',     'Dirección del instituto'),
('instituto_correo',            'bolsatrabajo@ldv.edu.pe',           'Correo institucional'),
('instituto_razon_social',        'Instituto de Educación Superior Tecnológico Privado Leonardo Da Vinci', 'Razón social utilizada en los documentos oficiales'),
('instituto_ruc',                 '20440386092', 'RUC del instituto'),
('instituto_representante_nombre','Lic. GLADYS ANGELICA MIYASHIMA ARROYO', 'Representante del centro de formación'),
('instituto_representante_dni',   '10066097', 'Documento de identidad del representante del instituto')
ON DUPLICATE KEY UPDATE valor = VALUES(valor);

-- ─────────────────────────────────────────────────────────────
-- 3. EMPRESAS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresas (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    razon_social     VARCHAR(200) NOT NULL,
    ruc              VARCHAR(11) UNIQUE NOT NULL,
    sector           VARCHAR(100),
    descripcion      TEXT,
    actividad_economica VARCHAR(200),
    direccion        VARCHAR(255),
    telefono         VARCHAR(20),
    sitio_web        VARCHAR(200),
    correo           VARCHAR(160) UNIQUE NOT NULL,
    nombre_contacto  VARCHAR(120),
    -- Nombre y cargo del representante legal (para documentos oficiales)
    representante_nombre VARCHAR(150),
    representante_dni   VARCHAR(12),
    representante_cargo  VARCHAR(120) DEFAULT 'Gerente General',
    password_hash    VARCHAR(255) NOT NULL,
    estado           ENUM('pendiente','aprobado','rechazado') DEFAULT 'pendiente',
    creado_en        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 4. ESTUDIANTES / EGRESADOS / TITULADOS
-- ─────────────────────────────────────────────────────────────
-- NUEVO: codigo_estudiante → código único LDV (ej: 2024-CI-001)
-- NUEVO: estado → 'pendiente' hasta que admin apruebe (igual que empresas)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estudiantes (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    nombres            VARCHAR(100) NOT NULL,
    apellidos          VARCHAR(100) NOT NULL,
    dni                VARCHAR(8) UNIQUE NOT NULL,
    -- Código de estudiante LDV — debe verificarse por admin
    codigo_estudiante  VARCHAR(30) UNIQUE NOT NULL,
    telefono           VARCHAR(20),
    direccion          VARCHAR(255),
    correo             VARCHAR(160) UNIQUE NOT NULL,
    password_hash      VARCHAR(255) NOT NULL,
    fecha_nacimiento   DATE,
    nacionalidad       VARCHAR(60) DEFAULT 'PERUANA',
    sexo               ENUM('masculino','femenino','otro'),
    estado_civil       ENUM('soltero','casado','conviviente','divorciado','viudo'),
    -- Carreras del Instituto LDV — Trujillo
    carrera            ENUM(
        'Computación e Informática',
        'Contabilidad',
        'Administración de Empresas',
        'Enfermería Técnica',
        'Farmacia',
        'Mecánica Automotriz',
        'Electrotecnia Industrial',
        'Construcción Civil',
        'Diseño Gráfico Computarizado',
        'Gastronomía y Arte Culinario'
    ) NOT NULL,
    ciclo              VARCHAR(20),
    -- tipo: perfil del candidato
    tipo               ENUM('practicante','egresado','titulado') NOT NULL DEFAULT 'practicante',
    anio_egreso        YEAR,
    anio_titulacion    YEAR,
    habilidades        TEXT,
    -- ESTADO (mismo flujo que empresas):
    -- pendiente → esperando verificación del admin
    -- aprobado  → puede ingresar al sistema
    -- rechazado → cuenta denegada
    estado             ENUM('pendiente','aprobado','rechazado') DEFAULT 'pendiente',
    -- Nota del admin al aprobar/rechazar
    nota_admin         TEXT,
    activo             BOOLEAN DEFAULT TRUE,
    creado_en          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_codigo   (codigo_estudiante),
    INDEX idx_estado   (estado)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 5. OFERTAS DE TRABAJO / PRÁCTICAS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ofertas (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id      INT NOT NULL,
    titulo          VARCHAR(200) NOT NULL,
    descripcion     TEXT NOT NULL,
    requisitos      TEXT,
    beneficios      TEXT,
    -- Actividades que el practicante/trabajador realizará (para Carta de Aceptación)
    actividades     TEXT,
    tipo_oferta     ENUM('practicas','trabajo') NOT NULL,
    dirigido_a      ENUM('practicante','egresado','titulado','todos') NOT NULL DEFAULT 'todos',
    modalidad       ENUM('presencial','remoto','hibrido') DEFAULT 'presencial',
    vacantes        INT DEFAULT 1,
    horario         VARCHAR(200),
    horario_dias    VARCHAR(150),
    salario_rango   VARCHAR(100),
    carrera_afin    VARCHAR(255),
    area_practica   VARCHAR(150),  -- Área donde realizará las prácticas
    horas_practicas INT DEFAULT 128,  -- Horas mínimas de práctica
    fecha_inicio    DATE,
    fecha_fin       DATE,
    fecha_limite    DATE,
    estado          ENUM('activa','pausada','cerrada') DEFAULT 'activa',
    creado_en       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    INDEX idx_tipo      (tipo_oferta),
    INDEX idx_dirigido  (dirigido_a),
    INDEX idx_estado    (estado),
    INDEX idx_empresa   (empresa_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 6. POSTULACIONES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS postulaciones (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    estudiante_id      INT NOT NULL,
    oferta_id          INT NOT NULL,
    cv_url             VARCHAR(500) NOT NULL,
    cv_filename        VARCHAR(255),
    carta_presentacion TEXT,
    estado             ENUM('enviada','en_revision','seleccionado','rechazado') DEFAULT 'enviada',
    cerrada            BOOLEAN DEFAULT FALSE,
    nota_empresa       TEXT,
    nota_admin         TEXT,
    fecha_postulacion  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_postulacion (estudiante_id, oferta_id),
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
    FOREIGN KEY (oferta_id)     REFERENCES ofertas(id)     ON DELETE CASCADE,
    INDEX idx_estado    (estado),
    INDEX idx_oferta    (oferta_id),
    INDEX idx_estudiante (estudiante_id),
    INDEX idx_cerrada   (cerrada)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 7. DOCUMENTOS GENERADOS
-- Registro de todos los PDFs oficiales emitidos por el admin
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos_generados (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    postulacion_id   INT NOT NULL,
    generado_por     INT NOT NULL,
    tipo_documento   ENUM(
        'carta_aceptacion',      -- ANEXO 2: Carta de Aceptación de EFSRT
        'constancia_efsrt',      -- ANEXO 4: Constancia de Experiencias
        'ficha_supervision',     -- ANEXO 6: Ficha de Supervisión
        'carta_presentacion_inst', -- Carta de presentación del instituto
        'carta_presentacion_egresado', -- Carta de presentación para egresados
        'carta_presentacion_titulado', -- Carta de presentación para titulados
        'certificado_practicas', -- Certificado de prácticas
        'informe_practicas'      -- Informe de prácticas
    ) NOT NULL,
    numero_documento VARCHAR(50) NOT NULL,
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (postulacion_id) REFERENCES postulaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (generado_por)   REFERENCES administradores(id),
    UNIQUE KEY uk_doc (postulacion_id, tipo_documento)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 8. CARTAS DE ACEPTACIÓN (compatibilidad con versión anterior)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cartas_aceptacion (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    postulacion_id   INT NOT NULL,
    generada_por     INT NOT NULL,
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    numero_carta     VARCHAR(50) NOT NULL,
    FOREIGN KEY (postulacion_id) REFERENCES postulaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (generada_por)   REFERENCES administradores(id),
    UNIQUE KEY uk_carta_postulacion (postulacion_id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- 9. SOLICITUDES DE EDICIÓN DE PERFIL (empresas y estudiantes)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes_edicion (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    tipo_usuario   ENUM('empresa','estudiante') NOT NULL,
    registro_id    INT NOT NULL,
    campos         JSON NOT NULL,
    motivo         TEXT,
    estado         ENUM('pendiente','aprobado','rechazado') DEFAULT 'pendiente',
    respuesta_admin TEXT,
    aprobado_por   INT NULL,
    creado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resuelto_en    TIMESTAMP NULL,
    FOREIGN KEY (aprobado_por) REFERENCES administradores(id) ON DELETE SET NULL,
    INDEX idx_tipo_registro (tipo_usuario, registro_id),
    INDEX idx_estado (estado)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- VISTAS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_postulaciones_completas AS
SELECT
    p.id                                        AS postulacion_id,
    p.cv_url,
    p.carta_presentacion,
    p.estado                                    AS estado_postulacion,
    p.cerrada                                   AS postulacion_cerrada,
    p.nota_empresa,
    p.nota_admin,
    p.fecha_postulacion,
    p.actualizado_en,
    CONCAT(e.nombres,' ',e.apellidos)           AS nombre_estudiante,
    e.id                                        AS estudiante_id,
    e.dni,
    e.codigo_estudiante,
    e.carrera,
    e.tipo                                      AS tipo_estudiante,
    e.correo                                    AS correo_estudiante,
    e.telefono,
    e.direccion                                 AS estudiante_direccion,
    e.nacionalidad,
    e.sexo,
    e.estado_civil,
    e.ciclo,
    e.anio_egreso,
    e.anio_titulacion,
    e.habilidades,
    e.nombres,
    e.apellidos,
    o.id                                        AS oferta_id,
    o.titulo                                    AS titulo_oferta,
    o.tipo_oferta,
    o.dirigido_a,
    o.modalidad,
    o.horario,
    o.horario_dias,
    o.horas_practicas,
    o.area_practica,
    o.actividades,
    o.fecha_inicio                              AS oferta_fecha_inicio,
    o.fecha_fin                                 AS oferta_fecha_fin,
    o.estado                                    AS estado_oferta,
    emp.id                                      AS empresa_id,
    emp.razon_social                            AS nombre_empresa,
    emp.ruc                                     AS empresa_ruc,
    emp.sector                                  AS empresa_sector,
    emp.direccion                               AS empresa_direccion,
    emp.telefono                                AS empresa_telefono,
    emp.actividad_economica                     AS empresa_actividad,
    emp.representante_nombre                    AS empresa_representante_nombre,
    emp.representante_cargo                     AS empresa_representante_cargo,
    emp.representante_dni                       AS empresa_representante_dni
FROM postulaciones p
JOIN estudiantes e  ON e.id   = p.estudiante_id
JOIN ofertas o      ON o.id   = p.oferta_id
JOIN empresas emp   ON emp.id = o.empresa_id;

-- Vista de estadísticas
CREATE OR REPLACE VIEW v_stats AS
SELECT
    (SELECT COUNT(*) FROM empresas     WHERE estado = 'aprobado')                          AS empresas,
    (SELECT COUNT(*) FROM estudiantes  WHERE activo = 1 AND estado = 'aprobado')           AS estudiantes,
    (SELECT COUNT(*) FROM ofertas      WHERE estado = 'activa')                            AS ofertas,
    (SELECT COUNT(*) FROM postulaciones)                                                   AS postulaciones,
    (SELECT COUNT(*) FROM postulaciones WHERE estado = 'seleccionado' AND cerrada = 0)     AS preseleccionados,
    (SELECT COUNT(*) FROM postulaciones WHERE estado = 'seleccionado' AND cerrada = 1)     AS seleccionados,
    (SELECT COUNT(*) FROM empresas     WHERE estado = 'pendiente')                         AS empresas_pendientes,
    (SELECT COUNT(*) FROM estudiantes  WHERE estado = 'pendiente')                         AS estudiantes_pendientes;