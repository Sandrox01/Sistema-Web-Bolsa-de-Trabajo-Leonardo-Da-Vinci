// ============================================================
// BOLSA DE TRABAJO LDV — Global JS v4.0
// ============================================================

const API = '/api';

// ── Auth ────────────────────────────────────────────────────
const Auth = {
    getToken: () => localStorage.getItem('ldv_token'),
    getUser: () => {
        try { return JSON.parse(localStorage.getItem('ldv_user')); } catch { return null; }
    },
    setSession: (data) => {
        localStorage.setItem('ldv_token', data.token);
        localStorage.setItem('ldv_user', JSON.stringify({
            tipo: data.tipo, nombre: data.nombre, id: data.id
        }));
    },
    clear: () => {
        localStorage.removeItem('ldv_token');
        localStorage.removeItem('ldv_user');
    },
    isLoggedIn: () => !!localStorage.getItem('ldv_token'),
    requireAuth: (tipo) => {
        const user = Auth.getUser();
        if (!user || (tipo && user.tipo !== tipo)) {
            Auth.clear();
            window.location.href = '/login';
            return false;
        }
        return true;
    }
};

// ── API Fetch ───────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
    const token = Auth.getToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const res = await fetch(API + endpoint, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
    return data;
}

// ── Toast notifications (SweetAlert2) ──────────────────────
function toast(msg, type = 'info', duration = 4000) {
    if (typeof Swal === 'undefined') {
        console.warn('SweetAlert2 no disponible');
        return;
    }
    Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: duration,
        timerProgressBar: true,
        icon: { success: 'success', error: 'error', info: 'info', warning: 'warning' }[type] || 'info',
        title: msg
    });
}

// ── Alert helper ────────────────────────────────────────────
function showAlert(selector, msg, type = 'success') {
    if (typeof Swal !== 'undefined') {
        const titleMap = { success: 'Listo', error: 'Ocurrió un problema', info: 'Aviso', warning: 'Atención' };
        Swal.fire({
            icon: type,
            title: titleMap[type] || 'Aviso',
            text: msg,
            confirmButtonColor: '#1d6fe8'
        });
    }
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el) {
        el.textContent = msg;
        el.className = `alert alert-${type} show`;
        setTimeout(() => { el.className = 'alert'; }, 6000);
    }
}

// ── Global processing modal ─────────────────────────────
function processingAlert(message = 'Procesando...') {
    if (typeof Swal === 'undefined') return () => {};
    Swal.fire({
        title: message,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
    });
    return () => {
        try { Swal.close(); } catch (_) {}
    };
}

// ── Confirm dialog ──────────────────────────────────────────
async function confirmAction(opts = {}) {
    if (typeof Swal === 'undefined') return confirm(opts.text || '¿Confirmar?');
    const result = await Swal.fire({
        icon: opts.icon || 'warning',
        title: opts.title || '¿Estás seguro?',
        text: opts.text || '',
        showCancelButton: true,
        confirmButtonText: opts.confirm || 'Confirmar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: opts.danger ? '#ef4444' : '#1d6fe8',
        cancelButtonColor: '#6b8aaa'
    });
    return result.isConfirmed;
}

