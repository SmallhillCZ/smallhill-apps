import Toybox.Attention;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.StringUtil;
import Toybox.WatchUi;

class PagesView extends WatchUi.View {
    var pages as Array<Dictionary> = [];
    var index as Number = 0;

    function initialize() {
        View.initialize();
        build();
    }

    function onShow() as Void {
        Store.listener = method(:changed);
        if (Attention has :backlight) {
            try {
                Attention.backlight(1.0);
            } catch (e) {
            }
        }
    }

    function onHide() as Void {
        Store.listener = null;
    }

    function changed() as Void {
        build();
        WatchUi.requestUpdate();
    }

    function build() as Void {
        var list = [] as Array<Dictionary>;
        if (Store.session() == null) {
            list.add({"action" => :signIn});
        } else {
            var tickets = Store.tickets();
            for (var i = 0; i < tickets.size(); i++) {
                var t = tickets[i] as Dictionary;
                var codes = t["codes"] as Array?;
                if (codes == null || codes.size() == 0) {
                    list.add({"ticket" => t});
                } else {
                    for (var j = 0; j < codes.size(); j++) {
                        list.add({"ticket" => t, "code" => codes[j], "part" => (codes.size() > 1 ? (j + 1) + "/" + codes.size() : null)});
                    }
                }
            }
            if (tickets.size() == 0) {
                list.add({"empty" => true});
            }
            list.add({"action" => :refresh});
            list.add({"action" => :signOut});
        }
        pages = list;
        if (index >= pages.size()) {
            index = pages.size() - 1;
        }
    }

    function page() as Dictionary {
        return pages[index];
    }

    function onUpdate(dc as Dc) as Void {
        var p = page();
        if (p["code"] != null) {
            drawQr(dc, p);
        } else if (p["ticket"] != null) {
            drawText(dc, Graphics.COLOR_WHITE, (p["ticket"] as Dictionary)["name"] as String, WatchUi.loadResource(Rez.Strings.NoCode) as String);
        } else if (p["empty"] != null) {
            drawText(dc, Graphics.COLOR_WHITE, WatchUi.loadResource(Rez.Strings.NoTickets) as String, status());
        } else if (p["action"] == :signIn) {
            drawText(dc, 0xe64980, WatchUi.loadResource(Rez.Strings.SignIn) as String, WatchUi.loadResource(Rez.Strings.SignInHint) as String);
        } else if (p["action"] == :refresh) {
            drawText(dc, 0xe64980, WatchUi.loadResource(Rez.Strings.Refresh) as String, status());
        } else {
            drawText(dc, 0xe64980, WatchUi.loadResource(Rez.Strings.SignOut) as String, "");
        }
        drawDots(dc, p["code"] != null);
    }

    function drawText(dc as Dc, color as Number, title as String, detail as String) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.42, Graphics.FONT_MEDIUM, Graphics.fitTextToArea(title, Graphics.FONT_MEDIUM, w * 0.8, h * 0.3, true), center);
        if (detail.length() > 0) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h * 0.66, Graphics.FONT_XTINY, Graphics.fitTextToArea(detail, Graphics.FONT_XTINY, w * 0.7, h * 0.16, true), center);
        }
    }

    function drawQr(dc as Dc, p as Dictionary) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_WHITE);
        dc.clear();
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_TRANSPARENT);
        var ticket = p["ticket"] as Dictionary;
        var code = p["code"] as Dictionary;
        if (code["qr"] == null) {
            var text = (ticket["name"] as String) + "\n" + (code["code"] == null ? "" : code["code"]);
            dc.drawText(w / 2, h / 2, Graphics.FONT_SMALL, Graphics.fitTextToArea(text, Graphics.FONT_SMALL, w * 0.75, h * 0.6, true), center);
            return;
        }
        var size = code["size"] as Number;
        var bits = StringUtil.convertEncodedString(code["qr"] as String, {
            :fromRepresentation => StringUtil.REPRESENTATION_STRING_BASE64,
            :toRepresentation => StringUtil.REPRESENTATION_BYTE_ARRAY
        }) as ByteArray;
        var px = (w * 0.6 / size).toNumber();
        var side = px * size;
        var x0 = (w - side) / 2;
        var y0 = (h - side) / 2;
        for (var r = 0; r < size; r++) {
            var c = 0;
            while (c < size) {
                var i = r * size + c;
                if ((bits[i >> 3] & (0x80 >> (i & 7))) != 0) {
                    var start = c;
                    while (c < size) {
                        var k = r * size + c;
                        if ((bits[k >> 3] & (0x80 >> (k & 7))) == 0) {
                            break;
                        }
                        c++;
                    }
                    dc.fillRectangle(x0 + start * px, y0 + r * px, (c - start) * px, px);
                } else {
                    c++;
                }
            }
        }
        var top = Graphics.fitTextToArea(ticket["name"] as String, Graphics.FONT_XTINY, w * 0.6, y0 * 0.7, true);
        dc.drawText(w / 2, y0 * 0.6, Graphics.FONT_XTINY, top, center);
        var bottom = Format.start(ticket);
        if (p["part"] != null) {
            bottom = p["part"] + "  " + bottom;
        }
        bottom = Graphics.fitTextToArea(bottom, Graphics.FONT_XTINY, w * 0.6, (h - y0 - side) * 0.7, true);
        dc.drawText(w / 2, y0 + side + (h - y0 - side) * 0.4, Graphics.FONT_XTINY, bottom, center);
    }

    function drawDots(dc as Dc, light as Boolean) as Void {
        var n = pages.size();
        if (n < 2) {
            return;
        }
        var h = dc.getHeight();
        var gap = 10;
        var y0 = h / 2 - (n - 1) * gap / 2;
        for (var i = 0; i < n; i++) {
            var on = i == index;
            dc.setColor(on ? 0xe64980 : (light ? Graphics.COLOR_LT_GRAY : Graphics.COLOR_DK_GRAY), Graphics.COLOR_TRANSPARENT);
            dc.fillCircle(12, y0 + i * gap, on ? 4 : 3);
        }
    }

    function status() as String {
        if (Store.syncing) {
            return WatchUi.loadResource(Rez.Strings.Syncing) as String;
        }
        if (Store.failed) {
            return WatchUi.loadResource(Rez.Strings.Offline) as String;
        }
        var saved = Store.savedAt();
        return saved == null ? "" : WatchUi.loadResource(Rez.Strings.Updated) + " " + Format.time(saved);
    }
}

class PagesDelegate extends WatchUi.BehaviorDelegate {
    var view as PagesView;

    function initialize(v as PagesView) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onSelect() as Boolean {
        var action = view.page()["action"];
        if (action == :signIn) {
            Store.signIn();
        } else if (action == :refresh) {
            Store.sync();
        } else if (action == :signOut) {
            view.index = 0;
            Store.signOut();
        }
        return true;
    }

    function onTap(event as WatchUi.ClickEvent) as Boolean {
        return onSelect();
    }

    function onNextPage() as Boolean {
        if (view.index + 1 < view.pages.size()) {
            view.index += 1;
            WatchUi.requestUpdate();
        }
        return true;
    }

    function onPreviousPage() as Boolean {
        if (view.index > 0) {
            view.index -= 1;
            WatchUi.requestUpdate();
        }
        return true;
    }
}
