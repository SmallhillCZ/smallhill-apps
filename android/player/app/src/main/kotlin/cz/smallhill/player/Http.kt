package cz.smallhill.player

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class HttpException(val code: Int, val body: String) : IOException("HTTP $code")

object Http {
    fun get(url: String, token: String): String {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.setRequestProperty("Authorization", "Bearer $token")
        return read(connection)
    }

    fun postForm(url: String, form: Map<String, String>): String {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
        val body = form.entries.joinToString("&") { (key, value) ->
            "${URLEncoder.encode(key, "UTF-8")}=${URLEncoder.encode(value, "UTF-8")}"
        }
        connection.outputStream.use { it.write(body.toByteArray()) }
        return read(connection)
    }

    private fun read(connection: HttpURLConnection): String {
        connection.connectTimeout = 15_000
        connection.readTimeout = 30_000
        try {
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) throw HttpException(code, body)
            return body
        } finally {
            connection.disconnect()
        }
    }
}
