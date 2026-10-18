import { Component, ElementRef, OnDestroy, afterNextRender, effect, inject, viewChild } from "@angular/core";
import * as L from "leaflet";
import "leaflet.markercluster";
import { I18n } from "./i18n";
import { Lists, type Place, type SavedList } from "./lists";
import { MAPY_API_KEY } from "./mapy";

const CZECHIA: L.LatLngTuple = [49.8, 15.5];

const escape = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function googleLink(place: Place) {
	if (place.cid) return `https://maps.google.com/?cid=${place.cid}`;
	return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
}

export function mapyLink(place: Place) {
	return `https://mapy.com/fnc/v1/showmap?mapset=basic&center=${place.lng},${place.lat}&zoom=17&marker=true`;
}

@Component({
	selector: "app-map",
	template: `<div #map class="map"></div>`,
	styles: `
		:host,
		.map {
			display: block;
			width: 100%;
			height: 100%;
		}
		.map {
			background: var(--bg);
		}
	`,
})
export class MapView implements OnDestroy {
	private readonly i18n = inject(I18n);
	private readonly store = inject(Lists);
	private readonly host = viewChild.required<ElementRef<HTMLElement>>("map");
	private map: L.Map | null = null;
	private tiles: L.TileLayer | null = null;
	private readonly markers = clusterGroup();
	private readonly byPlace = new Map<Place, L.Marker>();
	private fitted = false;
	private readonly locator = new Locator({ position: "topright" });
	private here: L.LayerGroup | null = null;
	private slider: ZoomSlider | null = null;

	constructor() {
		afterNextRender(() => {
			const map = L.map(this.host().nativeElement, {
				zoomControl: false,
				maxZoom: 19,
				zoomSnap: 0,
				zoomDelta: 1,
				wheelPxPerZoomLevel: 120,
			}).setView(CZECHIA, 7);
			map.attributionControl.setPrefix(false);
			this.slider = new ZoomSlider(map);
			this.slider.setTitle(this.i18n.t().zoom);
			this.locator.onLocate = () => this.locate();
			this.locator.addTo(map);
			this.locator.setTitle(this.i18n.t().locate);
			map.on("locationfound", (e) => this.showHere(e));
			map.on("locationerror", () => {
				this.locator.setState("error", this.i18n.t().locateFailed);
			});
			this.markers.addTo(map);
			this.map = map;
			new MapyLogo({ position: "bottomright" }).addTo(map);
			this.renderTiles();
			this.renderMarkers();
		});
		effect(() => {
			this.store.mapset();
			this.i18n.lang();
			this.renderTiles();
		});
		effect(() => {
			this.locator.setTitle(this.i18n.t().locate);
			this.slider?.setTitle(this.i18n.t().zoom);
		});
		effect(() => {
			this.store.visiblePlaces();
			this.i18n.t();
			this.renderMarkers();
		});
	}

	ngOnDestroy() {
		this.map?.remove();
	}

	focus(place: Place) {
		const marker = this.byPlace.get(place);
		if (!this.map || !marker) return;
		this.markers.zoomToShowLayer(marker, () => marker.openPopup());
	}

	fitAll() {
		const places = this.store.visiblePlaces();
		if (!this.map || !places.length) return;
		const bounds = L.latLngBounds(places.map(({ place }) => [place.lat, place.lng] as L.LatLngTuple));
		const container = this.map.getContainer().getBoundingClientRect();
		const panel = document.querySelector("aside.panel")?.getBoundingClientRect();
		const side = panel && panel.width < container.width * 0.6 ? panel.right - container.left : 0;
		const bottom = panel && !side ? container.bottom - panel.top : 0;
		this.map.fitBounds(bounds, {
			paddingTopLeft: [40 + side, 40],
			paddingBottomRight: [40, 40 + bottom],
			maxZoom: 15,
		});
	}

