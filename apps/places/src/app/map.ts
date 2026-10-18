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

	constructor() {
		afterNextRender(() => {
			const map = L.map(this.host().nativeElement, { zoomControl: false, maxZoom: 19 }).setView(CZECHIA, 7);
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
		maxClusterRadius: (zoom) => (zoom <= 11 ? 80 : zoom <= 14 ? 50 : 30),
		disableClusteringAtZoom: 17,
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
