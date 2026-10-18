import { Component, ElementRef, OnDestroy, afterNextRender, effect, inject, viewChild } from "@angular/core";
import * as L from "leaflet";
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
	private readonly markers = L.layerGroup();
	private readonly byPlace = new Map<Place, L.CircleMarker>();
	private fitted = false;

	constructor() {
		afterNextRender(() => {
			const map = L.map(this.host().nativeElement, { zoomControl: false }).setView(CZECHIA, 7);
			map.attributionControl.setPrefix(false);
			L.control.zoom({ position: "topright" }).addTo(map);
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
		this.map.flyTo([place.lat, place.lng], Math.max(this.map.getZoom(), 15), { duration: 0.6 });
		marker.openPopup();
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
			const marker = L.circleMarker([place.lat, place.lng], {
				radius: 8,
				color: "#ffffff",
				weight: 2,
				fillColor: list.color,
				fillOpacity: 1,
			})
				.bindTooltip(escape(place.name), { direction: "top", offset: [0, -8] })
				.bindPopup(() => this.popup(place, list), { maxWidth: 280 });
			marker.addTo(this.markers);
			this.byPlace.set(place, marker);
		}
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
