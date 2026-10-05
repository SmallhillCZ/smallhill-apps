import { Text } from "./i18n";

export interface AppInfo {
	id: string;
	name: Text;
	tagline: Text;
	description: Text;
	color: string;
	icon: string;
	screenshots: string[];
	url?: string;
	listed: boolean;
}

export const APPS: AppInfo[] = [
	{
		id: "tuner",
		name: { en: "Tuner", cs: "Ladička" },
		tagline: { en: "Guitar, bass and violin tuner", cs: "Ladička pro kytaru, baskytaru a housle" },
		description: {
			en: "Tune your guitar, bass or violin with the microphone of your phone or computer. Pick a string or let the tuner detect it, switch to chromatic mode for any instrument and adjust the A4 reference. Sound is analyzed on your device only and nothing is recorded. Works offline.",
			cs: "Nalaďte kytaru, baskytaru nebo housle pomocí mikrofonu v telefonu či počítači. Vyberte strunu, nebo ji nechte rozpoznat automaticky, pro jiné nástroje přepněte na chromatický režim a upravte ladění A4. Zvuk se zpracovává jen ve vašem zařízení a nic se nenahrává. Funguje i offline.",
		},
		color: "#e8892b",
		icon: "apps/tuner/icon.svg",
		screenshots: ["apps/tuner/screenshot-1.webp", "apps/tuner/screenshot-2.webp"],
		url: "/tuner/",
		listed: true,
	},
	{
		id: "scheduler",
		name: { en: "Scheduler", cs: "Plánovač" },
		tagline: { en: "Find a time that suits everyone", cs: "Najděte termín, který všem vyhovuje" },
		description: {
			en: "Propose a few times, share the link and let everyone answer Yes, If need be or No. The best time is highlighted as answers come in. No sign-up for you or your friends, and polls are deleted 60 days after their last time slot.",
			cs: "Navrhněte několik termínů, pošlete odkaz a nechte ostatní odpovědět Ano, Kdyžtak nebo Ne. Nejlepší termín se zvýrazní, jak přibývají odpovědi. Žádná registrace pro vás ani pro ostatní a ankety se mažou 60 dní po posledním termínu.",
		},
		color: "#3b5bdb",
		icon: "apps/scheduler/icon.svg",
		screenshots: ["apps/scheduler/screenshot-1.webp", "apps/scheduler/screenshot-2.webp"],
		url: "/scheduler/",
		listed: true,
	},
	{
		id: "csveditor",
		name: { en: "CSV Editor", cs: "CSV Editor" },
		tagline: { en: "Edit CSV files in your browser", cs: "Upravujte CSV soubory v prohlížeči" },
		description: {
			en: "A spreadsheet-like editor for CSV files that runs entirely in your browser. Open and save CSV, sort and filter columns, use the formula bar, transform numbers, dates and markup, undo and redo, all in light or dark mode. Your files never leave your device.",
			cs: "Editor CSV souborů ve stylu tabulkového procesoru, který běží celý v prohlížeči. Otevírejte a ukládejte CSV, řaďte a filtrujte sloupce, používejte řádek vzorců, převádějte čísla, data a značkování, vracejte změny zpět, ve světlém i tmavém režimu. Vaše soubory nikdy neopustí zařízení.",
		},
		color: "#1e9e5a",
		icon: "apps/csveditor/icon.svg",
		screenshots: ["apps/csveditor/screenshot-1.webp"],
		listed: true,
	},
	{
		id: "jachtarskaknizka",
		name: { en: "Sailing Logbook", cs: "Jachtařská knížka" },
		tagline: { en: "Your sailing logbook online", cs: "Online jachtařská knížka" },
		description: {
			en: "Keep your sailing logbook online, with maps, photos and records of every voyage. The logbook is stored as files on your own disk, not on a server, and you can export it to PDF or Excel.",
			cs: "Veďte svou jachtařskou knížku online, s mapami, fotkami a záznamy všech plaveb. Knížka se ukládá jako soubory na váš vlastní disk, ne na server, a můžete ji exportovat do PDF nebo Excelu.",
		},
		color: "#0b8a8f",
		icon: "apps/jachtarskaknizka/icon.svg",
		screenshots: [],
		listed: true,
	},
];
