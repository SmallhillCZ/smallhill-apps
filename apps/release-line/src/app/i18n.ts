import { Injectable, computed, signal } from "@angular/core";

export type Lang = "en" | "cs";
export const LANGS: Lang[] = ["en", "cs"];

const en = {
	appName: "Release Line",
	language: "Language",
	menu: "Menu",
	theme: "Theme",
	themes: { auto: "Auto", light: "Light", dark: "Dark" },
	signOut: "Sign out",
	back: "Back",
	retry: "Try again",
	loading: "Loading…",

	tagline: "Your branches and tags as a metro map. Release by moving a tag.",
	signInGithub: "Sign in with GitHub",
	enterCode: "Enter this code on GitHub",
	openGithub: "Open github.com/login/device",
	copyCode: "Copy code",
	copied: "Copied",
	waiting: "Waiting for you to approve…",
	or: "or",
	patLabel: "Personal access token",
	patUse: "Use",
	patHint: "A fine-grained token with Contents and Actions set to read and write.",
	createToken: "Create one",
	privacy: "The token is kept only on this device and the app talks to GitHub directly.",
	authErrors: {
		offline: "You are offline.",
		denied: "Sign-in was cancelled on GitHub.",
		expired: "The code expired. Try again.",
		failed: "Sign-in failed. Try again.",
		badToken: "GitHub did not accept this token.",
	},

	chooseRepo: "Choose a repository",
	searchRepos: "Search or type owner/name",
	open: "Open",
	recent: "Recent",
	yourRepos: "Your repositories",
	noRepos: "No repositories found.",
	private: "Private",

	tags: "Tags",
	tagsPlaceholder: "all",
	branches: "Branches",
	branchModes: {
		range: (n: number, total: number) => `In range (${n} of ${total})`,
		default: "Default only",
		all: "All",
	},
	refresh: "Refresh",
	rangeFrom: (tag: string) => `From ${tag}, the oldest release tag, to the newest commit`,
	rangeRecent: "Latest commits on the default branch",
	commits: (n: number) => (n === 1 ? "1 commit" : `${n} commits`),
	hiddenCommits: (n: number) => (n === 1 ? "1 commit hidden" : `${n} commits hidden`),
	showHidden: "Show",
	showSome: (n: number) => `Show ${n} more`,
	releaseTags: "Release tags",
	dragHint:
		"Drag a coloured tag onto another commit, or click a commit, to release it there. Grey version tags are made by the workflows and can't be moved.",
	readOnly: "You can view this repository but not release it.",
	tagWorkflows: "Tag workflows",
	noWorkflow: "No workflow, the tag is moved directly",
	lastRun: {
		success: "Last run succeeded",
		failure: "Last run failed",
		running: "Running now",
		other: "Last run",
		none: "Not run yet",
	},
	behind: (n: number) => (n === 1 ? "1 commit behind" : `${n} commits behind`),
	atNewest: "at the newest commit",
	notInView: "outside the shown range",
	pending: "Releasing…",
	viewRun: "View run",
	openOnGithub: "Open on GitHub",
	releaseHere: "Release here",
	alreadyHere: "already here",
	moveBack: (n: number) => (n === 1 ? "1 commit back" : `${n} commits back`),
	moveForward: (n: number) => (n === 1 ? "1 commit forward" : `${n} commits forward`),
	noReleaseTags:
		"This repository has no release tags yet. Type tag names in the Tags field, or create a tag like NEXT or PRODUCTION.",
	clickHint: "Click a commit to release it there.",

	releaseTitle: "Release",
	at: "at",
	workflow: "Workflow",
	runsOn: "Runs on",
	runsOnInput: (branch: string, input: string) => `branch ${branch}, with the input ${input} set to this commit`,
	runsOnBranch: (b: string) => `branch ${b}, which points at this commit`,
	runsOnTag: (t: string) => `tag ${t}, which points at this commit`,
	runsOnTemp: (b: string) => `a temporary branch ${b}, deleted when the run ends`,
	justMove: "No workflow, just move the tag",
	inputs: "Workflow inputs",
	newVersion: "New version",
	latestVersion: (v: string) => `latest is ${v}`,
	noBump: "no bump",
	backWarning: (tag: string, n: number) =>
		`This moves ${tag} ${n === 1 ? "1 commit" : `${n} commits`} back. Changes made after this commit will leave ${tag}.`,
	irreversible:
		"Releasing might not be reversible. The workflow can deploy, publish or create versions that moving the tag back won't undo.",
	workflowMoves: (tag: string) =>
		`The workflow builds, deploys and moves the tag itself. Until it finishes, ${tag} shows as pending on this commit.`,
	moveOnly: "The tag moves right away. Nothing is built or deployed.",
	cancel: "Cancel",
	runWorkflow: "Run workflow",
	moveTag: "Move tag",
	starting: "Starting…",
	workflowRefused:
		"GitHub refused to run the workflow here. The workflow file might not exist in this commit yet, or it doesn't allow manual runs.",
	matched: { config: "config file", picked: "your pick", name: "name", content: "content" },
	yes: "Yes",
	no: "No",

	workflowsTitle: "Tag workflows",
	tagCol: "Tag",
	workflowCol: "Workflow",
	inputsCol: "Inputs asked",
	matchedCol: "Matched by",
	automatic: "Automatic",
	none: "none",
	versionRow: "No workflow. Version tags are made by the release workflows, so they are shown but can't be dragged.",
	versionTag: "version tag",
	howTitle: "How a tag finds its workflow",
	rules: [
		["Config file", "in the repository, if there is one:"],
		["Your pick", "from the list above, remembered on this device"],
		[
			"Name:",
			"a workflow you can run by hand whose file name or title contains the tag, like release-next.yml for NEXT",
		],
		["Content:", "a workflow you can run by hand that pushes the tag, like tag: NEXT"],
	],
	inputsNote:
		"Inputs come from the workflow's workflow_dispatch section: choices become buttons, booleans a switch and the rest a text field.",
	configTitle: "Optional config file",
	configNote:
		"Only needed when names don't match, or to preset inputs and colours. One workflow can serve several tags.",
	refTitle: "Which commit the workflow builds",
	refText:
		"GitHub runs a workflow on a branch or a tag, not on a commit. The app picks, in order: a workflow input named ref, sha or commit (filled with the commit), a branch or tag already pointing at the commit, or a short-lived branch release-line/<commit> that is deleted when the run ends.",

	errors: {
		auth: "Your GitHub sign-in expired. Sign in again.",
		notfound: "Repository not found, or you don't have access to it.",
		offline: "You are offline.",
		rate: "GitHub's rate limit was reached. Try again in a while.",
		failed: "Something went wrong talking to GitHub.",
		workflow: "GitHub refused the request.",
	},
};

