import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

class TicketsApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Dictionary?) as Void {
        Store.sync();
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        var view = new PagesView();
        return [view, new PagesDelegate(view)];
    }
}
