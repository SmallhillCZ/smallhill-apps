const MEDIA = /^(image|video)\//;
const TYPES = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	avif: "image/avif",
	mp4: "video/mp4",
	webm: "video/webm",
	mov: "video/quicktime",
};

function openDb() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("memes", 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains("memes"))
				request.result.createObjectStore("memes", { keyPath: "id" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function title(name) {
	return name
		.replace(/\.[a-z0-9]{2,5}$/i, "")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

async function receiveShare(request) {
	const scope = self.registration.scope;
	try {
		const form = await request.formData();
		const text = [form.get("title"), form.get("text")].filter((v) => typeof v === "string" && v).join(" ");
		const now = Date.now();
		const memes = [];
		for (const file of form.getAll("media")) {
			if (!(file instanceof File) || !file.size) continue;
			const ext = (file.name.match(/\.([a-z0-9]{2,5})$/i) || [])[1];
			const type =
				file.type && file.type !== "application/octet-stream" ? file.type : TYPES[(ext || "").toLowerCase()];
			if (!type || !MEDIA.test(type)) continue;
			memes.push({
				id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
				blob: new Blob([await file.arrayBuffer()], { type }),
				type,
				name: file.name || "",
				title: title(text || file.name || ""),
				tags: [],
				added: now + memes.length,
				used: 0,
				uses: 0,
				updated: now,
			});
		}
		if (!memes.length) return Response.redirect(`${scope}?shared=none`, 303);
		const db = await openDb();
		await new Promise((resolve, reject) => {
			const tx = db.transaction("memes", "readwrite");
			for (const meme of memes) tx.objectStore("memes").put(meme);
			tx.oncomplete = resolve;
			tx.onerror = () => reject(tx.error);
		});
		db.close();
		return Response.redirect(`${scope}?shared=${memes.map((m) => m.id).join(",")}`, 303);
	} catch (e) {
		return Response.redirect(`${scope}?shared=error`, 303);
	}
}

self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);
	if (event.request.method === "POST" && url.href === new URL("share-target", self.registration.scope).href) {
		event.respondWith(receiveShare(event.request));
	}
});

importScripts("./ngsw-worker.js");