	locate() {
		if (!this.map) return;
		this.locator.setState("busy", this.i18n.t().locate);
		this.map.locate({ enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
	}

	private showHere(e: L.LocationEvent) {
		const map = this.map;
		if (!map) return;
		this.locator.setState("on", this.i18n.t().locate);
		this.here?.remove();
		this.here = L.layerGroup([
			L.circle(e.latlng, { radius: e.accuracy, className: "here-accuracy", interactive: false }),
			L.marker(e.latlng, {
				icon: L.divIcon({ className: "here", html: "<span></span>", iconSize: [22, 22] }),
				interactive: false,
				keyboard: false,
				zIndexOffset: 1000,
			}),
		]).addTo(map);
		map.flyTo(e.latlng, Math.max(map.getZoom(), 15), { duration: 0.8 });
	}

	invalidate() {
		this.map?.invalidateSize();
	}

	private renderTiles() {
		const map = this.map;
		if (!map) return;
		this.tiles?.remove();
		const lang = this.i18n.lang();
		const mapset = this.store.mapset();
		const retina = (mapset === "basic" || mapset === "outdoor") && L.Browser.retina;
		this.tiles = L.tileLayer(
			`https://api.mapy.com/v1/maptiles/${mapset}/${retina ? "256@2x" : "256"}/{z}/{x}/{y}?lang=${lang}&apikey=${MAPY_API_KEY}`,
			{
				minZoom: 0,
				maxZoom: 19,
				attribution: `<a href="https://api.mapy.com/copyright" target="_blank" rel="noopener">&copy; Seznam.cz a.s. ${lang === "cs" ? "a další" : "and others"}</a>`,
			},
		);
		this.tiles.addTo(map);
	}

	private renderMarkers() {
		if (!this.map) return;
		this.markers.clearLayers();
		this.byPlace.clear();
		const places = this.store.visiblePlaces();
		for (const { place, list } of places) {
			const marker = L.marker([place.lat, place.lng], {
				icon: L.divIcon({
					className: "pin",
					html: `<span style="background:${list.color}"></span>`,
					iconSize: [20, 20],
				}),
				title: place.name,
				color: list.color,
			} as L.MarkerOptions)
				.bindTooltip(escape(place.name), { direction: "top", offset: [0, -10] })
				.bindPopup(() => this.popup(place, list), { maxWidth: 280 });
			this.byPlace.set(place, marker);
		}
		this.markers.addLayers([...this.byPlace.values()]);
		if (!this.fitted && places.length) {
			this.fitted = true;
			this.fitAll();
		}
	}

	private popup(place: Place, list: SavedList) {
		const t = this.i18n.t();
		const title = list.data?.title || t.untitled;
		return `<div class="popup">
			<div class="popup-list"><span class="dot" style="background:${list.color}"></span>${escape(title)}</div>
			<strong class="popup-name">${escape(place.name)}</strong>
			${place.note ? `<p class="popup-note">${escape(place.note)}</p>` : ""}
			${place.address ? `<p class="popup-address">${escape(place.address)}</p>` : ""}
			<div class="popup-links">
				<a href="${googleLink(place)}" target="_blank" rel="noopener">${t.openGoogle}</a>
				<a href="${mapyLink(place)}" target="_blank" rel="noopener">${t.openMapy}</a>
			</div>
		</div>`;
	}
}

function clusterGroup() {
	return (globalThis as unknown as { L: typeof L }).L.markerClusterGroup({
		maxClusterRadius: 80,
		disableClusteringAtZoom: 11,
		showCoverageOnHover: false,
		spiderfyOnMaxZoom: true,
		iconCreateFunction: (cluster) => {
			const count = cluster.getChildCount();
			const colors = new Set(
				cluster.getAllChildMarkers().map((m) => (m.options as L.MarkerOptions & { color?: string }).color),
			);
			const color = colors.size === 1 ? [...colors][0]! : "#343a40";
			const size = count < 10 ? 34 : count < 50 ? 40 : 48;
			return L.divIcon({
				className: "cluster",
				html: `<span style="background:${color}">${count}</span>`,
				iconSize: [size, size],
			});
		},
	});
}

class ZoomSlider {
	private readonly handle: HTMLElement;

	constructor(private readonly map: L.Map) {
		const handle = L.DomUtil.create("div", "zoom-handle", map.getContainer());
		handle.innerHTML = `<svg viewBox="0 0 16 28" aria-hidden="true"><path d="M3 10l5-6 5 6zM3 18l5 6 5-6z" /></svg>`;
		handle.setAttribute("role", "slider");
		handle.tabIndex = 0;
		L.DomEvent.disableClickPropagation(handle);
		L.DomEvent.disableScrollPropagation(handle);
		this.handle = handle;
		let startY = 0;
		let startZoom = 0;
		handle.addEventListener("pointerdown", (e) => {
			handle.setPointerCapture(e.pointerId);
			startY = e.clientY;
			startZoom = map.getZoom();
			handle.classList.add("dragging");
		});
		handle.addEventListener("pointermove", (e) => {
			if (!handle.hasPointerCapture(e.pointerId)) return;
			const dy = startY - e.clientY;
			handle.style.transform = `translateY(${-Math.max(-160, Math.min(160, dy))}px)`;
			const zoom = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), startZoom + dy / 50));
			map.setZoom(zoom, { animate: false });
		});
		const end = (e: PointerEvent) => {
			if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
			handle.classList.remove("dragging");
			handle.style.transform = "";
		};
		handle.addEventListener("pointerup", end);
		handle.addEventListener("pointercancel", end);
		handle.addEventListener("keydown", (e) => {
			if (e.key === "ArrowUp" || e.key === "+") map.zoomIn(0.5);
			else if (e.key === "ArrowDown" || e.key === "-") map.zoomOut(0.5);
		});
		map.on("zoomend", () => this.sync());
		this.sync();
	}

	setTitle(title: string) {
		this.handle.title = title;
		this.handle.setAttribute("aria-label", title);
	}

	private sync() {
		this.handle.setAttribute("aria-valuenow", this.map.getZoom().toFixed(1));
		this.handle.setAttribute("aria-valuemin", String(this.map.getMinZoom()));
		this.handle.setAttribute("aria-valuemax", String(this.map.getMaxZoom()));
	}
}

class Locator extends L.Control {
	onLocate: () => void = () => {};
	private button: HTMLButtonElement | null = null;
	private title = "";

	override onAdd() {
		const bar = L.DomUtil.create("div", "leaflet-bar locator");
		const button = L.DomUtil.create("button", "", bar) as HTMLButtonElement;
		button.type = "button";
		button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg>`;
		L.DomEvent.disableClickPropagation(bar);
		L.DomEvent.on(button, "click", () => this.onLocate());
		this.button = button;
		this.setTitle(this.title);
		return bar;
	}

	setTitle(title: string) {
		this.title = title;
		if (!this.button) return;
		this.button.title = title;
		this.button.setAttribute("aria-label", title);
	}

	setState(state: "busy" | "on" | "error", title: string) {
		if (!this.button) return;
		this.button.dataset["state"] = state;
		this.button.title = title;
		this.button.setAttribute("aria-label", title);
	}
}

class MapyLogo extends L.Control {
	override onAdd() {
		const a = L.DomUtil.create("a", "mapy-logo") as HTMLAnchorElement;
		a.href = "https://mapy.com/";
		a.target = "_blank";
		a.rel = "noopener";
		a.innerHTML = `<img src="https://api.mapy.com/img/api/logo.svg" alt="Mapy.com" height="30" />`;
		L.DomEvent.disableClickPropagation(a);
		return a;
	}
}
