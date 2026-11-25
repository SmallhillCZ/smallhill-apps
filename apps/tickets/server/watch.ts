import { PNG } from "pngjs";
import jsQRModule from "jsqr";
import QRCode from "qrcode";

export const WATCH_RESULT_URL = "https://localhost/smallhill-tickets";

export interface QrMatrix {
	size: number;
	qr: string;
}

export function qrMatrix(dataUrl: string): QrMatrix | null {
	const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
	if (!match) return null;
	let payload: number[];
	try {
		const png = PNG.sync.read(Buffer.from(match[1], "base64"));
		const pixels = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
		const found = jsQRModule.default(pixels, png.width, png.height, { inversionAttempts: "attemptBoth" });
		if (!found) return null;
		payload = found.binaryData;
	} catch {
		return null;
	}
	const { modules } = QRCode.create([{ data: Uint8Array.from(payload), mode: "byte" }], {
		errorCorrectionLevel: "M",
	});
	const size = modules.size;
	const bits = Buffer.alloc(Math.ceil((size * size) / 8));
	for (let i = 0; i < size * size; i++) {
		if (modules.get(Math.floor(i / size), i % size)) bits[i >> 3] |= 0x80 >> (i & 7);
	}
	return { size, qr: bits.toString("base64") };
}

const texts = {
	cs: {
		title: "Lístky pro hodinky",
		intro: "Přihlaste se účtem GoOut. Hodinky si uloží přístup a lístky stáhnou samy, heslo se nikam neukládá.",
		email: "E-mail",
		password: "Heslo",
		submit: "Přihlásit",
		credentials: "Špatný e-mail nebo heslo.",
		failed: "Přihlášení se nepovedlo, zkuste to znovu.",
	},
	en: {
		title: "Tickets for your watch",
		intro: "Sign in with your GoOut account. The watch keeps the access and downloads your tickets, the password is not stored anywhere.",
		email: "E-mail",
		password: "Password",
		submit: "Sign in",
		credentials: "Wrong e-mail or password.",
		failed: "Sign-in failed, please try again.",
	},
};

export function watchLanguage(acceptLanguage: string | undefined): "cs" | "en" {
	for (const part of (acceptLanguage ?? "").split(",")) {
		const lang = part.split(";")[0].trim().toLowerCase().slice(0, 2);
		if (lang === "cs" || lang === "sk") return "cs";
		if (lang === "en") return "en";
	}
	return "en";
}

export function watchLoginPage(lang: "cs" | "en"): string {
	const t = texts[lang];
	return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${t.title}</title>
<style>
:root{--bg:#fff;--fg:#1d1d1f;--muted:#5f5f66;--line:#d4d4d8;--accent:#c2255c}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--fg:#f2f2f5;--muted:#a1a1aa;--line:#3f3f46;--accent:#e64980}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:420px;margin:0 auto;padding:32px 16px}
h1{font-size:1.5rem;margin:0 0 8px;color:var(--accent)}
p{color:var(--muted);margin:0 0 24px}
label{display:block;font-weight:600;margin:0 0 16px}
input{display:block;width:100%;margin-top:6px;padding:12px;font:inherit;color:inherit;background:transparent;border:1px solid var(--line);border-radius:8px}
button{width:100%;padding:12px;font:inherit;font-weight:600;color:#fff;background:var(--accent);border:0;border-radius:8px}
button:disabled{opacity:.6}
#error{color:var(--accent);min-height:1.5em;margin:12px 0 0}
</style>
</head>
<body>
<main>
<h1>${t.title}</h1>
<p>${t.intro}</p>
<form id="form">
<label>${t.email}<input name="email" type="email" autocomplete="username" required></label>
<label>${t.password}<input name="password" type="password" autocomplete="current-password" required></label>
<button>${t.submit}</button>
<div id="error" role="alert"></div>
</form>
</main>
<script>
const form = document.getElementById("form");
const error = document.getElementById("error");
form.addEventListener("submit", async (e) => {
	e.preventDefault();
	const button = form.querySelector("button");
	button.disabled = true;
	error.textContent = "";
	try {
		const res = await fetch("../login", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: form.email.value, password: form.password.value }),
		});
		if (res.status === 401) throw new Error(${JSON.stringify(t.credentials)});
		if (!res.ok) throw new Error(${JSON.stringify(t.failed)});
		const { session } = await res.json();
		location.href = ${JSON.stringify(WATCH_RESULT_URL)} + "?session=" + encodeURIComponent(session);
	} catch (err) {
		error.textContent = err instanceof TypeError ? ${JSON.stringify(t.failed)} : err.message;
		button.disabled = false;
	}
});
</script>
</body>
</html>`;
}
