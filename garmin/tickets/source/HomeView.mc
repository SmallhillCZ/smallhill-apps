import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

class HomeView extends WatchUi.View {
    var index as Number = 0;

    function initialize() {
        View.initialize();
    }

    function onShow() as Void {
        Store.listener = method(:changed);
    }

    function onHide() as Void {
        Store.listener = null;
    }

    function changed() as Void {
        var count = Store.tickets().size();
        if (index >= count) {
            index = count > 0 ? count - 1 : 0;
        }
        WatchUi.requestUpdate();
    }

    function onUpdate(dc as Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        if (Store.session() == null) {
            dc.setColor(0xe64980, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h / 2 - 24, Graphics.FONT_MEDIUM, WatchUi.loadResource(Rez.Strings.SignIn), center);
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h / 2 + 24, Graphics.FONT_XTINY, WatchUi.loadResource(Rez.Strings.SignInHint), center);
            return;
        }
        var tickets = Store.tickets();
        if (tickets.size() == 0) {
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h / 2, Graphics.FONT_SMALL, WatchUi.loadResource(Rez.Strings.NoTickets), center);
        } else {
            var t = tickets[index] as Dictionary;
            dc.setColor(0xe64980, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h * 0.2, Graphics.FONT_XTINY, (index + 1) + " / " + tickets.size(), center);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            var name = Graphics.fitTextToArea(t["name"] as String, Graphics.FONT_MEDIUM, w * 0.8, h * 0.36, true);
            dc.drawText(w / 2, h * 0.45, Graphics.FONT_MEDIUM, name, center);
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            var when = Graphics.fitTextToArea(Format.start(t), Graphics.FONT_XTINY, w * 0.75, h * 0.14, true);
            dc.drawText(w / 2, h * 0.68, Graphics.FONT_XTINY, when, center);
        }
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.84, Graphics.FONT_XTINY, status(), center);
    }

    function status() as String {
        if (Store.syncing) {
            return WatchUi.loadResource(Rez.Strings.Syncing) as String;
        }
        var saved = Store.savedAt();
        var text = saved == null ? "" : WatchUi.loadResource(Rez.Strings.Updated) + " " + Format.time(saved);
        if (Store.failed) {
            return WatchUi.loadResource(Rez.Strings.Offline) as String;
        }
        return text;
    }
}

class HomeDelegate extends WatchUi.BehaviorDelegate {
    var view as HomeView;

    function initialize(v as HomeView) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onSelect() as Boolean {
        if (Store.session() == null) {
            Store.signIn();
            return true;
        }
        var tickets = Store.tickets();
        if (tickets.size() > 0) {
            var qr = new QrView(tickets[view.index] as Dictionary);
            WatchUi.pushView(qr, new QrDelegate(qr), WatchUi.SLIDE_LEFT);
        }
        return true;
    }

    function onNextPage() as Boolean {
        if (view.index + 1 < Store.tickets().size()) {
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

    function onMenu() as Boolean {
        if (Store.session() == null) {
            return false;
        }
        var menu = new WatchUi.Menu2({:title => Rez.Strings.AppName});
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.Refresh, null, :refresh, {}));
        menu.addItem(new WatchUi.MenuItem(Rez.Strings.SignOut, null, :signOut, {}));
        WatchUi.pushView(menu, new MainMenuDelegate(), WatchUi.SLIDE_UP);
        return true;
    }
}

class MainMenuDelegate extends WatchUi.Menu2InputDelegate {
    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        WatchUi.popView(WatchUi.SLIDE_DOWN);
        if (item.getId() == :refresh) {
            Store.sync();
        } else {
            Store.signOut();
        }
    }
}