// ── Format date ─────────────────────────────────────────────
function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
}
function timeAgo(d) {
    if (!d) return '—';
    const diff = Date.now() - new Date(d);
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `hace ${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `hace ${days}d`;
    return formatDate(d);
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function openCv(postulacionId) {
    if (!postulacionId) {
        toast('CV no disponible', 'warning');
        return;
    }
    const token = Auth.getToken();
    if (!token) {
        toast('Inicia sesión para ver el CV', 'warning');
        return;
    }
    const preOpen = window.open('', '_blank');
    try {
        const res = await fetch(`/api/cv/${postulacionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            let msg = 'No se pudo abrir el CV';
            try { const data = await res.json(); msg = data.error || msg; } catch {}
            throw new Error(msg);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (preOpen) {
            preOpen.location = url;
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener';
            a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
        if (preOpen) preOpen.close();
        toast(e.message || 'No se pudo abrir el CV', 'error');
    }
}

// ── Badge map ────────────────────────────────────────────────
// Estados de postulación — flujo completo:
// enviada → en_revision → seleccionado (preseleccionado, cerrada=0)
//                       → contratado (cerrada=1)
//                       → rechazado
const BADGE_MAP = {
    // Offer states
    activa:           ['green',  '● Activa'],
    pausada:          ['yellow', '⏸ Pausada'],
    cerrada:          ['gray',   '🔒 Cerrada'],
    // Job type
    practicas:        ['blue',   '🎓 Prácticas'],
    trabajo:          ['red',    '💼 Trabajo'],
    // Modality
    presencial:       ['gray',   'Presencial'],
    remoto:           ['teal',   '🌐 Remoto'],
    hibrido:          ['yellow', 'Híbrido'],
    // Application states
    enviada:          ['blue',   'Enviada'],
    en_revision:      ['yellow', '🔍 En revisión'],
    seleccionado:     ['yellow', '⏳ Preseleccionado'],  // awaiting letter
    contratado:       ['green',  '✅ Contratado'],        // letter issued + closed
    rechazado:        ['red',    '✗ Rechazado'],
    // User types
    aprobado:         ['green',  '✓ Aprobado'],
    pendiente:        ['yellow', '⏳ Pendiente'],
    estudiante:       ['blue',   'Estudiante'],
    practicante:      ['purple', 'Practicante'],
    egresado:         ['blue',   'Egresado'],
    titulado:         ['teal',   'Titulado'],
    todos:            ['gray',   'Todos'],
};

function tipoBadge(tipo) {
    if (!tipo) return '';
    const [color, label] = BADGE_MAP[tipo] || ['gray', tipo];
    return `<span class="badge badge-${color}">${label}</span>`;
}

// ── Special process badges ───────────────────────────────────
// Use these for the hiring pipeline cards (more visual than plain badges)
function preseleccionadoBadge() {
    return `<span class="badge badge-preseleccionado">⏳ Preseleccionado</span>`;
}
function contratadoBadge() {
    return `<span class="badge badge-contratado">✅ Contratado</span>`;
}
function cerradaOfertaBadge() {
    return `<span class="badge badge-cerrada-offer">🔒 Oferta cerrada</span>`;
}

// ── Application state helpers ────────────────────────────────
// Returns display info for a postulacion based on estado + cerrada flag
function getAppStatus(estado, cerrada) {
    if (estado === 'seleccionado' && !cerrada) {
        return {
            label: '⏳ Preseleccionado',
            color: 'amber',
            cssClass: 'badge-preseleccionado',
            description: 'La empresa te eligió. El instituto está gestionando tu Carta de Aceptación oficial.',
            icon: '⏳'
        };
    }
    if (estado === 'seleccionado' && cerrada) {
        return {
            label: '✅ Contratado',
            color: 'green',
            cssClass: 'badge-contratado',
            description: '¡Felicitaciones! Fuiste contratado. Tu carta fue emitida y el proceso cerrado.',
            icon: '✅'
        };
    }
    const map = {
        enviada:     { label: 'Enviada',       color: 'blue',   cssClass: 'badge-blue',   description: 'Tu postulación fue enviada y está a la espera de revisión.', icon: '📤' },
        en_revision: { label: 'En revisión',   color: 'yellow', cssClass: 'badge-yellow', description: 'La empresa está revisando tu perfil y CV.', icon: '🔍' },
        rechazado:   { label: 'No seleccionado', color: 'red',  cssClass: 'badge-red',    description: 'La empresa no continuará con tu postulación en esta oferta.', icon: '✕' },
    };
    return map[estado] || { label: estado, color: 'gray', cssClass: 'badge-gray', description: '', icon: '•' };
}

// ── Truncate ─────────────────────────────────────────────────
function truncate(str, len = 100) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
}

