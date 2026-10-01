/**
 * Cloudflare Worker — Studio Libre Accès form handler
 *
 * Routes:
 *   POST /api/contact     -> contact form
 *   POST /api/estimate    -> estimate/inquiry form
 *
 * Stores submissions in D1 and sends an email notification via Resend.
 */

const SITE_NAME = 'Studio Libre Accès';

function makeCorsHeaders(origin, env) {
	const allowed = env.CANONICAL_URL || '*';
	return {
		'Access-Control-Allow-Origin': allowed,
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Content-Type': 'application/json',
	};
}

function corsPreflight(origin, env) {
	return new Response(null, { status: 204, headers: makeCorsHeaders(origin, env) });
}

function jsonResponse(body, status = 200, env, origin) {
	return new Response(JSON.stringify(body), { status, headers: makeCorsHeaders(origin, env) });
}

function errorResponse(message, status = 400, env, origin) {
	return jsonResponse({ ok: false, error: message }, status, env, origin);
}

function validateEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

function sanitize(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

async function sendTelegram(env, text) {
	if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
	const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: env.TELEGRAM_CHAT_ID,
			text,
			parse_mode: 'MarkdownV2',
			disable_web_page_preview: true,
		}),
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Telegram error ${res.status}: ${err}`);
	}
	return res.json();
}

function escapeMarkdown(text) {
	return String(text ?? '').replace(/([_\*\[\]\(\)~`>#+\-=|{}.!])/g, '\\$1');
}

async function storeSubmission(db, data) {
	const stmt = db.prepare(`
		INSERT INTO submissions
		(form_type, name, pronouns, email, organization, message, reason, pages, estimated_budget, care_plan, sliding_scale, timeline, addons)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);
	await stmt.bind(
		data.form_type,
		data.name,
		data.pronouns ?? null,
		data.email,
		data.organization ?? null,
		data.message,
		data.reason ?? null,
		data.pages ?? null,
		data.estimated_budget ?? null,
		data.care_plan ?? null,
		data.sliding_scale ?? null,
		data.timeline ?? null,
		data.addons ?? null
	).run();
}

function buildTelegramMessage(formType, data) {
	const reasonLabel = data.reason ? ` (${escapeMarkdown(data.reason)})` : '';
	const typeLabel = formType === 'estimate' ? 'Estimate request' : 'Contact message';
	let msg = `*New ${typeLabel}${reasonLabel} — ${escapeMarkdown(SITE_NAME)}*\n\n`;
	msg += `*Name:* ${escapeMarkdown(data.name)}\n`;
	if (data.pronouns) msg += `*Pronouns:* ${escapeMarkdown(data.pronouns)}\n`;
	msg += `*Email:* ${escapeMarkdown(data.email)}\n`;
	if (data.organization) msg += `*Organization:* ${escapeMarkdown(data.organization)}\n`;
	if (data.reason) msg += `*Reason:* ${escapeMarkdown(data.reason)}\n`;
	if (data.pages) msg += `*Pages:* ${escapeMarkdown(data.pages)}\n`;
	if (data.estimated_budget) msg += `*Budget:* ${escapeMarkdown(data.estimated_budget)}\n`;
	if (data.care_plan) msg += `*Care plan:* ${escapeMarkdown(data.care_plan)}\n`;
	if (data.sliding_scale) msg += `*Sliding scale:* ${escapeMarkdown(data.sliding_scale)}\n`;
	if (data.timeline) msg += `*Timeline:* ${escapeMarkdown(data.timeline)}\n`;
	if (data.addons) msg += `*Add\-ons:* ${escapeMarkdown(data.addons)}\n`;
	msg += `\n*Message:*\n${escapeMarkdown(data.message)}`;
	return msg;
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const origin = request.headers.get('Origin') || '';

		if (request.method === 'OPTIONS') return corsPreflight(origin, env);
		if (request.method !== 'POST') return errorResponse('Method not allowed', 405, env, origin);

		let data;
		try {
			data = await request.json();
		} catch {
			return errorResponse('Invalid JSON body', 400, env, origin);
		}

		if (!['/api/contact', '/api/estimate'].includes(url.pathname)) {
			return errorResponse('Not found', 404, env, origin);
		}

		// Legacy /api/estimate defaults to estimate; otherwise form_type comes from payload.
		let formType = data.form_type || (url.pathname === '/api/estimate' ? 'estimate' : 'contact');
		formType = ['contact', 'estimate'].includes(formType) ? formType : 'contact';

		if (!data.name || !data.email || !data.message) {
			return errorResponse('Name, email, and message are required', 400, env, origin);
		}

		if (!validateEmail(data.email)) {
			return errorResponse('Please provide a valid email address', 400, env, origin);
		}

		const payload = {
			form_type: formType,
			name: data.name.trim(),
			pronouns: (data.pronouns || '').trim() || null,
			email: data.email.trim().toLowerCase(),
			organization: (data.organization || '').trim() || null,
			message: data.message.trim(),
			reason: (data.reason || '').trim() || null,
			pages: data.pages ? Number(data.pages) : null,
			estimated_budget: (data.estimated_budget || '').trim() || null,
			care_plan: (data.care_plan || '').trim() || null,
			sliding_scale: (data.sliding_scale || '').trim() || null,
			timeline: (data.timeline || '').trim() || null,
			addons: (data.addons || '').trim() || null,
		};

		try {
			await storeSubmission(env.DB, payload);
		} catch (err) {
			console.error('D1 store error:', err);
			return errorResponse('Failed to save submission. Please try again later.', 500, env, origin);
		}

		try {
			await sendTelegram(env, buildTelegramMessage(formType, payload));
		} catch (err) {
			console.error('Telegram send error:', err);
			// Still return success to user; admin can check D1.
		}

		return jsonResponse({ ok: true, message: 'Submission received. We will get back to you within 48 hours.' }, 200, env, origin);
	},
};
