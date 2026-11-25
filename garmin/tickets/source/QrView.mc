import Toybox.Attention;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.StringUtil;
import Toybox.WatchUi;

class QrView extends WatchUi.View {
    var codes as Array;
    var index as Number = 0;

    function initialize(ticket as Dictionary) {
        View.initialize();
        var c = ticket["codes"];
        codes = c == null ? [] : c as Array;
    }

    function onShow() as Void {
        if (Attention has :backlight) {
            try {
                Attention.backlight(1.0);
            } catch (e) {
            }
        }
    }

    function onUpdate(dc as Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_WHITE);
        dc.clear();
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_TRANSPARENT);
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        var code = codes.size() > index ? codes[index] as Dictionary : null;
        if (code == null || code["qr"] == null) {
            var text = WatchUi.loadResource(Rez.Strings.NoCode) as String;
            if (code != null && code["code"] != null) {
                text += "\n" + code["code"];
            }
            dc.drawText(w / 2, h / 2, Graphics.FONT_SMALL, Graphics.fitTextToArea(text, Graphics.FONT_SMALL, w * 0.75, h * 0.6, true), center);
            return;
        }
        var size = code["size"] as Number;
        var bits = StringUtil.convertEncodedString(code["qr"], {
            :fromRepresentation => StringUtil.REPRESENTATION_STRING_BASE64,
            :toRepresentation => StringUtil.REPRESENTATION_BYTE_ARRAY
        }) as ByteArray;
        var px = (w * 0.68 / size).toNumber();
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
                        var j = r * size + c;
                        if ((bits[j >> 3] & (0x80 >> (j & 7))) == 0) {
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
        var label = code["code"] as String?;
        if (codes.size() > 1) {
            label = (index + 1) + "/" + codes.size() + (label == null ? "" : "  " + label);
        }
        if (label != null) {
            dc.drawText(w / 2, y0 + side + (h - y0 - side) / 3, Graphics.FONT_XTINY, label, center);
        }
    }
}

class QrDelegate extends WatchUi.BehaviorDelegate {
    var view as QrView;

    function initialize(v as QrView) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onTap(event as WatchUi.ClickEvent) as Boolean {
        return onSelect();
    }

    function onNextPage() as Boolean {
        if (view.index + 1 < view.codes.size()) {
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

    function onSelect() as Boolean {
        return onNextPage();
    }
}
