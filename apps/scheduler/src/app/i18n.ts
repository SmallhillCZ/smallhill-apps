import { Injectable, computed, signal } from "@angular/core";
import type { Vote } from "./api";
import { setDateLocale } from "./time";

export type Lang = "en" | "cs";
export const LANGS: Lang[] = ["en", "cs"];

const en = {
	footer: "No sign-up, no ads, no tracking. Polls are deleted 60 days after their last time slot.",
	language: "Language",
	menu: "Menu",
	theme: "Theme",
	themes: { auto: "Auto", light: "Light", dark: "Dark" },

	// Home
	heroTitle: "Find a time that works for everyone",
	heroText:
		"Suggest a few times, send one link, and see who can make it. Nobody needs an account, and there are no ads or trackers.",
	createPoll: "Create a poll",
	yourPolls: "Your polls",
	rememberedHere: "Remembered in this browser only.",
	untitled: "Untitled poll",
	youCreated: "you created it",
	youAnswered: "you answered",
	forget: "Forget",

	// Poll form
	newPoll: "New poll",
	editPoll: "Edit poll",
	titleLabel: "What are you planning?",
	titlePlaceholder: "Team lunch",
	whereLabel: "Where",
	wherePlaceholder: "Café on the corner, or a video call link",
	noteLabel: "Note for participants",
	optional: "(optional)",
	whenTitle: "When could it happen?",
	tzHint: (tz: string) => `Times are in your time zone (${tz}). Participants see them in theirs.`,
	editHint: "Answers to times you keep stay as they are. Removing a time also removes the answers for it.",
	slotCount: (n: number) => `${n} time slot${n === 1 ? "" : "s"}`,
	needTitle: "Give the poll a title.",
	needSlot: "Pick at least one day and time.",
	tooManySlots: "A poll can have at most 100 time slots.",
	badSlot: "Each time slot must end after it starts.",
	notOwner: "Only the person who created this poll can edit it, from the browser they created it in.",
	cancel: "Cancel",
	saving: "Saving…",
	saveChanges: "Save changes",
	submitPoll: "Create poll",

	// Slot picker
	pickDays: "Pick days",
	prevMonth: "Previous month",
	nextMonth: "Next month",
	pickDaysHint: "Tap the days that could work. You'll set the times next.",
	copyToAll: "Use these times for all days",
	remove: "Remove",
	startTime: "Start time",
	endTime: "End time",
	removeTime: "Remove time",
	addTime: "+ Add time",

	// Poll page
	notFoundTitle: "Poll not found",
	notFoundText: "It may have been deleted by its creator, or removed after it ended.",
	createNewPoll: "Create a new poll",
	readyTitle: "Your poll is ready",
	readyText: "Send this link to everyone you want to ask. Nobody needs an account.",
	shareLink: "Share link",
	copy: "Copy",
	copied: "Copied",
	share: "Share…",
	shareText: "Which times work for you?",
	copyPrompt: "Copy this link:",
	shownInYourTz: (tz: string) => `Times are shown in your time zone (${tz}).`,
	organiserTz: (tz: string) => `The organiser is in ${tz}.`,
	decided: "It's decided",
	addToCalendar: "Add to calendar",
	closedNotice: "This poll is closed. Answers can no longer be changed.",
	whichTimes: "Which times work for you?",
	times: "Times",
	markAll: "Mark all:",
	chosen: "Chosen",
	bestSoFar: "Best so far",
	yourAnswerFor: (slot: string) => `Your answer for ${slot}`,
	choose: "Choose",
	chooseTitle: "Pick this as the final time",
	yourName: "Your name",
	sendAnswer: "Send my answer",
	blankIsNo: "Slots you leave blank count as “No”. Your answer is visible to everyone with the link.",
	answeredAs: "You answered as",
	changeAnswer: "Change my answer",
	answeredCount: (n: number) => `${n} ${n === 1 ? "person has" : "people have"} answered`,
	showAll: "Show all answers",
	hideAll: "Hide all answers",
	you: "(you)",
	noAnswer: "No answer",
	removeName: (name: string) => `Remove ${name}`,
	managePoll: "Manage poll",
	manageHint: "Only you see this, because you created the poll in this browser.",
	reopen: "Reopen",
	closePoll: "Close poll",
	undoChosen: "Undo chosen time",
	delete: "Delete",
	adminLink: "Admin link",
	adminLinkHint: "(keep it private; it lets you manage the poll on another device)",
	loading: "Loading…",
	invalidAdminLink: "That admin link is not valid for this poll.",
	confirmRemoveMine: "Remove your answer?",
	confirmRemoveOther: (name: string) => `Remove the answer from ${name}?`,
	confirmDelete: "Delete this poll and all answers? This cannot be undone.",
	votes: { yes: "Yes", maybe: "If need be", no: "No" } as Record<Vote, string>,

	// Errors
	offline: "Cannot reach the server. Check your connection and try again.",
	genericError: "Something went wrong. Please try again.",
	/** Server messages are in English; other languages translate the ones a person can run into. */
	serverErrors: {} as Record<string, string>,
};