// ── Initials ─────────────────────────────────────────────────
function initials(name) {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

// ── Logout ───────────────────────────────────────────────────
function logout() {
    Auth.clear();
    window.location.href = '/';
}

// ── Navbar scroll effect ─────────────────────────────────────
window.addEventListener('scroll', () => {
    const nav = document.querySelector('.navbar');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
});

// ── Update nav links based on auth ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const navActions = document.getElementById('navActions');
    if (!navActions) return;
    const user = Auth.getUser();
    if (user) {
        const dashMap = {
            empresa:    '/dashboard-empresa',
            estudiante: '/dashboard-estudiante',
            admin:      '/dashboard-admin'
        };
        navActions.innerHTML = `
            <a href="${dashMap[user.tipo] || '/'}" class="btn btn-ghost btn-sm">Mi Panel</a>
            <button onclick="logout()" class="btn btn-outline btn-sm">Salir</button>
        `;
    }
});

// ── Accordion toggle utility ─────────────────────────────────
function toggleAccordion(headerId, bodyId) {
    const header = document.getElementById(headerId);
    const body = document.getElementById(bodyId);
    const toggle = header?.querySelector('.accordion-toggle');
    if (!body) return;
    const isOpen = body.classList.toggle('open');
    if (header) header.classList.toggle('open', isOpen);
    if (toggle) toggle.classList.toggle('open', isOpen);
}

// ── Section switcher (dashboard nav) ─────────────────────────
function showSection(id, navSelector = '.nav-item') {
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll(navSelector).forEach(n => n.classList.remove('active'));
    const sec = document.getElementById(id);
    if (sec) { sec.style.display = 'block'; sec.classList.add('fade-up'); }
    const navEl = document.querySelector(`[data-section="${id}"]`);
    if (navEl) navEl.classList.add('active');
}

// ── Generate carta PDF via API ────────────────────────────────
async function generarCarta(postulacionId, btnEl) {
    if (!btnEl) return;
    const originalHTML = btnEl.innerHTML;
    btnEl.innerHTML = '<span class="spinner"></span> Generando...';
    btnEl.disabled = true;
    const stopLoading = processingAlert('Generando carta de aceptación...');
    try {
        const data = await apiFetch(`/admin/carta/${postulacionId}`);
        stopLoading();
        await Swal.fire({
            icon: 'success',
            title: 'Carta generada',
            text: 'La carta de aceptación fue emitida y quedó lista para descarga.',
            confirmButtonColor: '#1d6fe8'
        });
        // Enable the "confirm hire" button if present
        const confirmBtn = document.querySelector(`[data-confirm-hire="${postulacionId}"]`);
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('btn-ghost');
            confirmBtn.classList.add('btn-green-solid');
        }
        return data;
    } catch (err) {
        stopLoading();
        await Swal.fire({
            icon: 'error',
            title: 'No se pudo generar',
            text: err.message || 'Intenta nuevamente en unos segundos.',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        btnEl.innerHTML = originalHTML;
        btnEl.disabled = false;
    }
}

// ── Close hiring process (admin only) ────────────────────────
async function confirmarContratacion(postulacionId, btnEl) {
    const ok = await confirmAction({
        title: '¿Confirmar contratación?',
        text: 'Esta acción cerrará la oferta y marcará al candidato como contratado. No se puede deshacer.',
        confirm: 'Sí, confirmar',
        icon: 'question'
    });
    if (!ok) return;
    const originalHTML = btnEl.innerHTML;
    btnEl.innerHTML = '<span class="spinner"></span> Procesando...';
    btnEl.disabled = true;
    const stopLoading = processingAlert('Confirmando contratación...');
    try {
        await apiFetch(`/postulaciones/${postulacionId}/cerrar`, { method: 'PATCH' });
        stopLoading();
        await Swal.fire({
            icon: 'success',
            title: 'Proceso cerrado',
            text: 'La oferta quedó cerrada y el candidato fue registrado como contratado.',
            confirmButtonColor: '#16a34a'
        });
        setTimeout(() => location.reload(), 1200);
    } catch (err) {
        stopLoading();
        await Swal.fire({
            icon: 'error',
            title: 'No se pudo confirmar',
            text: err.message || 'Intenta nuevamente.',
            confirmButtonColor: '#ef4444'
        });
        btnEl.innerHTML = originalHTML;
        btnEl.disabled = false;
    }
}