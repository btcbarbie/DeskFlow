/**
 * DeskFlow Helpdesk — app.js
 * ─────────────────────────────────────────────────────────────
 * Architecture:
 *   • TicketStore  — single source of truth, wraps localStorage
 *   • App          — global app state, role switching, form handling
 *   • Dashboard    — table render, filtering, sorting, metrics
 *   • Modal        — ticket detail overlay, inline edits
 *   • Toast        — lightweight notification utility
 *   • Utils        — shared helpers (ids, dates, SLA)
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ══════════════════════════════════════════
   UTILS — shared helpers
══════════════════════════════════════════ */
const Utils = (() => {

    /** Generate a unique ticket ID like TKT-8F3A2 */
    function generateId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let id = 'TKT-';
        for (let i = 0; i < 5; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    /** SLA hours by priority */
    const SLA_HOURS = { Low: 72, Medium: 48, High: 24, Urgent: 8 };

    /** Compute SLA deadline ISO string from creation date + priority */
    function calcSLADeadline(createdAt, priority) {
        const hours = SLA_HOURS[priority] || 48;
        const deadline = new Date(createdAt);
        deadline.setTime(deadline.getTime() + hours * 60 * 60 * 1000);
        return deadline.toISOString();
    }

    /** Return true if SLA deadline has passed and ticket is not resolved/closed */
    function isOverdue(ticket) {
        if (ticket.status === 'Resolved' || ticket.status === 'Closed') return false;
        return new Date() > new Date(ticket.slaDeadline);
    }

    /** Format ISO string to readable date/time */
    function formatDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    /** Format ISO string to short date only */
    function formatShortDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    }

    /** Escape HTML to prevent XSS */
    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    /** Validate email format */
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /** Calculate hours between two ISO dates */
    function hoursBetween(a, b) {
        return Math.abs(new Date(b) - new Date(a)) / 3_600_000;
    }

    return { generateId, calcSLADeadline, isOverdue, formatDate, formatShortDate, escHtml, isValidEmail, hoursBetween, SLA_HOURS };
})();


/* ══════════════════════════════════════════
   TICKET STORE — localStorage wrapper
══════════════════════════════════════════ */
const TicketStore = (() => {
    const KEY = 'deskflow_tickets_v1';

    /** Load all tickets from localStorage */
    function getAll() {
        try {
            return JSON.parse(localStorage.getItem(KEY)) || [];
        } catch {
            return [];
        }
    }

    /** Persist the full ticket array */
    function saveAll(tickets) {
        localStorage.setItem(KEY, JSON.stringify(tickets));
    }

    /** Add a new ticket; returns the saved ticket object */
    function add(ticketData) {
        const tickets = getAll();
        const now = new Date().toISOString();
        const ticket = {
            id: Utils.generateId(),
            name: ticketData.name.trim(),
            email: ticketData.email.trim().toLowerCase(),
            subject: ticketData.subject.trim(),
            description: ticketData.description.trim(),
            category: ticketData.category,
            priority: ticketData.priority,
            status: 'Open',
            agent: '',
            notes: '',
            resolution: '',
            createdAt: now,
            updatedAt: now,
            resolvedAt: null,
            slaDeadline: Utils.calcSLADeadline(now, ticketData.priority),
        };
        tickets.unshift(ticket); // newest first
        saveAll(tickets);
        return ticket;
    }

    /** Update specific fields on a ticket by ID */
    function update(id, fields) {
        const tickets = getAll();
        const idx = tickets.findIndex(t => t.id === id);
        if (idx === -1) return null;
        const prev = tickets[idx];
        const now = new Date().toISOString();

        // Track resolved time for average resolution metric
        if (fields.status && fields.status === 'Resolved' && prev.status !== 'Resolved') {
            fields.resolvedAt = now;
        }

        // If priority changes, recalculate SLA from original creation time
        if (fields.priority && fields.priority !== prev.priority) {
            fields.slaDeadline = Utils.calcSLADeadline(prev.createdAt, fields.priority);
        }

        tickets[idx] = { ...prev, ...fields, updatedAt: now };
        saveAll(tickets);
        return tickets[idx];
    }

    /** Remove a ticket by ID */
    function remove(id) {
        const tickets = getAll().filter(t => t.id !== id);
        saveAll(tickets);
    }

    /** Find one ticket by ID */
    function getById(id) {
        return getAll().find(t => t.id === id) || null;
    }

    return { getAll, add, update, remove, getById };
})();