export type Texts = typeof en;

const cs: Texts = {
	footer: "Bez registrace, bez reklam, bez sledování. Ankety se mažou 60 dní po posledním termínu.",
	language: "Jazyk",
	menu: "Nabídka",
	theme: "Vzhled",
	themes: { auto: "Automatický", light: "Světlý", dark: "Tmavý" },

	heroTitle: "Najděte termín, který vyhovuje všem",
	heroText:
		"Navrhněte pár termínů, pošlete jeden odkaz a uvidíte, kdo může. Nikdo nepotřebuje účet a nejsou tu žádné reklamy ani sledování.",
	createPoll: "Vytvořit anketu",
	yourPolls: "Vaše ankety",
	rememberedHere: "Pamatuje si je jen tento prohlížeč.",
	untitled: "Anketa bez názvu",
	youCreated: "vytvořili jste ji",
	youAnswered: "odpověděli jste",
	forget: "Zapomenout",

	newPoll: "Nová anketa",
	editPoll: "Upravit anketu",
	titleLabel: "Co plánujete?",
	titlePlaceholder: "Týmový oběd",
	whereLabel: "Kde",
	wherePlaceholder: "Kavárna na rohu nebo odkaz na videohovor",
	noteLabel: "Poznámka pro účastníky",
	optional: "(nepovinné)",
	whenTitle: "Kdy by to mohlo být?",
	tzHint: (tz: string) => `Časy jsou ve vašem časovém pásmu (${tz}). Účastníci je uvidí ve svém.`,
	editHint: "Odpovědi u ponechaných termínů zůstanou. Odebráním termínu se smažou i odpovědi na něj.",
	slotCount: (n: number) => `${n} ${czech(n, "termín", "termíny", "termínů")}`,
	needTitle: "Zadejte název ankety.",
	needSlot: "Vyberte aspoň jeden den a čas.",
	tooManySlots: "Anketa může mít nejvýše 100 termínů.",
	badSlot: "Každý termín musí skončit až po svém začátku.",
	notOwner: "Anketu může upravit jen ten, kdo ji vytvořil, a to v prohlížeči, ve kterém ji vytvořil.",
	cancel: "Zrušit",
	saving: "Ukládám…",
	saveChanges: "Uložit změny",
	submitPoll: "Vytvořit anketu",

	pickDays: "Vyberte dny",
	prevMonth: "Předchozí měsíc",
	nextMonth: "Další měsíc",
	pickDaysHint: "Klepněte na dny, které by mohly vyhovovat. Časy nastavíte potom.",
	copyToAll: "Použít tyto časy pro všechny dny",
	remove: "Odebrat",
	startTime: "Začátek",
	endTime: "Konec",
	removeTime: "Odebrat čas",
	addTime: "+ Přidat čas",

	notFoundTitle: "Anketa nenalezena",
	notFoundText: "Autor ji možná smazal, nebo byla po skončení odstraněna.",
	createNewPoll: "Vytvořit novou anketu",
	readyTitle: "Anketa je připravená",
	readyText: "Pošlete tento odkaz všem, koho se chcete zeptat. Nikdo nepotřebuje účet.",
	shareLink: "Odkaz pro sdílení",
	copy: "Kopírovat",
	copied: "Zkopírováno",
	share: "Sdílet…",
	shareText: "Které termíny vám vyhovují?",
	copyPrompt: "Zkopírujte tento odkaz:",
	shownInYourTz: (tz: string) => `Časy jsou zobrazené ve vašem časovém pásmu (${tz}).`,
	organiserTz: (tz: string) => `Organizátor je v pásmu ${tz}.`,
	decided: "Rozhodnuto",
	addToCalendar: "Přidat do kalendáře",
	closedNotice: "Anketa je uzavřená. Odpovědi už nejde měnit.",
	whichTimes: "Které termíny vám vyhovují?",
	times: "Termíny",
	markAll: "Označit vše:",
	chosen: "Vybráno",
	bestSoFar: "Zatím nejlepší",
	yourAnswerFor: (slot: string) => `Vaše odpověď pro ${slot}`,
	choose: "Vybrat",
	chooseTitle: "Vybrat jako konečný termín",
	yourName: "Vaše jméno",
	sendAnswer: "Odeslat odpověď",
	blankIsNo: "Nevyplněné termíny se počítají jako „Ne“. Vaši odpověď uvidí každý, kdo má odkaz.",
	answeredAs: "Odpověděli jste jako",
	changeAnswer: "Změnit odpověď",
	answeredCount: (n: number) => `${n} ${czech(n, "člověk odpověděl", "lidé odpověděli", "lidí odpovědělo")}`,
	showAll: "Zobrazit všechny odpovědi",
	hideAll: "Skrýt všechny odpovědi",
	you: "(vy)",
	noAnswer: "Bez odpovědi",
	removeName: (name: string) => `Odebrat ${name}`,
	managePoll: "Správa ankety",
	manageHint: "Vidíte to jen vy, protože jste anketu vytvořili v tomto prohlížeči.",
	reopen: "Znovu otevřít",
	closePoll: "Uzavřít anketu",
	undoChosen: "Zrušit výběr termínu",
	delete: "Smazat",
	adminLink: "Odkaz pro správu",
	adminLinkHint: "(nesdílejte ho; umožní vám spravovat anketu na jiném zařízení)",
	loading: "Načítám…",
	invalidAdminLink: "Tento odkaz pro správu k anketě nepatří.",
	confirmRemoveMine: "Odebrat vaši odpověď?",
	confirmRemoveOther: (name: string) => `Odebrat odpověď od ${name}?`,
	confirmDelete: "Smazat anketu i všechny odpovědi? Nejde to vrátit zpět.",
	votes: { yes: "Ano", maybe: "Když bude nutné", no: "Ne" },

	offline: "Nelze se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.",
	genericError: "Něco se pokazilo. Zkuste to prosím znovu.",
	serverErrors: {
		"Poll not found.": "Anketa nenalezena.",
		"This poll is closed.": "Anketa je uzavřená.",
		"This poll has too many responses.": "Anketa už má příliš mnoho odpovědí.",
		"Please enter your name.": "Zadejte své jméno.",
		"Response not found.": "Odpověď nenalezena.",
		"You can only edit your own response.": "Upravit můžete jen svou odpověď.",
		"Not allowed.": "Na to nemáte oprávnění.",
		"Invalid admin key.": "Neplatný klíč pro správu.",
		"Each slot must end after it starts.": "Každý termín musí skončit až po svém začátku.",
		"Unknown slot id.": "Neznámý termín.",
	},
};

