import Toybox.Application;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.Time;

module Store {
    const BASE_URL = "https://apps.smallhill.cz/tickets/api/watch";
    const RESULT_URL = "https://localhost/smallhill-tickets";

    var syncing as Boolean = false;
    var failed as Boolean = false;
    var listener as Method? = null;

    function session() as String? {
        return Application.Storage.getValue("session") as String?;
    }

    function tickets() as Array {
        var t = Application.Storage.getValue("tickets");
        return t == null ? [] : t as Array;
    }

    function savedAt() as Number? {
        return Application.Storage.getValue("savedAt") as Number?;
    }

    function notify() as Void {
        if (listener != null) {
            listener.invoke();
        }
    }

    function signIn() as Void {
        Communications.registerForOAuthMessages(new Method(Store, :onOAuth));
        Communications.makeOAuthRequest(BASE_URL + "/login", {}, RESULT_URL, Communications.OAUTH_RESULT_TYPE_URL, {"session" => "session"});
    }

    function onOAuth(message as Communications.OAuthMessage) as Void {
        var data = message.data;
        if (data != null && data["session"] != null) {
            Application.Storage.setValue("session", data["session"]);
            sync();
        }
        notify();
    }

    function signOut() as Void {
        Application.Storage.clearValues();
        notify();
    }

    function sync() as Void {
        var s = session();
        if (s == null || syncing) {
            return;
        }
        syncing = true;
        failed = false;
        Communications.makeWebRequest(BASE_URL + "/tickets", null, {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => {"x-goout-session" => s},
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        }, new Method(Store, :onTickets));
        notify();
    }

    function onTickets(code as Number, data as Dictionary or String or Null) as Void {
        syncing = false;
        if (code == 200 && data instanceof Dictionary) {
            Application.Storage.setValue("tickets", data["tickets"]);
            Application.Storage.setValue("savedAt", Time.now().value());
            if (data["session"] != null) {
                Application.Storage.setValue("session", data["session"]);
            }
        } else if (code == 401) {
            Application.Storage.deleteValue("session");
        } else {
            failed = true;
        }
        notify();
    }
}