export type Texts = typeof en;

const cs: Texts = {
	appName: "Release Line",
	language: "Jazyk",
	menu: "Nabídka",
	theme: "Vzhled",
	themes: { auto: "Automaticky", light: "Světlý", dark: "Tmavý" },
	signOut: "Odhlásit",
	back: "Zpět",
	retry: "Zkusit znovu",
	loading: "Načítám…",

	tagline: "Větve a tagy jako mapa metra. Vydávejte přesunutím tagu.",
	signInGithub: "Přihlásit přes GitHub",
	enterCode: "Zadejte tento kód na GitHubu",
	openGithub: "Otevřít github.com/login/device",
	copyCode: "Kopírovat kód",
	copied: "Zkopírováno",
	waiting: "Čekám na vaše potvrzení…",
	or: "nebo",
	patLabel: "Osobní přístupový token",
	patUse: "Použít",
	patHint: "Fine-grained token s oprávněním Contents a Actions pro čtení i zápis.",
	createToken: "Vytvořit token",
	privacy: "Token zůstává jen v tomto zařízení a aplikace komunikuje přímo s GitHubem.",
	authErrors: {
		offline: "Jste offline.",
		denied: "Přihlášení bylo na GitHubu zrušeno.",
		expired: "Kód vypršel. Zkuste to znovu.",
		failed: "Přihlášení se nepovedlo. Zkuste to znovu.",
		badToken: "GitHub tento token nepřijal.",
	},

	chooseRepo: "Vyberte repozitář",
	searchRepos: "Hledat nebo zadat vlastník/název",
	open: "Otevřít",
	recent: "Naposledy otevřené",
	yourRepos: "Vaše repozitáře",
	noRepos: "Žádné repozitáře.",
	private: "Soukromý",

	tags: "Tagy",
	tagsPlaceholder: "všechny",
	branches: "Větve",
	branchModes: {
		range: (n: number, total: number) => `V rozsahu (${n} z ${total})`,
		default: "Jen hlavní",
		all: "Všechny",
	},
	refresh: "Obnovit",
	rangeFrom: (tag: string) => `Od ${tag}, nejstaršího tagu vydání, po nejnovější commit`,
	rangeRecent: "Poslední commity hlavní větve",
	commits: (n: number) => `${n} ${czech(n, "commit", "commity", "commitů")}`,
	hiddenCommits: (n: number) => `${n} ${czech(n, "skrytý commit", "skryté commity", "skrytých commitů")}`,
	showHidden: "Zobrazit",
	showSome: (n: number) => `Zobrazit dalších ${n}`,
	releaseTags: "Tagy vydání",
	dragHint:
		"Přetáhněte barevný tag na jiný commit, nebo na commit klepněte, a vydáte ho tam. Šedé tagy verzí vytvářejí workflow a přesouvat nejdou.",
	readOnly: "Tento repozitář můžete prohlížet, ale ne vydávat.",
	tagWorkflows: "Workflow tagů",
	noWorkflow: "Bez workflow, tag se jen přesune",
	lastRun: {
		success: "Poslední běh uspěl",
		failure: "Poslední běh selhal",
		running: "Právě běží",
		other: "Poslední běh",
		none: "Zatím neběželo",
	},
	behind: (n: number) => `o ${n} ${czech(n, "commit", "commity", "commitů")} pozadu`,
	atNewest: "na nejnovějším commitu",
	notInView: "mimo zobrazený rozsah",
	pending: "Vydávám…",
	viewRun: "Zobrazit běh",
	openOnGithub: "Otevřít na GitHubu",
	releaseHere: "Vydat sem",
	alreadyHere: "už je tady",
	moveBack: (n: number) => `o ${n} ${czech(n, "commit", "commity", "commitů")} zpět`,
	moveForward: (n: number) => `o ${n} ${czech(n, "commit", "commity", "commitů")} dopředu`,
	noReleaseTags:
		"Tento repozitář zatím nemá tagy vydání. Napište názvy tagů do pole Tagy, nebo vytvořte tag jako NEXT nebo PRODUCTION.",
	clickHint: "Klepněte na commit a vydejte ho.",

	releaseTitle: "Vydat",
	at: "na",
	workflow: "Workflow",
	runsOn: "Spustí se na",
	runsOnInput: (branch: string, input: string) => `větvi ${branch}, vstup ${input} dostane tento commit`,
	runsOnBranch: (b: string) => `větvi ${b}, která ukazuje na tento commit`,
	runsOnTag: (t: string) => `tagu ${t}, který ukazuje na tento commit`,
	runsOnTemp: (b: string) => `dočasné větvi ${b}, po doběhnutí se smaže`,
	justMove: "Bez workflow, jen přesunout tag",
	inputs: "Vstupy workflow",
	newVersion: "Nová verze",
	latestVersion: (v: string) => `poslední je ${v}`,
	noBump: "beze změny",
	backWarning: (tag: string, n: number) =>
		`${tag} se posune o ${n} ${czech(n, "commit", "commity", "commitů")} zpět. Změny po tomto commitu z ${tag} zmizí.`,
	irreversible:
		"Vydání nemusí jít vrátit. Workflow může nasadit, publikovat nebo vytvořit verze, které přesunutí tagu zpět nevrátí.",
	workflowMoves: (tag: string) =>
		`Workflow sestaví, nasadí a tag přesune samo. Než doběhne, ${tag} se u tohoto commitu ukazuje jako probíhající.`,
	moveOnly: "Tag se přesune hned. Nic se nesestaví ani nenasadí.",
	cancel: "Zrušit",
	runWorkflow: "Spustit workflow",
	moveTag: "Přesunout tag",
	starting: "Spouštím…",
	workflowRefused:
		"GitHub workflow tady spustit odmítl. Soubor workflow v tomto commitu možná ještě neexistuje, nebo nejde spustit ručně.",
	matched: { config: "konfigurace", picked: "váš výběr", name: "název", content: "obsah" },
	yes: "Ano",
	no: "Ne",

	workflowsTitle: "Workflow tagů",
	tagCol: "Tag",
	workflowCol: "Workflow",
	inputsCol: "Vstupy",
	matchedCol: "Podle",
	automatic: "Automaticky",
	none: "žádné",
	versionRow: "Bez workflow. Tagy verzí vytvářejí workflow vydání, proto se jen zobrazují a přetáhnout nejdou.",
	versionTag: "tag verze",
	howTitle: "Jak tag najde své workflow",
	rules: [
		["Konfigurační soubor", "v repozitáři, pokud existuje:"],
		["Váš výběr", "v tabulce nahoře, pamatuje si ho toto zařízení"],
		["Název:", "ručně spustitelné workflow, jehož soubor nebo název obsahuje tag, třeba release-next.yml pro NEXT"],
		["Obsah:", "ručně spustitelné workflow, které tag pushuje, třeba tag: NEXT"],
	],
	inputsNote:
		"Vstupy se berou ze sekce workflow_dispatch: z výběru jsou tlačítka, z ano/ne přepínač a ze zbytku textové pole.",
	configTitle: "Nepovinný konfigurační soubor",
	configNote:
		"Potřeba jen když názvy nesedí, nebo pro předvyplnění vstupů a barev. Jedno workflow může obsluhovat víc tagů.",
	refTitle: "Který commit workflow sestaví",
	refText:
		"GitHub spouští workflow na větvi nebo tagu, ne na commitu. Aplikace vybere v tomto pořadí: vstup workflow pojmenovaný ref, sha nebo commit (dostane commit), větev nebo tag, který už na commit ukazuje, nebo krátkodobou větev release-line/<commit>, která se po doběhnutí smaže.",

	errors: {
		auth: "Přihlášení ke GitHubu vypršelo. Přihlaste se znovu.",
		notfound: "Repozitář neexistuje, nebo k němu nemáte přístup.",
		offline: "Jste offline.",
		rate: "GitHub dočasně omezil počet požadavků. Zkuste to za chvíli.",
		failed: "Komunikace s GitHubem se nepovedla.",
		workflow: "GitHub požadavek odmítl.",
	},
};

