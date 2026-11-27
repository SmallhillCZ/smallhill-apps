import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;

module Format {
    function start(ticket as Dictionary) as String {
        var s = ticket["start"] as String?;
        if (s == null || s.length() < 16) {
            return ticket["venue"] as String;
        }
        var text = s.substring(8, 10) + "." + s.substring(5, 7) + ".";
        if (ticket["hasTime"] == true) {
            text += " " + s.substring(11, 16);
        }
        var venue = ticket["venue"] as String?;
        return venue == null || venue.length() == 0 ? text : text + " · " + venue;
    }

    function time(value as Number) as String {
        var info = Gregorian.info(new Time.Moment(value), Time.FORMAT_SHORT);
        return info.day + "." + info.month + ". " + info.hour.format("%02d") + ":" + info.min.format("%02d");
    }
}