const TEXTS: Record<Lang, Texts> = { en, cs };
const STORAGE_KEY = "scheduler.lang";

/** Czech has three plural forms: 1, 2–4 and the rest. */
function czech(n: number, one: string, few: string, many: string) {
	const rule = new Intl.PluralRules("cs").select(n);
	return rule === "one" ? one : rule === "few" ? few : many;
}

/** The first of the browser's preferred languages that we support, else English. */
export function detectLang(languages: readonly string[]): Lang {
	for (const l of languages) {
		const base = l.toLowerCase().split("-")[0];
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
	/** Set when the person picked a language; otherwise we follow the browser. */
	private readonly chosen = signal<Lang | null>(storedLang());
	readonly lang = computed(() => this.chosen() ?? detectLang(browserLanguages()));
	readonly t = computed(() => TEXTS[this.lang()]);

	/**
	 * Locale for dates and times. Keeps the browser's regional variant (en-GB vs en-US)
	 * when it matches the language, so only the language changes, not the date style.
	 */
	readonly locale = computed(() => {
		const lang = this.lang();
		return browserLanguages().find((l) => l.toLowerCase().split("-")[0] === lang) ?? lang;
	});

	constructor() {
		this.apply();
	}

	setLang(lang: Lang) {
		this.chosen.set(lang);
		this.apply();
		try {
			localStorage.setItem(STORAGE_KEY, lang);
		} catch {
			// Not remembered, but still switched for this visit.
		}
	}

	private apply() {
		setDateLocale(this.locale());
		if (typeof document !== "undefined") document.documentElement.lang = this.lang();
	}
}
