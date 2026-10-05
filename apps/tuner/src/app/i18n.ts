const en = {
	start: "Start tuning",
	stop: "Stop",
	starting: "Waiting for microphone…",
	playString: "Play a string",
	playNote: "Play a note",
	inTune: "In tune",
	tuneUp: "Tune up",
	tuneDown: "Tune down",
	denied: "Microphone access was denied. Allow it in your browser settings and try again.",
	error: "The microphone could not be started.",
	reference: "Reference A4",
	auto: "Auto",
	privacy: "Sound is analyzed on your device only. Nothing is recorded or sent anywhere.",
	instruments: { guitar: "Guitar", bass: "Bass", violin: "Violin", chromatic: "Chromatic" },
};

const cs: typeof en = {
	start: "Začít ladit",
	stop: "Zastavit",
	starting: "Čekám na mikrofon…",
	playString: "Zahrajte strunu",
	playNote: "Zahrajte tón",
	inTune: "Naladěno",
	tuneUp: "Přitáhnout",
	tuneDown: "Povolit",
	denied: "Přístup k mikrofonu byl zamítnut. Povolte ho v nastavení prohlížeče a zkuste to znovu.",
	error: "Mikrofon se nepodařilo spustit.",
	reference: "Ladění A4",
	auto: "Auto",
	privacy: "Zvuk se zpracovává jen ve vašem zařízení. Nic se nenahrává ani neodesílá.",
	instruments: { guitar: "Kytara", bass: "Baskytara", violin: "Housle", chromatic: "Chromatické" },
};

export const LANG =
	typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("cs") ? "cs" : "en";
export const T = LANG === "cs" ? cs : en;
