const DEFAULT_CITY = 'Trujillo';

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function upper(value = '') {
  return escapeHtml((value || '').toString().toUpperCase());
}

function safe(value = '', fallback = '—') {
  const text = (value ?? '').toString().trim();
  return escapeHtml(text || fallback);
}

function formatLongDate(value) {
  if (!value) return '——';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '——';
  return `${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

function formatShortLiteral(value) {
  if (!value) return '——';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '——';
  return `${date.getDate()} de ${MONTHS[date.getMonth()]} del ${date.getFullYear()}`;
}

function formatShortLiteralEnd(value) {
  if (!value) return 'Indefinidamente';
  return formatShortLiteral(value);
}

function formatRange(start, end) {
  const from = formatShortLiteral(start);
  const to = formatShortLiteralEnd(end);
  if (from === '——' && to === 'Indefinidamente') return '——';
  if (to === 'Indefinidamente') return `desde ${from} indefinidamente`;
  if (from === '——') return `hasta ${to}`;
  return `${from} al ${to}`;
}

function parseList(value = '') {
  return (value || '')
    .split(/\n|\r|\-/)
    .map(item => item.trim())
    .filter(Boolean);
}

function wrapDocument(content, extraCss = '') {
  return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <style>
      @page { size: A4; margin: 0.9in 0.8in; }
      body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; color: #111; line-height: 1.55; }
      p { text-align: justify; text-justify: inter-word; }
      h1, h2, h3 { text-align: center; margin: 0; }
      h1 { font-size: 15pt; letter-spacing: 0.5px; text-transform: uppercase; }
      p { margin: 0 0 12px; }
      ul { margin: 6px 0 18px 20px; }
      table { border-collapse: collapse; width: 100%; font-size: 11pt; }
      .date { text-align: right; margin-bottom: 18px; }
      .signature-block { margin-top: 55px; text-align: center; padding-bottom: 20px; }
      .sig-highlight { display: inline-block; padding: 26px 28px 14px; background: #fff79b; font-weight: bold; text-transform: uppercase; border-top: 2px solid #f6dd4f; }
      ${extraCss}
    </style>
  </head>
  <body>
    ${content}
  </body>
  </html>`;
}