const TEXTS: Record<Lang, Texts> = { en, cs };
const STORAGE_KEY = "release-line.lang";

function czech(n: number, one: string, few: string, many: string) {
	const rule = new Intl.PluralRules("cs").select(n);
	return rule === "one" ? one : rule === "few" ? few : many;
}

export function detectLang(languages: readonly string[]): Lang {
	for (const l of languages) {
		const base = l.toLowerCase().split("-")[0];
		if (base === "sk") return "cs";
		if ((LANGS as string[]).includes(base)) return base as Lang;
	}
	return "en";
}

function browserLanguages(): readonly string[] {
	if (typeof navigator === "undefined") return [];
	return navigator.languages?.length ? navigator.languages : [navigator.language];
}

function storedLang(): Lang | null {
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		return v && (LANGS as string[]).includes(v) ? (v as Lang) : null;
	} catch {
		return null;
	}
}

@Injectable({ providedIn: "root" })
export class I18n {
	private readonly chosen = signal<Lang | null>(storedLang());
	readonly lang = computed(() => this.chosen() ?? detectLang(browserLanguages()));
	readonly t = computed(() => TEXTS[this.lang()]);
	readonly locale = computed(() => {
		const lang = this.lang();
		const match = browserLanguages().find((l) => l.toLowerCase().split("-")[0] === lang);
		try {
			return match && Intl.DateTimeFormat.supportedLocalesOf(match).length ? match : lang;
		} catch {
			return lang;
		}
	});

	constructor() {
		this.apply();
	}

	setLang(lang: Lang) {
		this.chosen.set(lang);
		this.apply();
		try {
			localStorage.setItem(STORAGE_KEY, lang);
		} catch {}
	}

	private apply() {
		if (typeof document !== "undefined") document.documentElement.lang = this.lang();
	}
}