/* ══════════════════════════════════════════
   TOAST — notification utility
══════════════════════════════════════════ */
const Toast = (() => {
    let timer = null;
    const el = () => document.getElementById('toast');

    function show(msg, type = 'info', duration = 3000) {
        const t = el();
        t.textContent = msg;
        t.className = `toast toast-${type} show`;
        clearTimeout(timer);
        timer = setTimeout(() => { t.className = 'toast'; }, duration);
    }

    return { show };
})();


/* ══════════════════════════════════════════
   APP — role switching + customer form
══════════════════════════════════════════ */
const App = (() => {

    let currentRole = 'customer';

    /** Switch between customer and agent views */
    function switchRole(role) {
        currentRole = role;

        // Toggle view visibility
        document.getElementById('view-customer').style.display = role === 'customer' ? '' : 'none';
        document.getElementById('view-agent').style.display = role === 'agent' ? '' : 'none';

        // Update toggle button states
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === role);
        });

        // Refresh dashboard when switching to agent
        if (role === 'agent') {
            Dashboard.render();
        }
    }

    /** Initialize form listeners */
    function initForm() {
        const form = document.getElementById('ticketForm');
        const desc = document.getElementById('ticketDescription');
        const count = document.getElementById('charCount');

        // Character counter for description
        desc.addEventListener('input', () => {
            const len = desc.value.length;
            count.textContent = `${len} / 1000`;
            if (len > 1000) {
                desc.value = desc.value.slice(0, 1000);
                count.textContent = '1000 / 1000';
            }
        });

        // Form submission
        form.addEventListener('submit', e => {
            e.preventDefault();
            if (!validateForm()) return;
            submitTicket();
        });
    }

    /** Validate the submission form; returns true if valid */
    function validateForm() {
        let valid = true;

        const fields = [
            { id: 'custName', errId: 'err-custName', msg: 'Please enter your name.' },
            { id: 'custEmail', errId: 'err-custEmail', msg: 'Please enter a valid email.', fn: v => Utils.isValidEmail(v) },
            { id: 'ticketSubject', errId: 'err-ticketSubject', msg: 'Please enter a subject.' },
            { id: 'ticketCategory', errId: 'err-ticketCategory', msg: 'Please select a category.' },
            { id: 'ticketPriority', errId: 'err-ticketPriority', msg: 'Please select a priority.' },
            { id: 'ticketDescription', errId: 'err-ticketDescription', msg: 'Please describe your issue.' },
        ];

        fields.forEach(({ id, errId, msg, fn }) => {
            const el = document.getElementById(id);
            const err = document.getElementById(errId);
            const val = el.value.trim();
            const ok = fn ? fn(val) : val.length > 0;

            if (!ok) {
                el.classList.add('invalid');
                err.textContent = msg;
                valid = false;
            } else {
                el.classList.remove('invalid');
                err.textContent = '';
            }
        });

        return valid;
    }

    /** Collect form data and persist ticket */
    function submitTicket() {
        const ticket = TicketStore.add({
            name: document.getElementById('custName').value,
            email: document.getElementById('custEmail').value,
            subject: document.getElementById('ticketSubject').value,
            description: document.getElementById('ticketDescription').value,
            category: document.getElementById('ticketCategory').value,
            priority: document.getElementById('ticketPriority').value,
        });

        // Show success state
        document.getElementById('ticketFormCard').style.display = 'none';
        const sc = document.getElementById('successCard');
        sc.style.display = '';
        document.getElementById('successTicketId').textContent = ticket.id;
        Toast.show('Ticket submitted successfully!', 'success');
    }

    /** Reset form back to initial state */
    function resetForm() {
        document.getElementById('ticketForm').reset();
        document.getElementById('charCount').textContent = '0 / 1000';
        document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
        document.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
        document.getElementById('successCard').style.display = 'none';
        document.getElementById('ticketFormCard').style.display = '';
    }

    function init() {
        initForm();
    }

    return { switchRole, resetForm, init };
})();


/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