function buildCartaAceptacion(ctx) {
  const { d, instituto, fechas } = ctx;
  const student = upper(d.nombre_estudiante || 'Estudiante');
  const carrera = upper(d.carrera || 'Carrera Profesional');
  const dni = safe(d.dni, '——');
  const area = upper(d.area_practica || d.titulo_oferta || 'Área asignada');
  const horas = safe(d.horas_practicas || 0, '128');
  const horario = safe(d.horario || 'Por coordinar');
  const actividadList = parseList(d.actividades);
  const cityDate = `${DEFAULT_CITY}, ${fechas.hoyLong}`;

  const activitiesHtml = actividadList.length
    ? `<p>La estudiante desarrollará estas actividades:</p>
       <ul>${actividadList.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';

  const content = `
    <h1>CARTA DE ACEPTACIÓN DE LAS EFSRT</h1>
    <div class="date">${escapeHtml(cityDate)}</div>
    <p><strong>${upper(instituto.nombre)}</strong><br>Presente.-<br>De mi consideración</p>
    <p>
      Por medio del presente le comunico a usted que el (la) joven (srta.) <strong>${student}</strong>,
      identificado(a) con DNI Nº <strong>${dni}</strong>, estudiante de la carrera de
      <strong>${carrera}</strong>, ha sido aceptado(a) para realizar su EFSRT en nuestra institución,
      en el área <strong>${area}</strong> lo cual coincide con su formación profesional, durante el periodo
      comprendido ${escapeHtml(fechas.rangoPracticas)} donde llegará a alcanzar un mínimo de
      <strong>${horas} horas</strong> de prácticas en el horario de <strong>${horario}</strong>.
    </p>
    ${activitiesHtml}
    <p>Hago propicia la oportunidad para expresar a ustedes los sentimientos de mi más alta y digna consideración.</p>
    <p>Atentamente;</p>
    <div class="signature-block">
      <div class="sig-highlight">
        ${upper(d.representante_nombre || d.nombre_empresa || 'GERENTE GENERAL')}<br>
        ${upper(d.representante_cargo || 'Gerente General')}<br>
        ${upper(d.nombre_empresa || '')}
      </div>
    </div>
  `;

  return wrapDocument(content, `.sig-highlight { border-bottom: 2px solid #d9b200; }`);
}

function buildConstancia(ctx) {
  const { d, fechas, instituto } = ctx;
  const empresa = upper(d.nombre_empresa || '——');
  const ruc = safe(d.empresa_ruc, '——');
  const estudiante = upper(d.nombre_estudiante || '——');
  const dni = safe(d.dni, '——');
  const carrera = upper(d.carrera || '——');
  const horas = safe(d.horas_practicas || 128, '128');

  const content = `
    <h2 style="text-transform:none;font-size:14pt;margin-bottom:6px;">Constancia de Experiencias Formativas en Situaciones<br>Reales de Trabajo</h2>
    <p>El Representante Legal de la empresa <strong>${empresa}</strong>, con RUC Nº <strong>${ruc}</strong>, deja constancia que:</p>
    <p><strong>${estudiante}</strong>, identificado con DNI Nº <strong>${dni}</strong>, estudiante del <strong>${upper(instituto.nombre)}</strong> ha realizado las Experiencias Formativas en Situaciones Reales de Trabajo correspondientes al programa de estudios de <strong>${carrera}</strong> del nivel formativo profesional técnico.</p>
    <p>Estas se efectuaron ${escapeHtml(fechas.rangoPracticas)} con un mínimo de <strong>${horas} horas</strong> de prácticas en las que ha demostrado las competencias requeridas para el desarrollo de las actividades.</p>
    <p>Se extiende la presente para los fines que estime convenientes.</p>
    <div class="date">${escapeHtml(`${DEFAULT_CITY}, ${fechas.hoyLong}`)}</div>
    <div class="signature-block">
      <div class="sig-highlight" style="background:#fff; border-top:1px solid #222; border-bottom:none; padding-top:24px;">
        ${upper(d.representante_nombre || d.nombre_empresa || '——')}<br>
        ${upper(d.representante_cargo || 'Gerente General')}<br>
        ${empresa}
      </div>
    </div>
  `;

  return wrapDocument(content);
}

function buildCartaPresentacion(ctx) {
  const { d, responsable, fechas, numeroDoc } = ctx;
  const horas = d.horas_practicas || 128;
  const carrerasList = [
    'Administración de Empresas',
    'Contabilidad',
    'Computación e Informática'
  ];
  const programas = [
    'Diseñador Gráfico Digital',
    'Técnico en computación',
    'Secretariado y Asistente Administrativo'
  ];
  const cursos = [
    'Especialista en Ofimática Empresarial',
    'Técnico en Ensamblaje y Reparación de PC\'s y Móviles',
    'Especialista en Marketing Digital',
    'Community Management Profesional'
  ];
  const content = `
    <div class="doc-estudiante">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;">
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <div style="color:#0088c2;font-size:48px;font-weight:bold;line-height:0.9;">iD</div>
          <div style="font-size:10pt;line-height:1.1;">
            <div style="font-weight:600;">instituto</div>
            <div style="font-size:14pt;">Leonardo</div>
            <div style="font-size:14pt;">Da Vinci</div>
          </div>
        </div>
        <div style="text-align:right;font-size:10pt;">
          <div>Av. España 2725</div>
          <div>Trujillo, Perú</div>
          <div style="font-weight:bold;">T. 245424</div>
          <div style="color:#0088c2;font-weight:bold;">davinci.pe</div>
        </div>
      </div>
      <p style="text-align:center;font-style:italic;">"Año de la Esperanza y el Fortalecimiento de la Democracia"</p>
      <div class="date">${escapeHtml(`${DEFAULT_CITY}, ${fechas.hoyLong}`)}</div>
      <p style="font-weight:bold;">CARTA N° ${escapeHtml(numeroDoc)}</p>
      <p style="font-weight:bold; text-transform:uppercase;">${upper(d.representante_nombre || 'Representante Legal')}</p>
      <p style="font-weight:bold;">${upper(d.representante_cargo || 'GERENTE GENERAL')}</p>
      <p style="font-weight:bold;">${upper(d.nombre_empresa || '')}</p>
      <p>De mi mayor consideración:</p>
      <p>Es grato dirigirme a usted para expresarle nuestro cordial saludo en nombre del Instituto de Educación Superior Tecnológico Privado Leonardo Da Vinci, y a la vez presentar al estudiante <strong>${upper(d.nombre_estudiante || '')}</strong>, identificado(a) con DNI N° <strong>${safe(d.dni, '——')}</strong>, del Instituto de Educación Tecnológico Privado Leonardo Da Vinci, de la Carrera Técnica Profesional de <strong>${upper(d.carrera || '')}</strong>, quien va a realizar sus Experiencias Formativas en Situaciones Reales de Trabajo (EFSRT) en su organización, por un periodo de ${horas} a ${horas * 3} horas, para complementar la formación recibida en nuestra Institución Educativa.</p>
      <p>De lograr la oportunidad de culminar sus EFSRT, agradecemos se le brinde las facilidades del caso que permita a nuestro estudiante alcanzar un óptimo desempeño. Asimismo, le solicitamos consignar la información solicitada en la Ficha de Evaluación de Prácticas Pre Profesionales y extender la respectiva Constancia de EFSRT al término de la misma.</p>
      <p>Aprovechamos para informarle que en nuestra Institución contamos con estudiantes y egresados altamente calificados: los cuales se pueden desempeñar en las carreras y programas</p>
      <div class="courses-grid">
        <div class="courses-col">
          <strong>Carreras Técnicas de 3 años:</strong>
          <ul>${carrerasList.map(item => `<li>${item}</li>`).join('')}</ul>
        </div>
        <div class="courses-col">
          <strong>Programas Técnicos de 1 año:</strong>
          <ul>${programas.map(item => `<li>${item}</li>`).join('')}</ul>
        </div>
        <div class="courses-col">
          <strong>Cursos de 6 meses:</strong>
          <ul>${cursos.map(item => `<li>${item}</li>`).join('')}</ul>
          <div class="courses-short">
            <div class="courses-short-title">Cursos cortos de 4 meses</div>
            <ul><li>Especialista en Excel Profesional</li></ul>
          </div>
        </div>
      </div>
      <p style="margin-top:10px;">Hacemos propicia la ocasión para renovarle las expresiones de nuestra especial consideración.</p>
      <p>Atentamente;</p>
      <div class="signature-block">
        <div style="display:inline-block; min-width:280px; text-align:center;">
          <div style="border-top:1px solid #000; width:260px; margin:0 auto 12px;"></div>
          <strong>${upper(responsable.nombre)}</strong><br>
          ${upper(responsable.cargo)}<br>
          Instituto de Educación Superior Tecnológico Privado Leonardo Da Vinci
        </div>
      </div>
      <div class="doc-slogan">Trabajas ya, progresas ya</div>
      <div class="doc-watermark">iD</div>
    </div>
  `;
  return wrapDocument(content, `
    .doc-estudiante { line-height: 1.5; position: relative; }
    .doc-estudiante p { margin: 0 0 10px; }
    .courses-grid { display:flex; gap:12px; font-size:10pt; margin-top:4px; }
    .courses-col { flex:1; padding-left:10px; }
    .courses-col:first-child { padding-left:0; }
    .courses-col + .courses-col { border-left:1px solid #222; }
    .courses-grid ul { margin: 4px 0 6px 18px; }
    .courses-grid li { margin-bottom: 2px; }
    .courses-short { break-inside:avoid; page-break-inside:avoid; }
    .courses-short-title { margin: 4px 0 2px 18px; font-weight: 700; }
    .doc-watermark {
      position: absolute; right: -8px; bottom: -6px;
      font-size: 180px; color: rgba(0,136,194,0.2);
      font-weight: 700; line-height: 1; pointer-events: none;
    }
    .doc-slogan { text-align:center; margin-top:8px; color:#0088c2; font-weight:700; font-size:10pt; }
  `);
}

function buildCartaPresentacionEgresado(ctx) {
  const { d, responsable, numeroDoc } = ctx;
  const horas = d.horas_practicas || 128;
  const fechaDoc = formatShortLiteral(new Date());
  const carrerasList = [
    'Administración de Empresas',
    'Contabilidad',
    'Computación e Informática'
  ];
  const programas = [
    'Diseñador Gráfico Digital',
    'Técnico en computación',
    'Secretariado y Asistente Administrativo'
  ];
  const cursos = [
    'Especialista en Ofimática Empresarial',
    'Técnico en Ensamblaje y Reparación de PC\'s y Móviles',
    'Especialista en Marketing Digital',
    'Community Management Profesional'
  ];
  const cursosCortos = [
    'Especialista en Excel Profesional'
  ];

  const content = `
    <div class="doc-tight">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="color:#0088c2;font-size:48px;font-weight:bold;line-height:0.9;">iD</div>
        <div style="font-size:10pt;line-height:1.1;">
          <div style="font-weight:600;">instituto</div>
          <div style="font-size:14pt;">Leonardo</div>
          <div style="font-size:14pt;">Da Vinci</div>
        </div>
      </div>
      <div style="text-align:right;font-size:10pt;">
        <div>Av. España 2725</div>
        <div>Trujillo, Perú</div>
        <div style="font-weight:bold;">T. 245424</div>
        <div style="color:#0088c2;font-weight:bold;">davinci.pe</div>
      </div>
    </div>
    <p style="text-align:center;font-style:italic;">"Año de la Esperanza y el Fortalecimiento de la Democracia"</p>
    <div class="date">${escapeHtml(`${DEFAULT_CITY}, ${fechaDoc}`)}</div>
    <p style="font-weight:bold;">CARTA N° ${escapeHtml(numeroDoc)}</p>
    <p style="font-weight:bold; text-transform:uppercase;">${upper(d.representante_nombre || 'Representante Legal')}</p>
    <p style="font-weight:bold;">${upper(d.representante_cargo || 'GERENTE GENERAL')}</p>
    <p style="font-weight:bold;">${upper(d.nombre_empresa || '')}</p>
    <p>De mi mayor consideración:</p>
    <p>Es grato dirigirme a usted para expresarle nuestro cordial saludo en nombre del Instituto de Educación Superior Tecnológico Privado Leonardo Da Vinci, y a la vez presentar al egresado <strong>${upper(d.nombre_estudiante || '')}</strong>, identificado con DNI Nº <strong>${safe(d.dni, '——')}</strong>, del Instituto de Educación Tecnológico Privado Leonardo Da Vinci, de la Carrera Técnica Profesional de <strong>${upper(d.carrera || '')}</strong>, quien va a realizar prácticas profesionales en su organización, por un periodo de ${horas} a ${horas * 3} horas, para complementar la formación recibida en nuestra Institución Educativa.</p>
    <p>De lograr la oportunidad de culminar sus EFSRT, agradecemos se le brinde las facilidades del caso que permita a nuestro egresado alcanzar un óptimo desempeño.</p>
    <p>Aprovechamos para informarle que en nuestra Institución contamos con estudiantes y egresados altamente calificados: los cuales se pueden desempeñar en las carreras y programas.</p>
    <div class="courses-grid">
      <div class="courses-col">
        <strong>Carreras Técnicas de 3 años:</strong>
        <ul>${carrerasList.map(item => `<li>${item}</li>`).join('')}</ul>
      </div>
      <div class="courses-col">
        <strong>Programas Técnicos de 1 año:</strong>
        <ul>${programas.map(item => `<li>${item}</li>`).join('')}</ul>
      </div>
      <div class="courses-col">
        <strong>Cursos de 6 meses:</strong>
        <ul>${cursos.map(item => `<li>${item}</li>`).join('')}</ul>
        <div class="courses-short">
          <div class="courses-short-title">Cursos cortos de 4 meses</div>
          <ul>${cursosCortos.map(item => `<li>${item}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
    <div class="page-break"></div>
    <p style="margin-top:6px;">Hacemos propicia la ocasión para renovarle las expresiones de nuestra especial consideración.</p>
    <p>Atentamente;</p>
    <div class="signature-block">
      <div style="display:inline-block; min-width:280px; text-align:center;">
        <div style="border-top:1px solid #000; width:260px; margin:0 auto 12px;"></div>
        <strong>${upper(responsable.nombre)}</strong><br>
        ${upper(responsable.cargo)}<br>
        Instituto de Educación Superior Tecnológico Privado Leonardo Da Vinci
      </div>
    </div>
    <div class="doc-watermark">iD</div>
    </div>
  `;
  return wrapDocument(content, `
    .doc-tight { line-height: 1.45; position: relative; }
    .doc-tight p { margin: 0 0 10px; }
    .doc-tight .date { margin-bottom: 12px; }
    .page-break { page-break-before: always; }
    .courses-grid { display:flex; gap:12px; font-size:9.5pt; margin-top:4px; }
    .courses-col { flex:1; padding-left:10px; }
    .courses-col:first-child { padding-left:0; }
    .courses-col + .courses-col { border-left:1px solid #222; }
    .courses-grid ul { margin: 2px 0 4px 16px; }
    .courses-grid li { margin-bottom: 2px; }
    .courses-short { break-inside:avoid; page-break-inside:avoid; }
    .courses-short-title { margin: 4px 0 2px 16px; font-weight: 700; }
    .doc-watermark {
      position: absolute; right: -8px; bottom: -6px;
      font-size: 180px; color: rgba(0,136,194,0.2);
      font-weight: 700; line-height: 1; pointer-events: none;
    }
  `);
}

function buildCartaPresentacionTitulado(ctx) {
  const { d, responsable, numeroDoc } = ctx;
  const horas = d.horas_practicas || 128;
  const fechaDoc = formatShortLiteral(new Date());
  const carrerasList = [
    'Administración de Empresas',
    'Contabilidad',
    'Computación e Informática'
  ];
  const programas = [
    'Diseñador Gráfico Digital',
    'Técnico en computación',
    'Secretariado y Asistente Administrativo'
  ];
  const cursos = [
    'Especialista en Ofimática Empresarial',
    'Técnico en Ensamblaje y Reparación de PC\'s y Móviles',
    'Especialista en Marketing Digital',
    'Community Management Profesional'
  ];
  const cursosCortos = [
    'Especialista en Excel Profesional'
  ];

  const content = `
    <div class="doc-tight">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="color:#0088c2;font-size:48px;font-weight:bold;line-height:0.9;">iD</div>
        <div style="font-size:10pt;line-height:1.1;">
          <div style="font-weight:600;">instituto</div>
          <div style="font-size:14pt;">Leonardo</div>
          <div style="font-size:14pt;">Da Vinci</div>
        </div>
      </div>
      <div style="text-align:right;font-size:10pt;">
        <div>Av. España 2725</div>
        <div>Trujillo, Perú</div>
        <div style="font-weight:bold;">T. 245424</div>
        <div style="color:#0088c2;font-weight:bold;">davinci.pe</div>
      </div>
    </div>
    <p style="text-align:center;font-style:italic;">"Año de la Esperanza y el Fortalecimiento de la Democracia"</p>
    <div class="date">${escapeHtml(`${DEFAULT_CITY}, ${fechaDoc}`)}</div>
    <p style="font-weight:bold;">CARTA N° ${escapeHtml(numeroDoc)}</p>
    <p style="font-weight:bold; text-transform:uppercase;">${upper(d.representante_nombre || 'Representante Legal')}</p>
    <p style="font-weight:bold;">${upper(d.representante_cargo || 'GERENTE GENERAL')}</p>
    <p style="font-weight:bold;">${upper(d.nombre_empresa || '')}</p>
    <p>De mi mayor consideración:</p>
    <p>Es grato dirigirme a usted para expresarle nuestro cordial saludo en nombre del Instituto de Educación Superior Tecnológico Privado Leonardo Da Vinci, y a la vez presentar al titulado <strong>${upper(d.nombre_estudiante || '')}</strong>, identificado con DNI Nº <strong>${safe(d.dni, '——')}</strong>, del Instituto de Educación Tecnológico Privado Leonardo Da Vinci, de la Carrera Técnica Profesional de <strong>${upper(d.carrera || '')}</strong>, quien va a realizar prácticas profesionales en su organización, por un periodo de ${horas} a ${horas * 3} horas, para complementar la formación recibida en nuestra Institución Educativa.</p>
    <p>De lograr la oportunidad de culminar sus EFSRT, agradecemos se le brinde las facilidades del caso que permita a nuestro titulado alcanzar un óptimo desempeño.</p>
    <p>Aprovechamos para informarle que en nuestra Institución contamos con estudiantes y titulados altamente calificados: los cuales se pueden desempeñar en las carreras y programas.</p>
    <div class="courses-grid">
      <div class="courses-col">
        <strong>Carreras Técnicas de 3 años:</strong>
        <ul>${carrerasList.map(item => `<li>${item}</li>`).join('')}</ul>
      </div>
      <div class="courses-col">
        <strong>Programas Técnicos de 1 año:</strong>
        <ul>${programas.map(item => `<li>${item}</li>`).join('')}</ul>
      </div>
      <div class="courses-col">
        <strong>Cursos de 6 meses:</strong>
        <ul>${cursos.map(item => `<li>${item}</li>`).join('')}</ul>
        <div class="courses-short">
          <div class="courses-short-title">Cursos cortos de 4 meses</div>
          <ul>${cursosCortos.map(item => `<li>${item}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
    <div class="page-break"></div>
    <p style="margin-top:6px;">Hacemos propicia la ocasión para renovarle las expresiones de nuestra especial consideración.</p>
    <p>Atentamente;</p>
    <div class="signature-block">
      <div style="display:inline-block; min-width:280px; text-align:center;">
        <div style="border-top:1px solid #000; width:260px; margin:0 auto 12px;"></div>
        <strong>${upper(responsable.nombre)}</strong><br>
        ${upper(responsable.cargo)}<br>
        Instituto de Educación Superior Tecnológico Privado Leonardo Da Vinci
      </div>
    </div>
    <div class="doc-watermark">iD</div>
    </div>
  `;
  return wrapDocument(content, `
    .doc-tight { line-height: 1.45; position: relative; }
    .doc-tight p { margin: 0 0 10px; }
    .doc-tight .date { margin-bottom: 12px; }
    .page-break { page-break-before: always; }
    .courses-grid { display:flex; gap:12px; font-size:9.5pt; margin-top:4px; }
    .courses-col { flex:1; padding-left:10px; }
    .courses-col:first-child { padding-left:0; }
    .courses-col + .courses-col { border-left:1px solid #222; }
    .courses-grid ul { margin: 2px 0 4px 16px; }
    .courses-grid li { margin-bottom: 2px; }
    .courses-short { break-inside:avoid; page-break-inside:avoid; }
    .courses-short-title { margin: 4px 0 2px 16px; font-weight: 700; }
    .doc-watermark {
      position: absolute; right: -8px; bottom: -6px;
      font-size: 180px; color: rgba(0,136,194,0.2);
      font-weight: 700; line-height: 1; pointer-events: none;
    }
  `);
}

function buildSupervision(ctx) {
  const { d, fechas, docente } = ctx;
  const rows = [
    ['1.', 'Nombre y apellido del practicante', upper(d.nombre_estudiante || '')],
    ['2.', 'Carrera Profesional', upper(d.carrera || '')],
    ['3.', 'Ciclo de estudios', safe(d.ciclo, '——')],
    ['4.', 'Institución, empresa o centro de prácticas', upper(d.nombre_empresa || '')]
  ];
  const content = `
    <h3 style="font-size:13pt;text-transform:uppercase;margin-bottom:4px;">ANEXO 6: FICHA DE SUPERVISIÓN DE EXPERIENCIAS FORMATIVAS EN SITUACIONES REALES DE TRABAJO</h3>
    <h3 style="font-size:12pt;margin-bottom:22px;">FICHA DE SUPERVISIÓN DE EXPERIENCIAS FORMATIVAS EN SITUACIONES REALES DE TRABAJO</h3>
    <table class="info-table">
      <tbody>
        ${rows.map(row => `<tr><td class="idx">${row[0]}</td><td>${row[1]}: <strong>${row[2]}</strong></td></tr>`).join('')}
        <tr><td class="idx">5.</td><td>Fecha: Inicio <strong>${escapeHtml(fechas.inicioCorto)}</strong> &nbsp;&nbsp; Término <strong>${escapeHtml(fechas.finCorto)}</strong></td></tr>
      </tbody>
    </table>
    <h4 style="margin-top:18px;">REGISTRO DE VISITAS DE SUPERVISIÓN</h4>
    <table class="visitas">
      <thead>
        <tr>
          <th>N° de visita</th>
          <th>Docente supervisor</th>
          <th>Fecha de supervisión</th>
          <th>Tareas o actividades de la práctica</th>
          <th>Estado de avance (%)</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>
        ${Array.from({ length: 4 }).map(() => '<tr>' + Array.from({ length: 6 }).map(() => '<td></td>').join('') + '</tr>').join('')}
      </tbody>
    </table>
    <div class="text-block"><strong>6. Dificultades detectadas durante la práctica</strong></div>
    <div class="empty-box"></div>
    <div class="text-block"><strong>7. Sugerencias y recomendaciones</strong></div>
    <div class="empty-box"></div>
    <div class="signature-block">
      <div style="border-top:1px solid #000; width:200px; margin:0 auto; padding-top:12px;font-weight:bold; text-transform:uppercase;">
        ${upper(docente.nombre)}<br>
        <span style="font-weight:normal;text-transform:none;">${escapeHtml(docente.cargo || 'Docente Supervisor')}</span>
      </div>
    </div>
  `;
  const css = `
    .info-table { width:100%; border-collapse:collapse; font-size:11pt; }
    .info-table td { border:1px solid #444; padding:6px 10px; }
    .info-table .idx { width:30px; text-align:center; font-weight:bold; background:#f2f2f2; }
    .visitas { width:100%; border-collapse:collapse; font-size:10pt; margin-top:10px; }
    .visitas th { background:#efeaf6; border:1px solid #555; padding:6px; font-size:9pt; }
    .visitas td { border:1px solid #777; height:34px; }
    .text-block { margin-top:16px; }
    .empty-box { border:1px solid #444; height:60px; }
  `;
  return wrapDocument(content, css);
}

function buildConvenio(ctx) {
  const { d, fechas, instituto } = ctx;
  const horas = d.horas_practicas || 128;
  const actividad = upper(d.actividad_economica || d.empresa_actividad || d.titulo_oferta || '—');
  const clauses = [
    'PRIMERO: El (la) beneficiario (a) cumple los requisitos de edad y manifiesta su interés de reforzar la capacitación laboral adquirida en el centro de formación mediante actividades formativas en la empresa.',
    'SEGUNDO: El centro de formación informa a la empresa la necesidad de que el beneficiario efectúe su experiencia formativa en situaciones reales de trabajo (EFSRT) para relacionarlo con el mundo laboral.',
    'TERCERO: El (la) beneficiario desempeñará las actividades de EFSRT según el programa de estudios vigente, en el domicilio de la empresa indicado en las condiciones generales.',
    'CUARTO: Obligaciones de la empresa: brindar facilidades, proporcionar dirección técnica, no cobrar por la formación, emitir informes solicitados y entregar certificado sobre su desempeño.',
    'QUINTO: Obligaciones del centro de formación: planificar y desarrollar el plan específico de EFSRT, conducir las actividades de formación y supervisar, evaluar y certificar las actividades formativas.',
    'SEXTO: Obligaciones del beneficiario: suscribir el convenio, desarrollar la EFSRT con disciplina, cumplir las tareas productivas y las obligaciones convenidas.',
    'SÉPTIMO: Causas de modificación, suspensión y terminación del convenio conforme a la Ley N° 28518 y D.S. N° 007-2005-TR.',
    'OCTAVO: El beneficiario declara conocer que el convenio no tiene carácter laboral y solo genera los derechos y obligaciones previstos en la normativa.',
    'NOVENO: Los domicilios consignados serán válidos mientras no exista comunicación escrita que indique un cambio.'
  ];

  const section = (title, entries) => `
    <h4>${title}</h4>
    <table class="cond-table">
      <tbody>
        ${entries.map(([label, value, highlight]) => `<tr class="${highlight ? 'hl' : ''}"><td class="label">${label}</td><td>${value}</td></tr>`).join('')}
      </tbody>
    </table>`;

  const content = `
    <h3 style="text-align:left;text-transform:uppercase;">ANEXO 5: CONVENIO DE EFSRT</h3>
    <h2 style="font-size:13pt;">CONVENIO DE EXPERIENCIA FORMATIVA EN SITUACIONES REALES DE TRABAJO<br>${upper(instituto.nombre)}</h2>
    <p>Conste por el presente documento que, de conformidad con la Ley Nº 28518 y su reglamento, celebran convenio LA EMPRESA, EL CENTRO DE FORMACIÓN y EL (LA) BENEFICIARIO (A), identificados a continuación:</p>
    ${section('A. LA EMPRESA / ENTIDAD', [
      ['Razón Social', upper(d.nombre_empresa || '——')],
      ['RUC', safe(d.empresa_ruc, '——')],
      ['Domicilio', safe(d.empresa_direccion, '——')],
      ['Actividad Económica', actividad, true],
      ['Representante', upper(d.representante_nombre || d.nombre_empresa || '——')],
      ['Doc. de Identidad del Representante', safe(d.representante_dni, '——')]
    ])}
    ${section('B. EL CENTRO DE FORMACIÓN PROFESIONAL', [
      ['Razón Social', upper(instituto.razon)],
      ['RUC', safe(instituto.ruc, '——')],
      ['Domicilio', safe(instituto.direccion, '——')],
      ['Representante', upper(instituto.representante)],
      ['D.N.I.', safe(instituto.representante_dni, '——')]
    ])}
    ${section('C. EL (LA) BENEFICIARIO (A)', [
      ['Nombre', upper(d.nombre_estudiante || '——')],
      ['D.N.I.', safe(d.dni, '——')],
      ['Nacionalidad', upper(d.nacionalidad || 'Peruana')],
      ['Fecha de nacimiento', safe(formatShortLiteral(d.fecha_nacimiento), '——')],
      ['Sexo', upper(d.sexo || '——')],
      ['Estado civil', upper(d.estado_civil || '——')],
      ['Domicilio', safe(d.estudiante_direccion || d.direccion || '——')],
      ['Especialidad', upper(d.carrera || '——')],
      ['Ocupación materia de la capacitación', 'ESTUDIANTE']
    ])}
    ${section('D. CONDICIONES DEL CONVENIO', [
      ['Plazo de duración', `${horas} horas desde ${escapeHtml(fechas.inicioCorto)} al ${escapeHtml(fechas.finCorto)}`],
      ['Días de la pasantía', upper(d.horario_dias || 'Lunes a sábado')],
      ['Horario de la pasantía', upper(d.horario || 'Por definir')],
      ['Área donde se realiza la pasantía', upper(d.area_practica || d.titulo_oferta || '——')]
    ])}
    <h4>CLÁUSULAS DEL CONVENIO</h4>
    ${clauses.map(text => `<p>${escapeHtml(text)}</p>`).join('')}
    <p>Suscrito en la Ciudad de ${DEFAULT_CITY}, ${escapeHtml(fechas.hoyLong)}.</p>
    <div class="firmas">
      <div><div class="line"></div><p>${upper(d.nombre_estudiante || 'Beneficiario')}</p><span>Beneficiario</span></div>
      <div><div class="line"></div><p>${upper(d.representante_nombre || d.nombre_empresa || '——')}</p><span>${escapeHtml(d.representante_cargo || 'Gerente General')}</span></div>
      <div><div class="line"></div><p>Eco. Robert Prada Marchena (e)</p><span>Coordinador Académico</span><span>Instituto Leonardo Da Vinci</span></div>
    </div>
  `;

  const css = `
    h4 { text-transform:uppercase; margin-top:20px; }
    .cond-table { margin-top:8px; }
    .cond-table td { border:1px solid #555; padding:6px 10px; vertical-align:top; }
    .cond-table .label { width:220px; font-weight:bold; background:#f7f7f7; }
    .cond-table tr.hl td:last-child { background:#fff59d; }
    .firmas { margin-top:48px; display:flex; gap:16px; font-size:10pt; text-align:center; }
    .firmas .line { border-top:1px solid #000; margin-bottom:16px; }
    .firmas div { flex:1; padding-top:20px; }
    .firmas span { display:block; }
  `;
  return wrapDocument(content, css);
}

function buildFichaEvaluacion(ctx) {
  const { d, fechas, empresaNombre } = ctx;
  const criterios = [
    'Responsabilidad y ética',
    'Habilidades y destrezas',
    'Liderazgo e iniciativa',
    'Capacidad de gestión',
    'Integración y trabajo en equipo',
    'Manejo de herramientas',
    'Creatividad y aportes',
    'Razonamiento y análisis',
    'Asistencia y puntualidad',
    'Organización y preparación de tareas'
  ];
  const rendimientos = [
    { nivel: 'POBRE', desc: 'Rendimiento deficitario, incorrecto, inadecuado e insuficiente', puntaje: '1' },
    { nivel: 'SUFICIENTE', desc: 'Rendimiento regular, mínimamente satisfactorio', puntaje: '2' },
    { nivel: 'BUENO', desc: 'Rendimiento que satisface las expectativas por encima del promedio', puntaje: '3' },
    { nivel: 'EXCELENTE', desc: 'Rendimiento más que bueno, supera largamente las expectativas', puntaje: '4' }
  ];

  const pageOne = `
    <h3 style="text-align:center;text-transform:uppercase;">INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PRIVADO LEONARDO DA VINCI</h3>
    <h4 style="text-align:left;margin-top:8px;">ANEXO 1: FICHA DE EVALUACIÓN DE EXPERIENCIAS FORMATIVAS EN SITUACIONES REALES DE TRABAJO</h4>
    <p style="text-align:center;font-style:italic;">(Por el supervisor - Coordinador, en el Centro de Prácticas)</p>
    <div class="line-field">Practicante: <span>${upper(d.nombre_estudiante || '')}</span></div>
    <div class="line-field">Centro de Prácticas: <span>${upper(d.nombre_empresa || '')}</span></div>
    <div class="line-field">Supervisor – Coordinador: <span>${upper(d.representante_nombre || empresaNombre || '')}</span></div>
    <div class="line-field">Periodo de evaluación: desde <span>${escapeHtml(fechas.inicioCorto)}</span> hasta <span>${escapeHtml(fechas.finCorto)}</span></div>
    <div class="line-field">Fecha de esta evaluación: <span>${escapeHtml(fechas.hoyLong)}</span> &nbsp;&nbsp; Módulo Académico: <span>${safe(d.ciclo, '')}</span></div>
    <table class="eval-table">
      <thead>
        <tr>
          <th>CRITERIOS DE EVALUACIÓN</th>
          <th>A<br>PONDERACIÓN<br>1- 2- 3- 4</th>
          <th>B<br>RENDIMIENTO<br>1- 2- 3- 4</th>
          <th>AXB<br>PUNTAJE</th>
        </tr>
      </thead>
      <tbody>
        ${criterios.map(text => `<tr><td>${text}</td><td></td><td></td><td></td></tr>`).join('')}
        <tr><td><strong>Puntaje total asignado en esta evaluación</strong></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
  `;

  const pageTwo = `
    <div class="page-break"></div>
    <h4>TABLA DE RENDIMIENTOS</h4>
    <p>Encerrar uno de ellos, según corresponda</p>
    <table class="rend-table">
      <thead><tr><th>RENDIMIENTO</th><th>DESCRIPCIÓN</th><th>PUNTAJE</th></tr></thead>
      <tbody>
        ${rendimientos.map(r => `<tr><td>${r.nivel}</td><td>${r.desc}</td><td>${r.puntaje}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="text-block"><strong>OBSERVACIONES:</strong></div>
    <div class="empty-box"></div>
    <div class="signature-block">
      <div style="border-top:1px solid #000; width:200px; margin:0 auto; padding-top:12px;">
        ${upper(d.representante_nombre || empresaNombre || '________________')}<br>
        <span style="text-transform:none;">${upper(d.representante_cargo || 'Administrador')}</span>
      </div>
    </div>
  `;

  const css = `
    .line-field { margin-bottom:10px; }
    .line-field span { display:inline-block; min-width:120px; border-bottom:1px solid #000; padding:0 6px; }
    .eval-table, .eval-table th, .eval-table td { border:1px solid #000; }
    .eval-table th { text-transform:uppercase; font-size:9pt; padding:6px; text-align:center; }
    .eval-table td { height:32px; padding:6px; }
    .page-break { page-break-before: always; }
    .rend-table { border:1px solid #000; }
    .rend-table th, .rend-table td { border:1px solid #000; padding:6px; }
    .text-block { margin-top:18px; }
    .empty-box { border:1px solid #444; height:120px; }
  `;

  return wrapDocument(pageOne + pageTwo, css);
}

const builders = {
  carta_aceptacion: buildCartaAceptacion,
  constancia_efsrt: buildConstancia,
  ficha_supervision: buildSupervision,
  carta_presentacion_inst: buildCartaPresentacion,
  carta_presentacion_egresado: buildCartaPresentacionEgresado,
  carta_presentacion_titulado: buildCartaPresentacionTitulado,
  certificado_practicas: buildConvenio,
  informe_practicas: buildFichaEvaluacion
};

function buildHtmlTemplate(tipo, ctx) {
  const builder = builders[tipo];
  if (!builder) throw new Error('Plantilla no disponible para el documento solicitado.');
  return builder(ctx);
}

module.exports = {
  buildHtmlTemplate,
  helpers: {
    escapeHtml,
    upper,
    safe,
    formatLongDate,
    formatShortLiteral,
    formatShortLiteralEnd,
    formatRange
  }
};
